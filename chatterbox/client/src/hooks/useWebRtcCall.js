/**
 * Purpose: Manages browser-native 1:1 WebRTC call state and Socket.io signaling.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const createPeerConnection = () => {
  if (typeof RTCPeerConnection === 'undefined') {
    return null;
  }

  const configuredStun = localStorage.getItem('chatterbox.stunServers');
  const iceServers = configuredStun
    ? configuredStun.split(',').map((url) => ({ urls: url.trim() })).filter((entry) => entry.urls)
    : [];

  return new RTCPeerConnection({ iceServers });
};

const stopStream = (stream) => {
  stream?.getTracks?.().forEach((track) => track.stop());
};

const useWebRtcCall = (socket) => {
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callError, setCallError] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);

  const cleanup = useCallback(() => {
    peerRef.current?.close?.();
    peerRef.current = null;
    stopStream(localStreamRef.current);
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
    setActiveCall(null);
  }, []);

  const getMedia = async (mediaType) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Calls are not available in this browser.');
    }

    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mediaType === 'video'
    });
  };

  const preparePeer = useCallback((conversationId, callId) => {
    const peer = createPeerConnection();

    if (!peer) {
      throw new Error('WebRTC is not available in this browser.');
    }

    peer.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('call:ice-candidate', {
          callId,
          candidate: event.candidate,
          conversationId
        });
      }
    };
    peerRef.current = peer;
    return peer;
  }, [socket]);

  const startCall = useCallback(async (conversation, mediaType = 'audio') => {
    try {
      setCallError('');
      const callId = `${conversation.id}-${Date.now()}`;
      const stream = await getMedia(mediaType);
      const peer = preparePeer(conversation.id, callId);

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      localStreamRef.current = stream;
      setLocalStream(stream);
      setActiveCall({ callId, conversation, mediaType, startedAt: Date.now(), state: 'calling' });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket?.emit('call:offer', {
        callId,
        conversationId: conversation.id,
        mediaType,
        offer
      });
    } catch (error) {
      setCallError(error.message || 'Unable to start call.');
      cleanup();
    }
  }, [cleanup, preparePeer, socket]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) {
      return;
    }

    try {
      setCallError('');
      const stream = await getMedia(incomingCall.mediaType);
      const peer = preparePeer(incomingCall.conversationId, incomingCall.callId);

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      localStreamRef.current = stream;
      setLocalStream(stream);
      await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket?.emit('call:answer', {
        answer,
        callId: incomingCall.callId,
        conversationId: incomingCall.conversationId,
        mediaType: incomingCall.mediaType
      });
      socket?.emit('call:accepted', {
        callId: incomingCall.callId,
        conversationId: incomingCall.conversationId,
        mediaType: incomingCall.mediaType
      });
      setActiveCall({ ...incomingCall, startedAt: Date.now(), state: 'active' });
      setIncomingCall(null);
    } catch (error) {
      setCallError(error.message || 'Unable to accept call.');
      socket?.emit('call:rejected', {
        callId: incomingCall.callId,
        conversationId: incomingCall.conversationId,
        mediaType: incomingCall.mediaType,
        reason: 'permission_denied'
      });
      cleanup();
    }
  }, [cleanup, incomingCall, preparePeer, socket]);

  const rejectCall = useCallback(() => {
    if (incomingCall) {
      socket?.emit('call:rejected', {
        callId: incomingCall.callId,
        conversationId: incomingCall.conversationId,
        mediaType: incomingCall.mediaType
      });
    }
    setIncomingCall(null);
  }, [incomingCall, socket]);

  const endCall = useCallback(() => {
    if (activeCall) {
      socket?.emit('call:ended', {
        callId: activeCall.callId,
        conversationId: activeCall.conversation?.id || activeCall.conversationId,
        mediaType: activeCall.mediaType
      });
    }
    cleanup();
  }, [activeCall, cleanup, socket]);

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks?.().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setActiveCall((current) => current ? { ...current, muted: !current.muted } : current);
  }, []);

  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks?.().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setActiveCall((current) => current ? { ...current, cameraOff: !current.cameraOff } : current);
  }, []);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleOffer = (payload) => {
      setIncomingCall(payload);
      socket.emit('call:ringing', payload);
    };
    const handleAnswer = async (payload) => {
      if (peerRef.current && payload.answer) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
      }
      setActiveCall((current) => current ? { ...current, state: 'active', startedAt: current.startedAt || Date.now() } : current);
    };
    const handleIce = async (payload) => {
      if (peerRef.current && payload.candidate) {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    };
    const handleEnded = () => cleanup();
    const handleRejected = () => {
      setCallError('Call was rejected.');
      cleanup();
    };

    socket.on('call:offer', handleOffer);
    socket.on('call:answer', handleAnswer);
    socket.on('call:ice-candidate', handleIce);
    socket.on('call:ended', handleEnded);
    socket.on('call:rejected', handleRejected);

    return () => {
      socket.off('call:offer', handleOffer);
      socket.off('call:answer', handleAnswer);
      socket.off('call:ice-candidate', handleIce);
      socket.off('call:ended', handleEnded);
      socket.off('call:rejected', handleRejected);
    };
  }, [cleanup, socket]);

  return {
    acceptCall,
    activeCall,
    callError,
    endCall,
    incomingCall,
    localStream,
    rejectCall,
    remoteStream,
    startCall,
    toggleCamera,
    toggleMute
  };
};

export default useWebRtcCall;
