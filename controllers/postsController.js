const Post = require('../models/Post');
const User = require('../models/User');
const { ensureLocalized } = require('../helpers/translate');
const timeAgo = require('../helpers/timeAgo');

const buildUserSummary = async (userId) => {
  if (!userId) return null;
  const u = await User.findById(userId).select('username profileImage roles position country region rating ratingCount sellerType').lean();
  if (!u) return null;
  return {
    id: u._id,
    username: u.username,
    profileImage: u.profileImage || null,
    roles: u.roles || [],
    position: u.position || null,
    country: u.country || null,
    region: u.region || null,
    rating: u.rating || 5.0,
    ratingCount: u.ratingCount || 0,
    sellerType: u.sellerType || 'seller',
  };
};

const createPost = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    const m = await ensureLocalized(message);

    // accept files metadata array in body.files (uploaded via /uploads/attach)
    let files = [];
    if (req.body.files) {
      try { files = typeof req.body.files === 'string' ? JSON.parse(req.body.files) : req.body.files; } catch (e) { files = req.body.files; }
    }

    const post = await Post.create({ message: m, files, createdBy: req.user?.id });
    const payload = post.toObject();
    payload.timeAgo = timeAgo(post.createdAt);
    payload.user = await buildUserSummary(post.createdBy);
    return res.status(201).json({ post: payload });
  } catch (e) {
    console.error('createPost', e);
    return res.status(500).json({ error: 'Failed to create post' });
  }
};

const getPost = async (req, res) => {
  try {
    const id = req.params.id;
    const post = await Post.findById(id).lean();
    if (!post) return res.status(404).json({ error: 'Not found' });
    const user = await buildUserSummary(post.createdBy);
    return res.json({ post: { ...post, timeAgo: timeAgo(post.createdAt), user } });
  } catch (e) {
    console.error('getPost', e);
    return res.status(500).json({ error: 'Failed to fetch post' });
  }
};

const listPosts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const docs = await Post.find({}).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
    const userIds = docs.map(d => d.createdBy).filter(Boolean);
    const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select('username profileImage roles position country region rating ratingCount sellerType').lean() : [];
    const usersById = users.reduce((acc, u) => {
      acc[String(u._id)] = {
        id: u._id,
        username: u.username,
        profileImage: u.profileImage || null,
        roles: u.roles || [],
        position: u.position || null,
        country: u.country || null,
        region: u.region || null,
        rating: u.rating || 5.0,
        ratingCount: u.ratingCount || 0,
        sellerType: u.sellerType || 'seller',
      };
      return acc;
    }, {});
    const out = docs.map(d => ({
      ...d,
      message: d.message || { en: '', ar: '' },
      timeAgo: timeAgo(d.createdAt),
      user: d.createdBy ? usersById[String(d.createdBy)] || null : null,
    }));
    return res.json({ posts: out, page: Number(page), limit: Number(limit) });
  } catch (e) {
    console.error('listPosts', e);
    return res.status(500).json({ error: 'Failed to list posts' });
  }
};

const updatePost = async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body || {};
    if (data.message) data.message = await ensureLocalized(data.message);

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (String(post.createdBy) !== String(req.user?.id)) return res.status(403).json({ error: 'Not allowed' });

    // removedFiles handling
    let removed = data.removedFiles || data.removed || null;
    if (removed) {
      if (typeof removed === 'string') {
        try { removed = JSON.parse(removed); } catch (e) { removed = removed.split(',').map(s => s.trim()).filter(Boolean); }
      }
      if (Array.isArray(removed) && removed.length) {
        const { destroyFile } = require('../helpers/cloudinary');
        for (const r of removed) {
          const match = post.files.find(f => f.urlSrc === r || f.filename === r || f.originalname === r);
          if (match && match.publicId) {
            try { await destroyFile(match.publicId); } catch (e) { /* ignore */ }
          }
        }
        post.files = post.files.filter(f => !removed.includes(f.urlSrc) && !removed.includes(f.filename) && !removed.includes(f.originalname));
      }
    }

    // new files metadata
    let newFiles = [];
    if (data.files) {
      try { newFiles = typeof data.files === 'string' ? JSON.parse(data.files) : data.files; } catch (e) { newFiles = data.files; }
    }
    if (Array.isArray(newFiles) && newFiles.length) post.files.push(...newFiles);

    // apply other updates
    Object.keys(data).forEach(k => {
      if (['removedFiles','removed','files'].includes(k)) return;
      post[k] = data[k];
    });

    await post.save();
    return res.json({ post: post.toObject() });
  } catch (e) {
    console.error('updatePost', e);
    return res.status(500).json({ error: 'Failed to update post' });
  }
};

const deletePost = async (req, res) => {
  try {
    const id = req.params.id;
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (String(post.createdBy) !== String(req.user?.id)) return res.status(403).json({ error: 'Not allowed' });

    // destroy remote files if any
    const { destroyFile } = require('../helpers/cloudinary');
    if (Array.isArray(post.files) && post.files.length) {
      for (const f of post.files) {
        if (f && f.publicId) {
          try { await destroyFile(f.publicId); } catch (e) { /* ignore */ }
        }
      }
    }

    await post.remove();
    return res.json({ success: true });
  } catch (e) {
    console.error('deletePost', e);
    return res.status(500).json({ error: 'Failed to delete post' });
  }
};

module.exports = { createPost, getPost, listPosts, updatePost, deletePost };
