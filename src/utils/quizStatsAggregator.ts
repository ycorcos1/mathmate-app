import type { QuizAggregatedStats, QuizResultRecord } from '../types/quiz';

const clampScore = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
};

export const aggregateQuizStats = (summaries: QuizResultRecord[]): QuizAggregatedStats => {
  if (summaries.length === 0) {
    return {
      totalQuizzes: 0,
      averageScore: 0,
      recentScore: null,
    };
  }

  const completed = summaries.filter((summary) => summary.completedAt !== null);

  if (completed.length === 0) {
    return {
      totalQuizzes: summaries.length,
      averageScore: 0,
      recentScore: null,
    };
  }

  const scores = completed
    .map((summary) => clampScore(summary.scorePercent))
    .filter((value) => Number.isFinite(value));

  const totalQuizzes = completed.length;
  const sumScores = scores.reduce((total, value) => total + value, 0);
  const averageScore = scores.length > 0 ? sumScores / scores.length : 0;
  const recentScore = scores.length > 0 ? scores[0] : null;

  return {
    totalQuizzes,
    averageScore,
    recentScore,
  };
};
