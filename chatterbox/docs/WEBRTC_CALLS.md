<!-- Purpose: WebRTC voice/video call architecture and limitations for ChatterBox v4.0.0. -->

# WebRTC Calls

ChatterBox v4.0.0 supports local/demo 1:1 voice and video calls using browser-native WebRTC APIs.

## Architecture

```text
Caller browser
  getUserMedia + RTCPeerConnection
  Socket.io call:offer / ICE signaling
        |
        v
Node.js Socket.io server
  validates direct conversation membership
  forwards signaling to user:<recipientId>
        |
        v
Recipient browser
  incoming call modal
  getUserMedia + RTCPeerConnection
  call:answer / ICE signaling
```

## Socket Events

- `call:offer`
- `call:answer`
- `call:ice-candidate`
- `call:ringing`
- `call:accepted`
- `call:rejected`
- `call:ended`
- `call:missed`

Every call event includes a `conversationId`; the server verifies that the sender belongs to that direct conversation before forwarding anything.

## UI

- Direct chat header has voice and video call buttons.
- Incoming calls show an accept/reject modal.
- Active calls show mute/unmute, camera on/off for video, duration, and end call.
- Permission denial is shown as a local call error.
- Missed calls create a local system message.

## Free/Local Limitations

The v4 implementation is peer-to-peer and works best on localhost or a LAN. It does not require Twilio, Agora, Daily, Vonage, Firebase, Pusher, or paid media infrastructure.

STUN servers can be configured in the browser with `localStorage["chatterbox.stunServers"]` as a comma-separated list. Production NAT traversal usually requires properly operated TURN infrastructure. TURN is not bundled because reliable TURN hosting is infrastructure work and may cost money.

## Group Call Placeholder

v4.0.0 intentionally supports 1:1 calls only. Full group calls normally require SFU infrastructure such as mediasoup or Janus. The call signaling module is isolated so a future SFU adapter can be added without rewriting direct chat.
