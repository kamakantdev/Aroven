/**
 * AIRouter - Intelligent routing between AI providers.
 *
 * Routing rules:
 *   Text message  → HuggingFace (primary) → Groq (fallback)
 *   Voice message → Groq (primary, low latency) → HuggingFace (fallback, text-only)
 *   Emergency     → Rule engine override (no AI needed)
 *
 * Features:
 *   - Automatic failover between providers
 *   - Retry with exponential backoff for JSON parsing failures
 *   - Latency logging for monitoring
 *   - Provider health tracking
 */
const HuggingFaceProvider = require('./HuggingFaceProvider');
const GroqProvider = require('./GroqProvider');
const config = require('../../config');

class AIRouter {
  constructor() {
    this.providers = {
      huggingface: new HuggingFaceProvider(),
      groq: new GroqProvider(),
    };

    // Track failures for circuit breaker pattern
    this.failureCounts = { huggingface: 0, groq: 0 };
    this.circuitBreakerThreshold = 3;
    this.circuitBreakerResetMs = 60000; // 1 minute
    this.circuitBreakerTimers = {};
  }

  /**
   * Route a chat completion to the appropriate provider.
   * @param {Array} messages - Chat messages array
   * @param {Object} options - {messageType: 'text'|'voice', temperature, maxTokens, jsonMode}
   * @returns {Promise<Object>} AI response with provider metadata
   */
  async route(messages, options = {}) {
    const { messageType = 'text' } = options;

    // Determine provider order based on message type
    const providerOrder = this._getProviderOrder(messageType);

    let lastError = null;

    for (const providerName of providerOrder) {
      const provider = this.providers[providerName];

      // Skip if provider is unavailable or circuit breaker is open
      if (!provider || !provider.isAvailable || this._isCircuitOpen(providerName)) {
        continue;
      }

      try {
        const result = await provider.chatCompletion(messages, options);

        // Reset failure count on success
        this.failureCounts[providerName] = 0;

        console.log(`[AIRouter] ${providerName} responded in ${result.latencyMs}ms (${result.usage.totalTokens} tokens)`);

        return result;
      } catch (err) {
        lastError = err;
        this._recordFailure(providerName);
        console.error(`[AIRouter] ${providerName} failed:`, err.message);
      }
    }

    throw lastError || new Error('All AI providers are unavailable');
  }

  /**
   * Route with structured JSON enforcement + retry.
   * Retries up to 2 times if response is not valid JSON.
   */
  async routeWithJsonRetry(messages, options = {}, maxRetries = 2) {
    const jsonOptions = { ...options, jsonMode: true };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.route(messages, jsonOptions);

        // Validate JSON
        const parsed = this._extractJson(result.content);
        if (parsed) {
          return { ...result, parsedContent: parsed };
        }

        // If JSON parsing failed and we have retries left, add instruction
        if (attempt < maxRetries) {
          const retryMessage = {
            role: 'user',
            content: 'Your previous response was not valid JSON. Please respond ONLY with a valid JSON object, no markdown or extra text.',
          };
          messages = [...messages, { role: 'assistant', content: result.content }, retryMessage];
          console.log(`[AIRouter] JSON retry attempt ${attempt + 1}/${maxRetries}`);
        }
      } catch (err) {
        if (attempt === maxRetries) throw err;
      }
    }

    throw new Error('Failed to get valid JSON response after retries');
  }

  /**
   * Get provider order based on message type.
   */
  _getProviderOrder(messageType) {
    if (messageType === 'voice') {
      // Voice → Groq (low latency) → HuggingFace fallback
      return ['groq', 'huggingface'];
    }
    // Text → HuggingFace (cost-effective) → Groq fallback
    return ['huggingface', 'groq'];
  }

  /**
   * Extract JSON from a response that might contain markdown or extra text.
   */
  _extractJson(text) {
    if (!text) return null;

    // Try direct parse first
    try {
      return JSON.parse(text);
    } catch { /* continue */ }

    // Try extracting JSON from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch { /* continue */ }
    }

    // Try extracting first JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch { /* continue */ }
    }

    return null;
  }

  /**
   * Record a failure for circuit breaker.
   */
  _recordFailure(providerName) {
    this.failureCounts[providerName]++;

    if (this.failureCounts[providerName] >= this.circuitBreakerThreshold) {
      console.warn(`[AIRouter] Circuit breaker OPEN for ${providerName}`);

      // Auto-reset after cooldown
      if (this.circuitBreakerTimers[providerName]) {
        clearTimeout(this.circuitBreakerTimers[providerName]);
      }
      this.circuitBreakerTimers[providerName] = setTimeout(() => {
        this.failureCounts[providerName] = 0;
        console.log(`[AIRouter] Circuit breaker RESET for ${providerName}`);
      }, this.circuitBreakerResetMs);
    }
  }

  /**
   * Check if circuit breaker is open for a provider.
   */
  _isCircuitOpen(providerName) {
    return this.failureCounts[providerName] >= this.circuitBreakerThreshold;
  }

  /**
   * Get status of all providers.
   */
  getStatus() {
    return Object.entries(this.providers).map(([name, provider]) => ({
      name,
      available: provider.isAvailable,
      circuitOpen: this._isCircuitOpen(name),
      failureCount: this.failureCounts[name],
    }));
  }
}

// Singleton
module.exports = new AIRouter();
