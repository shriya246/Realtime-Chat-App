/**
 * Purpose: Registers channel/broadcast routes.
 */

const express = require('express');

const {
  createChannel,
  createPost,
  followChannel,
  getChannel,
  listChannels,
  reactToPost,
  unfollowChannel
} = require('../controllers/channelController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', listChannels);
router.post('/', createChannel);
router.get('/:id', getChannel);
router.post('/:id/follow', followChannel);
router.delete('/:id/follow', unfollowChannel);
router.post('/:id/posts', createPost);
router.post('/:id/posts/:postId/reactions', reactToPost);

module.exports = router;
