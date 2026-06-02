/**
 * Purpose: Defines one-to-one direct conversations between exactly two users.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Builds the stable uniqueness key for a direct conversation.
 *
 * @param {Array<object|string>} participantIds - User identifiers.
 * @returns {string} Sorted participant key.
 */
const buildParticipantKey = (participantIds) =>
  participantIds.map((participantId) => participantId.toString()).sort().join(':');

const conversationSettingSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    pinned: {
      type: Boolean,
      default: false
    },
    archived: {
      type: Boolean,
      default: false
    },
    muted: {
      type: Boolean,
      default: false
    },
    locked: {
      type: Boolean,
      default: false
    },
    unlockedUntil: {
      type: Date,
      default: null
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    lastMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },
    lastMessagePreview: {
      type: String,
      default: '',
      maxlength: 160
    },
    lastMessageAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    settings: {
      type: [conversationSettingSchema],
      default: []
    },
    disappearingMode: {
      type: String,
      enum: ['off', '24h', '7d', '90d'],
      default: 'off'
    },
    encryptedModeEnabled: {
      type: Boolean,
      default: false,
      required: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
        delete returnedObject.__v;
        return returnedObject;
      }
    },
    toObject: {
      virtuals: true
    }
  }
);

conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index({ lastMessageAt: -1 });

/**
 * Enforces the direct-message invariant and prepares the uniqueness key.
 *
 * @param {Function} next - Mongoose middleware continuation.
 * @returns {void} Continues validation.
 */
conversationSchema.pre('validate', function validateDirectConversation(next) {
  const participantIds = [...new Set((this.participants || []).map((participantId) => participantId.toString()))];

  if (participantIds.length !== 2) {
    this.invalidate('participants', 'Direct conversations must include exactly two unique users.');
    return next();
  }

  this.participants = participantIds;
  this.participantKey = buildParticipantKey(participantIds);
  return next();
});

module.exports = mongoose.model('Conversation', conversationSchema);
module.exports.buildParticipantKey = buildParticipantKey;
