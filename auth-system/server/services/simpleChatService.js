const OpenAI = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');

class SimpleChatService {
  constructor() {
    this.openai = null;
    this.pinecone = null;
    this.isEnabled = false;
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize OpenAI
      if (!process.env.OPENAI_API_KEY) {
        console.log('❌ OpenAI API key not configured');
        return;
      }

      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Initialize Pinecone
      if (!process.env.PINECONE_API_KEY) {
        console.log('❌ Pinecone API key not configured');
        return;
      }

      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });

      this.isEnabled = true;
      console.log('✅ Simple chat service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize simple chat service:', error.message);
      this.isEnabled = false;
    }
  }

  async chatWithDocuments(userPineconeId, query, conversationHistory = []) {
    if (!this.isEnabled) {
      return {
        response: 'Chat service is not available. Please check API configuration.',
        sources: [],
        totalSources: 0,
        hasContext: false,
        error: 'Service not enabled'
      };
    }

    try {
      console.log(`🔍 Searching documents for user: ${userPineconeId}`);
      console.log(`📝 Query: "${query}"`);

      // Step 1: Generate embedding for the query
      const queryEmbedding = await this.generateQueryEmbedding(query);
      if (!queryEmbedding) {
        throw new Error('Failed to generate query embedding');
      }

      // Step 2: Search Pinecone for relevant documents
      const searchResults = await this.searchPinecone(userPineconeId, queryEmbedding);
      console.log(`📊 Found ${searchResults.matches?.length || 0} document matches`);

      // Step 3: Build context from search results
      const contextBlocks = this.buildContext(searchResults.matches || []);
      console.log(`📄 Built context from ${contextBlocks.length} chunks`);

      // Step 4: Generate response with OpenAI
      const response = await this.generateResponse(query, contextBlocks, conversationHistory);

      return {
        response: response,
        sources: this.extractSources(contextBlocks),
        totalSources: contextBlocks.length,
        hasContext: contextBlocks.length > 0,
        searchResults: searchResults.matches?.length || 0
      };

    } catch (error) {
      console.error('❌ Chat error:', error.message);
      return {
        response: `I encountered an error: ${error.message}. Please try again.`,
        sources: [],
        totalSources: 0,
        hasContext: false,
        error: error.message
      };
    }
  }

  async generateQueryEmbedding(query) {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: query,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ Embedding generation failed:', error.message);
      return null;
    }
  }

  async searchPinecone(userPineconeId, queryEmbedding) {
    try {
      const index = this.pinecone.index(userPineconeId);
      
      const searchResults = await index.query({
        vector: queryEmbedding,
        topK: 10,
        includeMetadata: true,
        includeValues: false
      });

      return searchResults;
    } catch (error) {
      console.error('❌ Pinecone search failed:', error.message);
      return { matches: [] };
    }
  }

  buildContext(matches) {
    const contextBlocks = [];
    
    matches.forEach((match, index) => {
      if (match.metadata && match.metadata.text) {
        contextBlocks.push({
          source: match.metadata.fileName || 'Unknown',
          text: match.metadata.text,
          score: match.score,
          chunkIndex: match.metadata.chunkIndex || index
        });
      }
    });

    return contextBlocks.slice(0, 5); // Limit to top 5 chunks
  }

  async generateResponse(query, contextBlocks, conversationHistory) {
    try {
      let systemPrompt = `You are a helpful assistant that answers questions based on uploaded documents.

INSTRUCTIONS:
- Use ONLY the provided document context to answer questions
- If the documents don't contain the answer, say so clearly
- Quote relevant parts from the documents
- Be helpful and provide insights based on the document content
- Support comparisons, calculations, and analysis using the document data

DOCUMENT CONTEXT:`;

      if (contextBlocks.length === 0) {
        systemPrompt += "\nNo relevant documents found for this query.";
      } else {
        contextBlocks.forEach((block, index) => {
          systemPrompt += `\n\n[Document ${index + 1}: ${block.source}]
${block.text}`;
        });
      }

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-6), // Keep last 6 messages for context
        { role: 'user', content: query }
      ];

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.3,
        max_tokens: 1500
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('❌ OpenAI response generation failed:', error.message);
      throw error;
    }
  }

  extractSources(contextBlocks) {
    return contextBlocks.map(block => ({
      fileName: block.source,
      chunkIndex: block.chunkIndex,
      relevanceScore: block.score,
      preview: block.text.substring(0, 100) + '...'
    }));
  }

  async generateTitle(query, response) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Generate a short, descriptive title (max 6 words) for this conversation. Return only the title.'
          },
          {
            role: 'user',
            content: `Query: ${query}\n\nResponse: ${response.substring(0, 200)}...`
          }
        ],
        temperature: 0.3,
        max_tokens: 20
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('Title generation failed:', error);
      return query.split(' ').slice(0, 4).join(' ') + '...';
    }
  }
}

module.exports = new SimpleChatService();