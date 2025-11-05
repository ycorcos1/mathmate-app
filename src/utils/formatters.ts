/**
 * Formatting utilities for displaying dates, times, and durations
 */

/**
 * Formats a duration in seconds to a human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string like "2m 30s", "1h 15m", or "—" if invalid
 */
export const formatDuration = (seconds: number | undefined | null): string => {
  if (seconds === undefined || seconds === null || seconds < 0 || !Number.isFinite(seconds)) {
    return '—';
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
};

/**
 * Formats a date to a readable string
 * @param date - Date object or null
 * @returns Formatted string like "Jan 15, 2025" or "—" if invalid
 */
export const formatDate = (date: Date | null | undefined): string => {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Formats a date to include time
 * @param date - Date object or null
 * @returns Formatted string like "Jan 15, 2025 at 3:45 PM" or "—" if invalid
 */
export const formatDateTime = (date: Date | null | undefined): string => {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Formats a date to show relative time (e.g., "2 hours ago", "Yesterday")
 * @param date - Date object or null
 * @returns Formatted relative string or "—" if invalid
 */
export const formatRelativeTime = (date: Date | null | undefined): string => {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '—';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'Just now';
  }

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  }

  if (diffDays === 1) {
    return 'Yesterday';
  }

  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return formatDate(date);
};
