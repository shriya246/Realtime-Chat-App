/**
 * Purpose: Displays one delivered or optimistic chat message with replies, reactions, and actions.
 */

import { useState } from 'react';
import clsx from 'clsx';
import { AlertCircle, Check, CheckCheck, Clock3, Pencil, Reply, RotateCcw, Smile, Trash2 } from 'lucide-react';

import { getApiBaseUrl } from '../services/api';
import { formatFullDateTime, formatMessageTime } from '../utils/formatTime';

/**
 * Renders delivery state for a sent message.
 *
 * @param {{ message: object }} props - Message record.
 * @returns {JSX.Element} Status icon.
 */
const DeliveryIcon = ({ message }) => {
  if (message.status === 'failed') {
    return <AlertCircle aria-label="Failed to send" className="h-3.5 w-3.5 text-coral" />;
  }

  if (message.isPending || message.status === 'sending') {
    return (
      <Clock3
        aria-label={message.status === 'queued' ? 'Queued for reconnect' : 'Sending'}
        className="h-3.5 w-3.5 text-muted"
      />
    );
  }

  if (message.status === 'sent') {
    return <Check aria-label="Sent" className="h-3.5 w-3.5 text-muted" />;
  }

  if (message.status === 'read') {
    return <CheckCheck aria-label="Read" className="h-3.5 w-3.5 text-sky-300" />;
  }

  return <CheckCheck aria-label="Delivered" className="h-3.5 w-3.5 text-accent" />;
};

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const getAttachmentUrl = (attachment, download = false) => {
  const baseUrl = getApiBaseUrl().replace(/\/api$/, '');
  const url = attachment.url?.startsWith('http') ? attachment.url : `${baseUrl}${attachment.url}`;
  return download ? `${url}?download=true` : url;
};

const AttachmentPreview = ({ attachment }) => {
  if (attachment.kind === 'image') {
    return (
      <img
        alt={attachment.originalFilename}
        className="mb-2 max-h-72 w-full rounded-md object-cover"
        src={getAttachmentUrl(attachment)}
      />
    );
  }

  if (attachment.kind === 'video') {
    return <video className="mb-2 max-h-72 w-full rounded-md" controls src={getAttachmentUrl(attachment)} />;
  }

  if (attachment.kind === 'audio') {
    return <audio className="mb-2 w-full min-w-48" controls src={getAttachmentUrl(attachment)} />;
  }

  return (
    <a
      className="mb-2 flex items-center justify-between gap-3 rounded-md border border-stroke bg-canvas/40 px-3 py-2 text-xs underline-offset-2 hover:underline"
      href={getAttachmentUrl(attachment, true)}
      rel="noreferrer"
      target="_blank"
    >
      <span className="truncate">{attachment.originalFilename}</span>
      <span className="shrink-0 text-muted">{Math.ceil((attachment.size || 0) / 1024)} KB</span>
    </a>
  );
};

/**
 * Renders a chat message from the current user or another sender.
 *
 * @param {{ message: object, currentUserId: string }} props - Message and active-user identifiers.
 * @returns {JSX.Element} Message bubble.
 */
