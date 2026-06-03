/**
 * Purpose: Stores simple WhatsApp-style channels and broadcast posts.
 */

const mongoose = require('mongoose');

const CHANNEL_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const channelReactionSchema = new mongoose.Schema(
  {
    createdAt: {
      default: Date.now,
      type: Date
    },
    emoji: {
      enum: CHANNEL_REACTIONS,
      required: true,
      type: String
    },
    userId: {
      ref: 'User',
      required: true,
      type: mongoose.Schema.Types.ObjectId
    }
  },
  { _id: false }
);

const channelPostSchema = new mongoose.Schema(
  {
    attachments: [
      {
        ref: 'Attachment',
        type: mongoose.Schema.Types.ObjectId
      }
    ],
    content: {
      default: '',
      maxlength: 2000,
      trim: true,
      type: String
    },
    createdAt: {
      default: Date.now,
      type: Date
    },
    reactions: {
      default: [],
      type: [channelReactionSchema]
    },
    type: {
      default: 'text',
      enum: ['text', 'image', 'video', 'file'],
      type: String
    }
  },
  { timestamps: false }
);

const channelSchema = new mongoose.Schema(
  {
    admins: [
      {
        ref: 'User',
        type: mongoose.Schema.Types.ObjectId
      }
    ],
    avatarAttachmentId: {
      default: null,
      ref: 'Attachment',
      type: mongoose.Schema.Types.ObjectId
    },
    description: {
      default: '',
      maxlength: 240,
      trim: true,
      type: String
    },
    followers: [
      {
        ref: 'User',
        type: mongoose.Schema.Types.ObjectId
      }
    ],
    name: {
      maxlength: 80,
      required: true,
      trim: true,
      type: String
    },
    ownerId: {
      index: true,
      ref: 'User',
      required: true,
      type: mongoose.Schema.Types.ObjectId
    },
    posts: {
      default: [],
      type: [channelPostSchema]
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

channelSchema.index({ name: 'text', description: 'text' });
channelSchema.index({ followers: 1, updatedAt: -1 });

channelSchema.pre('validate', function ensureOwnerDefaults(next) {
  if (this.ownerId) {
    const ownerId = this.ownerId.toString();

    if (!this.admins.some((adminId) => adminId.toString() === ownerId)) {
      this.admins.push(this.ownerId);
    }

    if (!this.followers.some((followerId) => followerId.toString() === ownerId)) {
      this.followers.push(this.ownerId);
    }
  }

  next();
});

module.exports = {
  Channel: mongoose.model('Channel', channelSchema),
  CHANNEL_REACTIONS
};
