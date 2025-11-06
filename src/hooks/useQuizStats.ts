import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { firestore } from '../firebase';
import { aggregateQuizStats } from '../utils/quizStatsAggregator';
import type { QuizAggregatedStats, QuizResultRecord, QuizStatsState } from '../types/quiz';

const initialStats: QuizAggregatedStats = {
  totalQuizzes: 0,
  averageScore: 0,
  recentScore: null,
};

const initialState: QuizStatsState = {
  summaries: [],
  stats: initialStats,
  loading: true,
  error: null,
};

export const useQuizStats = () => {
  const { user } = useAuth();
  const [state, setState] = useState<QuizStatsState>(initialState);

  useEffect(() => {
    if (!user) {
      setState(initialState);
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const quizzesCollection = collection(firestore, 'users', user.uid, 'quizzes');
    const quizzesQuery = query(quizzesCollection, orderBy('completedAt', 'desc'));

    const unsubscribe = onSnapshot(
      quizzesQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setState({
            summaries: [],
            stats: initialStats,
            loading: false,
            error: null,
          });
          return;
        }

        const summaries: QuizResultRecord[] = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data() as {
            topicId?: unknown;
            difficulty?: unknown;
            totalQuestions?: unknown;
            correctCount?: unknown;
            scorePercent?: unknown;
            createdAt?: Timestamp | null;
            completedAt?: Timestamp | null;
          };

          const totalQuestions =
            typeof data.totalQuestions === 'number' && Number.isFinite(data.totalQuestions)
              ? data.totalQuestions
              : 0;
          const correctCount =
            typeof data.correctCount === 'number' && Number.isFinite(data.correctCount)
              ? data.correctCount
              : 0;
          const scorePercent =
            typeof data.scorePercent === 'number' && Number.isFinite(data.scorePercent)
              ? data.scorePercent
              : 0;

          return {
            id: docSnapshot.id,
            topicId: typeof data.topicId === 'string' ? data.topicId : null,
            difficulty:
              data.difficulty === 'beginner' ||
              data.difficulty === 'intermediate' ||
              data.difficulty === 'advanced'
                ? data.difficulty
                : 'intermediate',
            totalQuestions,
            correctCount,
            scorePercent,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
            completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toDate() : null,
          } satisfies QuizResultRecord;
        });

        const stats = aggregateQuizStats(summaries);

        setState({
          summaries,
          stats,
          loading: false,
          error: null,
        });
      },
      (error) => {
        console.error('Failed to subscribe to quiz stats', error);
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
      summaries: state.summaries,
      stats: state.stats,
      loading: state.loading,
      error: state.error,
    }),
    [state],
  );
};
