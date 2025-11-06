import type { GeneratedProblem, ProblemGenerationParams } from '../types/problem';

const DEFAULT_REGION = 'us-central1';

const isSupportedDifficulty = (value: unknown): value is GeneratedProblem['difficulty'] =>
  value === 'beginner' || value === 'intermediate' || value === 'advanced';

const sanitizeTopicId = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'general';

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

export const callGenerateProblem = async (
  params: ProblemGenerationParams,
): Promise<GeneratedProblem> => {
  const baseUrl = resolveFunctionsBaseUrl();
  const response = await fetch(`${baseUrl}/generateProblem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: params.topicId ?? null,
      difficulty: params.difficulty ?? null,
      recentProblems: params.recentProblems ?? null,
      mode: params.mode ?? 'tutor',
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => 'Unknown error');
    throw new Error(`generateProblem failed: ${response.status} ${details}`);
  }

  const payload = (await response.json()) as Partial<GeneratedProblem>;

  if (!payload || typeof payload.problemText !== 'string') {
    throw new Error('generateProblem returned an invalid payload.');
  }

  const topicId =
    typeof payload.topicId === 'string' && payload.topicId.trim()
      ? sanitizeTopicId(payload.topicId)
      : params.topicId
        ? sanitizeTopicId(params.topicId)
        : 'general';

  const difficulty: GeneratedProblem['difficulty'] = isSupportedDifficulty(payload.difficulty)
    ? payload.difficulty
    : params.difficulty && isSupportedDifficulty(params.difficulty)
      ? params.difficulty
      : 'intermediate';

  return {
    problemText: payload.problemText.trim(),
    topicId,
    difficulty,
    suggestedHint:
      typeof payload.suggestedHint === 'string' && payload.suggestedHint.trim()
        ? payload.suggestedHint.trim()
        : undefined,
    title:
      typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : undefined,
  } satisfies GeneratedProblem;
};
