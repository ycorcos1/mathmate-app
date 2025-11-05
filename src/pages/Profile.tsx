import { useEffect, useMemo, useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { firestore } from '../firebase';
import { useUserDoc } from '../hooks/useUserDoc';

const ProfileContent = () => {
  const { user, refreshUser } = useAuth();
  const { userDoc, userId, loading: userDocLoading, error: userDocError } = useUserDoc();

  const [displayName, setDisplayName] = useState('');
  const [voiceMode, setVoiceMode] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  useEffect(() => {
    if (!userDoc) {
      return;
    }

    setDisplayName(userDoc.displayName ?? '');
    setVoiceMode(Boolean(userDoc.settings?.voiceMode));
  }, [userDoc]);

  const isFieldBusy = useMemo(
    () => isSavingName || isUpdatingSettings,
    [isSavingName, isUpdatingSettings],
  );

  const handleDisplayNameBlur = async () => {
    if (!userId || !user) {
      return;
    }

    const trimmed = displayName.trim();

    if (!trimmed) {
      setProfileError('Display name cannot be empty.');
      return;
    }

    if (trimmed === userDoc?.displayName) {
      setProfileError(null);
      return;
    }

    setIsSavingName(true);
    setProfileError(null);

    try {
      const userRef = doc(firestore, 'users', userId);
      await updateDoc(userRef, { displayName: trimmed });
      await updateProfile(user, { displayName: trimmed });
      await refreshUser();
    } catch (error) {
      console.error('Failed to update display name', error);
      setProfileError('We could not update your name. Please try again.');
    } finally {
      setIsSavingName(false);
    }
  };

  const updateSettings = async (updates: Partial<{ voiceMode: boolean }>) => {
    if (!userId) {
      return false;
    }

    setIsUpdatingSettings(true);
    setSettingsError(null);

    try {
      const userRef = doc(firestore, 'users', userId);
      const payload: Record<string, unknown> = {};

      if (updates.voiceMode !== undefined) {
        payload['settings.voiceMode'] = updates.voiceMode;
      }

      await updateDoc(userRef, payload);
      return true;
    } catch (error) {
      console.error('Failed to update settings', error);
      setSettingsError('Unable to save your settings right now. Please try again.');
      return false;
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleVoiceModeToggle = async (checked: boolean) => {
    const previous = voiceMode;
    setVoiceMode(checked);
    const success = await updateSettings({ voiceMode: checked });

    if (!success) {
      setVoiceMode(previous);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <div className="rounded-3xl border border-brand-mint/60 bg-white p-8 shadow-subtle">
        <h1 className="text-3xl font-semibold text-brand-charcoal">Profile</h1>
        <p className="mt-2 text-sm text-brand-slate">
          Manage how MathMate greets you and tune your tutor preferences.
        </p>

        {userDocError ? (
          <div className="mt-6 rounded-xl border border-brand-coral/50 bg-[#FEE2E2] px-4 py-3 text-sm text-brand-coral">
            We couldn’t load your profile. Please refresh to try again.
          </div>
        ) : null}

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-brand-charcoal">Identity</h2>
          <p className="mt-1 text-sm text-brand-slate">
            This is how MathMate introduces you during tutoring sessions.
          </p>

          <form className="mt-6 space-y-5" onSubmit={(event) => event.preventDefault()}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-slate">
                Display name
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                onBlur={handleDisplayNameBlur}
                disabled={userDocLoading || isSavingName}
                placeholder="Your name"
                className="mt-2 w-full rounded-2xl border border-brand-mint/60 bg-white px-4 py-3 text-sm text-brand-charcoal shadow-inner transition focus:border-brand-sky disabled:cursor-not-allowed disabled:bg-brand-background"
              />
            </label>

            <div className="rounded-2xl bg-brand-background px-4 py-3 text-sm text-brand-slate">
              <p className="font-medium text-brand-charcoal">Account email</p>
              <p>{user?.email}</p>
            </div>

            {profileError ? <p className="text-sm text-brand-coral">{profileError}</p> : null}
          </form>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-brand-charcoal">Tutor preferences</h2>
          <p className="mt-1 text-sm text-brand-slate">
            Control how MathMate sounds during sessions.
          </p>

          <div className="mt-6">
            <div className="rounded-2xl border border-brand-mint/60 p-5">
              <h3 className="text-sm font-semibold text-brand-charcoal">Voice mode</h3>
              <p className="mt-1 text-sm text-brand-slate">
                Enable speech-assisted tutoring (coming soon).
              </p>

              <div className="mt-4 flex items-center justify-between rounded-2xl bg-brand-background px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-brand-charcoal">Voice mode</p>
                  <p className="text-xs text-brand-slate">
                    When available, speak with MathMate out loud.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleVoiceModeToggle(!voiceMode)}
                  disabled={isFieldBusy || userDocLoading}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                    voiceMode ? 'bg-brand-sky' : 'bg-brand-slate/40'
                  } ${isFieldBusy || userDocLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  aria-pressed={voiceMode}
                >
                  <span
                    className={`inline-block size-5 rounded-full bg-white transition-transform ${
                      voiceMode ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {settingsError ? (
                <p className="mt-3 text-sm text-brand-coral">{settingsError}</p>
              ) : null}
            </div>
          </div>
        </section>

        {isFieldBusy ? (
          <p className="mt-6 text-xs text-brand-slate">Saving your preferences…</p>
        ) : null}
      </div>
    </div>
  );
};

const ProfilePage = () => (
  <ProtectedRoute>
    <ProfileContent />
  </ProtectedRoute>
);

export default ProfilePage;
