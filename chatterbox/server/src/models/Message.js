/**
 * Purpose: Defines the Message schema and indexes for fast room history retrieval.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const MESSAGE_TYPES = ['text', 'system'];
const MESSAGE_STATUSES = ['sent', 'delivered', 'read', 'failed'];

const messageSchema = new Schema(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000
    },
    type: {
      type: String,
      enum: MESSAGE_TYPES,
      default: 'text',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    },
    status: {
      type: String,
      enum: MESSAGE_STATUSES,
      default: 'sent',
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

messageSchema.index({ roomId: 1, timestamp: -1 });
messageSchema.index({ roomId: 1, _id: -1 });
messageSchema.index({ senderId: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
