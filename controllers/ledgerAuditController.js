const Wallet = require('../models/Wallet');
const Ledger = require('../models/Ledger');

// GET /admin/ledger-audit - compute mismatch between wallet balances and ledger sums
const ledgerAudit = async (req, res) => {
  try {
    const wallets = await Wallet.find({}).lean();
    const mismatches = [];
    for (const w of wallets) {
      const ledgers = await Ledger.find({ walletId: w._id }).lean();
      const credits = ledgers.filter(l => l.type === 'credit').reduce((s, l) => s + (Number(l.amount) || 0), 0);
      const debits = ledgers.filter(l => l.type === 'debit').reduce((s, l) => s + (Number(l.amount) || 0), 0);
      const calcAvailable = credits - debits; // note: this is a simplified view
      const actual = (w.available || 0) + (w.locked || 0);
      if (Math.abs(actual - calcAvailable) > 0.001) {
        mismatches.push({ walletId: w._id, actual, calcAvailable, available: w.available, locked: w.locked });
      }
    }
    return res.json({ mismatches, count: mismatches.length });
  } catch (e) {
    console.error('ledgerAudit', e);
    return res.status(500).json({ error: 'Failed to run ledger audit' });
  }
};

module.exports = { ledgerAudit };
