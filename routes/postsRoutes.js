const express = require('express');
const router = express.Router();
const { createPost, getPost, listPosts, updatePost, deletePost } = require('../controllers/postsController');
const verifyJWT = require('../middleware/verifyJWT');

// Create post (message + optional files metadata uploaded via /uploads/attach)
router.post('/', verifyJWT, createPost);

// List posts (public)
router.get('/', listPosts);

// Get single post
router.get('/:id', getPost);

// Update post (owner only)
router.put('/:id', verifyJWT, updatePost);

// Delete post (owner only)
router.delete('/:id', verifyJWT, deletePost);

module.exports = router;
