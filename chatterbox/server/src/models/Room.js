/**
 * Purpose: Defines the Room schema for public and private chat spaces.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const ROOM_TYPES = ['public', 'private'];
const GROUP_PERMISSION_VALUES = ['everyone', 'admins'];
const DISAPPEARING_MODES = ['off', '24h', '7d', '90d'];
const JOIN_REQUEST_STATUSES = ['pending', 'approved', 'rejected'];

const joinRequestSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: JOIN_REQUEST_STATUSES,
      default: 'pending',
      required: true
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      required: true
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { _id: false }
);

const roomSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80
    },
    description: {
      type: String,
      trim: true,
      maxlength: 240,
      default: ''
    },
    avatarAttachmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Attachment',
      default: null
    },
    type: {
      type: String,
      enum: ROOM_TYPES,
      default: 'public',
      required: true
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],
    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    settings: {
      whoCanSendMessages: {
        type: String,
        enum: GROUP_PERMISSION_VALUES,
        default: 'everyone'
      },
      whoCanEditInfo: {
        type: String,
        enum: GROUP_PERMISSION_VALUES,
        default: 'admins'
      },
      newMembersCanSeeRecentHistory: {
        type: Boolean,
        default: true
      },
      joinApprovalRequired: {
        type: Boolean,
        default: false
      },
      disappearingMode: {
        type: String,
        enum: DISAPPEARING_MODES,
        default: 'off'
      }
    },
    inviteToken: {
      type: String,
      default: null,
      index: true
    },
    inviteRevokedAt: {
      type: Date,
      default: null
    },
    joinRequests: {
      type: [joinRequestSchema],
      default: []
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

roomSchema.index({ name: 1, type: 1 });
roomSchema.index({ members: 1 });
roomSchema.index({ createdBy: 1 });
roomSchema.index({ ownerId: 1 });

/**
 * Returns the number of members in a room.
 *
 * @returns {number} Member count.
 */
roomSchema.virtual('memberCount').get(function getMemberCount() {
  return this.members.length;
});

/**
 * Returns whether the room is private.
 *
 * @returns {boolean} True when the room type is private.
 */
roomSchema.virtual('isPrivate').get(function getIsPrivate() {
  return this.type === 'private';
});

/**
 * Ensures the creator is always a room member.
 *
 * @param {Function} next - Mongoose middleware continuation.
 * @returns {void} Continues the save operation.
 */
roomSchema.pre('validate', function ensureCreatorMembership(next) {
  try {
    const creatorId = this.createdBy?.toString();

    if (creatorId && !this.members.some((memberId) => memberId.toString() === creatorId)) {
      this.members.push(this.createdBy);
    }

    if (!this.ownerId && this.createdBy) {
      this.ownerId = this.createdBy;
    }

    if (creatorId && !this.admins.some((adminId) => adminId.toString() === creatorId)) {
      this.admins.push(this.createdBy);
    }

    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Room', roomSchema);
