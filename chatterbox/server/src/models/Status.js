/**
 * Purpose: Stores WhatsApp-style 24-hour user status/story updates.
 */

const mongoose = require('mongoose');

const viewerSchema = new mongoose.Schema(
  {
    viewedAt: {
      default: Date.now,
      type: Date
    },
    viewerId: {
      ref: 'User',
      required: true,
      type: mongoose.Schema.Types.ObjectId
    }
  },
  { _id: false }
);

const statusSchema = new mongoose.Schema(
  {
    attachments: [
      {
        ref: 'Attachment',
        type: mongoose.Schema.Types.ObjectId
      }
    ],
    content: {
      default: '',
      maxlength: 1000,
      trim: true,
      type: String
    },
    expiresAt: {
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: true,
      required: true,
      type: Date
    },
    ownerId: {
      index: true,
      ref: 'User',
      required: true,
      type: mongoose.Schema.Types.ObjectId
    },
    privacy: {
      default: 'everyone',
      enum: ['everyone', 'contacts', 'nobody'],
      type: String
    },
    type: {
      default: 'text',
      enum: ['text', 'image', 'video'],
      type: String
    },
    viewers: {
      default: [],
      type: [viewerSchema]
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

statusSchema.index({ ownerId: 1, createdAt: -1 });
statusSchema.index({ expiresAt: 1, ownerId: 1 });

module.exports = mongoose.model('Status', statusSchema);
