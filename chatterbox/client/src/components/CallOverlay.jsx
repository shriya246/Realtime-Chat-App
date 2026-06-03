/**
 * Purpose: Shows incoming and active WebRTC call controls.
 */

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';

const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
};

const VideoPreview = ({ label, muted = false, stream }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream || null;
    }
  }, [stream]);

  if (!stream) {
    return <div className="flex aspect-video items-center justify-center rounded-md bg-canvas text-xs text-muted">{label}</div>;
  }

  return <video aria-label={label} autoPlay className="aspect-video w-full rounded-md bg-black object-cover" muted={muted} playsInline ref={ref} />;
};

const CallOverlay = ({
  acceptCall,
  activeCall,
  callError,
  endCall,
  incomingCall,
  localStream,
  rejectCall,
  remoteStream,
  toggleCamera,
  toggleMute
}) => {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!activeCall?.startedAt) {
      setDuration(0);
      return undefined;
    }

    const timer = setInterval(() => {
      setDuration((Date.now() - activeCall.startedAt) / 1000);
    }, 1000);

    return () => clearInterval(timer);
  }, [activeCall?.startedAt]);

  if (!incomingCall && !activeCall && !callError) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <section className="w-full max-w-md rounded-md border border-stroke bg-panel p-5 shadow-modal">
        {callError && !activeCall && !incomingCall && (
          <>
            <h2 className="mb-2 text-base font-semibold text-ink">Call unavailable</h2>
            <p className="mb-4 text-sm text-muted">{callError}</p>
            <button className="primary-button w-full" onClick={endCall} type="button">Close</button>
          </>
        )}

        {incomingCall && (
          <>
            <h2 className="mb-1 text-base font-semibold text-ink">Incoming {incomingCall.mediaType} call</h2>
            <p className="mb-4 text-sm text-muted">{incomingCall.fromUser?.displayName || incomingCall.fromUser?.username || 'Someone'} is calling.</p>
            <div className="flex gap-3">
              <button className="primary-button flex-1" onClick={acceptCall} type="button">Accept</button>
              <button className="icon-button w-auto flex-1 px-4 text-coral" onClick={rejectCall} type="button">Reject</button>
            </div>
          </>
        )}

        {activeCall && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink">{activeCall.mediaType === 'video' ? 'Video call' : 'Voice call'}</h2>
                <p className="text-xs text-muted">{activeCall.state === 'calling' ? 'Calling...' : formatDuration(duration)}</p>
              </div>
              <span className="rounded bg-canvas px-2 py-1 text-xs text-muted">1:1 local WebRTC</span>
            </div>

            {activeCall.mediaType === 'video' && (
              <div className="mb-4 grid gap-3">
                <VideoPreview label="Remote video" stream={remoteStream} />
                <VideoPreview label="Local video" muted stream={localStream} />
              </div>
            )}

            <div className="flex justify-center gap-3">
              <button aria-label={activeCall.muted ? 'Unmute call' : 'Mute call'} className="icon-button" onClick={toggleMute} type="button">
                {activeCall.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              {activeCall.mediaType === 'video' && (
                <button aria-label={activeCall.cameraOff ? 'Turn camera on' : 'Turn camera off'} className="icon-button" onClick={toggleCamera} type="button">
                  {activeCall.cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </button>
              )}
              <button aria-label="End call" className="icon-button bg-coral text-white" onClick={endCall} type="button">
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default CallOverlay;
