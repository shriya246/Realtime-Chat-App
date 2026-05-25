/**
 * Purpose: Renders a consistent compact presence indicator for users.
 */

import clsx from 'clsx';

/**
 * Displays online or offline presence as a status dot.
 *
 * @param {{ isOnline: boolean, className?: string }} props - Presence display properties.
 * @returns {JSX.Element} Status marker.
 */
const OnlineIndicator = ({ isOnline, className }) => (
  <span
    aria-label={isOnline ? 'Online' : 'Offline'}
    className={clsx(
      'inline-block h-2.5 w-2.5 shrink-0 rounded-full',
      isOnline ? 'bg-accent' : 'bg-muted/45',
      className
    )}
    title={isOnline ? 'Online' : 'Offline'}
  />
);

export default OnlineIndicator;
