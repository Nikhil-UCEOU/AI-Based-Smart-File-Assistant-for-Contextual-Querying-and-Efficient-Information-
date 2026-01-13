const { Chat, ChatMessage } = require('../models/Chat');
const User = require('../models/User');
const chatService = require('../services/newChatService');

class NewChatController {
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
        data: { chat: chat.toJSON() }
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
        data: { chats: chats.map(chat => chat.toJSON()) }
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

      if (!message?.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
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

      // Get user's Pinecone ID
      const user = await User.findById(userId);
      if (!user?.pineconeId) {
        return res.status(400).json({
          success: false,
          error: 'User documents not found'
        });
      }

      // Get chat history for context
      const existingMessages = await ChatMessage.findByChatId(chatId);
      const chatHistory = existingMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Save user message
      const userMessage = await ChatMessage.create({
        chatId: chatId,
        role: 'user',
        content: message.trim()
      });

      console.log(`💬 User ${userId} asked: "${message}"`);

      // Get AI response
      const aiResponse = await chatService.chat(
        user.pineconeId,
        message.trim(),
        chatHistory
      );

      // Save AI response
      const assistantMessage = await ChatMessage.create({
        chatId: chatId,
        role: 'assistant',
        content: aiResponse.response,
        sources: JSON.stringify(aiResponse.sources || [])
      });

      // Update chat title if this is the first message
      if (existingMessages.length === 0) {
        const title = await chatService.generateTitle(message, aiResponse.response);
        await chat.updateTitle(title);
      }

      console.log(`✅ Response generated with ${aiResponse.totalSources} sources`);

      res.json({
        success: true,
        data: {
          userMessage: userMessage.toJSON(),
          assistantMessage: assistantMessage.toJSON(),
          sources: aiResponse.sources,
          hasContext: aiResponse.hasContext,
          totalSources: aiResponse.totalSources
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

      if (!title?.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Title is required'
        });
      }

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
}

const newChatController = new NewChatController();

// Bind methods
Object.getOwnPropertyNames(NewChatController.prototype).forEach(name => {
  if (typeof newChatController[name] === 'function' && name !== 'constructor') {
    newChatController[name] = newChatController[name].bind(newChatController);
  }
});

module.exports = newChatController;