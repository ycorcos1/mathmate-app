import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  callGenerateResponse,
  callGenerateResponseStream,
  type ChatMessagePayload,
  type GenerateResponseMode,
  type SocraticStepType,
  type StreamingChunk,
} from '../api/generateResponse';
import { LoadingScreen } from '../components/LoadingScreen';
import { MathText } from '../components/MathText';
import { useAuth } from '../context/AuthContext';
import {
  useSessionStore,
  useSessionStoreApi,
  type SessionMessage,
  type SessionRole,
} from '../context/SessionContext';
import { useUIStore } from '../context/UIContext';
import { firestore, storage } from '../firebase';

type SessionSummary = {
  id: string;
  createdAt: Date | null;
  lastUpdated: Date | null;
  title: string | null;
  topicId: string | null;
  stats: {
    totalTurns?: number;
    hintsUsed?: number;
    durationSec?: number;
  } | null;
  completed?: boolean;
};

type FormattedMessage = SessionMessage & {
  timestamp: string;
  evaluation: EvaluationRecord | null;
};

type EvaluationResult = 'correct' | 'incorrect' | 'hintUsed';

type EvaluationRecord = {
  result: EvaluationResult;
  timestamp: Date | null;
};

const evaluationFeedback: Record<EvaluationResult, { text: string; className: string }> = {
  correct: {
    text: '✅ Great thinking—this step checks out.',
    className: 'text-emerald-600',
  },
  incorrect: {
    text: '⚠️ Let’s double-check this reasoning together.',
    className: 'text-brand-coral',
  },
  hintUsed: {
    text: '💡 Hint noted—apply this nudge and try the next step.',
    className: 'text-amber-600',
  },
};

const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

const normalizeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || `image-${Date.now()}`;

const buildUploadPath = (uid: string, sessionId: string, originalName: string) => {
  const normalized = normalizeFileName(originalName);
  return `uploads/${uid}/${sessionId}/${Date.now()}-${normalized}`;
};

