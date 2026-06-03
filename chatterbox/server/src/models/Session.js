/**
 * Purpose: Tracks active JWT-backed browser sessions for v4 session management.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    createdAt: {
      default: Date.now,
      type: Date
    },
    expiresAt: {
      index: true,
      required: true,
      type: Date
    },
    ipAddress: {
      default: '',
      maxlength: 120,
      type: String
    },
    lastSeenAt: {
      default: Date.now,
      type: Date
    },
    revokedAt: {
      default: null,
      type: Date
    },
    sessionId: {
      default: () => crypto.randomUUID(),
      index: true,
      required: true,
      type: String,
      unique: true
    },
    tokenHash: {
      index: true,
      required: true,
      type: String
    },
    userAgent: {
      default: '',
      maxlength: 300,
      type: String
    },
    userId: {
      index: true,
      ref: 'User',
      required: true,
      type: mongoose.Schema.Types.ObjectId
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.active = !ret.revokedAt && ret.expiresAt > new Date();
        delete ret._id;
        delete ret.__v;
        delete ret.tokenHash;
        return ret;
      }
    }
  }
);

sessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: -1 });

module.exports = mongoose.model('Session', sessionSchema);
