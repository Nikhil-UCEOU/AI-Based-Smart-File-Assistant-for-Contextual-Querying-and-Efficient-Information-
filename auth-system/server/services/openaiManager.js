const OpenAI = require('openai');

class OpenAIManager {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.rateLimitInfo = {
      requestsPerMinute: 0,
      tokensPerMinute: 0,
      lastReset: Date.now()
    };
  }

  async initialize() {
    try {
      // Validate API key
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }

      if (process.env.OPENAI_API_KEY.length < 20) {
        throw new Error('OPENAI_API_KEY appears to be invalid (too short)');
      }

      // Initialize OpenAI client with optimal configuration
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 60000, // 60 second timeout
        maxRetries: 3,
        defaultHeaders: {
          'User-Agent': 'DocumentChatSystem/1.0'
        }
      });

      // Test the connection
      await this.testConnection();

      this.isReady = true;
      console.log('✅ OpenAI Manager initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ OpenAI Manager initialization failed:', error.message);
      this.isReady = false;
      throw error;
    }
  }

  async testConnection() {
    try {
      console.log('🔄 Testing OpenAI API connection...');

      // Test with a simple models list call instead of expensive embedding/chat calls
      const modelsTest = await this.client.models.list();
      
      if (!modelsTest.data || modelsTest.data.length === 0) {
        throw new Error('Models list test failed');
      }

      console.log('✅ OpenAI API connection verified');
      return true;

    } catch (error) {
      console.error('❌ OpenAI connection test failed:', error.message);
      
      // Provide specific error guidance
      if (error.status === 401) {
        throw new Error('OpenAI API key is invalid or expired. Please check your OPENAI_API_KEY.');
      } else if (error.status === 429) {
        throw new Error('OpenAI rate limit exceeded. Please try again later or upgrade your plan.');
      } else if (error.message?.includes('insufficient_quota')) {
        throw new Error('OpenAI account has insufficient credits. Please add credits to your account.');
      } else if (error.status === 403) {
        throw new Error('OpenAI API access forbidden. Please check your account status.');
      } else {
        throw error;
      }
    }
  }

  async createEmbedding(text, options = {}) {
    if (!this.isReady) {
      throw new Error('OpenAI Manager not initialized');
    }

    try {
      // Update rate limiting info
      this.updateRateLimit();

      // Clean and validate input
      const cleanText = text.trim().substring(0, 8000);
      if (!cleanText) {
        throw new Error('Empty text provided for embedding');
      }

      const response = await this.client.embeddings.create({
        model: options.model || 'text-embedding-3-small',
        input: cleanText,
        dimensions: options.dimensions || 384,
        ...options
      });

      if (!response.data?.[0]?.embedding) {
        throw new Error('Invalid embedding response from OpenAI');
      }

      return {
        embedding: response.data[0].embedding,
        usage: response.usage,
        model: response.model
      };

    } catch (error) {
      console.error('❌ OpenAI embedding creation failed:', error.message);
      throw error;
    }
  }

  async createChatCompletion(messages, options = {}) {
    if (!this.isReady) {
      throw new Error('OpenAI Manager not initialized');
    }

    try {
      // Update rate limiting info
      this.updateRateLimit();

      // Validate messages
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages array is required and cannot be empty');
      }

      const response = await this.client.chat.completions.create({
        model: options.model || 'gpt-3.5-turbo',
        messages: messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.max_tokens || 1500,
        top_p: options.top_p ?? 0.9,
        frequency_penalty: options.frequency_penalty ?? 0.1,
        presence_penalty: options.presence_penalty ?? 0.1,
        ...options
      });

      if (!response.choices?.[0]?.message) {
        throw new Error('Invalid chat completion response from OpenAI');
      }

      return {
        message: response.choices[0].message.content,
        usage: response.usage,
        model: response.model,
        finishReason: response.choices[0].finish_reason
      };

    } catch (error) {
      console.error('❌ OpenAI chat completion failed:', error.message);
      throw error;
    }
  }

  async generateTitle(query, response, options = {}) {
    try {
      const messages = [
        {
          role: 'system',
          content: 'Create a concise, descriptive title (maximum 6 words) for this conversation. Focus on the main topic. Return only the title.'
        },
        {
          role: 'user',
          content: `Question: ${query.substring(0, 200)}\nAnswer: ${response.substring(0, 300)}`
        }
      ];

      const result = await this.createChatCompletion(messages, {
        max_tokens: 20,
        temperature: 0.3,
        ...options
      });

      // Clean up the title
      return result.message
        .replace(/['"]/g, '')
        .replace(/\.$/, '')
        .substring(0, 50)
        .trim();

    } catch (error) {
      console.error('❌ Title generation failed:', error.message);
      
      // Fallback: extract keywords from query
      const keywords = query.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 3);
        
      return keywords.length > 0 ? keywords.join(' ') : 'Chat';
    }
  }

  updateRateLimit() {
    const now = Date.now();
    
    // Reset counters every minute
    if (now - this.rateLimitInfo.lastReset > 60000) {
      this.rateLimitInfo.requestsPerMinute = 0;
      this.rateLimitInfo.tokensPerMinute = 0;
      this.rateLimitInfo.lastReset = now;
    }
    
    this.rateLimitInfo.requestsPerMinute++;
  }

  getRateLimitInfo() {
    return { ...this.rateLimitInfo };
  }

  getStatus() {
    return {
      isReady: this.isReady,
      hasClient: !!this.client,
      rateLimitInfo: this.getRateLimitInfo()
    };
  }

  // Utility method to check if OpenAI is properly configured
  static validateConfiguration() {
    const issues = [];

    if (!process.env.OPENAI_API_KEY) {
      issues.push('OPENAI_API_KEY environment variable is missing');
    } else if (process.env.OPENAI_API_KEY.length < 20) {
      issues.push('OPENAI_API_KEY appears to be invalid (too short)');
    } else if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
      issues.push('OPENAI_API_KEY should start with "sk-"');
    }

    return {
      isValid: issues.length === 0,
      issues: issues
    };
  }
}

// Create singleton instance
const openaiManager = new OpenAIManager();

module.exports = openaiManager;