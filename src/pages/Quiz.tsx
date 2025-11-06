import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { firestore } from '../firebase';
import { MathText } from '../components/MathText';
import { LoadingScreen } from '../components/LoadingScreen';
import { PROBLEM_TOPICS, DIFFICULTY_OPTIONS, generateProblem } from '../utils/problemGenerator';
import type { ProblemDifficulty } from '../types/problem';
import type {
  QuizPhase,
  QuizQuestion,
  QuizQuestionEvaluation,
  QuizQuestionResponse,
} from '../types/quiz';
import { evaluateQuizAnswer } from '../api/evaluateQuizAnswer';
import {
  callGenerateResponseStream,
  type ChatMessagePayload,
  type StreamingChunk,
} from '../api/generateResponse';

type ReviewChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ReviewChatState = {
  messages: ReviewChatMessage[];
  isStreaming: boolean;
  pendingContent: string;
  error: string | null;
};

interface SetupFormState {
  topicId: string;
  difficulty: ProblemDifficulty;
  questionCount: number;
}

const DEFAULT_SETUP_STATE: SetupFormState = {
  topicId: '',
  difficulty: 'intermediate',
  questionCount: 10,
};

const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 15;

const clampQuestionCount = (value: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_SETUP_STATE.questionCount;
  }
  return Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, Math.floor(value)));
};

const createQuestionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `quiz-question-${Math.random().toString(36).slice(2, 10)}`;
};

const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

