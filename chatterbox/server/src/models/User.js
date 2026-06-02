/**
 * Purpose: Defines the User schema, password hashing behavior, password comparison, and safe JSON output.
 */

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

const { getConfig } = require('../config');

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

module.exports = mongoose.model('User', userSchema);
