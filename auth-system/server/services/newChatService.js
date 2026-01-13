const OpenAI = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const openaiManager = require('./openaiManager');

class NewChatService {
  constructor() {
    this.openai = null;
    this.pinecone = null;
    this.isReady = false;
    this.init();
  }

  async init() {
    try {
      // Try to initialize OpenAI Manager, but don't fail if it doesn't work
      try {
        await openaiManager.initialize();
        this.openai = openaiManager.client;
        console.log('✅ OpenAI integration enabled');
      } catch (error) {
        console.log('⚠️ OpenAI not available:', error.message);
        console.log('💡 Chat will work with document search only (no AI responses)');
        this.openai = null;
      }

      // Initialize Pinecone
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });

      this.isReady = true;
      console.log('✅ New Chat Service Ready');
    } catch (error) {
      console.error('❌ Chat Service Init Failed:', error.message);
      this.isReady = false;
    }
  }


  async chat(userPineconeId, userMessage, chatHistory = []) {
    if (!this.isReady) {
      return {
        response: "Chat service is initializing. Please try again.",
        sources: [],
        hasContext: false
      };
    }

    try {
      console.log(`🔍 Processing: "${userMessage}" for user: ${userPineconeId}`);

      // 1. Create embedding for user's question
      const embedding = await this.createEmbedding(userMessage);
      
      // 2. Search documents in Pinecone
      const documents = await this.searchDocuments(userPineconeId, embedding);
      
      // 3. Build context from found documents
      const context = this.buildDocumentContext(documents);
      
      // 4. Generate AI response using OpenAI
      const aiResponse = await this.generateAIResponse(userMessage, context, chatHistory);
      
      return {
        response: aiResponse,
        sources: this.formatSources(documents),
        hasContext: documents.length > 0,
        totalSources: documents.length
      };

    } catch (error) {
      console.error('❌ Chat Error:', error.message);
      return {
        response: `Sorry, I encountered an error: ${error.message}`,
        sources: [],
        hasContext: false
      };
    }
  }

  async createEmbedding(text) {
    // Check if OpenAI is available
    if (!this.openai) {
      console.log('🔄 OpenAI not available, using fallback embedding');
      return this.createFallbackEmbedding(text);
    }
    
    try {
      console.log(`🔄 Creating embedding for: "${text.substring(0, 50)}..."`);
      
      const result = await openaiManager.createEmbedding(text);
      
      console.log('✅ Embedding created successfully');
      return result.embedding;
      
    } catch (error) {
      console.error('❌ OpenAI Embedding creation failed:', error.message);
      
      // Enhanced fallback embedding system
      return this.createFallbackEmbedding(text);
    }
  }

  createFallbackEmbedding(text) {
    console.log('🔄 Using fallback embedding system');
    
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0);
    
    // Create a more sophisticated embedding based on word patterns
    words.forEach((word, wordIndex) => {
      // Skip very short words
      if (word.length < 2) return;
      
      // Create multiple hash positions for each word
      for (let i = 0; i < Math.min(word.length, 10); i++) {
        const charCode = word.charCodeAt(i);
        const position1 = (wordIndex * 37 + i * 17 + charCode) % 384;
        const position2 = (wordIndex * 23 + i * 13 + charCode * 7) % 384;
        
        embedding[position1] += (charCode / 255) - 0.5;
        embedding[position2] += (charCode / 127) - 1.0;
      }
      
      // Add word length and position information
      const lengthPos = (word.length * 31 + wordIndex * 7) % 384;
      embedding[lengthPos] += word.length / 20.0;
    });
    
    // Normalize the embedding vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    console.log('✅ Fallback embedding created');
    return embedding;
  }

  async searchDocuments(userPineconeId, embedding) {
    try {
      const index = this.pinecone.index(userPineconeId);
      
      const results = await index.query({
        vector: embedding,
        topK: 8,
        includeMetadata: true
      });

      return results.matches || [];
    } catch (error) {
      console.error('❌ Pinecone Search Error:', error.message);
      return [];
    }
  }

  buildDocumentContext(documents) {
    if (documents.length === 0) {
      return "No relevant documents found.";
    }

    let context = "DOCUMENT CONTEXT:\n\n";
    
    documents.forEach((doc, index) => {
      const fileName = doc.metadata?.fileName || 'Unknown Document';
      const text = doc.metadata?.text || '';
      const score = Math.round(doc.score * 100);
      
      // Include documents even with lower scores if they contain text
      if (text.trim().length > 0) {
        context += `[Document ${index + 1}: ${fileName} (Relevance: ${score}%)]\n`;
        context += `${text}\n\n`;
      }
    });

    return context;
  }

  async generateAIResponse(userMessage, documentContext, chatHistory) {
    // Check if OpenAI is available
    if (!this.openai) {
      console.log('🔄 OpenAI not available, providing document-based response');
      return this.generateFallbackResponse(userMessage, documentContext);
    }
    
    try {
      const systemPrompt = `You are an intelligent document assistant specialized in analyzing and answering questions based on provided documents.

CORE CAPABILITIES:
1. Document Analysis: Extract and interpret information from provided documents
2. Cross-Reference: Find connections and patterns across multiple documents
3. Legal/Technical Understanding: Handle specialized terminology and concepts
4. Contextual Reasoning: Make logical inferences from document content

RESPONSE GUIDELINES:
1. PRIMARY: Use information from the provided documents to answer questions
2. RELEVANCE: If documents contain relevant information, use it even if not a perfect match
3. INFERENCE: Make reasonable connections and inferences from document content
4. COMPARISON: Analyze similarities, differences, and relationships in the data
5. CITATION: Quote or reference specific parts from documents when answering
6. CLARITY: Provide clear, well-structured responses
7. FALLBACK: Only say "I don't have information about that" if truly no relevant content exists

DOCUMENT ANALYSIS APPROACH:
- Look for keywords, concepts, and related terms
- Consider context and legal/technical meanings
- Extract relevant sections even if not exact matches
- Synthesize information from multiple sources

${documentContext}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.slice(-6), // Keep last 6 messages for better context
        { role: 'user', content: userMessage }
      ];

      console.log('🤖 Generating AI response...');

      const result = await openaiManager.createChatCompletion(messages, {
        temperature: 0.2,
        max_tokens: 1500,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      });

      console.log('✅ AI response generated successfully');
      return result.message;

    } catch (error) {
      console.error('❌ OpenAI response generation failed:', error.message);
      
      // Fallback to document-based response
      return this.generateFallbackResponse(userMessage, documentContext);
    }
  }

  generateFallbackResponse(userMessage, documentContext) {
    console.log('🔄 Generating fallback response based on document content');
    
    if (!documentContext || documentContext === "No relevant documents found.") {
      return "I don't have any relevant documents to answer your question. Please upload documents related to your query.";
    }
    
    // Extract document content
    const documents = documentContext.split('[Document ').slice(1);
    
    if (documents.length === 0) {
      return "I found some documents but couldn't extract relevant information. Please try rephrasing your question.";
    }
    
    // Simple keyword matching and response generation
    const queryWords = userMessage.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    let bestMatch = '';
    let bestScore = 0;
    
    documents.forEach(doc => {
      const content = doc.toLowerCase();
      let score = 0;
      
      queryWords.forEach(word => {
        if (content.includes(word)) {
          score += 1;
        }
      });
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = doc;
      }
    });
    
    if (bestScore > 0) {
      // Extract the text content from the best matching document
      const textStart = bestMatch.indexOf('\n') + 1;
      const textEnd = bestMatch.lastIndexOf('\n\n');
      const text = bestMatch.substring(textStart, textEnd > textStart ? textEnd : undefined);
      
      return `Based on your documents, here's what I found:\n\n${text.substring(0, 800)}${text.length > 800 ? '...' : ''}\n\n(Note: AI processing is currently unavailable, showing direct document content)`;
    }
    
    return "I found relevant documents but couldn't match them to your specific question. Please try using more specific keywords or check the source documents directly.";
  }

  formatSources(documents) {
    return documents.map((doc, index) => ({
      fileName: doc.metadata?.fileName || 'Unknown',
      relevanceScore: Math.round(doc.score * 100),
      preview: doc.metadata?.text?.substring(0, 150) + '...' || 'No preview'
    }));
  }

  async generateTitle(query, response) {
    if (!this.openai) {
      // Simple fallback title generation
      const words = query.split(' ').slice(0, 4).join(' ');
      return words || 'Chat';
    }
    
    try {
      return await openaiManager.generateTitle(query, response);
    } catch (error) {
      console.error('❌ Title generation failed:', error.message);
      
      // Fallback: create title from query keywords
      const keywords = query.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 3);
        
      return keywords.length > 0 ? keywords.join(' ') : 'Chat';
    }
  }
}

module.exports = new NewChatService();