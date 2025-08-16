import { get_encoding, TiktokenEncoding } from 'tiktoken';

type TikTokenEncoder = ReturnType<typeof get_encoding>;

export class TokenizerManager {
  private static encoders = new Map<string, TikTokenEncoder>();
  
  /**
   * Get tokenizer for specific model
   */
  private static getEncoder(model: string): TikTokenEncoder {
    // Map model names to encoding types
    let encodingName: string;
    
    if (model.startsWith('gpt-4') || model.startsWith('gpt-3.5')) {
      encodingName = 'cl100k_base'; // GPT-4 and GPT-3.5-turbo
    } else if (model.startsWith('text-davinci') || model.startsWith('text-curie')) {
      encodingName = 'p50k_base'; // Codex models
    } else if (model.startsWith('gemini')) {
      // Gemini uses similar tokenization to GPT-4
      encodingName = 'cl100k_base';
    } else {
      // Default to GPT-4 encoding for unknown models
      encodingName = 'cl100k_base';
    }

    if (!this.encoders.has(encodingName)) {
      this.encoders.set(encodingName, get_encoding(encodingName as TiktokenEncoding));
    }

    return this.encoders.get(encodingName)!;
  }

  /**
   * Count tokens in text for specific model
   */
  static countTokens(text: string, model = 'gpt-4'): number {
    try {
      const encoder = this.getEncoder(model);
      return encoder.encode(text).length;
    } catch (error) {
      // Fallback to character-based estimation if tiktoken fails
      console.warn('Tiktoken failed, falling back to character estimation:', error);
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Estimate tokens for conversation messages
   */
  static countMessageTokens(
    messages: Array<{ role: string; content: string; name?: string }>,
    model = 'gpt-4'
  ): number {
    try {
      const encoder = this.getEncoder(model);
      let totalTokens = 0;

      for (const message of messages) {
        // Every message follows <|start|>{role/name}\n{content}<|end|>\n
        totalTokens += 3; // start, role, end tokens
        
        if (message.name) {
          totalTokens += encoder.encode(message.name).length;
        }
        
        totalTokens += encoder.encode(message.role).length;
        totalTokens += encoder.encode(message.content).length;
      }
      
      totalTokens += 3; // Every reply is primed with <|start|>assistant<|message|>
      
      return totalTokens;
    } catch (error) {
      // Fallback estimation
      console.warn('Tiktoken failed for message counting, falling back to estimation:', error);
      const totalChars = messages.reduce((sum, msg) => 
        sum + msg.content.length + msg.role.length + (msg.name?.length || 0), 0
      );
      return Math.ceil(totalChars / 4) + messages.length * 4; // Add overhead per message
    }
  }

  /**
   * Truncate text to fit within token limit
   */
  static truncateToTokenLimit(text: string, maxTokens: number, model = 'gpt-4'): string {
    try {
      const encoder = this.getEncoder(model);
      const tokens = encoder.encode(text);
      
      if (tokens.length <= maxTokens) {
        return text;
      }
      
      const truncatedTokens = tokens.slice(0, maxTokens);
      return new TextDecoder().decode(encoder.decode(truncatedTokens));
    } catch (error) {
      // Fallback to character-based truncation
      console.warn('Tiktoken failed for truncation, falling back to character estimation:', error);
      const maxChars = maxTokens * 4;
      return text.length <= maxChars ? text : text.substring(0, maxChars);
    }
  }

  /**
   * Get token usage breakdown for debugging
   */
  static getTokenBreakdown(
    text: string, 
    model = 'gpt-4'
  ): { total: number; method: 'tiktoken' | 'fallback'; encoding?: string } {
    try {
      const encoder = this.getEncoder(model);
      const tokens = encoder.encode(text).length;
      
      return {
        total: tokens,
        method: 'tiktoken',
        encoding: model.startsWith('gpt-4') ? 'cl100k_base' : 'p50k_base'
      };
    } catch (error) {
      return {
        total: Math.ceil(text.length / 4),
        method: 'fallback'
      };
    }
  }

  /**
   * Clean up encoders to free memory
   */
  static cleanup(): void {
    for (const encoder of this.encoders.values()) {
      encoder.free();
    }
    this.encoders.clear();
  }
}

// Cleanup on process exit
process.on('exit', () => {
  TokenizerManager.cleanup();
});

process.on('SIGINT', () => {
  TokenizerManager.cleanup();
  process.exit();
});

process.on('SIGTERM', () => {
  TokenizerManager.cleanup();
  process.exit();
});