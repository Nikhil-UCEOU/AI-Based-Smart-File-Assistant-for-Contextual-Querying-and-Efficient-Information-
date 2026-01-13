const express = require('express');
const chatController = require('../controllers/newChatController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All chat routes require authentication
router.use(authenticateToken);

// Chat management routes
router.post('/', chatController.createChat);
router.get('/', chatController.getUserChats);
router.get('/:chatId', chatController.getChatMessages);
router.delete('/:chatId', chatController.deleteChat);
router.put('/:chatId/title', chatController.updateChatTitle);

// Message routes
router.post('/:chatId/messages', chatController.sendMessage);

module.exports = router;