// Background OCR function (doesn't block UI)
const runOcrInBackground = async (
  file: File,
  imageUrl: string,
  userId: string,
  sessionId: string,
) => {
  try {
    const { default: Tesseract } = await import('tesseract.js');
    const result = await Tesseract.recognize(file, 'eng');
    const rawText = (result?.data?.text ?? '').replace(/\r\n/g, '\n');
    const sanitizedText = rawText.replace(/\n{3,}/g, '\n\n').trim();
    const rawConfidence = result?.data?.confidence ?? 0;
    const confidence = Number.isFinite(rawConfidence) ? (rawConfidence as number) / 100 : 0;

    // Log to Firestore (even if low confidence or no text)
    const sessionRef = doc(firestore, 'users', userId, 'sessions', sessionId);
    await addDoc(collection(sessionRef, 'ocrLogs'), {
      imageUrl,
      text: sanitizedText || '',
      confidence,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Silent fail - OCR is just for logging
    console.error('Background OCR failed:', error);
  }
};

const stepTypeLabels: Record<SocraticStepType, string> = {
  hint: 'Hint',
  check: 'Check-in',
  final: 'Summary',
};

const safelyEvaluateExpression = (expression: string): number | null => {
  const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');

  if (!sanitized || !/^[0-9+\-*/().\s]+$/.test(sanitized)) {
    return null;
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${sanitized});`);
    const result = fn();

    if (typeof result === 'number' && Number.isFinite(result)) {
      return Number(result.toFixed(6));
    }
  } catch (error) {
    // Silently ignore evaluation failures and fall back to qualitative checks.
  }

  return null;
};

const extractPromptTargetValue = (prompt?: string | null): number | null => {
  if (!prompt) {
    return null;
  }

  const patterns = [
    /(?:what is|compute|calculate|evaluate)\s+([0-9+\-*/().\s]+)\??/i,
    /(?:simplify|find)\s+([0-9+\-*/().\s]+)\??/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);

    if (match && match[1]) {
      const evaluated = safelyEvaluateExpression(match[1]);

      if (evaluated !== null) {
        return evaluated;
      }
    }
  }

  return null;
};

const evaluateNumericResponse = (
  prompt?: string | null,
  userInput?: string | null,
): 'correct' | 'incorrect' | null => {
  if (!prompt || !userInput) {
    return null;
  }

  const expected = extractPromptTargetValue(prompt);

  if (expected === null) {
    return null;
  }

  const matches = userInput.match(/-?\d+(?:\.\d+)?/g) ?? [];

  if (matches.length !== 1) {
    return null;
  }

  const userValue = Number.parseFloat(matches[0]);

  if (!Number.isFinite(userValue)) {
    return null;
  }

  return Math.abs(userValue - expected) < 1e-3 ? 'correct' : 'incorrect';
};

const evaluateStudentInput = (
  input: string,
  lastAssistantContent?: string | null,
): 'correct' | 'incorrect' | null => {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();

  const confusionSignals = ["i don't know", "don't know", 'not sure', 'no idea', 'help', 'stuck'];

  if (confusionSignals.some((signal) => lower.includes(signal))) {
    return 'incorrect';
  }

  if (trimmed.endsWith('?')) {
    return 'incorrect';
  }

  const numericEvaluation = evaluateNumericResponse(lastAssistantContent, trimmed);

  if (numericEvaluation) {
    return numericEvaluation;
  }

  const positiveSignals = ['therefore', 'so ', 'equals', 'answer is', 'solution is', 'x =', 'y ='];

  if (positiveSignals.some((signal) => lower.includes(signal))) {
    return 'correct';
  }

  if (lower.startsWith('yes') || lower.startsWith('correct')) {
    return 'correct';
  }

  return null;
};

const ensureSessionExists = async (userId: string) => {
  const sessionsCollection = collection(firestore, 'users', userId, 'sessions');
  const newSessionRef = doc(sessionsCollection);

  await setDoc(newSessionRef, {
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
  });

  return newSessionRef.id;
};

// Helper function to get localStorage key for draft messages
const getDraftStorageKey = (sessionId: string | null) => {
  if (!sessionId) return null;
  return `tutor-draft-${sessionId}`;
};

const TutorPage = () => {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationRecord>>({});
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const creatingSessionRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isStreamingRef = useRef(false);
  const pendingMessageIdRef = useRef<string | null>(null);

  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSessionId = useSessionStore((state) => state.setActiveSessionId);
  const messages = useSessionStore((state) => state.messages);
  const setMessages = useSessionStore((state) => state.setMessages);
  const clearMessages = useSessionStore((state) => state.clearMessages);
  const sessionStoreApi = useSessionStoreApi();

  const isUploading = useUIStore((state) => state.isUploading);
  const setUploading = useUIStore((state) => state.setUploading);

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  // Load draft from localStorage on mount or when session changes
  useEffect(() => {
    if (!activeSessionId) {
      setInputValue('');
      setPendingImageUrl(null);
      return;
    }

    const storageKey = getDraftStorageKey(activeSessionId);
    if (!storageKey) return;

    try {
      const savedDraft = localStorage.getItem(storageKey);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft) as {
          inputValue?: string;
          pendingImageUrl?: string | null;
        };
        if (draft.inputValue !== undefined) {
          setInputValue(draft.inputValue);
        }
        if (draft.pendingImageUrl !== undefined) {
          setPendingImageUrl(draft.pendingImageUrl);
        }
      }
    } catch (error) {
      console.error('Failed to load draft from localStorage', error);
    }
  }, [activeSessionId]);

  // Save draft to localStorage when inputValue or pendingImageUrl changes
  useEffect(() => {
    if (!activeSessionId) return;

    const storageKey = getDraftStorageKey(activeSessionId);
    if (!storageKey) return;

    try {
      const draft = {
        inputValue,
        pendingImageUrl,
      };
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch (error) {
      console.error('Failed to save draft to localStorage', error);
    }
  }, [activeSessionId, inputValue, pendingImageUrl]);

  useEffect(() => {
    if (!user) {
      clearMessages();
      setActiveSessionId(null);
      setSessions([]);
      setEvaluations({});
      setIsLoading(false);
      return;
    }

    const sessionsCollection = collection(firestore, 'users', user.uid, 'sessions');
    const sessionsQuery = query(sessionsCollection, orderBy('lastUpdated', 'desc'));

    const unsubscribe = onSnapshot(
      sessionsQuery,
      async (snapshot) => {
        if (snapshot.empty) {
          if (!creatingSessionRef.current) {
            creatingSessionRef.current = true;
            try {
              const newSessionId = await ensureSessionExists(user.uid);
              setActiveSessionId(newSessionId);
            } catch (error) {
              console.error('Failed to create initial session', error);
              setSessionError('We could not start a new session. Please try refreshing the page.');
            } finally {
              creatingSessionRef.current = false;
              setIsLoading(false);
            }
          } else {
            // Session creation already in progress, just ensure loading is false
            setIsLoading(false);
          }

          setSessions([]);
          return;
        }

        const summaries = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data() as {
            createdAt?: Timestamp | null;
            lastUpdated?: Timestamp | null;
            title?: unknown;
            topicId?: unknown;
            stats?: unknown;
            completed?: boolean;
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

          return {
            id: docSnapshot.id,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
            lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate() : null,
            title: rawTitle || null,
            topicId: rawTopic || null,
            stats: normalizedStats,
            completed,
          } satisfies SessionSummary;
        });

        setSessions(summaries);

        if (!activeSessionId || !summaries.some((session) => session.id === activeSessionId)) {
          setActiveSessionId(summaries[0]?.id ?? null);
        }

        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to subscribe to sessions', error);
        setSessionError(
          'We could not load your sessions. Try refreshing or check your connection.',
        );
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [activeSessionId, clearMessages, setActiveSessionId, user]);

  useEffect(() => {
    if (!user || !activeSessionId) {
      clearMessages();
      setEvaluations({});
      return;
    }

    const messagesCollection = collection(
      firestore,
      'users',
      user.uid,
      'sessions',
      activeSessionId,
      'messages',
    );
    const messagesQuery = query(messagesCollection, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        // Skip Firestore updates if we're actively streaming
        // This prevents overwriting pending messages during streaming
        if (isStreamingRef.current) {
          return;
        }

        const firestoreMessages = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data() as {
            role?: string;
            content?: string;
            imageUrl?: string | null;
            topicId?: string | null;
            createdAt?: Timestamp | null;
            stepType?: string | null;
          };

          return {
            id: docSnapshot.id,
            role: (data.role === 'assistant' ? 'assistant' : 'user') as SessionRole,
            content: data.content ?? '',
            imageUrl: data.imageUrl ?? null,
            topicId: data.topicId ?? null,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
            stepType:
              data.stepType === 'hint' || data.stepType === 'check' || data.stepType === 'final'
                ? data.stepType
                : null,
          } satisfies SessionMessage;
        });

        // Merge Firestore messages with pending messages (messages with pending: true)
        // IMPORTANT: Get current messages RIGHT BEFORE setting to include any streaming updates
        // This preserves pending messages during streaming, but filters out empty ones
        const currentMessages = sessionStoreApi.getState().messages;
        const pendingMessages = currentMessages.filter(
          (msg) =>
            'pending' in msg &&
            msg.pending === true &&
            msg.content &&
            (msg.content.trim().length > 0 || msg.content === '...'),
        );

        // During streaming, pending messages should take priority over Firestore messages
        // We need to preserve pending messages that are actively being streamed
        const now = Date.now();
        const pendingMessagesWithContent = pendingMessages.filter((pendingMsg) => {
          // Always keep pending messages that have substantial content (actively streaming)
          if (
            pendingMsg.content &&
            pendingMsg.content.trim().length > 3 &&
            pendingMsg.content !== '...'
          ) {
            return true;
          }

          // Keep pending messages that were created recently (within last 60 seconds)
          // This ensures we keep them during the entire streaming process
          if (pendingMsg.createdAt) {
            const age = now - pendingMsg.createdAt.getTime();
            if (age < 60000) {
              // Only remove if there's a Firestore message with substantial content
              const hasSubstantialFirestoreMessage = firestoreMessages.some(
                (fm) =>
                  fm.role === 'assistant' &&
                  fm.content &&
                  fm.content.trim().length > 3 &&
                  fm.createdAt &&
                  pendingMsg.createdAt &&
                  Math.abs(fm.createdAt.getTime() - pendingMsg.createdAt.getTime()) < 5000,
              );
              // Keep pending if no substantial Firestore message exists yet
              return !hasSubstantialFirestoreMessage;
            }
          }

          // For older pending messages, check if Firestore has a matching message
          const hasMatchingFirestoreMessage = firestoreMessages.some(
            (fm) =>
              fm.role === 'assistant' &&
              fm.content &&
              fm.content.trim().length > 0 &&
              fm.createdAt &&
              pendingMsg.createdAt &&
              Math.abs(fm.createdAt.getTime() - pendingMsg.createdAt.getTime()) < 5000,
          );

          // Remove pending message only if Firestore has a matching message with content
          return !hasMatchingFirestoreMessage;
        });

        // Combine Firestore messages with pending messages that should be kept
        const allMessages = [...firestoreMessages, ...pendingMessagesWithContent];

        // Remove duplicates - prefer Firestore messages over pending messages
        const uniqueMessages = allMessages.filter((msg, index, arr) => {
          // Filter out empty assistant messages (but allow "..." as pending indicator)
          if (msg.role === 'assistant') {
            if (!msg.content || (msg.content.trim().length === 0 && msg.content !== '...')) {
              return false;
            }
          }

          // If this is a Firestore message, check if there's a pending message with the same content
          // If so, prefer the Firestore message (it's the final version)
          if (!('pending' in msg) || !msg.pending) {
            const hasPendingDuplicate = pendingMessagesWithContent.some(
              (pm) =>
                pm.role === msg.role &&
                pm.content === msg.content &&
                pm.createdAt &&
                msg.createdAt &&
                Math.abs(pm.createdAt.getTime() - msg.createdAt.getTime()) < 5000,
            );
            // Always prefer Firestore message over pending
            return true;
          }

          return true;
        });

        // Sort by createdAt if available, otherwise keep pending messages at end
        uniqueMessages.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return a.createdAt.getTime() - b.createdAt.getTime();
          }
          const aPending = 'pending' in a && a.pending;
          const bPending = 'pending' in b && b.pending;
          if (aPending && !bPending) return 1;
          if (!aPending && bPending) return -1;
          return 0;
        });

        // Before setting, get the latest pending messages to preserve streaming updates
        // This ensures we don't overwrite pending messages that were just updated during streaming
        const latestMessages = sessionStoreApi.getState().messages;
        const latestPendingMessages = latestMessages.filter(
          (msg) => 'pending' in msg && msg.pending === true,
        );

        // Always prefer the latest pending messages (which include streaming updates)
        // Replace any pending messages in uniqueMessages with the latest versions
        // Also remove pending messages if we have a matching Firestore message (prevents flicker)
        latestPendingMessages.forEach((latestPendingMsg) => {
          if (
            latestPendingMsg.content &&
            (latestPendingMsg.content.trim().length > 0 || latestPendingMsg.content === '...')
          ) {
            // Check if there's a matching Firestore message (same content, recent timestamp)
            // Match by content similarity, not exact match, to handle timing differences
            const matchingFirestoreMessage = firestoreMessages.find(
              (fm) =>
                fm.role === 'assistant' &&
                fm.content &&
                fm.content.trim().length > 0 &&
                fm.content.trim() === latestPendingMsg.content.trim() &&
                fm.createdAt &&
                latestPendingMsg.createdAt &&
                Math.abs(fm.createdAt.getTime() - latestPendingMsg.createdAt.getTime()) < 10000, // 10 second window
            );

            // If we have a matching Firestore message with the same content, replace pending with it
            // This ensures smooth transition - Firestore message replaces pending seamlessly
            // Only remove pending if Firestore message is actually in the list
            if (matchingFirestoreMessage) {
              const firestoreIndex = uniqueMessages.findIndex(
                (msg) => msg.id === matchingFirestoreMessage.id,
              );
              const pendingIndex = uniqueMessages.findIndex(
                (msg) => msg.id === latestPendingMsg.id,
              );

              // If Firestore message is already in the list, remove pending
              if (firestoreIndex >= 0) {
                if (pendingIndex >= 0) {
                  uniqueMessages.splice(pendingIndex, 1);
                }
                // Clear the ref when we remove the pending message
                if (pendingMessageIdRef.current === latestPendingMsg.id) {
                  pendingMessageIdRef.current = null;
                }
                return;
              }
              // If Firestore message isn't in list yet, keep pending until it is
            }

            // Always keep pending messages with final content (more than 3 chars, not "...")
            // This prevents flicker - pending stays visible until Firestore loads
            if (
              latestPendingMsg.content &&
              latestPendingMsg.content.trim().length > 3 &&
              latestPendingMsg.content !== '...'
            ) {
              const index = uniqueMessages.findIndex((msg) => msg.id === latestPendingMsg.id);
              if (index >= 0) {
                // Always use the latest pending message (has final content)
                uniqueMessages[index] = latestPendingMsg;
              } else {
                uniqueMessages.push(latestPendingMsg);
              }
              return;
            }

            const index = uniqueMessages.findIndex((msg) => msg.id === latestPendingMsg.id);
            if (index >= 0) {
              // Replace with latest version (has streaming updates)
              uniqueMessages[index] = latestPendingMsg;
            } else {
              // Add if it doesn't exist (preserve streaming updates)
              uniqueMessages.push(latestPendingMsg);
            }
          }
        });

        // Re-sort after adding/updating pending messages
        uniqueMessages.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return a.createdAt.getTime() - b.createdAt.getTime();
          }
          const aPending = 'pending' in a && a.pending;
          const bPending = 'pending' in b && b.pending;
          if (aPending && !bPending) return 1;
          if (!aPending && bPending) return -1;
          return 0;
        });

        setMessages(uniqueMessages);
      },
      (error) => {
        console.error('Failed to subscribe to messages', error);
      },
    );

    return () => unsubscribe();
  }, [activeSessionId, clearMessages, setMessages, user]);

  useEffect(() => {
    if (!user || !activeSessionId) {
      setEvaluations({});
      return;
    }

    const evaluationsCollection = collection(
      firestore,
      'users',
      user.uid,
      'sessions',
      activeSessionId,
      'evaluations',
    );

    const unsubscribe = onSnapshot(
      evaluationsCollection,
      (snapshot) => {
        const next: Record<string, EvaluationRecord> = {};

        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as {
            messageId?: string;
            result?: string;
            timestamp?: Timestamp | null;
          };

          if (
            typeof data.messageId === 'string' &&
            (data.result === 'correct' || data.result === 'incorrect' || data.result === 'hintUsed')
          ) {
            next[data.messageId] = {
              result: data.result,
              timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : null,
            };
          }
        });

        setEvaluations(next);
      },
      (error) => {
        console.error('Failed to subscribe to evaluations', error);
      },
    );

    return () => unsubscribe();
  }, [activeSessionId, user]);

  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0) {
      // Use requestAnimationFrame to ensure DOM is ready, then scroll to bottom
      // Double RAF ensures layout is complete (including images)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            const container = messagesContainerRef.current;
            // Scroll to absolute bottom, accounting for padding
            container.scrollTop = container.scrollHeight;
          }
        });
      });
    }
  }, [messages, activeSessionId]); // Also scroll when session changes

  const formattedMessages = useMemo<FormattedMessage[]>(
    () =>
      messages
        .filter((message) => {
          // Filter out assistant messages that only have "..." as content
          if (message.role === 'assistant') {
            if (!message.content || message.content.trim() === '' || message.content === '...') {
              return false;
            }
          }
          return true;
        })
        .map((message) => ({
          ...message,
          timestamp: message.createdAt
            ? message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '—',
          evaluation: evaluations[message.id] ?? null,
        })),
    [messages, evaluations],
  );

  const currentSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const activeTopicId = useMemo(() => {
    const latestTopicMessage = [...messages].reverse().find((message) => message.topicId);
    if (latestTopicMessage?.topicId) {
      return latestTopicMessage.topicId;
    }

    return currentSession?.topicId ?? null;
  }, [messages, currentSession]);

  const sessionStats = useMemo(() => {
    if (!currentSession) {
      return null;
    }

    const totalMessages = messages.length;
    const userTurns = messages.filter((message) => message.role === 'user').length;
    const assistantTurns = totalMessages - userTurns;
    const hintCount = Object.values(evaluations).filter(
      (record) => record.result === 'hintUsed',
    ).length;

    let durationMs: number | null = null;
    if (currentSession.createdAt && currentSession.lastUpdated) {
      durationMs = Math.max(
        0,
        currentSession.lastUpdated.getTime() - currentSession.createdAt.getTime(),
      );
    }

    return {
      totalMessages,
      userTurns,
      assistantTurns,
      hintCount,
      durationMs,
    };
  }, [currentSession, evaluations, messages]);

  // Sync session stats to Firestore when messages or evaluations change
  useEffect(() => {
    if (!user || !activeSessionId || !sessionStats || !currentSession) {
      return;
    }

    // Calculate duration in seconds based on current timestamp
    // Use current time for duration calculation, not lastUpdated to avoid loops
    let durationSec: number | undefined;
    if (currentSession.createdAt) {
      const now = Date.now();
      const durationMs = Math.max(0, now - currentSession.createdAt.getTime());
      if (durationMs > 0) {
        durationSec = Math.floor(durationMs / 1000);
      }
    }

    // Update stats if they've changed
    const currentStats = currentSession.stats;
    const newStats = {
      totalTurns: sessionStats.userTurns,
      hintsUsed: sessionStats.hintCount,
      durationSec,
    };

    const statsChanged =
      !currentStats ||
      currentStats.totalTurns !== newStats.totalTurns ||
      currentStats.hintsUsed !== newStats.hintsUsed ||
      (newStats.durationSec !== undefined && currentStats.durationSec !== newStats.durationSec);

    // Only update if stats have changed
    if (statsChanged) {
      const sessionRef = doc(firestore, 'users', user.uid, 'sessions', activeSessionId);
      updateDoc(sessionRef, {
        stats: newStats,
        lastUpdated: serverTimestamp(),
      }).catch((error) => {
        console.error('Failed to update session stats', error);
      });
    }
  }, [user, activeSessionId, sessionStats, currentSession]);

  // Sync topicId to session document when it changes
  useEffect(() => {
    if (!user || !activeSessionId || !activeTopicId) {
      return;
    }

    // Only update if topicId has changed from what's stored
    if (currentSession?.topicId === activeTopicId) {
      return;
    }

    const sessionRef = doc(firestore, 'users', user.uid, 'sessions', activeSessionId);
    updateDoc(sessionRef, {
      topicId: activeTopicId,
      lastUpdated: serverTimestamp(),
    }).catch((error) => {
      console.error('Failed to update session topicId', error);
    });
  }, [user, activeSessionId, activeTopicId, currentSession]);

  // Track completion state - mark as completed when a final/summary message is detected
  useEffect(() => {
    if (!user || !activeSessionId || !currentSession) {
      return;
    }

    // Check if there's a final/summary message
    const hasFinalMessage = messages.some((message) => message.stepType === 'final');

    // Only update if completion state has changed
    if (hasFinalMessage && !currentSession.completed) {
      const sessionRef = doc(firestore, 'users', user.uid, 'sessions', activeSessionId);
      updateDoc(sessionRef, {
        completed: true,
        lastUpdated: serverTimestamp(),
      }).catch((error) => {
        console.error('Failed to update session completion state', error);
      });
    }
  }, [user, activeSessionId, messages, currentSession]);

  const sendMessage = async ({
    content,
    imageUrl,
    mode = 'default',
    skipEvaluation,
  }: {
    content: string;
    imageUrl?: string | null;
    mode?: GenerateResponseMode;
    skipEvaluation?: boolean;
  }) => {
    if (!user || !activeSessionId || isSending) {
      return;
    }

    const trimmed = content.trim();

    // Allow empty content if there's an image
    if (!trimmed && !imageUrl) {
      return;
    }

    const shouldSkipEvaluation = skipEvaluation ?? mode === 'hint';

    setIsSending(true);

    const existingMessages: SessionMessage[] = [...messages];
    const sessionRef = doc(firestore, 'users', user.uid, 'sessions', activeSessionId);
    const messagesCollection = collection(sessionRef, 'messages');
    const evaluationsCollection = collection(sessionRef, 'evaluations');

    try {
      const userMessageRef = await addDoc(messagesCollection, {
        role: 'user',
        content: trimmed || '',
        imageUrl: imageUrl ?? null,
        topicId: null,
        stepType: null,
        createdAt: serverTimestamp(),
      });

      await updateDoc(sessionRef, {
        lastUpdated: serverTimestamp(),
      });

      if (!shouldSkipEvaluation && trimmed) {
        const lastAssistantMessage = [...existingMessages]
          .reverse()
          .find((message) => message.role === 'assistant');

        const evaluationResult = evaluateStudentInput(
          trimmed,
          lastAssistantMessage?.content ?? null,
        );

        if (evaluationResult) {
          try {
            await addDoc(evaluationsCollection, {
              messageId: userMessageRef.id,
              result: evaluationResult,
              timestamp: serverTimestamp(),
            });
          } catch (evaluationError) {
            console.error('Failed to record evaluation result', evaluationError);
          }
        }
      }

      const payload: ChatMessagePayload[] = [
        ...existingMessages.map((message) => ({
          role: message.role,
          content: message.content,
          imageUrl: message.imageUrl ?? null,
        })),
        { role: 'user', content: trimmed || '', imageUrl: imageUrl ?? null },
      ];

      // Context retention: Log context size for monitoring
      // Future enhancement: Summarize older messages if conversation exceeds ~20 messages
      const contextSize = payload.length;
      if (contextSize > 20) {
        console.log(
          `Long conversation context: ${contextSize} messages. Consider summarization for very long threads.`,
        );
      }

      // Debug: Log if image is being sent
      if (imageUrl) {
        console.log('Sending message with image:', { imageUrl, content: trimmed });
      }

      // Use streaming for better UX
      let streamingContent = '';
      let streamingStepType: SocraticStepType | null = null;
      let pendingMessageId: string | null = null;

      try {
        // Create a temporary pending message in local state for real-time updates
        const tempMessageId = `pending-${Date.now()}`;
        pendingMessageId = tempMessageId;

        // Mark streaming as active
        isStreamingRef.current = true;
        pendingMessageIdRef.current = tempMessageId;

        // Start streaming - don't create pending message until we have actual content
        const assistantResult = await callGenerateResponseStream(
          payload,
          mode,
          (chunk: StreamingChunk) => {
            if (chunk.error) {
              console.error('Streaming error:', chunk.error);
              return;
            }

            // Update streaming content
            if (chunk.content !== undefined) {
              streamingContent = chunk.content;
            }

            // Update streaming step type
            if (chunk.stepType !== undefined) {
              streamingStepType = chunk.stepType;
            }

            // Only create/update pending message if we have actual content (not just "...")
            if (pendingMessageId && streamingContent.trim().length > 0) {
              const currentMessages = sessionStoreApi.getState().messages;
              const hasPendingMessage = currentMessages.some((msg) => msg.id === pendingMessageId);

              if (!hasPendingMessage) {
                // Create pending message now that we have content
                const pendingMessage: SessionMessage = {
                  id: pendingMessageId,
                  role: 'assistant',
                  content: streamingContent,
                  imageUrl: null,
                  topicId: null,
                  createdAt: new Date(),
                  stepType: streamingStepType,
                  pending: true,
                };
                setMessages([...currentMessages, pendingMessage]);
              } else {
                // Update existing pending message with streaming content
                const updatedMessages = currentMessages.map((msg) =>
                  msg.id === pendingMessageId
                    ? { ...msg, content: streamingContent, stepType: streamingStepType }
                    : msg,
                );
                setMessages(updatedMessages);
              }
            }
          },
        );

        // Finalize: use the final result from streaming
        const finalContent = assistantResult.content || streamingContent;
        const finalStepType: SocraticStepType | null =
          assistantResult.stepType ?? streamingStepType ?? (mode === 'hint' ? 'hint' : null);

        // Only save to Firestore if we have content
        if (!finalContent.trim()) {
          console.warn('Assistant response is empty, not saving to Firestore');
          // Remove pending message immediately if content is empty
          const currentMessages = sessionStoreApi.getState().messages;
          setMessages(currentMessages.filter((msg) => msg.id !== pendingMessageId));
          // Mark streaming as complete
          isStreamingRef.current = false;
          pendingMessageIdRef.current = null;
          return;
        }

        // Update pending message with final content IMMEDIATELY to prevent flicker
        // This must happen synchronously before Firestore subscription can fire
        const currentMessages = sessionStoreApi.getState().messages;
        const updatedMessages = currentMessages.map((msg) =>
          msg.id === pendingMessageId
            ? { ...msg, content: finalContent.trim(), stepType: finalStepType, pending: true }
            : msg,
        );
        setMessages(updatedMessages);

        // Create the final message in Firestore
        const finalAssistantDocRef = await addDoc(messagesCollection, {
          role: 'assistant',
          content: finalContent.trim(),
          topicId: null,
          stepType: finalStepType,
          createdAt: serverTimestamp(),
        });

        // Wait for React to render the pending message update before allowing Firestore subscription
        // This prevents flicker by ensuring the final content is visible before Firestore processes
        await new Promise((resolve) => {
          // Use requestAnimationFrame to ensure the update is rendered
          requestAnimationFrame(() => {
            // Use another frame to ensure React has processed the update
            requestAnimationFrame(() => {
              resolve(undefined);
            });
          });
        });

        // Mark streaming as complete AFTER pending message update is rendered
        // The pending message with final content will stay visible until Firestore subscription
        // detects the matching message and removes it - this prevents flicker
        isStreamingRef.current = false;
        // Keep pendingMessageIdRef so Firestore subscription can match and remove it

        if (finalStepType === 'hint') {
          try {
            await addDoc(evaluationsCollection, {
              messageId: finalAssistantDocRef.id,
              result: 'hintUsed',
              timestamp: serverTimestamp(),
            });
          } catch (hintLogError) {
            console.error('Failed to log hint usage', hintLogError);
          }
        }
      } catch (error) {
        // Remove pending message if it exists
        if (pendingMessageId) {
          const currentMessages = sessionStoreApi.getState().messages;
          setMessages(currentMessages.filter((msg) => msg.id !== pendingMessageId));
        }
        // Mark streaming as complete
        isStreamingRef.current = false;
        pendingMessageIdRef.current = null;
        console.error('Failed to generate assistant response', error);

        const fallbackMessage =
          "I ran into a hiccup reaching my reasoning engine. Let's retry that step after a moment.";

        await addDoc(messagesCollection, {
          role: 'assistant',
          content: fallbackMessage,
          topicId: null,
          stepType: null,
          createdAt: serverTimestamp(),
        });
      }

      await updateDoc(sessionRef, {
        lastUpdated: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to process tutor message flow', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    if (isSending || isUploading) {
      return;
    }

    const trimmed = inputValue.trim();

    // Allow sending if there's text OR a pending image
    if (!trimmed && !pendingImageUrl) {
      return;
    }

    const imageUrlToSend = pendingImageUrl;
    const fileForOcr = pendingImageFile;

    // Clear pending state before sending
    setPendingImageUrl(null);
    setPendingImageFile(null);
    setInputValue('');

    // Clear draft from localStorage after sending
    if (activeSessionId) {
      const storageKey = getDraftStorageKey(activeSessionId);
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey);
        } catch (error) {
          console.error('Failed to clear draft from localStorage', error);
        }
      }
    }

    // Send message with image if available
    void sendMessage({
      content: trimmed,
      imageUrl: imageUrlToSend,
      mode: 'default',
    }).then(() => {
      // Run OCR in background after sending (don't wait for it)
      if (fileForOcr && imageUrlToSend && user && activeSessionId) {
        void runOcrInBackground(fileForOcr, imageUrlToSend, user.uid, activeSessionId);
      }
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleRequestHint = () => {
    if (isSending || isUploading) {
      return;
    }

    const base = inputValue.trim();
    const hintContent = base
      ? `${base}\n\n(Hint requested: please share a gentle nudge.)`
      : 'Could I have a hint to nudge me forward?';

    setInputValue('');

    // Clear draft from localStorage after sending hint
    if (activeSessionId) {
      const storageKey = getDraftStorageKey(activeSessionId);
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey);
        } catch (error) {
          console.error('Failed to clear draft from localStorage', error);
        }
      }
    }

    void sendMessage({ content: hintContent, mode: 'hint', skipEvaluation: true });
  };

  const handleUploadButtonClick = () => {
    if (isSending || isUploading) {
      return;
    }

    setOcrError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setOcrError(null);

    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      setOcrError('Unsupported file type. Please upload a PNG, JPG, or WEBP image.');
      event.target.value = '';
      return;
    }

    if (!user) {
      setOcrError('Please sign in before uploading images.');
      event.target.value = '';
      return;
    }

    if (!activeSessionId) {
      setOcrError('Select or create a session before uploading an image.');
      event.target.value = '';
      return;
    }

    setUploading(true);

    try {
      // Upload to Storage
      const uploadPath = buildUploadPath(user.uid, activeSessionId, file.name);
      const storageRef = ref(storage, uploadPath);

      await uploadBytes(storageRef, file, { contentType: file.type });
      const imageUrl = await getDownloadURL(storageRef);

      // Set pending image (don't send yet - user needs to press Send)
      setPendingImageUrl(imageUrl);
      setPendingImageFile(file);
    } catch (error) {
      console.error('Failed to upload image:', error);
      setOcrError('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setPendingImageUrl(null);
    setPendingImageFile(null);
    setOcrError(null);

    // Update draft in localStorage (image is removed, but text remains)
    // This will be handled by the useEffect that saves draft on pendingImageUrl change
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pt-4 md:px-6 min-h-0 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-brand-charcoal">Tutor</h1>
          <p className="text-sm text-brand-slate">
            Guided Socratic dialogue to help you learn math step by step.
          </p>
        </div>
      </div>

      {sessionError ? (
        <div className="shrink-0 rounded-xl border border-brand-coral/40 bg-[#FEE2E2] px-4 py-3 text-sm text-brand-charcoal">
          {sessionError}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-brand-mint/60 bg-white shadow-subtle">
          <header className="flex items-center justify-between border-b border-brand-mint/60 px-4 py-3">
            <h2 className="text-lg font-semibold text-brand-charcoal">Chat</h2>
            <span className="rounded-full bg-brand-mint/40 px-3 py-1 text-xs font-medium text-brand-slate">
              Socratic mode
            </span>
          </header>
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              ref={messagesContainerRef}
              className="flex-1 space-y-4 overflow-y-auto px-4 py-6 min-h-0"
            >
              {formattedMessages.length === 0 ? (
                <div className="rounded-xl bg-brand-sky/10 p-4 text-sm text-brand-slate">
                  Start a session by describing a problem. MathMate will walk through the reasoning
                  with you step by step.
                </div>
              ) : (
                formattedMessages.map((message) => {
                  const evaluationDetails = message.evaluation
                    ? evaluationFeedback[message.evaluation.result]
                    : null;
                  const stepLabel =
                    message.role === 'assistant' && message.stepType
                      ? stepTypeLabels[message.stepType]
                      : null;

                  return (
                    <article
                      key={message.id}
                      className={`max-w-[85%] rounded-2xl p-4 shadow-subtle ${
                        message.role === 'user' ? 'ml-auto bg-[#E8FFF2]' : 'bg-[#E6F0FF]'
                      }`}
                    >
                      {stepLabel ? (
                        <span className="mb-2 inline-flex items-center text-xs font-semibold uppercase tracking-wide text-brand-slate">
                          {stepLabel}
                        </span>
                      ) : null}
                      {message.imageUrl ? (
                        <div className="mb-3 rounded-xl overflow-hidden border border-brand-mint/60 bg-white">
                          <img
                            src={message.imageUrl}
                            alt="Math problem"
                            className="w-full h-auto max-h-96 object-contain"
                            loading="lazy"
                            onLoad={() => {
                              // Scroll to bottom when image loads to account for height change
                              if (messagesContainerRef.current) {
                                messagesContainerRef.current.scrollTop =
                                  messagesContainerRef.current.scrollHeight;
                              }
                            }}
                          />
                        </div>
                      ) : null}
                      {message.content && message.content.trim() && message.content !== '...' ? (
                        <MathText content={message.content} />
                      ) : null}
                      {evaluationDetails ? (
                        <span
                          className={`mt-2 block text-xs font-medium ${evaluationDetails.className}`}
                        >
                          {evaluationDetails.text}
                        </span>
                      ) : null}
                      <span className="mt-3 block text-right text-xs text-brand-slate">
                        {message.timestamp}
                      </span>
                    </article>
                  );
                })
              )}
              {isSending ? (
                <article className="w-fit rounded-2xl bg-[#E6F0FF] p-4 shadow-subtle">
                  <div className="flex items-center gap-1">
                    <span className="typing-dot text-lg text-brand-slate">•</span>
                    <span className="typing-dot text-lg text-brand-slate">•</span>
                    <span className="typing-dot text-lg text-brand-slate">•</span>
                  </div>
                </article>
              ) : null}
            </div>
          </div>
          <footer className="border-t border-brand-mint/60 p-4">
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={handleUploadButtonClick}
                  disabled={isSending || isUploading}
                  className="flex items-center rounded-full bg-brand-background px-3 py-2 text-sm font-medium text-brand-charcoal shadow-inner transition hover:bg-brand-mint/40 disabled:cursor-not-allowed disabled:opacity-70"
                  aria-busy={isUploading}
                >
                  <span aria-hidden>{isUploading ? '⏳' : '📎'}</span>
                  <span className="ml-2 hidden text-xs text-brand-slate sm:inline">
                    {isUploading ? 'Processing…' : 'Upload'}
                  </span>
                </button>
                <textarea
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question or describe the next step…"
                  className="max-h-44 flex-1 rounded-2xl border border-brand-mint/60 bg-white px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-brand-sky"
                  rows={2}
                />
                <button
                  type="button"
                  onClick={handleRequestHint}
                  className="rounded-full border border-brand-yellow/60 px-4 py-3 text-sm font-medium text-brand-charcoal transition hover:bg-brand-yellow/30 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSending || isUploading}
                >
                  Hint
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-brand-sky px-5 py-3 text-sm font-medium text-white shadow-subtle transition disabled:cursor-not-allowed disabled:bg-brand-slate"
                  disabled={(!inputValue.trim() && !pendingImageUrl) || isSending || isUploading}
                >
                  {isSending ? '…' : isUploading ? 'Uploading…' : 'Send'}
                </button>
              </div>
              {pendingImageUrl ? (
                <div className="relative rounded-xl border border-brand-mint/60 bg-white p-3">
                  <div className="flex items-start gap-3">
                    <img
                      src={pendingImageUrl}
                      alt="Math problem preview"
                      className="h-20 w-20 rounded-lg object-cover border border-brand-mint/60"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-brand-charcoal">Image ready to send</p>
                      <p className="mt-1 text-xs text-brand-slate">
                        Press Send to include this image with your message
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="rounded-full p-1 text-brand-slate transition hover:bg-brand-background hover:text-brand-charcoal"
                      aria-label="Remove image"
                    >
                      <span className="text-lg">×</span>
                    </button>
                  </div>
                </div>
              ) : null}
              {ocrError ? (
                <div className="rounded-xl border border-brand-coral/50 bg-[#FEE2E2] px-3 py-2 text-xs text-brand-charcoal">
                  {ocrError}
                </div>
              ) : null}
              <div className="text-xs text-brand-slate" aria-live="polite">
                {isUploading ? <p className="text-brand-sky">Uploading image…</p> : null}
                <p>
                  Hint button offers a gentle nudge • Enter to send • Shift + Enter for newline •
                  Use the clip icon to upload a math photo.
                </p>
              </div>
            </form>
          </footer>
        </section>
      </div>
    </div>
  );
};

export default TutorPage;
