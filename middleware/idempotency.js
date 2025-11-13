const IdempotencyKey = require('../models/IdempotencyKey');

// More robust idempotency middleware: store keys in a dedicated collection.
// If the key exists we short-circuit; otherwise we insert the key atomically and continue.
module.exports = async (req, res, next) => {
  const key = req.headers['idempotency-key'] || req.body?.idempotencyKey || req.query?.idempotencyKey;
  if (!key) return next();

  try {
    // Try to find existing key document
    const doc = await IdempotencyKey.findOne({ key }).lean();
    if (doc) {
      // If a full response was stored previously, replay it
      if (doc.response && doc.response.statusCode) {
        const body = doc.response.body || {};
        return res.status(doc.response.statusCode).json(body);
      }
      // previously used but no stored response: return a generic idempotent hint
      return res.status(200).json({ ok: true, idempotent: true });
    }

    // insert placeholder - will be filled by handler after success
    await IdempotencyKey.create({ key, userId: req.user?.id || null });
    req.idempotencyKey = key;
    return next();
  } catch (e) {
    // If unique constraint triggered by race, try to read stored doc and replay
    if (e && e.code === 11000) {
      try {
        const doc2 = await IdempotencyKey.findOne({ key }).lean();
        if (doc2 && doc2.response && doc2.response.statusCode) {
          return res.status(doc2.response.statusCode).json(doc2.response.body || {});
        }
        return res.status(200).json({ ok: true, idempotent: true });
      } catch (inner) {
        console.warn('idempotency middleware race read error', inner);
        return res.status(200).json({ ok: true, idempotent: true });
      }
    }
    console.warn('idempotency middleware error', e);
    return next();
  }
};
