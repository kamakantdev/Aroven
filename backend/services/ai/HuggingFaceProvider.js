/**
 * HuggingFace AI Provider
 * Primary provider for TEXT chat (lower cost, good quality).
 * Uses Meta Llama 3.3-70B via HuggingFace Inference Providers (router).
 * 
 * IMPORTANT: Requires a fine-grained HF token with
 * "Make calls to Inference Providers" permission.
 * Generate at: https://huggingface.co/settings/tokens/new?ownUserPermissions=inference.serverless.write&tokenType=fineGrained
 */
const AIProvider = require('./AIProvider');
const config = require('../../config');

class HuggingFaceProvider extends AIProvider {
  constructor() {
    super('huggingface');
    this.apiKey = config.ai?.huggingFaceKey || process.env.HUGGINGFACE_API_KEY;
    this.model = 'meta-llama/Llama-3.3-70B-Instruct';
    // New HF Inference Providers endpoint (OpenAI-compatible)
    this.baseUrl = 'https://router.huggingface.co/v1';
    this.isAvailable = !!this.apiKey;
  }

  async chatCompletion(messages, options = {}) {
    const {
      temperature = 0.7,
      maxTokens = 800,
      jsonMode = false,
    } = options;

    const startTime = Date.now();

    // HuggingFace Inference Providers — OpenAI-compatible chat completions
    const url = `${this.baseUrl}/chat/completions`;

    const body = {
      model: this.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    };

    // If jsonMode requested, add response_format
    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    // 30-second timeout to prevent hanging requests
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    let response;
    try {
      response = await fetch(url, {
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
        throw new Error('HuggingFace API request timed out after 30s');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HuggingFace API error (${response.status}): ${errorText}`);
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
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

module.exports = HuggingFaceProvider;
