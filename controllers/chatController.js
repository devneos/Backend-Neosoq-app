const Conversation = require('../models/Conversation');
const ChatMessage = require('../models/ChatMessage');
const { createNotification } = require('./notificationsController');

// Create a conversation (participants array)
const createConversation = async (req, res) => {
  const { participants = [], title } = req.body;
  if (!Array.isArray(participants) || participants.length < 1) return res.status(400).json({ message: 'participants required' });
  const conv = await Conversation.create({ participants, title });
  res.status(201).json({ conversation: conv });
};

// List conversations for current user
const listConversations = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const convs = await Conversation.find({ participants: userId }).sort({ updatedAt: -1 }).lean();
  res.json({ conversations: convs });
};

// Get messages for a conversation with pagination
const getMessages = async (req, res) => {
  const { id } = req.params;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const skip = (page - 1) * limit;

  const q = { conversationId: id };
  if (req.query.before) q.createdAt = { $lt: new Date(req.query.before) };
  if (req.query.after) q.createdAt = { $gt: new Date(req.query.after) };

  const total = await ChatMessage.countDocuments(q);
  const msgs = await ChatMessage.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  res.json({ messages: msgs.reverse(), page, limit, total, hasMore: skip + msgs.length < total });
};

// Post a message to conversation
const postMessage = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { id } = req.params; // conversation id
  const { body, attachments } = req.body;
  // Validate attachments metadata if provided
  const safeAttachments = Array.isArray(attachments)
    ? attachments.map(a => ({ url: a.url || a.path || '', filename: a.filename || a.name || '' }))
    : [];

  const msg = await ChatMessage.create({ conversationId: id, sender: userId, body, attachments: safeAttachments });
  // update conversation updatedAt
  await Conversation.findByIdAndUpdate(id, { $set: { updatedAt: new Date() } });
  // Emit via socket if available (socket attached on app)
  try {
    const io = req.app.get('io');
    if (io) io.to(String(id)).emit('message', msg);
  } catch (e) { /* ignore */ }
  // Create notifications for other participants
  try {
    const conv = await Conversation.findById(id).lean();
    if (conv && Array.isArray(conv.participants)) {
      const others = conv.participants.filter(p => String(p) !== String(userId));
      for (const u of others) {
        try {
          await createNotification({ userId: u, actorId: userId, type: 'chat_message', title: 'New message', body: (body || '').slice(0,200), link: `/chat/${id}`, data: { conversationId: id, messageId: msg._id } });
        } catch (e) {}
      }
    }
  } catch (e) { /* ignore */ }
  res.status(201).json({ message: msg });
};

// Mark single message as read by current user
const markMessageRead = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { id, messageId } = req.params; // conversation id, message id
  await ChatMessage.findOneAndUpdate({ _id: messageId, conversationId: id }, { $addToSet: { readBy: userId } });
  res.json({ ok: true });
};

// Mark conversation as read for current user
const markRead = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { id } = req.params;
  await ChatMessage.updateMany({ conversationId: id, readBy: { $ne: userId } }, { $addToSet: { readBy: userId } });
  res.json({ ok: true });
};

module.exports = { createConversation, listConversations, getMessages, postMessage, markRead, markMessageRead };
