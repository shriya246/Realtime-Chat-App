/**
 * Purpose: Defines the Message schema and indexes for room and direct-chat history retrieval.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const MESSAGE_TYPES = ['text', 'system', 'image', 'video', 'file', 'audio'];
const MESSAGE_STATUSES = ['sent', 'delivered', 'read', 'failed'];

const receiptSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    at: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  { _id: false }
);

const reactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    emoji: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8
    },
    reactedAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
      index: true
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
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
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true
    },
    isEncrypted: {
      type: Boolean,
      default: false,
      required: true
    },
    encryptionMetadata: {
      algorithm: {
        type: String,
        default: ''
      },
      iv: {
        type: String,
        default: ''
      },
      demoWarning: {
        type: String,
        default: ''
      }
    },
    replyToMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },
    attachments: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Attachment'
      }
    ],
    reactions: {
      type: [reactionSchema],
      default: []
    },
    deliveredTo: {
      type: [receiptSchema],
      default: []
    },
    readBy: {
      type: [receiptSchema],
      default: []
    },
    editedAt: {
      type: Date,
      default: null
    },
    deletedAt: {
      type: Date,
      default: null
    },
    isDeleted: {
      type: Boolean,
      default: false,
      required: true
    },
    hiddenFor: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
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
messageSchema.index({ conversationId: 1, timestamp: -1 });
messageSchema.index({ conversationId: 1, _id: -1 });
messageSchema.index({ senderId: 1, timestamp: -1 });
messageSchema.index({ 'readBy.userId': 1 });

/**
 * Requires every message to belong to either a room or a direct conversation.
 *
 * @param {Function} next - Mongoose middleware continuation.
 * @returns {void} Continues validation.
 */
messageSchema.pre('validate', function requireConversationOrRoom(next) {
  if (!this.roomId && !this.conversationId) {
    this.invalidate('roomId', 'Message must belong to a room or direct conversation.');
    this.invalidate('conversationId', 'Message must belong to a room or direct conversation.');
  }

  next();
});

module.exports = mongoose.model('Message', messageSchema);
