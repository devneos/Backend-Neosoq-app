const Contract = require('../models/Contract');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Request = require('../models/Request');
const Offer = require('../models/Offer');
const Escrow = require('../models/Escrow');

// GET /contracts - list contracts for current user (as buyer or worker)
const listContracts = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { role, status, page = 1, limit = 20 } = req.query;
    const q = { $or: [{ buyer: userId }, { worker: userId }] };
    if (role === 'buyer') q.$or = [{ buyer: userId }];
    if (role === 'worker') q.$or = [{ worker: userId }];
    if (status) q.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const totalCount = await Contract.countDocuments(q);
    const contracts = await Contract.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('buyer', 'username profileImage email phoneNumber')
      .populate('worker', 'username profileImage email phoneNumber')
      .populate('listingId', 'title images price')
      .populate('requestId', 'title images price')
      .lean();
    const totalPages = Math.ceil(totalCount / Number(limit));
    return res.json({ contracts, page: Number(page), limit: Number(limit), totalCount, totalPages });
  } catch (e) {
    console.error('listContracts', e);
    return res.status(500).json({ error: 'Failed to list contracts' });
  }
};

// GET /contracts/:id - get contract details
const getContract = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const contractId = req.params.id;
    const contract = await Contract.findById(contractId)
      .populate('buyer', 'username profileImage email phoneNumber')
      .populate('worker', 'username profileImage email phoneNumber')
      .populate('listingId', 'title description images price')
      .populate('requestId', 'title description images price')
      .populate('offerId', 'amount message')
      .populate('escrowId')
      .lean();
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    // Only buyer or worker can view
    if (String(contract.buyer._id) !== userId && String(contract.worker._id) !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this contract' });
    }
    return res.json({ contract });
  } catch (e) {
    console.error('getContract', e);
    return res.status(500).json({ error: 'Failed to fetch contract' });
  }
};

// POST /contracts - create a new contract
const createContract = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { buyer, worker, listingId, requestId, offerId, escrowId, amount, description } = req.body;
    if (!buyer || !worker || !amount) return res.status(400).json({ error: 'buyer, worker, and amount are required' });
    const contract = await Contract.create({
      buyer,
      worker,
      listingId,
      requestId,
      offerId,
      escrowId,
      amount,
      description,
      status: 'active',
    });
    const populated = await Contract.findById(contract._id)
      .populate('buyer', 'username profileImage email phoneNumber')
      .populate('worker', 'username profileImage email phoneNumber')
      .lean();
    return res.status(201).json({ contract: populated });
  } catch (e) {
    console.error('createContract', e);
    return res.status(500).json({ error: 'Failed to create contract' });
  }
};

// POST /contracts/:id/complete - mark contract as complete by buyer or worker
const markComplete = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const contractId = req.params.id;
    const contract = await Contract.findById(contractId);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const isBuyer = String(contract.buyer) === userId;
    const isWorker = String(contract.worker) === userId;
    if (!isBuyer && !isWorker) return res.status(403).json({ error: 'Not authorized' });
    if (isBuyer) contract.completedByBuyer = true;
    if (isWorker) contract.completedByWorker = true;
    // If both completed, update status and set completedAt
    if (contract.completedByBuyer && contract.completedByWorker) {
      contract.status = 'completed';
      contract.completedAt = new Date();
      // Optionally trigger escrow release here
      if (contract.escrowId) {
        try {
          const escrow = await Escrow.findById(contract.escrowId);
          if (escrow && escrow.status === 'held') {
            escrow.status = 'released';
            escrow.releasedAt = new Date();
            await escrow.save();
          }
        } catch (err) {
          console.warn('Failed to release escrow:', err);
        }
      }
    }
    await contract.save();
    const populated = await Contract.findById(contract._id)
      .populate('buyer', 'username profileImage')
      .populate('worker', 'username profileImage')
      .lean();
    return res.json({ contract: populated });
  } catch (e) {
    console.error('markComplete', e);
    return res.status(500).json({ error: 'Failed to mark contract as complete' });
  }
};

// POST /contracts/:id/cancel - cancel contract
const cancelContract = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const contractId = req.params.id;
    const { reason } = req.body;
    const contract = await Contract.findById(contractId);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const isBuyer = String(contract.buyer) === userId;
    const isWorker = String(contract.worker) === userId;
    if (!isBuyer && !isWorker) return res.status(403).json({ error: 'Not authorized' });
    contract.status = 'cancelled';
    contract.cancelledBy = userId;
    contract.cancelledAt = new Date();
    if (reason) contract.cancelReason = reason;
    await contract.save();
    return res.json({ contract });
  } catch (e) {
    console.error('cancelContract', e);
    return res.status(500).json({ error: 'Failed to cancel contract' });
  }
};

module.exports = { listContracts, getContract, createContract, markComplete, cancelContract };
