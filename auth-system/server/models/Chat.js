const database = require('../config/database');

class Chat {
  constructor(chatData) {
    this.id = chatData.id;
    this.userId = chatData.user_id;
    this.title = chatData.title;
    this.createdAt = chatData.created_at;
    this.updatedAt = chatData.updated_at;
  }

  static async create(chatData) {
    const db = database.getDb();
    const { userId, title } = chatData;

    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO chats (user_id, title)
        VALUES (?, ?)
      `;
      
      db.run(query, [userId, title], function(err) {
        if (err) {
          console.error('Chat creation error:', err);
          reject(err);
        } else {
          Chat.findById(this.lastID)
            .then(chat => resolve(chat))
            .catch(reject);
        }
      });
    });
  }

  static async findById(id) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM chats WHERE id = ?';
      
      db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new Chat(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  static async findByUserId(userId, limit = 20) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM chats WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?';
      
      db.all(query, [userId, limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const chats = rows.map(row => new Chat(row));
          resolve(chats);
        }
      });
    });
  }

  async updateTitle(title) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'UPDATE chats SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      
      db.run(query, [title, this.id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async delete() {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM chats WHERE id = ?';
      
      db.run(query, [this.id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      title: this.title,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class ChatMessage {
  constructor(messageData) {
    this.id = messageData.id;
    this.chatId = messageData.chat_id;
    this.role = messageData.role; // 'user' or 'assistant'
    this.content = messageData.content;
    this.sources = messageData.sources ? JSON.parse(messageData.sources) : [];
    this.createdAt = messageData.created_at;
  }

  static async create(messageData) {
    const db = database.getDb();
    const { chatId, role, content, sources = [] } = messageData;

    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO chat_messages (chat_id, role, content, sources)
        VALUES (?, ?, ?, ?)
      `;
      
      db.run(query, [chatId, role, content, JSON.stringify(sources)], function(err) {
        if (err) {
          console.error('Chat message creation error:', err);
          reject(err);
        } else {
          ChatMessage.findById(this.lastID)
            .then(message => resolve(message))
            .catch(reject);
        }
      });
    });
  }

  static async findById(id) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM chat_messages WHERE id = ?';
      
      db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve(new ChatMessage(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  static async findByChatId(chatId) {
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC';
      
      db.all(query, [chatId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const messages = rows.map(row => new ChatMessage(row));
          resolve(messages);
        }
      });
    });
  }

  toJSON() {
    return {
      id: this.id,
      chatId: this.chatId,
      role: this.role,
      content: this.content,
      sources: this.sources,
      createdAt: this.createdAt
    };
  }
}

module.exports = { Chat, ChatMessage };