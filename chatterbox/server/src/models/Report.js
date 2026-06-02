/**
 * Purpose: Stores local moderation reports without external moderation services.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const REPORT_TYPES = ['user', 'message'];
const REPORT_STATUSES = ['open', 'reviewed', 'dismissed'];

const reportSchema = new Schema(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    reportedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
      index: true
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      default: null
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null
    },
    type: {
      type: String,
      enum: REPORT_TYPES,
      required: true
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'open',
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
    }
  }
);

module.exports = mongoose.model('Report', reportSchema);
