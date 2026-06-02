/**
 * Purpose: Stores local media/file attachment metadata for message and avatar access.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const ATTACHMENT_KINDS = ['image', 'video', 'audio', 'file', 'avatar'];
const ATTACHMENT_PURPOSES = ['message', 'avatar'];

const attachmentSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
      index: true
    },
    purpose: {
      type: String,
      enum: ATTACHMENT_PURPOSES,
      default: 'message',
      required: true
    },
    kind: {
      type: String,
      enum: ATTACHMENT_KINDS,
      required: true
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    storedFilename: {
      type: String,
      required: true
    },
    relativePath: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true,
      min: 1
    },
    duration: {
      type: Number,
      default: null
    },
    width: {
      type: Number,
      default: null
    },
    height: {
      type: Number,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        returnedObject.url = `/api/attachments/${returnedObject.id}/content`;
        delete returnedObject._id;
        delete returnedObject.__v;
        delete returnedObject.relativePath;
        delete returnedObject.storedFilename;
        return returnedObject;
      }
    },
    toObject: {
      virtuals: true
    }
  }
);

attachmentSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('Attachment', attachmentSchema);
