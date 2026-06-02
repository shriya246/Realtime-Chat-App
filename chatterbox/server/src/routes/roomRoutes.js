/**
 * Purpose: Defines protected REST routes for rooms and room membership.
 */

const express = require('express');

const messageController = require('../controllers/messageController');
const roomController = require('../controllers/roomController');
const { authenticate } = require('../middleware/auth');
const {
  addMemberValidators,
  createRoomValidators,
  messageHistoryValidators,
  roomIdValidators,
  roomListValidators
} = require('../utils/validators');

const router = express.Router();

router.use(authenticate);

router.post('/', createRoomValidators, roomController.createRoom);
router.get('/', roomListValidators, roomController.getRooms);
router.post('/join/:token', roomController.joinByInvite);
router.get('/:id/messages', messageHistoryValidators, messageController.getMessages);
router.get('/:id', roomIdValidators, roomController.getRoomById);
router.patch('/:id', roomIdValidators, roomController.updateRoom);
router.delete('/:id', roomIdValidators, roomController.deleteRoom);
router.post('/:id/members', addMemberValidators, roomController.addMember);
router.delete('/:id/members/me', roomIdValidators, roomController.leaveRoom);
router.delete('/:id/members/:userId', roomController.removeMember);
router.patch('/:id/admins/:userId', roomController.updateAdmin);
router.post('/:id/invite', roomIdValidators, roomController.generateInvite);
router.post('/:id/join-requests/:userId', roomController.resolveJoinRequest);

module.exports = router;
