/**
 * AIProvider - Abstract interface for AI LLM providers.
 * All providers (HuggingFace, Groq) implement this contract.
 *
 * Architecture:
 *   Android → Backend → AIProvider → (HuggingFace | Groq)
 *   API keys NEVER exposed to client.
 */

class AIProvider {
  constructor(name) {
    this.name = name;
    this.isAvailable = false;
  }

  /**
   * Send a chat completion request.
   * @param {Array} messages - [{role: 'system'|'user'|'assistant', content: string}]
   * @param {Object} options - {temperature, maxTokens, jsonMode}
   * @returns {Promise<{content: string, usage: {promptTokens, completionTokens, totalTokens}, latencyMs: number}>}
   */
  async chatCompletion(messages, options = {}) {
    throw new Error(`chatCompletion not implemented for ${this.name}`);
  }

  /**
   * Health check — is this provider reachable?
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    throw new Error(`healthCheck not implemented for ${this.name}`);
  }

  /**
   * Get provider name.
   */
  getName() {
    return this.name;
  }
}

module.exports = AIProvider;
