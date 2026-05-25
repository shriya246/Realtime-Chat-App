/**
 * Purpose: Displays one delivered or optimistic chat message with ownership-aware alignment.
 */

import clsx from 'clsx';
import { AlertCircle, CheckCheck, Clock3 } from 'lucide-react';

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

  if (message.isPending) {
    return (
      <Clock3
        aria-label={message.status === 'queued' ? 'Queued for reconnect' : 'Sending'}
        className="h-3.5 w-3.5 text-muted"
      />
    );
  }

  return <CheckCheck aria-label="Delivered" className="h-3.5 w-3.5 text-accent" />;
};

/**
 * Renders a chat message from the current user or another sender.
 *
 * @param {{ message: object, currentUserId: string }} props - Message and active-user identifiers.
 * @returns {JSX.Element} Message bubble.
 */
const MessageBubble = ({ message, currentUserId }) => {
  const isOwnMessage = message.sender?.id === currentUserId;

  return (
    <article className={clsx('flex w-full py-1', isOwnMessage ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[82%] sm:max-w-[68%]', isOwnMessage ? 'items-end' : 'items-start')}>
        {!isOwnMessage && (
          <p className="mb-1 px-1 text-xs font-medium text-muted">{message.sender?.username || 'Unknown user'}</p>
        )}
        <div
          className={clsx(
            'rounded-md px-3.5 py-2.5 text-sm leading-relaxed',
            isOwnMessage ? 'bg-accent text-canvas' : 'border border-stroke bg-raised text-ink'
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
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
      </div>
    </article>
  );
};

export default MessageBubble;