const MessageBubble = ({
  currentUserId,
  message,
  onDelete,
  onEdit,
  onQuoteClick,
  onReact,
  onReply,
  onRetry
}) => {
  const [isActionBarOpen, setIsActionBarOpen] = useState(false);
  const isOwnMessage = message.sender?.id === currentUserId;
  const canUseActions = Boolean(onReply || onReact || (isOwnMessage && (onEdit || onDelete || onRetry)));
  const ownReaction = message.reactions?.find((reaction) => reaction.reactedByMe);

  const handleEdit = () => {
    const nextContent = window.prompt('Edit message', message.content);

    if (nextContent && nextContent.trim() && nextContent.trim() !== message.content) {
      onEdit?.(message, nextContent.trim());
    }
  };

  return (
    <article
      className={clsx('flex w-full py-1', isOwnMessage ? 'justify-end' : 'justify-start')}
      data-message-id={message.id}
    >
      <div className={clsx('max-w-[82%] sm:max-w-[68%]', isOwnMessage ? 'items-end' : 'items-start')}>
        {!isOwnMessage && (
          <p className="mb-1 px-1 text-xs font-medium text-muted">{message.sender?.username || 'Unknown user'}</p>
        )}
        <div
          className={clsx(
            'rounded-md px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
            isOwnMessage ? 'bg-accent text-canvas' : 'border border-stroke bg-raised text-ink',
            message.isDeleted && 'opacity-80'
          )}
          onClick={() => canUseActions && setIsActionBarOpen((isOpen) => !isOpen)}
          role={canUseActions ? 'button' : undefined}
          tabIndex={canUseActions ? 0 : undefined}
        >
          {message.replyTo && (
            <button
              className={clsx(
                'mb-2 block w-full rounded border-l-2 px-2 py-1 text-left text-xs',
                isOwnMessage ? 'border-canvas/50 bg-canvas/10 text-canvas/80' : 'border-accent bg-canvas/60 text-muted'
              )}
              onClick={(event) => {
                event.stopPropagation();
                onQuoteClick?.(message.replyTo.id);
              }}
              type="button"
            >
              <span className="block truncate font-semibold">{message.replyTo.sender?.username || 'Unknown user'}</span>
              <span className="block truncate">{message.replyTo.content}</span>
            </button>
          )}
          {message.attachments?.map((attachment) => (
            <AttachmentPreview attachment={attachment} key={attachment.id} />
          ))}
          <p className={clsx('whitespace-pre-wrap break-words', message.isDeleted && 'italic')}>
            {message.content}
            {message.editedAt && !message.isDeleted && <span className="ml-1 text-[11px] opacity-70">(edited)</span>}
          </p>
          <div
            className={clsx(
              'mt-1.5 flex items-center justify-end gap-1.5 text-[11px]',
              isOwnMessage ? 'text-canvas/70' : 'text-muted'
            )}
          >
            <time dateTime={message.timestamp} title={formatFullDateTime(message.timestamp)}>
              {formatMessageTime(message.timestamp)}
            </time>
            {isOwnMessage && <DeliveryIcon message={message} />}
          </div>
        </div>
        {message.reactions?.length > 0 && (
          <div className={clsx('mt-1 flex flex-wrap gap-1', isOwnMessage ? 'justify-end' : 'justify-start')}>
            {message.reactions.map((reaction) => (
              <button
                aria-label={`Reaction ${reaction.emoji}`}
                className={clsx(
                  'rounded-full border px-2 py-0.5 text-xs shadow-sm',
                  reaction.reactedByMe
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-stroke bg-panel text-muted'
                )}
                key={reaction.emoji}
                onClick={() => onReact?.(message, reaction.reactedByMe ? null : reaction.emoji)}
                type="button"
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        )}
        {canUseActions && isActionBarOpen && (
          <div className={clsx('mt-1 flex flex-wrap gap-1', isOwnMessage ? 'justify-end' : 'justify-start')}>
            {onReply && (
              <button aria-label="Reply" className="icon-button h-8 w-8 bg-panel" onClick={() => onReply(message)} type="button">
                <Reply className="h-4 w-4" />
              </button>
            )}
            {onReact && (
              <>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-panel text-muted">
                  <Smile className="h-4 w-4" />
                </span>
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    aria-label={`React ${emoji}`}
                    className={clsx(
                      'h-8 min-w-8 rounded-md border border-stroke bg-panel px-2 text-sm transition hover:bg-raised',
                      ownReaction?.emoji === emoji && 'border-accent text-accent'
                    )}
                    key={emoji}
                    onClick={() => onReact(message, ownReaction?.emoji === emoji ? null : emoji)}
                    type="button"
                  >
                    {emoji}
                  </button>
                ))}
              </>
            )}
            {isOwnMessage && message.status === 'failed' && onRetry && (
              <button aria-label="Retry message" className="icon-button h-8 w-8 bg-panel" onClick={() => onRetry(message)} type="button">
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            {isOwnMessage && !message.isDeleted && onEdit && (
              <button aria-label="Edit message" className="icon-button h-8 w-8 bg-panel" onClick={handleEdit} type="button">
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {isOwnMessage && !message.isDeleted && onDelete && (
              <button aria-label="Delete message" className="icon-button h-8 w-8 bg-panel" onClick={() => onDelete(message)} type="button">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
};

export default MessageBubble;
