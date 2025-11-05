/**
 * Statistics aggregation utilities for calculating user performance metrics
 */

export interface SessionSummary {
  id: string;
  createdAt: Date | null;
  lastUpdated: Date | null;
  title: string | null;
  topicId: string | null;
  difficulty?: string | null;
  stats: {
    totalTurns?: number;
    hintsUsed?: number;
    durationSec?: number;
  } | null;
  completed?: boolean;
}

export interface AggregatedStats {
  totalSessions: number;
  hintsUsed: number;
  avgSolveSec: number;
}

export interface StreakData {
  current: number;
  longest: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

/**
 * Aggregates statistics from all sessions
 * @param sessions - Array of session summaries
 * @returns Aggregated statistics
 */
export const aggregateStats = (sessions: SessionSummary[]): AggregatedStats => {
  // Include completed sessions AND sessions with meaningful stats (hints used or duration)
  // This ensures active sessions with progress are counted in the dashboard
  const sessionsToCount = sessions.filter((session) => {
    // Always count completed sessions
    if (session.completed === true) {
      return true;
    }
    // Also count sessions that have meaningful stats (active sessions with progress)
    if (session.stats) {
      const hasHints = (session.stats.hintsUsed ?? 0) > 0;
      const hasDuration = (session.stats.durationSec ?? 0) > 0;
      return hasHints || hasDuration;
    }
    return false;
  });

  const totalSessions = sessionsToCount.length;

  let totalHintsUsed = 0;
  let totalDurationSec = 0;
  let durationCount = 0;

  sessionsToCount.forEach((session) => {
    if (session.stats) {
      const hintsUsed = session.stats.hintsUsed ?? 0;
      const durationSec = session.stats.durationSec;

      totalHintsUsed += hintsUsed;

      if (durationSec !== undefined && durationSec !== null && durationSec > 0) {
        totalDurationSec += durationSec;
        durationCount++;
      }
    }
  });

  const avgSolveSec = durationCount > 0 ? totalDurationSec / durationCount : 0;

  return {
    totalSessions,
    hintsUsed: totalHintsUsed,
    avgSolveSec,
  };
};

/**
 * Calculates current and longest streaks from session dates
 * @param sessions - Array of session summaries (should be completed sessions)
 * @returns Streak data with current and longest streak in days
 */
export const calculateStreaks = (sessions: SessionSummary[]): StreakData => {
  const completedSessions = sessions.filter((session) => session.completed === true);

  if (completedSessions.length === 0) {
    return { current: 0, longest: 0 };
  }

  // Get unique dates (by day) from completed sessions
  const sessionDates = completedSessions
    .map((session) => {
      const date = session.createdAt || session.lastUpdated;
      if (!date) return null;
      // Normalize to start of day
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      return dayStart.getTime();
    })
    .filter((timestamp): timestamp is number => timestamp !== null)
    .sort((a, b) => b - a); // Sort descending (most recent first)

  if (sessionDates.length === 0) {
    return { current: 0, longest: 0 };
  }

  const uniqueDates = Array.from(new Set(sessionDates));

  // Calculate current streak (starting from today)
  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  let checkDate = todayTime;
  let dateIndex = 0;

  // Check if today has a session
  if (uniqueDates.includes(todayTime)) {
    currentStreak = 1;
    dateIndex = 1;
    checkDate = todayTime - 86400000; // Move to yesterday
  } else {
    // Check if yesterday has a session (start streak from yesterday)
    const yesterdayTime = todayTime - 86400000;
    if (uniqueDates.includes(yesterdayTime)) {
      currentStreak = 1;
      dateIndex = 1;
      checkDate = yesterdayTime - 86400000; // Move to day before yesterday
    }
  }

  // Continue counting backwards
  while (dateIndex < uniqueDates.length) {
    const nextDate = uniqueDates[dateIndex];
    if (nextDate === checkDate) {
      currentStreak++;
      dateIndex++;
      checkDate -= 86400000; // Move back one day
    } else {
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 1;
  let tempStreak = 1;

  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const currentDate = uniqueDates[i];
    const nextDate = uniqueDates[i + 1];
    const diffDays = (currentDate - nextDate) / 86400000;

    if (diffDays === 1) {
      // Consecutive days
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      // Streak broken
      tempStreak = 1;
    }
  }

  return {
    current: currentStreak,
    longest: longestStreak,
  };
};

/**
 * Generates chart data for the last N weeks
 * @param sessions - Array of session summaries
 * @param weeks - Number of weeks to include (default: 4)
 * @returns Array of chart data points
 */
export const generateChartData = (
  sessions: SessionSummary[],
  weeks: number = 4,
): ChartDataPoint[] => {
  // Include completed sessions AND sessions with meaningful stats for chart
  const sessionsToCount = sessions.filter((session) => {
    if (session.completed === true) {
      return true;
    }
    // Also count sessions that have meaningful stats (active sessions with progress)
    if (session.stats) {
      const hasHints = (session.stats.hintsUsed ?? 0) > 0;
      const hasDuration = (session.stats.durationSec ?? 0) > 0;
      return hasHints || hasDuration;
    }
    return false;
  });

  if (sessionsToCount.length === 0) {
    // Return empty weeks
    return Array.from({ length: weeks }, (_, i) => ({
      label: `Week ${i + 1}`,
      value: 0,
    }));
  }

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
  weekStart.setHours(0, 0, 0, 0);

  const weekData: ChartDataPoint[] = [];

  for (let i = 0; i < weeks; i++) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7); // End of week (next Sunday)

    const weekLabel = i === 0 ? 'This Week' : i === 1 ? 'Last Week' : `Week ${weeks - i}`;

    // Count sessions in this week
    const sessionCount = sessionsToCount.filter((session) => {
      const sessionDate = session.createdAt || session.lastUpdated;
      if (!sessionDate) return false;

      const sessionTime = sessionDate.getTime();
      return sessionTime >= weekStart.getTime() && sessionTime < weekEnd.getTime();
    }).length;

    weekData.push({
      label: weekLabel,
      value: sessionCount,
    });

    // Move to previous week
    weekStart.setDate(weekStart.getDate() - 7);
  }

  // Reverse to show oldest week first
  return weekData.reverse();
};
