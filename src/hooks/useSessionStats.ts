import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { firestore } from '../firebase';
import {
  aggregateStats,
  calculateStreaks,
  generateChartData,
  type AggregatedStats,
  type ChartDataPoint,
  type SessionSummary,
  type StreakData,
} from '../utils/statsAggregator';

interface UseSessionStatsState {
  sessions: SessionSummary[];
  stats: AggregatedStats;
  streaks: StreakData;
  chartData: ChartDataPoint[];
  loading: boolean;
  error: Error | null;
}

const initialState: UseSessionStatsState = {
  sessions: [],
  stats: {
    totalSessions: 0,
    hintsUsed: 0,
    avgSolveSec: 0,
  },
  streaks: {
    current: 0,
    longest: 0,
  },
  chartData: [],
  loading: true,
  error: null,
};

/**
 * Hook to fetch and aggregate session statistics
 * @returns Session stats, streaks, chart data, and loading/error states
 */
export const useSessionStats = () => {
  const { user } = useAuth();
  const [state, setState] = useState<UseSessionStatsState>(initialState);

  useEffect(() => {
    if (!user) {
      setState(initialState);
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const sessionsCollection = collection(firestore, 'users', user.uid, 'sessions');
    const sessionsQuery = query(sessionsCollection, orderBy('lastUpdated', 'desc'));

    const unsubscribe = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setState({
            sessions: [],
            stats: {
              totalSessions: 0,
              hintsUsed: 0,
              avgSolveSec: 0,
            },
            streaks: {
              current: 0,
              longest: 0,
            },
            chartData: generateChartData([]),
            loading: false,
            error: null,
          });
          return;
        }

        const summaries: SessionSummary[] = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data() as {
            createdAt?: Timestamp | null;
            lastUpdated?: Timestamp | null;
            title?: unknown;
            topicId?: unknown;
            stats?: unknown;
            completed?: boolean;
            difficulty?: unknown;
          };

          let normalizedStats: SessionSummary['stats'] = null;
          if (data.stats && typeof data.stats === 'object') {
            const statsRecord = data.stats as Record<string, unknown>;
            normalizedStats = {
              totalTurns:
                typeof statsRecord.totalTurns === 'number' ? statsRecord.totalTurns : undefined,
              hintsUsed:
                typeof statsRecord.hintsUsed === 'number' ? statsRecord.hintsUsed : undefined,
              durationSec:
                typeof statsRecord.durationSec === 'number' ? statsRecord.durationSec : undefined,
            };
          }

          const rawTitle = typeof data.title === 'string' ? data.title.trim() : '';
          const rawTopic = typeof data.topicId === 'string' ? data.topicId.trim() : '';
          const completed = typeof data.completed === 'boolean' ? data.completed : false;
          const rawDifficulty =
            typeof data.difficulty === 'string' ? data.difficulty.trim().toLowerCase() : '';

          return {
            id: docSnapshot.id,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
            lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate() : null,
            title: rawTitle || null,
            topicId: rawTopic || null,
            difficulty: rawDifficulty || null,
            stats: normalizedStats,
            completed,
          } satisfies SessionSummary;
        });

        // Aggregate stats
        const stats = aggregateStats(summaries);
        const streaks = calculateStreaks(summaries);
        const chartData = generateChartData(summaries, 4);

        setState({
          sessions: summaries,
          stats,
          streaks,
          chartData,
          loading: false,
          error: null,
        });
      },
      (error) => {
        console.error('Failed to subscribe to sessions for stats', error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error as Error,
        }));
      },
    );

    return () => unsubscribe();
  }, [user]);

  return useMemo(
    () => ({
      sessions: state.sessions,
      stats: state.stats,
      streaks: state.streaks,
      chartData: state.chartData,
      loading: state.loading,
      error: state.error,
    }),
    [state],
  );
};
