const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const ctrl = require('../controllers/followController');

router.post('/:userId', verifyJWT, ctrl.followUser);
router.delete('/:userId', verifyJWT, ctrl.unfollowUser);
router.delete('/:userId/follower', verifyJWT, ctrl.removeFollower);
router.get('/:userId/followers', verifyJWT, ctrl.getFollowers);
router.get('/:userId/following', verifyJWT, ctrl.getFollowing);

module.exports = router;
