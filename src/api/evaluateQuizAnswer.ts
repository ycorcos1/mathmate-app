import type { ProblemDifficulty } from '../types/problem';
import type { QuizQuestionEvaluation } from '../types/quiz';

const DEFAULT_REGION = 'us-central1';

const resolveFunctionsBaseUrl = () => {
  const explicit = import.meta.env.VITE_FUNCTIONS_BASE_URL;

  if (explicit && typeof explicit === 'string') {
    return explicit.replace(/\/$/, '');
  }

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('VITE_FIREBASE_PROJECT_ID is required to resolve Functions base URL.');
  }

  return `https://${DEFAULT_REGION}-${projectId}.cloudfunctions.net`;
};

export interface EvaluateQuizAnswerParams {
  question: string;
  userAnswer: string;
  difficulty: ProblemDifficulty;
}

export interface EvaluateQuizAnswerResponse extends QuizQuestionEvaluation {}

export const evaluateQuizAnswer = async (
  params: EvaluateQuizAnswerParams,
): Promise<EvaluateQuizAnswerResponse> => {
  const baseUrl = resolveFunctionsBaseUrl();
  const response = await fetch(`${baseUrl}/evaluateQuizAnswer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: params.question,
      userAnswer: params.userAnswer,
      difficulty: params.difficulty,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => 'Unknown error');
    throw new Error(`evaluateQuizAnswer failed: ${response.status} ${details}`);
  }

  const payload = (await response.json()) as Partial<QuizQuestionEvaluation>;

  return {
    isCorrect: payload?.isCorrect === true,
    correctAnswer: typeof payload?.correctAnswer === 'string' ? payload.correctAnswer : null,
    explanation: typeof payload?.explanation === 'string' ? payload.explanation : null,
    feedback: typeof payload?.feedback === 'string' ? payload.feedback : null,
  } satisfies QuizQuestionEvaluation;
};
