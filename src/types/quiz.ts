import type { ProblemDifficulty } from './problem';

export type QuizPhase = 'setup' | 'generating' | 'inProgress' | 'grading' | 'review';

export interface QuizQuestion {
  id: string;
  problemText: string;
  topicId: string;
  difficulty: ProblemDifficulty;
  suggestedHint?: string | null;
}

export interface QuizQuestionResponse extends QuizQuestion {
  userAnswer: string;
  evaluation?: QuizQuestionEvaluation;
}

export interface QuizQuestionEvaluation {
  isCorrect: boolean;
  correctAnswer?: string | null;
  explanation?: string | null;
  feedback?: string | null;
}

export interface QuizResultRecord {
  id: string;
  topicId?: string | null;
  difficulty: ProblemDifficulty;
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  createdAt: Date | null;
  completedAt: Date | null;
}

export interface StoredQuizQuestion extends QuizQuestionResponse {
  evaluation: QuizQuestionEvaluation;
}

export interface StoredQuizRecord {
  topicId?: string | null;
  difficulty: ProblemDifficulty;
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  createdAt: Date | null;
  completedAt: Date | null;
  questions: StoredQuizQuestion[];
}

export interface QuizAggregatedStats {
  totalQuizzes: number;
  averageScore: number;
  recentScore: number | null;
}

export interface QuizStatsState {
  summaries: QuizResultRecord[];
  stats: QuizAggregatedStats;
  loading: boolean;
  error: Error | null;
}
