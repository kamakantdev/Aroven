/**
 * Groq AI Provider
 * Primary provider for VOICE chat (ultra-low latency).
 * Fallback provider for text when HuggingFace is unavailable.
 * Uses Llama 3.3-70B via Groq API.
 */
const AIProvider = require('./AIProvider');
const config = require('../../config');

class GroqProvider extends AIProvider {
  constructor() {
    super('groq');
    this.apiKey = config.ai?.groqApiKey || process.env.GROQ_API_KEY;
    this.model = 'llama-3.3-70b-versatile';
    this.baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
    this.isAvailable = !!this.apiKey;
  }

  async chatCompletion(messages, options = {}) {
    const {
      temperature = 0.7,
      maxTokens = 800,
      jsonMode = false,
    } = options;

    const startTime = Date.now();

    const body = {
      model: this.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    };

    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    // 30-second timeout to prevent hanging requests
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    let response;
    try {
      response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error('Groq API request timed out after 30s');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    const content = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || {};

    return {
      content,
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      },
      latencyMs,
      provider: this.name,
      model: this.model,
    };
  }

  async healthCheck() {
    // Use Groq /models endpoint instead of wasting tokens on completions
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        signal: controller.signal,
      });
      this.isAvailable = response.ok;
      return this.isAvailable;
    } catch {
      this.isAvailable = false;
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = GroqProvider;
