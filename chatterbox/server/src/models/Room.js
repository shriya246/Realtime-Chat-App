/**
 * Purpose: Defines the Room schema for public and private chat spaces.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const ROOM_TYPES = ['public', 'private'];

const roomSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80
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
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

roomSchema.index({ name: 1, type: 1 });
roomSchema.index({ members: 1 });
roomSchema.index({ createdBy: 1 });

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

    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Room', roomSchema);
