const Dispute = require('../models/Dispute');

const createDispute = async (req, res) => {
  try {
    const { accusedUser, issueType, description } = req.body;
    if (!accusedUser || !issueType) return res.status(400).json({ error: 'accusedUser and issueType required' });
    const { ensureLocalized } = require('../helpers/translate');
    let localizedDesc = undefined;
    if (description) localizedDesc = await ensureLocalized(description);
    const d = await Dispute.create({ createdBy: req.user?.id, accusedUser, issueType, description: localizedDesc });
    return res.status(201).json({ dispute: d });
  } catch (e) {
    console.error('createDispute', e);
    return res.status(500).json({ error: 'Failed to create dispute' });
  }
};

const getDispute = async (req, res) => {
  try {
    const id = req.params.id;
    const d = await Dispute.findById(id).lean();
    if (!d) return res.status(404).json({ error: 'Not found' });
    return res.json({ dispute: d });
  } catch (e) {
    console.error('getDispute', e);
    return res.status(500).json({ error: 'Failed to fetch dispute' });
  }
};

const listDisputes = async (req, res) => {
  try {
    const docs = await Dispute.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ disputes: docs });
  } catch (e) {
    console.error('listDisputes', e);
    return res.status(500).json({ error: 'Failed to list disputes' });
  }
};

const updateDispute = async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;
    // If description is present, ensure it is stored as localized object
    const { ensureLocalized } = require('../helpers/translate');
    if (data.description) {
      try { data.description = await ensureLocalized(data.description); } catch (e) { /* ignore */ }
    }
    const d = await Dispute.findByIdAndUpdate(id, data, { new: true }).lean();
    return res.json({ dispute: d });
  } catch (e) {
    console.error('updateDispute', e);
    return res.status(500).json({ error: 'Failed to update dispute' });
  }
};

const deleteDispute = async (req, res) => {
  try {
    const id = req.params.id;
    await Dispute.findByIdAndDelete(id);
    return res.json({ success: true });
  } catch (e) {
    console.error('deleteDispute', e);
    return res.status(500).json({ error: 'Failed to delete dispute' });
  }
};

module.exports = { createDispute, getDispute, listDisputes, updateDispute, deleteDispute };
