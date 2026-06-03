/**
 * Purpose: Handles free browser WebRTC call signaling over Socket.io.
 */

const Message = require('../../models/Message');
const { getAccessibleConversation } = require('../../services/conversationService');
const { emitSocketError } = require('../socketUtils');

const SIGNAL_EVENTS = [
  'call:offer',
  'call:answer',
  'call:ice-candidate',
  'call:ringing',
  'call:accepted',
  'call:rejected',
  'call:ended',
  'call:missed'
];

const getRecipientId = (conversation, senderId) => {
  const participant = conversation.participants.find((participantId) => {
    const id = participantId?._id?.toString?.() || participantId.toString();
    return id !== senderId;
  });
  return participant?._id?.toString?.() || participant?.toString();
};

const buildCallPayload = (eventName, payload, socket, conversation, recipientId) => ({
  callId: payload.callId,
  candidate: payload.candidate || null,
  conversationId: conversation.id,
  fromUser: {
    displayName: socket.user.displayName || '',
    id: socket.user.id,
    username: socket.user.username
  },
  mediaType: payload.mediaType || 'audio',
  offer: payload.offer || null,
  answer: payload.answer || null,
  reason: payload.reason || null,
  recipientId,
  state: eventName.replace('call:', ''),
  timestamp: new Date().toISOString()
});

const registerCallHandlers = (io, socket) => {
  SIGNAL_EVENTS.forEach((eventName) => {
    socket.on(eventName, async (payload = {}, acknowledgement) => {
      try {
        const conversation = await getAccessibleConversation(payload.conversationId, socket.user.id);
        const recipientId = getRecipientId(conversation, socket.user.id);

        if (!recipientId) {
          throw new Error('Call recipient not found.');
        }

        const eventPayload = buildCallPayload(eventName, payload, socket, conversation, recipientId);

        if (eventName === 'call:missed') {
          await Message.create({
            content: `Missed ${eventPayload.mediaType} call`,
            conversationId: conversation._id,
            senderId: socket.user._id,
            status: 'delivered',
            type: 'system'
          });
        }

        io.to(`user:${recipientId}`).emit(eventName, eventPayload);
        acknowledgement?.({ success: true, data: eventPayload });
      } catch (error) {
        emitSocketError(socket, error, acknowledgement);
      }
    });
  });
};

module.exports = {
  SIGNAL_EVENTS,
  registerCallHandlers
};
