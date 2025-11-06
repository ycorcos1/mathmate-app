import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSessionStore } from '../context/SessionContext';
import { firestore } from '../firebase';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useUserDoc } from '../hooks/useUserDoc';
import { useSessionStats } from '../hooks/useSessionStats';
import { useQuizStats } from '../hooks/useQuizStats';
import { useUserStatsSync } from '../hooks/useUserStatsSync';
import { formatDuration, formatRelativeTime } from '../utils/formatters';
import type { SessionSummary } from '../utils/statsAggregator';

const ensureSessionExists = async (userId: string) => {
  const sessionsCollection = collection(firestore, 'users', userId, 'sessions');
  const newSessionRef = doc(sessionsCollection);

  await setDoc(newSessionRef, {
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
  });

  return newSessionRef.id;
};

const DashboardContent = () => {
  const { userDoc } = useUserDoc();
  const { user } = useAuth();
  const navigate = useNavigate();
  const setActiveSessionId = useSessionStore((state) => state.setActiveSessionId);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const displayName = userDoc?.displayName ?? 'there';
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoadingLastSession, setIsLoadingLastSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch and aggregate session statistics
  const {
    sessions,
    stats,
    streaks,
    chartData,
    loading: statsLoading,
    error: statsError,
  } = useSessionStats();

  const { stats: quizStats, loading: quizLoading, error: quizError } = useQuizStats();

  // Sync aggregated stats to user document
  useUserStatsSync();

  // Calculate badges based on actual stats
  const badges = useMemo(
    () => [
      {
        id: 'first-session',
        name: 'First Session',
        description: 'Complete your first tutoring session.',
        unlocked: stats.totalSessions >= 1,
      },
      {
        id: 'ten-sessions',
        name: 'Ten Sessions',
        description: 'Complete 10 sessions.',
        unlocked: stats.totalSessions >= 10,
      },
      {
        id: 'perfect-week',
        name: 'Perfect Week',
        description: 'Practice every day for seven days.',
        unlocked: streaks.current >= 7,
      },
    ],
    [stats.totalSessions, streaks],
  );

  // Get recent sessions (last 5)
  const recentSessions = useMemo(() => {
    return sessions.slice(0, 5);
  }, [sessions]);

  // Get the most recently used session ID (the one that would open with "Continue Last Session")
  const mostRecentSessionId = useMemo(() => {
    if (sessions.length === 0) return null;
    // Sessions are already sorted by lastUpdated desc in useSessionStats
    return sessions[0].id;
  }, [sessions]);

  // Get last active date
  const lastActiveDate = useMemo(() => {
    if (sessions.length === 0) return null;
    const lastSession = sessions[0]; // Already sorted by lastUpdated desc
    return lastSession.lastUpdated || lastSession.createdAt;
  }, [sessions]);

  // Calculate max value for chart scaling
  const maxChartValue = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(1, ...chartData.map((point) => point.value));
  }, [chartData]);

  // Handle rename session
  const handleRenameStart = (session: SessionSummary) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title || '');
  };

  const handleRenameCancel = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleRenameSave = async (sessionId: string) => {
    if (!user || isSaving) return;

    const trimmedTitle = editingTitle.trim();
    setIsSaving(true);

    try {
      const sessionRef = doc(firestore, 'users', user.uid, 'sessions', sessionId);
      await updateDoc(sessionRef, {
        title: trimmedTitle || null,
        lastUpdated: serverTimestamp(),
      });

      setEditingSessionId(null);
      setEditingTitle('');
    } catch (error) {
      console.error('Failed to rename session', error);
      alert('Failed to rename session. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete session
  const handleDeleteStart = (sessionId: string) => {
    setDeletingSessionId(sessionId);
  };

  const handleDeleteCancel = () => {
    setDeletingSessionId(null);
  };

  const handleDeleteConfirm = async (sessionId: string) => {
    if (!user || isDeleting) return;

    setIsDeleting(true);

    try {
      const sessionRef = doc(firestore, 'users', user.uid, 'sessions', sessionId);
      await deleteDoc(sessionRef);

      // If the deleted session was active or was the most recent session, clear it
      if (activeSessionId === sessionId || mostRecentSessionId === sessionId) {
        setActiveSessionId(null);
      }

      setDeletingSessionId(null);
    } catch (error) {
      console.error('Failed to delete session', error);
      alert('Failed to delete session. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStartNewSession = async () => {
    if (!user || isCreatingSession) {
      return;
    }

    setIsCreatingSession(true);
    try {
      const newSessionId = await ensureSessionExists(user.uid);
      setActiveSessionId(newSessionId);
      navigate('/tutor');
    } catch (error) {
      console.error('Failed to create new session', error);
      // You could show an error message here if needed
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleContinueLastSession = async () => {
    if (!user || isLoadingLastSession) {
      return;
    }

    setIsLoadingLastSession(true);
    try {
      const sessionsCollection = collection(firestore, 'users', user.uid, 'sessions');
      const sessionsQuery = query(sessionsCollection, orderBy('lastUpdated', 'desc'), limit(1));
      const snapshot = await getDocs(sessionsQuery);

      if (!snapshot.empty) {
        const mostRecentSession = snapshot.docs[0];
        setActiveSessionId(mostRecentSession.id);
        navigate('/tutor');
      } else {
        // No sessions exist, create a new one instead
        const newSessionId = await ensureSessionExists(user.uid);
        setActiveSessionId(newSessionId);
        navigate('/tutor');
      }
    } catch (error) {
      console.error('Failed to load last session', error);
      // You could show an error message here if needed
    } finally {
      setIsLoadingLastSession(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-lg font-medium text-brand-slate">Hello {displayName}!</p>
          <h1 className="text-3xl font-semibold text-brand-charcoal">Dashboard</h1>
          <p className="mt-2 text-sm text-brand-slate">
            Keep an eye on your progress and jump back into learning with a single click.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleStartNewSession}
            disabled={isCreatingSession || isLoadingLastSession}
            className="rounded-full bg-brand-sky px-6 py-3 text-sm font-medium text-white shadow-subtle transition hover:bg-brand-sky/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingSession ? 'Creating…' : 'Start New Session'}
          </button>
          <button
            type="button"
            onClick={handleContinueLastSession}
            disabled={
              isLoadingLastSession ||
              isCreatingSession ||
              sessions.length === 0 ||
              mostRecentSessionId === null
            }
            className="rounded-full border border-brand-sky px-6 py-3 text-sm font-medium text-brand-sky transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingLastSession ? 'Loading…' : 'Continue Last Session'}
          </button>
        </div>
      </header>

      {(statsError || quizError) && (
        <div className="mt-6 space-y-2">
          {statsError ? (
            <div className="rounded-xl border border-brand-coral/40 bg-[#FEE2E2] px-4 py-3 text-sm text-brand-charcoal">
              Failed to load session statistics. Please refresh the page.
            </div>
          ) : null}
          {quizError ? (
            <div className="rounded-xl border border-brand-coral/40 bg-[#FEE2E2] px-4 py-3 text-sm text-brand-charcoal">
              Failed to load quiz statistics. Please refresh the page.
            </div>
          ) : null}
        </div>
      )}

      <section className="mt-10 grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-brand-mint/60 bg-white p-6 shadow-subtle">
          <p className="text-sm text-brand-slate">Total Sessions</p>
          {statsLoading ? (
            <p className="mt-2 text-3xl font-semibold text-brand-charcoal">—</p>
          ) : (
            <p className="mt-2 text-3xl font-semibold text-brand-charcoal">{stats.totalSessions}</p>
          )}
          <p className="mt-4 text-xs uppercase tracking-wide text-brand-slate">Longest Streak</p>
          {statsLoading ? (
            <p className="text-sm text-brand-charcoal">—</p>
          ) : (
            <p className="text-sm text-brand-charcoal">{streaks.longest} days</p>
          )}
        </div>
        <div className="rounded-2xl border border-brand-mint/60 bg-white p-6 shadow-subtle">
          <p className="text-sm text-brand-slate">Hints Used</p>
          {statsLoading ? (
            <p className="mt-2 text-3xl font-semibold text-brand-charcoal">—</p>
          ) : (
            <p className="mt-2 text-3xl font-semibold text-brand-charcoal">{stats.hintsUsed}</p>
          )}
          <p className="mt-4 text-xs uppercase tracking-wide text-brand-slate">Current Streak</p>
          {statsLoading ? (
            <p className="text-sm text-brand-charcoal">—</p>
          ) : (
            <p className="text-sm text-brand-charcoal">{streaks.current} days</p>
          )}
        </div>
        <div className="rounded-2xl border border-brand-mint/60 bg-white p-6 shadow-subtle">
          <p className="text-sm text-brand-slate">Average Session Time</p>
          {statsLoading ? (
            <p className="mt-2 text-3xl font-semibold text-brand-charcoal">—</p>
          ) : (
            <p className="mt-2 text-3xl font-semibold text-brand-charcoal">
              {formatDuration(stats.avgSolveSec)}
            </p>
          )}
          <p className="mt-4 text-xs uppercase tracking-wide text-brand-slate">Last Active</p>
          {statsLoading ? (
            <p className="text-sm text-brand-charcoal">—</p>
          ) : (
            <p className="text-sm text-brand-charcoal">
              {lastActiveDate ? formatRelativeTime(lastActiveDate) : '—'}
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-brand-mint/60 bg-white p-6 shadow-subtle">
          <p className="text-sm text-brand-slate">Total Quizzes</p>
          {quizLoading ? (
            <p className="mt-2 text-3xl font-semibold text-brand-charcoal">—</p>
          ) : (
            <p className="mt-2 text-3xl font-semibold text-brand-charcoal">
              {quizStats.totalQuizzes}
            </p>
          )}
          <p className="mt-4 text-xs uppercase tracking-wide text-brand-slate">
            Attempts Completed
          </p>
        </div>
        <div className="rounded-2xl border border-brand-mint/60 bg-white p-6 shadow-subtle">
          <p className="text-sm text-brand-slate">Average Quiz Score</p>
          {quizLoading ? (
            <p className="mt-2 text-3xl font-semibold text-brand-charcoal">—</p>
          ) : (
            <p className="mt-2 text-3xl font-semibold text-brand-charcoal">
              {quizStats.totalQuizzes > 0 ? `${quizStats.averageScore.toFixed(1)}%` : '—'}
            </p>
          )}
          <p className="mt-4 text-xs uppercase tracking-wide text-brand-slate">
            Across All Quizzes
          </p>
        </div>
        <div className="rounded-2xl border border-brand-mint/60 bg-white p-6 shadow-subtle">
          <p className="text-sm text-brand-slate">Last Quiz Score</p>
          {quizLoading ? (
            <p className="mt-2 text-3xl font-semibold text-brand-charcoal">—</p>
          ) : (
            <p className="mt-2 text-3xl font-semibold text-brand-charcoal">
              {quizStats.recentScore !== null && quizStats.totalQuizzes > 0
                ? `${quizStats.recentScore.toFixed(1)}%`
                : '—'}
            </p>
          )}
          <p className="mt-4 text-xs uppercase tracking-wide text-brand-slate">
            Most Recent Result
          </p>
        </div>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-5">
        <div className="rounded-2xl border border-brand-mint/60 bg-white p-6 shadow-subtle md:col-span-3">
          <h2 className="text-xl font-semibold text-brand-charcoal">Progress</h2>
          <p className="mt-2 text-sm text-brand-slate">Sessions completed in the last month.</p>
          {statsLoading ? (
            <div className="mt-6 flex items-end gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-1 text-center">
                  <div className="mx-auto flex h-32 w-9 items-end justify-center rounded-full bg-brand-background">
                    <div className="w-9 rounded-full bg-brand-background" aria-hidden />
                  </div>
                  <p className="mt-2 text-xs text-brand-slate">—</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 flex items-end gap-3">
              {chartData.map((point) => {
                const barHeight =
                  maxChartValue > 0 && point.value > 0
                    ? Math.max(5, (point.value / maxChartValue) * 100)
                    : 0;
                return (
                  <div key={point.label} className="flex-1 text-center">
                    <div className="mx-auto flex h-32 w-9 items-end justify-center rounded-full bg-brand-background">
                      {barHeight > 0 && (
                        <div
                          className="w-9 rounded-full bg-brand-sky transition-[height]"
                          style={{
                            height: `${barHeight}%`,
                          }}
                          aria-hidden
                        />
                      )}
                    </div>
                    <p className="mt-2 text-xs text-brand-slate">{point.label}</p>
                    <p className="mt-1 text-xs font-medium text-brand-charcoal">{point.value}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-brand-mint/60 bg-white p-6 shadow-subtle md:col-span-2">
          <h2 className="text-xl font-semibold text-brand-charcoal">Achievement Badges</h2>
          <p className="mt-2 text-sm text-brand-slate">
            Unlock badges as you keep learning with MathMate.
          </p>
          {statsLoading ? (
            <div className="mt-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border border-brand-mint/60 bg-brand-background p-3"
                >
                  <span className="text-lg" aria-hidden>
                    🔒
                  </span>
                  <div className="flex-1">
                    <div className="h-4 w-24 animate-pulse rounded bg-brand-mint/20" />
                    <div className="mt-1 h-3 w-32 animate-pulse rounded bg-brand-mint/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {badges.map((badge) => (
                <li
                  key={badge.id}
                  className={`flex items-start gap-3 rounded-2xl border p-3 ${
                    badge.unlocked
                      ? 'border-brand-mint bg-brand-mint/20'
                      : 'border-brand-mint/60 bg-brand-background'
                  }`}
                >
                  <span className="text-lg" aria-hidden>
                    {badge.unlocked ? '🏅' : '🔒'}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-brand-charcoal">{badge.name}</p>
                    <p className="text-xs text-brand-slate">{badge.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-brand-mint/60 bg-white p-6 shadow-subtle">
        <div>
          <h2 className="text-xl font-semibold text-brand-charcoal">Recent Sessions</h2>
          <p className="mt-2 text-sm text-brand-slate">
            Your last few tutoring sessions will appear here once you start practicing.
          </p>
        </div>

        {statsLoading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-brand-mint/60 bg-brand-background p-4"
              >
                <div className="h-4 w-32 animate-pulse rounded bg-brand-mint/20" />
                <div className="mt-2 h-3 w-24 animate-pulse rounded bg-brand-mint/10" />
              </div>
            ))}
          </div>
        ) : recentSessions.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-brand-mint/80 bg-brand-background p-6 text-sm text-brand-slate">
            No sessions to display yet. Start a new session to see your progress history.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {recentSessions.map((session) => {
              const handleSessionClick = () => {
                setActiveSessionId(session.id);
                navigate('/tutor');
              };

              const sessionDate = session.lastUpdated || session.createdAt;
              const isCompleted = session.completed === true;
              const isEditing = editingSessionId === session.id;
              const isActive =
                mostRecentSessionId !== null && session.id === mostRecentSessionId && !isCompleted;

              return (
                <div
                  key={session.id}
                  className="flex items-center gap-3 rounded-xl border border-brand-mint/60 bg-white p-4 transition hover:border-brand-sky hover:bg-brand-background"
                >
                  <button
                    type="button"
                    onClick={isEditing ? undefined : handleSessionClick}
                    className="flex-1 text-left"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleRenameSave(session.id);
                              } else if (e.key === 'Escape') {
                                handleRenameCancel();
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onKeyUp={(e) => e.stopPropagation()}
                            className="flex-1 rounded border border-brand-sky px-2 py-1 text-sm font-semibold text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-sky"
                          />
                        ) : (
                          <h3 className="text-sm font-semibold text-brand-charcoal">
                            {session.title || 'Untitled Session'}
                          </h3>
                        )}
                        {isActive && (
                          <span className="rounded-full bg-brand-sky/20 px-2 py-0.5 text-xs font-medium text-brand-sky">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-brand-slate">
                        {sessionDate && <span>{formatRelativeTime(sessionDate)}</span>}
                        {session.topicId && (
                          <span className="rounded-full bg-brand-sky/10 px-2 py-0.5 text-brand-sky">
                            {session.topicId}
                          </span>
                        )}
                        {session.stats && (
                          <>
                            {session.stats.hintsUsed !== undefined &&
                              session.stats.hintsUsed > 0 && (
                                <span>💡 {session.stats.hintsUsed} hints</span>
                              )}
                            {session.stats.durationSec !== undefined &&
                              session.stats.durationSec > 0 && (
                                <span>⏱️ {formatDuration(session.stats.durationSec)}</span>
                              )}
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRenameSave(session.id)}
                          disabled={isSaving}
                          className="rounded-full border border-brand-sky bg-white px-3 py-1.5 text-xs font-medium text-brand-sky transition hover:bg-brand-sky/10 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={handleRenameCancel}
                          disabled={isSaving}
                          className="rounded-full border border-brand-slate bg-white px-3 py-1.5 text-xs font-medium text-brand-slate transition hover:bg-brand-background disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameStart(session);
                          }}
                          className="rounded-full border border-brand-slate bg-white px-3 py-1.5 text-xs font-medium text-brand-slate transition hover:bg-brand-background"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStart(session.id);
                          }}
                          className="rounded-full border border-brand-coral bg-white px-3 py-1.5 text-xs font-medium text-brand-coral transition hover:bg-brand-coral/10"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      {deletingSessionId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-brand-mint/60 bg-white p-6 shadow-subtle">
            <h3 className="text-lg font-semibold text-brand-charcoal">Delete Session</h3>
            <p className="mt-2 text-sm text-brand-slate">
              Are you sure you want to delete this session? This action cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="flex-1 rounded-full border border-brand-slate px-4 py-2 text-sm font-medium text-brand-slate transition hover:bg-brand-background disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConfirm(deletingSessionId)}
                disabled={isDeleting}
                className="flex-1 rounded-full bg-brand-coral px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-coral/90 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DashboardPage = () => (
  <ProtectedRoute>
    <DashboardContent />
  </ProtectedRoute>
);

export default DashboardPage;
