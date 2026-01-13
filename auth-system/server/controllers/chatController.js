const { Chat, ChatMessage } = require('../models/Chat');
const User = require('../models/User');
const chatService = require('../services/simpleChatService');

class ChatController {
  async createChat(req, res) {
    try {
      const userId = req.user.id;
      const { title = 'New Chat' } = req.body;

      const chat = await Chat.create({
        userId: userId,
        title: title
      });

      res.status(201).json({
        success: true,
        data: {
          chat: chat.toJSON()
        }
      });
    } catch (error) {
      console.error('Create chat error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create chat'
      });
    }
  }

  async getUserChats(req, res) {
    try {
      const userId = req.user.id;
      const chats = await Chat.findByUserId(userId);

      res.json({
        success: true,
        data: {
          chats: chats.map(chat => chat.toJSON())
        }
      });
    } catch (error) {
      console.error('Get user chats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve chats'
      });
    }
  }

  async getChatMessages(req, res) {
    try {
      const userId = req.user.id;
      const chatId = req.params.chatId;

      // Verify chat belongs to user
      const chat = await Chat.findById(chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: 'Chat not found'
        });
      }

      const messages = await ChatMessage.findByChatId(chatId);

      res.json({
        success: true,
        data: {
          chat: chat.toJSON(),
          messages: messages.map(msg => msg.toJSON())
        }
      });
    } catch (error) {
      console.error('Get chat messages error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve chat messages'
      });
    }
  }

  async sendMessage(req, res) {
    try {
      const userId = req.user.id;
      const chatId = req.params.chatId;
      const { message } = req.body;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Message content is required'
        });
      }

      // Verify chat belongs to user
      const chat = await Chat.findById(chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: 'Chat not found'
        });
      }

      // Get user for Pinecone ID
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Get conversation history for context
      const existingMessages = await ChatMessage.findByChatId(chatId);
      const conversationHistory = existingMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Save user message
      const userMessage = await ChatMessage.create({
        chatId: chatId,
        role: 'user',
        content: message.trim()
      });

      // Get AI response with document context
      const aiResponse = await chatService.chatWithDocuments(
        user.pineconeId,
        message.trim(),
        conversationHistory
      );

      // Save AI response with enhanced logging
      const assistantMessage = await ChatMessage.create({
        chatId: chatId,
        role: 'assistant',
        content: aiResponse.response,
        sources: aiResponse.sources
      });

      // Enhanced logging for document-only responses
      chatController.logDocumentOnlyResponse(userId, chatId, message, aiResponse);

      // Update chat title if this is the first message
      if (existingMessages.length === 0) {
        const title = await chatService.generateTitle(message, aiResponse.response);
        await chat.updateTitle(title);
      }

      res.json({
        success: true,
        data: {
          userMessage: userMessage.toJSON(),
          assistantMessage: assistantMessage.toJSON(),
          sources: aiResponse.sources,
          hasContext: aiResponse.hasContext,
          totalSources: aiResponse.totalSources,
          usage: aiResponse.usage,
          // Enhanced response metadata
          queryType: aiResponse.queryType,
          crossDocumentAnalysis: aiResponse.crossDocumentAnalysis,
          searchStrategy: aiResponse.searchStrategy,
          responseQuality: aiResponse.responseQuality
        }
      });

    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send message'
      });
    }
  }

  async deleteChat(req, res) {
    try {
      const userId = req.user.id;
      const chatId = req.params.chatId;

      // Verify chat belongs to user
      const chat = await Chat.findById(chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: 'Chat not found'
        });
      }

      await chat.delete();

      res.json({
        success: true,
        message: 'Chat deleted successfully'
      });
    } catch (error) {
      console.error('Delete chat error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete chat'
      });
    }
  }

  async updateChatTitle(req, res) {
    try {
      const userId = req.user.id;
      const chatId = req.params.chatId;
      const { title } = req.body;

      if (!title || title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Title is required'
        });
      }

      // Verify chat belongs to user
      const chat = await Chat.findById(chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: 'Chat not found'
        });
      }

      await chat.updateTitle(title.trim());

      res.json({
        success: true,
        message: 'Chat title updated successfully'
      });
    } catch (error) {
      console.error('Update chat title error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update chat title'
      });
    }
  }

  /**
   * Log comprehensive information about document-only responses
   * @param {string} userId - User ID
   * @param {string} chatId - Chat ID
   * @param {string} query - User query
   * @param {Object} aiResponse - AI response with metadata
   */
  logDocumentOnlyResponse(userId, chatId, query, aiResponse) {
    try {
      const logData = {
        timestamp: new Date().toISOString(),
        userId: userId,
        chatId: chatId,
        query: {
          text: query,
          type: aiResponse.queryType || 'unknown',
          isAnalytical: aiResponse.crossDocumentAnalysis || false
        },
        response: {
          hasContext: aiResponse.hasContext,
          totalSources: aiResponse.totalSources,
          searchStrategy: aiResponse.searchStrategy || 'standard',
          errorType: aiResponse.errorType || null
        },
        documentUsage: {
          documentsUsed: aiResponse.sources ? new Set(aiResponse.sources.map(s => s.fileName)).size : 0,
          chunksUsed: aiResponse.totalSources || 0,
          avgRelevanceScore: aiResponse.sources && aiResponse.sources.length > 0 
            ? aiResponse.sources.reduce((sum, s) => sum + (s.relevanceScore || 0), 0) / aiResponse.sources.length 
            : 0
        },
        performance: {
          responseGenerated: aiResponse.hasContext,
          crossDocumentAnalysis: aiResponse.crossDocumentAnalysis || false,
          responseQuality: aiResponse.responseQuality || null
        }
      };

      // Log to console with structured format
      console.log('📊 DOCUMENT-ONLY RESPONSE LOG:', JSON.stringify(logData, null, 2));

      // Log specific metrics for monitoring
      if (aiResponse.crossDocumentAnalysis) {
        console.log(`🔍 CROSS-DOCUMENT ANALYSIS: User ${userId} performed ${aiResponse.queryType} analysis using ${logData.documentUsage.documentsUsed} documents`);
      }

      if (aiResponse.errorType) {
        console.log(`⚠️ RESPONSE ERROR: ${aiResponse.errorType} for user ${userId} - Query: "${query.substring(0, 50)}..."`);
      }

      if (aiResponse.hasContext && aiResponse.totalSources > 0) {
        console.log(`✅ SUCCESSFUL DOCUMENT RESPONSE: User ${userId} - ${aiResponse.totalSources} sources used - Avg relevance: ${Math.round(logData.documentUsage.avgRelevanceScore * 100)}%`);
      }

      // Additional logging for quality monitoring
      if (aiResponse.responseQuality) {
        console.log(`📈 RESPONSE QUALITY: Grade ${aiResponse.responseQuality.grade} (${aiResponse.responseQuality.score}/${aiResponse.responseQuality.maxScore}) for user ${userId}`);
      }

    } catch (error) {
      console.error('❌ Failed to log document-only response:', error.message);
      // Don't throw error - logging failure shouldn't break the response
    }
  }
}

const chatController = new ChatController();

// Bind all methods to preserve 'this' context
Object.getOwnPropertyNames(ChatController.prototype).forEach(name => {
  if (typeof chatController[name] === 'function' && name !== 'constructor') {
    chatController[name] = chatController[name].bind(chatController);
  }
});

module.exports = chatController;