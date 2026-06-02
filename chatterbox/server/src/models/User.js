/**
 * Purpose: Defines the User schema, password hashing behavior, password comparison, and safe JSON output.
 */

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

const { getConfig } = require('../config');

const PRIVACY_VISIBILITY_VALUES = ['everyone', 'contacts', 'nobody'];

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-zA-Z0-9_-]+$/
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 60,
      default: ''
    },
    about: {
      type: String,
      trim: true,
      maxlength: 160,
      default: ''
    },
    avatarAttachmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attachment',
      default: null
    },
    isAdmin: {
      type: Boolean,
      default: false,
      required: true
    },
    privacySettings: {
      lastSeenVisibility: {
        type: String,
        enum: PRIVACY_VISIBILITY_VALUES,
        default: 'everyone'
      },
      onlineVisibility: {
        type: String,
        enum: PRIVACY_VISIBILITY_VALUES,
        default: 'everyone'
      },
      readReceipts: {
        type: Boolean,
        default: true
      },
      profilePhotoVisibility: {
        type: String,
        enum: PRIVACY_VISIBILITY_VALUES,
        default: 'everyone'
      },
      aboutVisibility: {
        type: String,
        enum: PRIVACY_VISIBILITY_VALUES,
        default: 'everyone'
      }
    },
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    lockedChatPinHash: {
      type: String,
      default: null,
      select: true
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 8,
      select: true
    },
    lastSeen: {
      type: Date,
      default: null
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
        delete returnedObject.passwordHash;
        delete returnedObject.lockedChatPinHash;
        return returnedObject;
      }
    },
    toObject: {
      virtuals: true
    }
  }
);

userSchema.index({ username: 'text', email: 'text' });

/**
 * Returns the public display name fallback used throughout the client.
 *
 * @returns {string} Display name or username.
 */
userSchema.virtual('name').get(function getName() {
  return this.displayName || this.username;
});

/**
 * Hashes the passwordHash field before saving when it has changed.
 *
 * @param {Function} next - Mongoose middleware continuation.
 * @returns {Promise<void>} Resolves after password hashing.
 */
userSchema.pre('save', async function hashPassword(next) {
  try {
    if (!this.isModified('passwordHash')) {
      return next();
    }

    const { bcryptSaltRounds: saltRounds } = getConfig().security;
    this.passwordHash = await bcrypt.hash(this.passwordHash, saltRounds);
    return next();
  } catch (error) {
    return next(error);
  }
});

/**
 * Compares a candidate password with the stored bcrypt hash.
 *
 * @param {string} candidatePassword - Plain-text password provided by the user.
 * @returns {Promise<boolean>} True when the password matches.
 */
userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
  } catch (error) {
    throw error;
  }
};

/**
 * Compares a local locked-chat PIN with the stored bcrypt hash.
 *
 * @param {string} candidatePin - Plain-text PIN supplied by the user.
 * @returns {Promise<boolean>} True when the PIN matches.
 */
userSchema.methods.compareLockedChatPin = async function compareLockedChatPin(candidatePin) {
  if (!this.lockedChatPinHash) {
    return false;
  }

  return bcrypt.compare(candidatePin, this.lockedChatPinHash);
};

module.exports = mongoose.model('User', userSchema);
