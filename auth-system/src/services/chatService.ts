const API_BASE = 'http://localhost:3001/api';

export interface ChatMessage {
  id: number;
  chatId: number;
  role: 'user' | 'assistant';
  content: string;
  sources: DocumentSource[] | string;
  createdAt: string;
}

export interface DocumentSource {
  fileName: string;
  relevanceScore: number;
  preview: string;
}

export interface Chat {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageResponse {
  success: boolean;
  data: {
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
    sources: DocumentSource[];
    hasContext: boolean;
    totalSources: number;
  };
  error?: string;
}

export interface ChatResponse {
  success: boolean;
  data: {
    chat: Chat;
    messages: ChatMessage[];
  };
  error?: string;
}

export interface ChatsResponse {
  success: boolean;
  data: {
    chats: Chat[];
  };
  error?: string;
}

class ChatService {
  private getAuthHeaders() {
    const session = localStorage.getItem('authSession');
    let token = null;
    
    if (session) {
      try {
        const parsedSession = JSON.parse(session);
        token = parsedSession.accessToken;
      } catch (error) {
        console.error('Failed to parse auth session:', error);
      }
    }
    
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  }

  async createChat(title: string = 'New Chat'): Promise<Chat> {
    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ title })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create chat');
      }

      return result.data.chat;
    } catch (error) {
      console.error('Create chat error:', error);
      throw error;
    }
  }

  async getUserChats(): Promise<Chat[]> {
    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result: ChatsResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch chats');
      }

      return result.data.chats;
    } catch (error) {
      console.error('Get user chats error:', error);
      throw error;
    }
  }

  async getChatMessages(chatId: number): Promise<{ chat: Chat; messages: ChatMessage[] }> {
    try {
      const response = await fetch(`${API_BASE}/chat/${chatId}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const result: ChatResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch chat messages');
      }

      return result.data;
    } catch (error) {
      console.error('Get chat messages error:', error);
      throw error;
    }
  }

  async sendMessage(chatId: number, message: string): Promise<SendMessageResponse['data']> {
    try {
      const response = await fetch(`${API_BASE}/chat/${chatId}/messages`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ message })
      });

      const result: SendMessageResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send message');
      }

      return result.data;
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  }

  async deleteChat(chatId: number): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/chat/${chatId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete chat');
      }
    } catch (error) {
      console.error('Delete chat error:', error);
      throw error;
    }
  }

  async updateChatTitle(chatId: number, title: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/chat/${chatId}/title`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ title })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update chat title');
      }
    } catch (error) {
      console.error('Update chat title error:', error);
      throw error;
    }
  }
}

export const chatService = new ChatService();