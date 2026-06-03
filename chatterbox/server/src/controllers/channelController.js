/**
 * Purpose: Implements local channels/broadcast APIs.
 */

const { Channel, CHANNEL_REACTIONS } = require('../models/Channel');
const { forbiddenError, notFoundError, validationError } = require('../utils/errors');

const isChannelAdmin = (channel, userId) =>
  channel.ownerId.toString() === userId || channel.admins.some((adminId) => adminId.toString() === userId);

const formatChannel = (channel, userId = null) => {
  const payload = channel.toJSON();
  payload.avatarUrl = channel.avatarAttachmentId ? `/api/attachments/${channel.avatarAttachmentId.toString()}/content` : null;
  payload.followerCount = channel.followers.length;
  payload.isFollowing = userId ? channel.followers.some((followerId) => followerId.toString() === userId) : false;
  payload.myRole = userId && isChannelAdmin(channel, userId) ? 'admin' : 'follower';
  payload.posts = payload.posts.slice(-25).reverse();
  return payload;
};

const listChannels = async (req, res, next) => {
  try {
    const rawSearch = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const query = rawSearch
      ? { $text: { $search: rawSearch } }
      : {};
    const channels = await Channel.find(query)
      .sort(rawSearch ? { score: { $meta: 'textScore' } } : { updatedAt: -1 })
      .limit(30);

    return res.status(200).json({
      success: true,
      data: {
        channels: channels.map((channel) => formatChannel(channel, req.user.id))
      }
    });
  } catch (error) {
    return next(error);
  }
};

const createChannel = async (req, res, next) => {
  try {
    const { description = '', name } = req.body;

    if (!name || !String(name).trim()) {
      return next(validationError('Channel name is required.', [{ field: 'name', message: 'Channel name is required.' }]));
    }

    const channel = await Channel.create({
      description: String(description).trim(),
      name: String(name).trim(),
      ownerId: req.user._id
    });

    return res.status(201).json({
      success: true,
      data: {
        channel: formatChannel(channel, req.user.id)
      }
    });
  } catch (error) {
    return next(error);
  }
};

const getChannel = async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);

    if (!channel) {
      return next(notFoundError('Channel not found.'));
    }

    return res.status(200).json({
      success: true,
      data: {
        channel: formatChannel(channel, req.user.id)
      }
    });
  } catch (error) {
    return next(error);
  }
};

const followChannel = async (req, res, next) => {
  try {
    const channel = await Channel.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { followers: req.user._id } },
      { new: true }
    );

    if (!channel) {
      return next(notFoundError('Channel not found.'));
    }

    return res.status(200).json({ success: true, data: { channel: formatChannel(channel, req.user.id) } });
  } catch (error) {
    return next(error);
  }
};

const unfollowChannel = async (req, res, next) => {
  try {
    const channel = await Channel.findByIdAndUpdate(
      req.params.id,
      { $pull: { followers: req.user._id } },
      { new: true }
    );

    if (!channel) {
      return next(notFoundError('Channel not found.'));
    }

    return res.status(200).json({ success: true, data: { channel: formatChannel(channel, req.user.id) } });
  } catch (error) {
    return next(error);
  }
};

const createPost = async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);

    if (!channel) {
      return next(notFoundError('Channel not found.'));
    }

    if (!isChannelAdmin(channel, req.user.id)) {
      return next(forbiddenError('Only channel admins can post.'));
    }

    const { content = '', type = 'text' } = req.body;

    if (!String(content).trim()) {
      return next(validationError('Channel post content is required.', [{ field: 'content', message: 'Add post content.' }]));
    }

    channel.posts.push({
      content: String(content).trim(),
      type
    });
    await channel.save();

    return res.status(201).json({
      success: true,
      data: {
        channel: formatChannel(channel, req.user.id),
        post: channel.posts[channel.posts.length - 1].toJSON()
      }
    });
  } catch (error) {
    return next(error);
  }
};

const reactToPost = async (req, res, next) => {
  try {
    const { emoji } = req.body;
    const channel = await Channel.findById(req.params.id);

    if (!channel) {
      return next(notFoundError('Channel not found.'));
    }

    const post = channel.posts.id(req.params.postId);
    if (!post) {
      return next(notFoundError('Channel post not found.'));
    }

    post.reactions = post.reactions.filter((reaction) => reaction.userId.toString() !== req.user.id);
    if (emoji) {
      if (!CHANNEL_REACTIONS.includes(emoji)) {
        return next(validationError('Unsupported reaction emoji.', [{ field: 'emoji', message: 'Use a supported reaction.' }]));
      }
      post.reactions.push({ emoji, userId: req.user._id });
    }
    await channel.save();

    return res.status(200).json({
      success: true,
      data: {
        post: post.toJSON()
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createChannel,
  createPost,
  followChannel,
  formatChannel,
  getChannel,
  listChannels,
  reactToPost,
  unfollowChannel
};
