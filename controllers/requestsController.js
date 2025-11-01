const Request = require('../models/Request');
const { ensureLocalized } = require('../helpers/translate');
const timeAgo = require('../helpers/timeAgo');

const createRequest = async (req, res) => {
  try {
    const { title, description, projectType, pricingType, price } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const t = await ensureLocalized(title);
    const d = await ensureLocalized(description);
    const request = await Request.create({ title: t, description: d, projectType, pricingType, price: price ? Number(price) : undefined, createdBy: req.user?.id });
    const payload = request.toObject();
    payload.timeAgo = timeAgo(request.createdAt);
    return res.status(201).json({ request: payload });
  } catch (e) {
    console.error('createRequest', e);
    return res.status(500).json({ error: 'Failed to create request' });
  }
};

const getRequest = async (req, res) => {
  try {
    const id = req.params.id;
    const lang = req.query.lang || 'en';
    const request = await Request.findById(id).lean();
    if (!request) return res.status(404).json({ error: 'Not found' });
    return res.json({ request: { ...request, title: (request.title && request.title[lang]) ? request.title[lang] : request.title.en, description: (request.description && request.description[lang]) ? request.description[lang] : request.description.en, timeAgo: timeAgo(request.createdAt) } });
  } catch (e) {
    console.error('getRequest', e);
    return res.status(500).json({ error: 'Failed to fetch request' });
  }
};

const listRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const docs = await Request.find({}).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
    const out = docs.map(d => ({ ...d, title: d.title && d.title.en, description: d.description && d.description.en, timeAgo: timeAgo(d.createdAt) }));
    return res.json({ requests: out, page: Number(page), limit: Number(limit) });
  } catch (e) {
    console.error('listRequests', e);
    return res.status(500).json({ error: 'Failed to list requests' });
  }
};

const updateRequest = async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;
    if (data.title) data.title = await ensureLocalized(data.title);
    if (data.description) data.description = await ensureLocalized(data.description);
    const request = await Request.findByIdAndUpdate(id, data, { new: true }).lean();
    if (!request) return res.status(404).json({ error: 'Not found' });
    return res.json({ request });
  } catch (e) {
    console.error('updateRequest', e);
    return res.status(500).json({ error: 'Failed to update request' });
  }
};

const deleteRequest = async (req, res) => {
  try {
    const id = req.params.id;
    await Request.findByIdAndDelete(id);
    return res.json({ success: true });
  } catch (e) {
    console.error('deleteRequest', e);
    return res.status(500).json({ error: 'Failed to delete request' });
  }
};

module.exports = { createRequest, getRequest, listRequests, updateRequest, deleteRequest };
