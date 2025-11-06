export type ProblemDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface ProblemGenerationParams {
  topicId?: string;
  difficulty?: ProblemDifficulty;
  recentProblems?: Array<{ topicId: string; problemText: string; timestamp: number }>;
  mode?: 'quiz' | 'tutor';
}

export interface GeneratedProblem {
  problemText: string;
  topicId: string;
  difficulty: ProblemDifficulty;
  suggestedHint?: string | null;
  title?: string | null;
}

export interface ProblemTopic {
  id: string;
  label: string;
  description: string;
  samplePrompt: string;
}
