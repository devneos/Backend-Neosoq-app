const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const verifyJWT = require('../middleware/verifyJWT');

router.post('/', verifyJWT, chatController.createConversation);
router.get('/', verifyJWT, chatController.listConversations);
router.get('/:id/messages', verifyJWT, chatController.getMessages);
router.post('/:id/messages', verifyJWT, chatController.postMessage);
router.put('/:id/read', verifyJWT, chatController.markRead);
router.put('/:id/messages/:messageId/read', verifyJWT, chatController.markMessageRead);

module.exports = router;