const QuizPage = () => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<QuizPhase>('setup');
  const [setupState, setSetupState] = useState<SetupFormState>(DEFAULT_SETUP_STATE);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [responses, setResponses] = useState<QuizQuestionResponse[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [gradingProgress, setGradingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDocId, setQuizDocId] = useState<string | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewChats, setReviewChats] = useState<Record<string, ReviewChatState>>({});
  const initialReviewRequestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setPhase('setup');
      setQuestions([]);
      setResponses([]);
      setCurrentIndex(0);
      setQuizDocId(null);
    }
  }, [user]);

  const totalQuestions = questions.length;

  const incorrectQuestions = useMemo(
    () => responses.filter((response) => response.evaluation && !response.evaluation.isCorrect),
    [responses],
  );

  const currentQuestion = responses[currentIndex];
  const currentReviewQuestion = incorrectQuestions[reviewIndex] ?? null;

  useEffect(() => {
    if (phase !== 'review' || !currentReviewQuestion) {
      return;
    }

    if (initialReviewRequestedRef.current.has(currentReviewQuestion.id)) {
      return;
    }

    initialReviewRequestedRef.current.add(currentReviewQuestion.id);
    void startReviewChat(currentReviewQuestion, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentReviewQuestion]);

  const handleSetupChange = (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = event.target;

    setSetupState((prev) => {
      if (name === 'topicId') {
        return { ...prev, topicId: value };
      }
      if (
        name === 'difficulty' &&
        (value === 'beginner' || value === 'intermediate' || value === 'advanced')
      ) {
        return { ...prev, difficulty: value };
      }
      if (name === 'questionCount') {
        const parsed = Number.parseInt(value, 10);
        return { ...prev, questionCount: clampQuestionCount(parsed) };
      }
      return prev;
    });
  };

  const handleSetupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || isGenerating) {
      return;
    }

    setError(null);
    setIsGenerating(true);
    setPhase('generating');

    try {
      // Generate all questions in parallel for faster loading
      const questionPromises = Array.from({ length: setupState.questionCount }, () =>
        generateProblem({
          topicId: setupState.topicId || undefined,
          difficulty: setupState.difficulty,
          recentProblems: [],
          mode: 'quiz',
        }),
      );

      const generatedResults = await Promise.all(questionPromises);

      const generatedQuestions: QuizQuestion[] = generatedResults.map((generated) => ({
        id: createQuestionId(),
        problemText: generated.problemText,
        topicId: generated.topicId,
        difficulty: generated.difficulty,
        suggestedHint: generated.suggestedHint ?? null,
      }));

      setQuestions(generatedQuestions);
      setResponses(
        generatedQuestions.map((question) => ({
          ...question,
          userAnswer: '',
        })),
      );
      setCurrentIndex(0);
      setPhase('inProgress');
    } catch (generationError) {
      console.error('Failed to generate quiz questions', generationError);
      setError('We could not generate quiz questions right now. Please try again.');
      setPhase('setup');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswerChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setResponses((prev) =>
      prev.map((response, index) =>
        index === currentIndex
          ? {
              ...response,
              userAnswer: value,
            }
          : response,
      ),
    );
  };

  const goToNextQuestion = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions - 1));
  };

  const goToPreviousQuestion = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const gradeQuiz = async () => {
    if (!user || responses.length === 0 || isGrading) {
      return;
    }

    setPhase('grading');
    setIsGrading(true);
    setGradingProgress(0);
    setError(null);

    const updatedResponses: QuizQuestionResponse[] = [];
    let nextCorrectCount = 0;

    const quizId = doc(collection(firestore, 'users', user.uid, 'quizzes')).id;
    const startedAt = new Date();

    for (let i = 0; i < responses.length; i += 1) {
      const response = responses[i];
      try {
        const evaluation = await evaluateQuizAnswer({
          question: response.problemText,
          userAnswer: response.userAnswer || '(no answer provided)',
          difficulty: response.difficulty,
        });

        if (evaluation.isCorrect) {
          nextCorrectCount += 1;
        }

        updatedResponses.push({
          ...response,
          evaluation,
        });
      } catch (evaluationError) {
        console.error('Failed to evaluate quiz answer', evaluationError);
        const fallbackEvaluation: QuizQuestionEvaluation = {
          isCorrect: false,
          explanation:
            'We had trouble checking this answer automatically. Review the problem and try walking through it again.',
          feedback: null,
          correctAnswer: null,
        };
        updatedResponses.push({
          ...response,
          evaluation: fallbackEvaluation,
        });
      }

      setGradingProgress((i + 1) / responses.length);
    }

    setResponses(updatedResponses);
    setCorrectCount(nextCorrectCount);

    const scorePercent = responses.length > 0 ? (nextCorrectCount / responses.length) * 100 : 0;
    setQuizScore(scorePercent);

    const quizRecord = {
      topicId: setupState.topicId || null,
      difficulty: setupState.difficulty,
      totalQuestions: responses.length,
      correctCount: nextCorrectCount,
      scorePercent,
      createdAt: startedAt,
      completedAt: new Date(),
      questions: updatedResponses.map((item) => ({
        id: item.id,
        problemText: item.problemText,
        topicId: item.topicId,
        difficulty: item.difficulty,
        suggestedHint: item.suggestedHint ?? null,
        userAnswer: item.userAnswer,
        evaluation: item.evaluation as QuizQuestionEvaluation,
      })),
    };

    try {
      const quizRef = doc(firestore, 'users', user.uid, 'quizzes', quizId);
      await setDoc(quizRef, {
        ...quizRecord,
        createdAt: serverTimestamp(),
        completedAt: serverTimestamp(),
      });
      setQuizDocId(quizId);
    } catch (writeError) {
      console.error('Failed to store quiz results', writeError);
      setError(
        'Quiz results were calculated, but we could not save them. They will not appear on the dashboard until saved.',
      );
    }

    setPhase('review');
    setReviewIndex(0);
    setIsGrading(false);
  };

  const resetQuiz = () => {
    setPhase('setup');
    setQuestions([]);
    setResponses([]);
    setCurrentIndex(0);
    setCorrectCount(0);
    setQuizScore(0);
    setQuizDocId(null);
    setReviewIndex(0);
    setReviewChats({});
    initialReviewRequestedRef.current.clear();
  };

  const startReviewChat = async (question: QuizQuestionResponse, initial = false) => {
    const existing = reviewChats[question.id];
    if (existing?.isStreaming) {
      return;
    }

    const promptBase = initial
      ? `I took a quiz and this question was marked as incorrect. Please guide me step by step, using questions when possible, so I can understand the correct approach.

Question:
${question.problemText}

My answer:
${question.userAnswer || '(no answer provided)'}

${question.evaluation?.correctAnswer ? `Correct answer: ${question.evaluation.correctAnswer}` : ''}
${question.evaluation?.explanation ? `Explanation: ${question.evaluation.explanation}` : ''}

Please help me understand where I went wrong and guide me to the correct solution. If my answer is actually correct, please acknowledge that and explain why.`
      : null;

    if (initial && promptBase) {
      setReviewChats((prev) => ({
        ...prev,
        [question.id]: {
          messages: [
            {
              id: `user-${Date.now()}`,
              role: 'user',
              content: promptBase,
            },
          ],
          isStreaming: true,
          pendingContent: '',
          error: null,
        },
      }));
      await streamReviewResponse(question.id, [{ role: 'user', content: promptBase }]);
      return;
    }
  };

  const streamReviewResponse = async (questionId: string, messages: ChatMessagePayload[]) => {
    let streamingContent = '';
    try {
      await callGenerateResponseStream(messages, 'default', (chunk: StreamingChunk) => {
        if (chunk.error) {
          throw new Error(chunk.error);
        }

        if (typeof chunk.content === 'string') {
          streamingContent = chunk.content;
          setReviewChats((prev) => {
            const current = prev[questionId];
            if (!current) {
              return prev;
            }
            return {
              ...prev,
              [questionId]: {
                ...current,
                pendingContent: streamingContent,
              },
            };
          });
        }
      });

      setReviewChats((prev) => {
        const current = prev[questionId];
        if (!current) {
          return prev;
        }

        const updatedMessages: ReviewChatMessage[] = [
          ...current.messages,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant' as const,
            content: streamingContent,
          },
        ];

        return {
          ...prev,
          [questionId]: {
            messages: updatedMessages,
            isStreaming: false,
            pendingContent: '',
            error: null,
          },
        };
      });
    } catch (streamError) {
      console.error('Failed to stream review response', streamError);
      setReviewChats((prev) => {
        const current = prev[questionId];
        if (!current) {
          return prev;
        }

        return {
          ...prev,
          [questionId]: {
            ...current,
            isStreaming: false,
            pendingContent: '',
            error: 'We ran into an issue continuing the explanation. Try again.',
          },
        };
      });
    }
  };

  const handleReviewMessageSend = async (question: QuizQuestionResponse, content: string) => {
    if (!content.trim()) {
      return;
    }

    const existing = reviewChats[question.id];
    const newMessage: ReviewChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };

    const updatedMessages = existing ? [...existing.messages, newMessage] : [newMessage];

    setReviewChats((prev) => ({
      ...prev,
      [question.id]: {
        messages: updatedMessages,
        isStreaming: true,
        pendingContent: '',
        error: null,
      },
    }));

    const payloadMessages: ChatMessagePayload[] = updatedMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    await streamReviewResponse(question.id, payloadMessages);
  };

  if (!user) {
    return <LoadingScreen />;
  }

  if (phase === 'generating' || isGenerating) {
    return <LoadingScreen />;
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-brand-charcoal">Quiz Mode</h1>
        <p className="text-sm text-brand-slate">
          Take a timed set of questions and review anything you miss with the AI tutor.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-brand-coral/40 bg-[#FEE2E2] px-4 py-3 text-sm text-brand-charcoal">
          {error}
        </div>
      ) : null}

      {phase === 'setup' ? (
        <section className="rounded-2xl border border-brand-mint/60 bg-white p-6 shadow-subtle">
          <form className="space-y-5" onSubmit={handleSetupSubmit}>
            <div>
              <h2 className="text-lg font-semibold text-brand-charcoal">Quiz Setup</h2>
              <p className="mt-2 text-sm text-brand-slate">
                Choose a focus and difficulty. MathMate will generate fresh questions for you.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-brand-charcoal">
                Topic focus
                <select
                  name="topicId"
                  value={setupState.topicId}
                  onChange={handleSetupChange}
                  className="rounded-xl border border-brand-mint/60 bg-white px-3 py-2 text-sm text-brand-charcoal outline-none transition focus:border-brand-sky"
                >
                  <option value="">Let MathMate choose</option>
                  {PROBLEM_TOPICS.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-normal text-brand-slate">
                  {setupState.topicId
                    ? (PROBLEM_TOPICS.find((topic) => topic.id === setupState.topicId)
                        ?.description ?? 'Practice a focused concept.')
                    : 'Leave blank to get a balanced mix of topics.'}
                </span>
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-brand-charcoal">
                Difficulty
                <select
                  name="difficulty"
                  value={setupState.difficulty}
                  onChange={handleSetupChange}
                  className="rounded-xl border border-brand-mint/60 bg-white px-3 py-2 text-sm text-brand-charcoal outline-none transition focus:border-brand-sky"
                >
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-normal text-brand-slate">
                  {
                    DIFFICULTY_OPTIONS.find((option) => option.value === setupState.difficulty)
                      ?.description
                  }
                </span>
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-brand-charcoal">
                Number of questions
                <input
                  name="questionCount"
                  type="number"
                  min={MIN_QUESTIONS}
                  max={MAX_QUESTIONS}
                  value={setupState.questionCount}
                  onChange={handleSetupChange}
                  className="rounded-xl border border-brand-mint/60 bg-white px-3 py-2 text-sm text-brand-charcoal outline-none transition focus:border-brand-sky"
                />
                <span className="text-xs font-normal text-brand-slate">
                  Between {MIN_QUESTIONS} and {MAX_QUESTIONS} questions
                </span>
              </label>
            </div>

            <div className="flex flex-wrap justify-between gap-3">
              <p className="text-xs text-brand-slate">
                Each quiz is unique. After finishing, you can drill into any missed questions with
                the tutor.
              </p>
              <button
                type="submit"
                className="rounded-full bg-brand-sky px-5 py-3 text-sm font-medium text-white shadow-subtle transition hover:bg-brand-sky/90"
                disabled={isGenerating}
              >
                {isGenerating ? 'Preparing…' : 'Start Quiz'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {phase === 'inProgress' && currentQuestion ? (
        <section className="flex flex-1 flex-col gap-5 rounded-2xl border border-brand-mint/60 bg-white p-6 shadow-subtle">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-brand-slate">
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <div className="flex gap-2 text-xs text-brand-slate">
              <span className="rounded-full bg-brand-mint/40 px-3 py-1">
                Difficulty: {currentQuestion.difficulty}
              </span>
              {currentQuestion.topicId ? (
                <span className="rounded-full bg-brand-sky/20 px-3 py-1">
                  Topic: {currentQuestion.topicId}
                </span>
              ) : null}
            </div>
          </div>

          <article className="space-y-4 rounded-xl border border-brand-mint/60 bg-brand-background p-4">
            <MathText content={currentQuestion.problemText} />
            {currentQuestion.suggestedHint ? (
              <div className="rounded-xl border border-brand-sky/40 bg-brand-sky/10 px-3 py-2 text-sm text-brand-charcoal">
                <strong className="font-semibold">Hint:</strong> {currentQuestion.suggestedHint}
              </div>
            ) : null}
          </article>

          <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-brand-charcoal">
            Your answer
            <textarea
              value={currentQuestion.userAnswer}
              onChange={handleAnswerChange}
              className="min-h-40 flex-1 rounded-2xl border border-brand-mint/60 bg-white px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-brand-sky"
              placeholder="Write your solution or final answer here…"
            />
          </label>

          <div className="flex flex-wrap justify-between gap-3">
            <button
              type="button"
              onClick={goToPreviousQuestion}
              className="rounded-full border border-brand-slate px-4 py-2 text-sm font-medium text-brand-slate transition hover:bg-brand-background disabled:cursor-not-allowed disabled:opacity-60"
              disabled={currentIndex === 0}
            >
              Previous
            </button>
            <div className="flex gap-3">
              {currentIndex < totalQuestions - 1 ? (
                <button
                  type="button"
                  onClick={goToNextQuestion}
                  className="rounded-full border border-brand-sky px-4 py-2 text-sm font-medium text-brand-sky transition hover:bg-brand-background"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={gradeQuiz}
                  className="rounded-full bg-brand-sky px-5 py-2 text-sm font-medium text-white shadow-subtle transition hover:bg-brand-sky/90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isGrading}
                >
                  Finish Quiz
                </button>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {phase === 'grading' ? (
        <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-brand-mint/60 bg-white p-10 text-center shadow-subtle">
          <p className="text-lg font-semibold text-brand-charcoal">Grading your quiz…</p>
          <p className="mt-2 text-sm text-brand-slate">
            MathMate is checking each answer and preparing a review of anything you missed.
          </p>
          <div className="mt-6 h-2 w-full max-w-md overflow-hidden rounded-full bg-brand-background">
            <div
              className="h-full bg-brand-sky transition-all"
              style={{ width: `${Math.round(gradingProgress * 100)}%` }}
            />
          </div>
        </section>
      ) : null}

      {phase === 'review' ? (
        <section className="flex flex-col gap-6 rounded-2xl border border-brand-mint/60 bg-white p-6 shadow-subtle">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-brand-charcoal">Quiz Summary</h2>
              <p className="mt-1 text-sm text-brand-slate">
                You answered {correctCount} out of {responses.length} questions correctly.
              </p>
            </div>
            <div className="rounded-2xl border border-brand-sky/50 bg-brand-sky/10 px-5 py-3 text-right">
              <p className="text-xs uppercase tracking-wide text-brand-slate">Score</p>
              <p className="text-2xl font-semibold text-brand-charcoal">
                {formatPercentage(quizScore)}
              </p>
            </div>
          </div>

          {incorrectQuestions.length === 0 ? (
            <div className="rounded-xl border border-brand-mint/60 bg-brand-background px-4 py-3 text-sm text-brand-charcoal">
              Incredible work! You got everything correct. You can restart the quiz for a fresh set
              of problems anytime.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
              <aside className="rounded-2xl border border-brand-mint/60 bg-brand-background p-4">
                <h3 className="text-sm font-semibold text-brand-charcoal">Questions to review</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {incorrectQuestions.map((question, index) => {
                    const isActive = incorrectQuestions[reviewIndex]?.id === question.id;
                    return (
                      <li key={question.id}>
                        <button
                          type="button"
                          onClick={() => setReviewIndex(index)}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                            isActive
                              ? 'border-brand-sky bg-white text-brand-charcoal shadow-subtle'
                              : 'border-transparent text-brand-slate hover:border-brand-mint hover:bg-white'
                          }`}
                        >
                          Question{' '}
                          {responses.findIndex((response) => response.id === question.id) + 1}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </aside>

              <div className="space-y-5">
                {currentReviewQuestion ? (
                  <div className="space-y-4">
                    <article className="space-y-3 rounded-xl border border-brand-mint/60 bg-brand-background p-4">
                      <h3 className="text-sm font-semibold text-brand-charcoal">Problem</h3>
                      <MathText content={currentReviewQuestion.problemText} />
                    </article>

                    <div className="rounded-xl border border-brand-coral/40 bg-[#FEE2E2] p-4 text-sm">
                      <h4 className="font-semibold text-brand-charcoal">Your answer</h4>
                      <p className="mt-1 whitespace-pre-line text-brand-charcoal">
                        {currentReviewQuestion.userAnswer.trim()
                          ? currentReviewQuestion.userAnswer
                          : 'No answer provided.'}
                      </p>
                    </div>

                    {currentReviewQuestion.evaluation?.explanation ? (
                      <div className="rounded-xl border border-brand-sky/50 bg-brand-sky/10 p-4 text-sm text-brand-charcoal">
                        <h4 className="font-semibold">Quick explanation</h4>
                        <p className="mt-1 whitespace-pre-line">
                          {currentReviewQuestion.evaluation.explanation}
                        </p>
                      </div>
                    ) : null}

                    {currentReviewQuestion.evaluation?.correctAnswer ? (
                      <div className="rounded-xl border border-brand-mint/60 bg-brand-background p-4 text-sm text-brand-charcoal">
                        <h4 className="font-semibold">Suggested answer</h4>
                        <p className="mt-1 whitespace-pre-line">
                          {currentReviewQuestion.evaluation.correctAnswer}
                        </p>
                      </div>
                    ) : null}

                    <ReviewChatSection
                      question={currentReviewQuestion}
                      chatState={reviewChats[currentReviewQuestion.id]}
                      onSend={handleReviewMessageSend}
                      onStart={() => startReviewChat(currentReviewQuestion, true)}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-brand-mint/60 bg-brand-background p-6 text-sm text-brand-charcoal">
                    Select a question on the left to dive deeper with the tutor.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-3 border-t border-brand-mint/60 pt-4">
            <div className="text-xs text-brand-slate">
              {quizDocId ? `Quiz saved as #${quizDocId}.` : 'Quiz results were not saved.'}
            </div>
            <button
              type="button"
              onClick={resetQuiz}
              className="rounded-full border border-brand-slate px-4 py-2 text-sm font-medium text-brand-slate transition hover:bg-brand-background"
            >
              Start New Quiz
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
};

interface ReviewChatSectionProps {
  question: QuizQuestionResponse;
  chatState?: ReviewChatState;
  onSend: (question: QuizQuestionResponse, content: string) => Promise<void>;
  onStart: () => void;
}

const ReviewChatSection = ({ question, chatState, onSend, onStart }: ReviewChatSectionProps) => {
  const [inputValue, setInputValue] = useState('');
  const hasStarted = !!chatState;
  const pendingContent = chatState?.pendingContent ?? '';
  const isStreaming = chatState?.isStreaming ?? false;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputValue.trim() || isStreaming) {
      return;
    }
    const content = inputValue.trim();
    setInputValue('');
    await onSend(question, content);
  };

  return (
    <section className="rounded-2xl border border-brand-mint/60 bg-white p-4 shadow-inner">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-brand-charcoal">Tutor Review</h3>
        <button
          type="button"
          onClick={onStart}
          className="rounded-full border border-brand-sky px-3 py-1 text-xs font-medium text-brand-sky transition hover:bg-brand-sky/10"
          disabled={isStreaming}
        >
          {hasStarted ? 'Restart guidance' : 'Start guidance'}
        </button>
      </div>

      <div className="mt-3 flex max-h-96 flex-col gap-3 overflow-y-auto rounded-xl bg-brand-background p-3 text-sm">
        {chatState?.messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[85%] rounded-2xl px-4 py-2 ${
              message.role === 'user'
                ? 'ml-auto bg-[#E8FFF2] text-brand-charcoal'
                : 'bg-[#E6F0FF] text-brand-charcoal'
            }`}
          >
            <MathText content={message.content} />
          </div>
        ))}
        {pendingContent ? (
          <div className="max-w-[85%] rounded-2xl bg-[#E6F0FF] px-4 py-2 text-brand-charcoal">
            <MathText content={pendingContent} />
          </div>
        ) : null}
        {isStreaming && !pendingContent ? (
          <div className="w-fit rounded-2xl bg-[#E6F0FF] px-4 py-2">
            <span className="typing-dot text-lg text-brand-slate">• • •</span>
          </div>
        ) : null}
      </div>

      {chatState?.error ? (
        <div className="mt-2 rounded-xl border border-brand-coral/50 bg-[#FEE2E2] px-3 py-2 text-xs text-brand-charcoal">
          {chatState.error}
        </div>
      ) : null}

      <form className="mt-3 flex gap-3" onSubmit={handleSubmit}>
        <textarea
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          className="max-h-32 flex-1 rounded-2xl border border-brand-mint/60 bg-white px-4 py-2 text-sm outline-none transition focus:border-brand-sky"
          placeholder="Ask a follow-up question…"
          rows={2}
          disabled={isStreaming}
        />
        <button
          type="submit"
          className="rounded-full bg-brand-sky px-4 py-2 text-sm font-medium text-white shadow-subtle transition disabled:cursor-not-allowed disabled:bg-brand-slate"
          disabled={isStreaming || !inputValue.trim()}
        >
          Send
        </button>
      </form>
    </section>
  );
};

export default QuizPage;
