/**
 * Purpose: Provides the active direct-chat header, message stream, reply composer, and message actions.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Ban, Flag, LockKeyhole, Mic, Paperclip, Phone, Search, SendHorizontal, Shield, Square, Timer, Video, X } from 'lucide-react';

import MessageBubble from './MessageBubble';
import { encryptDemoMessage, ensureDemoKey } from '../services/encryptionDemo';

/**
 * Renders a selected one-to-one conversation.
 *
 * @param {object} props - Direct conversation state and actions.
 * @returns {JSX.Element} Direct-message workspace.
 */
const DirectChatWindow = ({
  connectionStatus,
  conversation,
  currentUser,
  deleteMessage,
  editMessage,
  error,
  isLoading,
  messages,
  onBlockUser = () => undefined,
  onLockChat = () => undefined,
  onReport = () => undefined,
  onStartVideoCall = () => undefined,
  onStartVoiceCall = () => undefined,
  onToggleDisappearing = () => undefined,
  onToggleEncryption = () => undefined,
  onUnlockChat = async () => false,
  onBack,
  reactToMessage,
  retryMessage,
  searchMessages = async () => [],
  sendMessage,
  uploadAttachment = async () => null
}) => {
  const [content, setContent] = useState('');
  const [unlockSecret, setUnlockSecret] = useState('');
  const [localError, setLocalError] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [replyTo, setReplyTo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const messageEndRef = useRef(null);
  const messageRefs = useRef(new Map());
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const participant = conversation?.participant;
  const isLocked = conversation?.settings?.locked && (!conversation.settings.unlockedUntil || new Date(conversation.settings.unlockedUntil) <= new Date());

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setContent('');
    setReplyTo(null);
    setSelectedAttachment(null);
    setSearchQuery('');
    setSearchResults([]);
  }, [conversation?.id]);

  useEffect(
    () => () => {
      if (selectedAttachment?.previewUrl) {
        URL.revokeObjectURL(selectedAttachment.previewUrl);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    },
    [selectedAttachment?.previewUrl]
  );

  const connectionLabel = useMemo(() => {
    if (participant?.isOnline) {
      return 'online';
    }

    if (connectionStatus === 'connected') {
      return 'offline';
    }

    return connectionStatus === 'reconnecting' ? 'reconnecting' : 'offline';
  }, [connectionStatus, participant?.isOnline]);

  const scrollToMessage = (messageId) => {
    const node = messageRefs.current.get(messageId);

    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.classList.add('ring-2', 'ring-accent/60');
      window.setTimeout(() => node.classList.remove('ring-2', 'ring-accent/60'), 900);
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();

    try {
      setLocalError('');
      let uploadedAttachment = null;
      let contentToSend = content;
      let encryptionOptions = {};

      if (selectedAttachment) {
        setUploadProgress(1);
        uploadedAttachment = await uploadAttachment(selectedAttachment.file, setUploadProgress);
      }

      if (conversation.encryptedModeEnabled && content.trim()) {
        const encrypted = await encryptDemoMessage(conversation.id, content);
        contentToSend = encrypted.ciphertext;
        encryptionOptions = {
          encryptionMetadata: encrypted.metadata,
          isEncrypted: true
        };
      }

      if (sendMessage(contentToSend, replyTo?.id || null, uploadedAttachment, encryptionOptions)) {
        if (selectedAttachment?.previewUrl) {
          URL.revokeObjectURL(selectedAttachment.previewUrl);
        }
        setSelectedAttachment(null);
        setUploadProgress(0);
        setContent('');
        setReplyTo(null);
      }
    } catch (sendError) {
      setLocalError(sendError.response?.data?.error?.message || sendError.message || 'Unable to send attachment.');
    }
  };

  const handleFileSelection = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (selectedAttachment?.previewUrl) {
      URL.revokeObjectURL(selectedAttachment.previewUrl);
    }

    setSelectedAttachment({
      file,
      previewUrl: URL.createObjectURL(file)
    });
    event.target.value = '';
  };

  const handleSearch = async (event) => {
    event.preventDefault();

    try {
      setSearchResults(await searchMessages(searchQuery));
    } catch (searchError) {
      setLocalError(searchError.response?.data?.error?.message || 'Unable to search messages.');
    }
  };

  const startRecording = async () => {
    try {
      setLocalError('');

      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setLocalError('Voice recording is not available in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recordingChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        setSelectedAttachment({
          file,
          previewUrl: URL.createObjectURL(blob)
        });
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setRecordingSeconds(0);
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);
    } catch (recordingError) {
      setLocalError(recordingError.message || 'Unable to start voice recording.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setIsRecording(false);
  };

  const cancelRecording = () => {
    recordingChunksRef.current = [];
    stopRecording();
    setSelectedAttachment(null);
  };

  const clearAttachment = () => {
    if (selectedAttachment?.previewUrl) {
      URL.revokeObjectURL(selectedAttachment.previewUrl);
    }

    setSelectedAttachment(null);
    setUploadProgress(0);
  };

  const renderAttachmentPreview = () => {
    if (!selectedAttachment) {
      return null;
    }

    if (selectedAttachment.file.type.startsWith('image/')) {
      return <img alt="Attachment preview" className="max-h-36 rounded-md object-cover" src={selectedAttachment.previewUrl} />;
    }

    if (selectedAttachment.file.type.startsWith('audio/')) {
      return <audio aria-label="Voice note preview" controls src={selectedAttachment.previewUrl} />;
    }

    if (selectedAttachment.file.type.startsWith('video/')) {
      return <video aria-label="Video preview" className="max-h-36 rounded-md" controls src={selectedAttachment.previewUrl} />;
    }

    return <p className="truncate text-sm text-ink">{selectedAttachment.file.name}</p>;
  };

  const visibleError = localError || error;

  if (!conversation) {
    return (
      <main className="hidden min-w-0 flex-1 flex-col bg-canvas lg:flex">
        <div className="flex flex-1 items-center justify-center px-6 text-sm text-muted">Select a chat to begin.</div>
      </main>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-canvas">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-stroke px-3 sm:px-5">
        <button aria-label="Back to chats" className="icon-button lg:hidden" onClick={onBack} type="button">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-canvas">
          {participant?.avatarUrl ? (
            <img alt="" className="h-full w-full rounded-full object-cover" src={participant.avatarUrl} />
          ) : (
            (participant?.displayName || participant?.username)?.slice(0, 1).toUpperCase() || '?'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-ink">{participant?.displayName || participant?.username || 'Direct chat'}</h2>
          <p className="text-xs text-muted">{connectionLabel}</p>
        </div>
        <span className="hidden rounded-md border border-stroke bg-panel px-2.5 py-1 text-xs text-muted sm:inline-flex">
          {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'reconnecting' ? 'Reconnecting' : 'Offline'}
        </span>
        <button aria-label="Start voice call" className="icon-button hidden sm:inline-flex" onClick={() => onStartVoiceCall(conversation)} type="button">
          <Phone className="h-4 w-4" />
        </button>
        <button aria-label="Start video call" className="icon-button hidden sm:inline-flex" onClick={() => onStartVideoCall(conversation)} type="button">
          <Video className="h-4 w-4" />
        </button>
        <button
          aria-label={conversation.encryptedModeEnabled ? 'Disable encrypted demo' : 'Enable encrypted demo'}
          className="icon-button hidden sm:inline-flex"
          onClick={async () => {
            await ensureDemoKey(conversation.id);
            onToggleEncryption(!conversation.encryptedModeEnabled);
          }}
          type="button"
        >
          <Shield className="h-4 w-4" />
        </button>
        <label className="hidden items-center gap-1 text-xs text-muted sm:flex">
          <Timer className="h-4 w-4" />
          <select
            aria-label="Disappearing messages"
            className="rounded border border-stroke bg-panel px-2 py-1 text-xs"
            onChange={(event) => onToggleDisappearing(event.target.value)}
            value={conversation.disappearingMode || 'off'}
          >
            <option value="off">Off</option>
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="90d">90 days</option>
          </select>
        </label>
        <button aria-label="Lock chat" className="icon-button hidden sm:inline-flex" onClick={onLockChat} type="button">
          <LockKeyhole className="h-4 w-4" />
        </button>
        <button aria-label="Block user" className="icon-button hidden sm:inline-flex" onClick={() => onBlockUser(participant)} type="button">
          <Ban className="h-4 w-4" />
        </button>
        <button aria-label="Report chat" className="icon-button hidden sm:inline-flex" onClick={() => onReport({ reportedUserId: participant?.id, type: 'user' })} type="button">
          <Flag className="h-4 w-4" />
        </button>
      </header>

      {(conversation.disappearingMode !== 'off' || conversation.encryptedModeEnabled) && (
        <div className="flex shrink-0 items-center gap-2 border-b border-stroke bg-panel px-3 py-2 text-xs text-muted sm:px-5">
          {conversation.disappearingMode !== 'off' && <span>Disappearing messages: {conversation.disappearingMode}</span>}
          {conversation.encryptedModeEnabled && <span>Encrypted demo: localStorage key, not production E2EE</span>}
        </div>
      )}

      {isLocked ? (
        <section className="flex flex-1 items-center justify-center px-4">
          <form
            className="w-full max-w-sm rounded-md border border-stroke bg-panel p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const unlocked = await onUnlockChat(unlockSecret);
              if (unlocked) {
                setUnlockSecret('');
              }
            }}
          >
            <h3 className="mb-2 text-sm font-semibold text-ink">Locked chat</h3>
            <p className="mb-3 text-xs text-muted">Enter your account password or local PIN to unlock this web-app-level private chat.</p>
            <input
              aria-label="Unlock secret"
              className="field"
              onChange={(event) => setUnlockSecret(event.target.value)}
              placeholder="Password or PIN"
              type="password"
              value={unlockSecret}
            />
            <button className="primary-button mt-3 w-full" disabled={!unlockSecret} type="submit">Unlock chat</button>
          </form>
        </section>
      ) : (
        <>

      {visibleError && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-md border border-coral/35 bg-coral/10 px-3 py-2 text-sm text-coral sm:mx-5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{visibleError}</span>
        </div>
      )}

      <form className="flex shrink-0 gap-2 border-b border-stroke px-3 py-2 sm:px-5" onSubmit={handleSearch}>
        <input
          aria-label="Search messages"
          className="field h-9 flex-1"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search in chat"
          value={searchQuery}
        />
        <button aria-label="Search messages submit" className="icon-button h-9 w-9 bg-panel" disabled={!searchQuery.trim()} type="submit">
          <Search className="h-4 w-4" />
        </button>
      </form>

      {searchResults.length > 0 && (
        <div className="shrink-0 border-b border-stroke bg-panel px-3 py-2 sm:px-5">
          <div className="flex gap-2 overflow-x-auto">
            {searchResults.map((result) => (
              <button
                className="max-w-64 shrink-0 rounded-md border border-stroke bg-canvas px-3 py-2 text-left text-xs text-muted hover:text-ink"
                key={result.id}
                onClick={() => scrollToMessage(result.id)}
                type="button"
              >
                <span className="block truncate font-semibold text-ink">{result.sender?.username}</span>
                <span className="block truncate">{result.content}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5" aria-label="Direct messages">
        {isLoading && <p className="pt-8 text-center text-sm text-muted">Loading messages...</p>}
        {!isLoading && messages.length === 0 && <p className="pt-8 text-center text-sm text-muted">No messages yet.</p>}
        {messages.map((message) => (
          <div
            key={message.id}
            ref={(node) => {
              if (node) {
                messageRefs.current.set(message.id, node);
              } else {
                messageRefs.current.delete(message.id);
              }
            }}
          >
            <MessageBubble
              currentUserId={currentUser.id}
              message={message}
              onDelete={(selectedMessage) => deleteMessage(selectedMessage.id)}
              onEdit={(selectedMessage, nextContent) => editMessage(selectedMessage.id, nextContent)}
              onQuoteClick={scrollToMessage}
              onReact={(selectedMessage, emoji) => reactToMessage(selectedMessage.id, emoji)}
              onReply={setReplyTo}
              onRetry={retryMessage}
            />
          </div>
        ))}
        <div ref={messageEndRef} />
      </section>

      <form className="shrink-0 border-t border-stroke bg-panel p-3 sm:px-5" onSubmit={handleSend}>
        {replyTo && (
          <div className="mb-3 flex items-start gap-3 rounded-md border-l-2 border-accent bg-canvas px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-accent">Replying to {replyTo.sender?.username || 'message'}</p>
              <p className="truncate text-xs text-muted">{replyTo.content}</p>
            </div>
            <button aria-label="Cancel reply" className="text-xs font-semibold text-muted hover:text-ink" onClick={() => setReplyTo(null)} type="button">
              Cancel
            </button>
          </div>
        )}
        {selectedAttachment && (
          <div className="mb-3 flex items-center gap-3 rounded-md border border-stroke bg-canvas px-3 py-2">
            <div className="min-w-0 flex-1">{renderAttachmentPreview()}</div>
            <div className="shrink-0 text-xs text-muted">
              {uploadProgress > 0 ? `${uploadProgress}%` : `${Math.ceil(selectedAttachment.file.size / 1024)} KB`}
            </div>
            <button aria-label="Remove attachment" className="icon-button h-8 w-8" onClick={clearAttachment} type="button">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {isRecording && (
          <div className="mb-3 flex items-center justify-between rounded-md border border-coral/35 bg-coral/10 px-3 py-2 text-sm text-coral">
            <span>Recording {recordingSeconds}s</span>
            <div className="flex gap-2">
              <button className="text-xs font-semibold" onClick={cancelRecording} type="button">Cancel</button>
              <button className="text-xs font-semibold" onClick={stopRecording} type="button">Stop</button>
            </div>
          </div>
        )}
        <div className="flex items-end gap-3">
          <input
            aria-label="Attachment picker"
            className="hidden"
            onChange={handleFileSelection}
            ref={fileInputRef}
            type="file"
          />
          <button aria-label="Attach file" className="icon-button bg-canvas" onClick={() => fileInputRef.current?.click()} type="button">
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            aria-label={isRecording ? 'Stop voice recording' : 'Record voice note'}
            className="icon-button bg-canvas"
            onClick={isRecording ? stopRecording : startRecording}
            type="button"
          >
            {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <textarea
            aria-label="Direct message"
            className="field min-h-11 flex-1 resize-none py-2.5"
            maxLength={2000}
            onChange={(event) => setContent(event.target.value)}
            placeholder={`Message ${participant?.username || ''}`}
            rows={1}
            value={content}
          />
          <button aria-label="Send direct message" className="primary-button w-11 px-0" disabled={!content.trim() && !selectedAttachment} title="Send direct message" type="submit">
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </form>
        </>
      )}
    </main>
  );
};

export default DirectChatWindow;
