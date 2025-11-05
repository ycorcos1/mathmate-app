import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { firestore } from '../firebase';
import { useUserDoc } from '../hooks/useUserDoc';

const SettingsContent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userId } = useUserDoc();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  );
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const [confirmEmail, setConfirmEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<string>('');

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordStatus('idle');
    setPasswordMessage(null);

    if (!user?.email || !user) {
      setPasswordStatus('error');
      setPasswordMessage('You must be logged in to change your password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus('error');
      setPasswordMessage('New passwords must match.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordStatus('error');
      setPasswordMessage('Use a password with at least 8 characters.');
      return;
    }

    try {
      setPasswordStatus('loading');
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setPasswordStatus('success');
      setPasswordMessage('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Password update failed:', error);
      setPasswordStatus('error');
      setPasswordMessage(
        'Unable to update password. Please check your current password and try again.',
      );
    }
  };

  const deleteCollectionDocs = async (collectionPath: 'sessions' | 'progress') => {
    if (!userId) {
      return;
    }

    const querySnapshot = await getDocs(collection(firestore, 'users', userId, collectionPath));

    if (querySnapshot.empty) {
      return;
    }

    let batch = writeBatch(firestore);
    let counter = 0;
    const commits: Array<Promise<void>> = [];

    querySnapshot.forEach((documentSnapshot) => {
      batch.delete(documentSnapshot.ref);
      counter += 1;

      if (counter === 450) {
        commits.push(batch.commit());
        batch = writeBatch(firestore);
        counter = 0;
      }
    });

    commits.push(batch.commit());

    await Promise.all(commits);
  };

  const handleDeleteAccount = async () => {
    setDeleteStatus('idle');
    setDeleteMessage(null);
    setDeleteStep('');

    if (!user?.email || !user || !userId) {
      setDeleteStatus('error');
      setDeleteMessage('You must be logged in to delete your account.');
      return;
    }

    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      setDeleteStatus('error');
      setDeleteMessage('Email confirmation does not match.');
      return;
    }

    if (!deletePassword) {
      setDeleteStatus('error');
      setDeleteMessage('Enter your current password to continue.');
      return;
    }

    try {
      setDeleteStatus('loading');
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);

      setDeleteStep('Clearing progress…');
      await deleteCollectionDocs('progress');
      setDeleteStep('Clearing sessions…');
      await deleteCollectionDocs('sessions');

      setDeleteStep('Removing account…');
      await deleteDoc(doc(firestore, 'users', userId));

      await deleteUser(user);
      setConfirmEmail('');
      setDeletePassword('');
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Account deletion failed:', error);
      setDeleteStatus('error');

      if ((error as { code?: string }).code === 'auth/requires-recent-login') {
        setDeleteMessage('Please sign in again and retry account deletion.');
      } else {
        setDeleteMessage('Account deletion failed. Please try again.');
      }
      setDeleteStep('');
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-brand-charcoal">Settings</h1>
      <p className="mt-2 text-sm text-brand-slate">
        Manage your MathMate account security and settings.
      </p>

      <section className="mt-10 rounded-3xl border border-brand-mint/60 bg-white p-8 shadow-subtle">
        <h2 className="text-xl font-semibold text-brand-charcoal">Change password</h2>
        <p className="mt-2 text-sm text-brand-slate">
          Update your password to keep your account secure. You will need your current password to
          confirm the change.
        </p>
        <form className="mt-6 space-y-5" onSubmit={handlePasswordChange}>
          <div className="space-y-2">
            <label htmlFor="currentPassword" className="text-sm font-medium text-brand-charcoal">
              Current password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-xl border border-brand-mint/60 bg-brand-background px-4 py-3 text-sm outline-none transition focus:border-brand-sky focus:bg-white"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="newPassword" className="text-sm font-medium text-brand-charcoal">
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-xl border border-brand-mint/60 bg-brand-background px-4 py-3 text-sm outline-none transition focus:border-brand-sky focus:bg-white"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-brand-charcoal">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-brand-mint/60 bg-brand-background px-4 py-3 text-sm outline-none transition focus:border-brand-sky focus:bg-white"
            />
          </div>
          {passwordStatus !== 'idle' && passwordMessage ? (
            <p
              className={`rounded-xl px-4 py-3 text-sm ${
                passwordStatus === 'success'
                  ? 'bg-brand-mint/20 text-brand-charcoal'
                  : 'bg-[#FEE2E2] text-brand-coral'
              }`}
            >
              {passwordMessage}
            </p>
          ) : null}
          <button
            type="submit"
            className="rounded-full bg-brand-sky px-6 py-3 text-sm font-medium text-white shadow-subtle transition hover:bg-brand-sky/90 disabled:cursor-not-allowed disabled:bg-brand-slate"
            disabled={passwordStatus === 'loading'}
          >
            {passwordStatus === 'loading' ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>

      <section className="mt-10 rounded-3xl border border-brand-coral/60 bg-white p-8 shadow-subtle">
        <h2 className="text-xl font-semibold text-brand-coral">Delete account</h2>
        <p className="mt-2 text-sm text-brand-slate">
          Permanently remove your account and all related session data. This action is irreversible.
        </p>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="confirmEmail" className="text-sm font-medium text-brand-charcoal">
              Type your email to confirm
            </label>
            <input
              id="confirmEmail"
              name="confirmEmail"
              type="email"
              placeholder={user?.email ?? ''}
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              className="w-full rounded-xl border border-brand-mint/60 bg-brand-background px-4 py-3 text-sm outline-none transition focus:border-brand-coral focus:bg-white"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="deletePassword" className="text-sm font-medium text-brand-charcoal">
              Current password
            </label>
            <input
              id="deletePassword"
              name="deletePassword"
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              className="w-full rounded-xl border border-brand-mint/60 bg-brand-background px-4 py-3 text-sm outline-none transition focus:border-brand-coral focus:bg-white"
            />
          </div>
          {deleteStatus === 'error' && deleteMessage ? (
            <p className="rounded-xl bg-[#FEE2E2] px-4 py-3 text-sm text-brand-coral">
              {deleteMessage}
            </p>
          ) : null}
          {deleteStep ? (
            <p className="rounded-xl bg-brand-mint/20 px-4 py-3 text-xs text-brand-charcoal">
              {deleteStep}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleDeleteAccount}
            className="rounded-full border border-brand-coral px-6 py-3 text-sm font-medium text-brand-coral transition hover:bg-[#FEE2E2] disabled:cursor-not-allowed disabled:opacity-70"
            disabled={deleteStatus === 'loading'}
          >
            {deleteStatus === 'loading' ? 'Deleting account…' : 'Delete account'}
          </button>
        </div>
      </section>
    </div>
  );
};

const SettingsPage = () => (
  <ProtectedRoute>
    <SettingsContent />
  </ProtectedRoute>
);

export default SettingsPage;
