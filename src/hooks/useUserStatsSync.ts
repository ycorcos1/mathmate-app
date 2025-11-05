import { useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { firestore } from '../firebase';
import { useSessionStats } from './useSessionStats';

/**
 * Hook to sync aggregated session statistics to user document
 * Updates user document stats when sessions change
 */
export const useUserStatsSync = () => {
  const { user } = useAuth();
  const { stats, loading } = useSessionStats();
  const lastSyncedStatsRef = useRef<{
    sessionsCount: number;
    hintsUsed: number;
    avgSolveSec: number;
  } | null>(null);

  useEffect(() => {
    if (!user || loading) {
      return;
    }

    // Check if stats have actually changed
    const currentStats = {
      sessionsCount: stats.totalSessions,
      hintsUsed: stats.hintsUsed,
      avgSolveSec: Math.round(stats.avgSolveSec),
    };

    const lastStats = lastSyncedStatsRef.current;

    const statsChanged =
      !lastStats ||
      lastStats.sessionsCount !== currentStats.sessionsCount ||
      lastStats.hintsUsed !== currentStats.hintsUsed ||
      lastStats.avgSolveSec !== currentStats.avgSolveSec;

    if (!statsChanged) {
      return;
    }

    // Debounce updates to avoid excessive writes
    const timeoutId = setTimeout(() => {
      const userRef = doc(firestore, 'users', user.uid);

      updateDoc(userRef, {
        stats: {
          sessionsCount: currentStats.sessionsCount,
          hintsUsed: currentStats.hintsUsed,
          avgSolveSec: currentStats.avgSolveSec,
        },
      })
        .then(() => {
          lastSyncedStatsRef.current = currentStats;
        })
        .catch((error) => {
          console.error('Failed to sync user stats', error);
        });
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [user, stats, loading]);
};
