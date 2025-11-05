import { FirebaseError } from 'firebase/app';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type SignupErrorKey = 'displayName' | 'email' | 'password' | 'confirmPassword' | 'general';

const SignupPage = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const emailPattern = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);
  const MIN_PASSWORD_LENGTH = 8;

  const clearFieldError = (key: SignupErrorKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) {
        return prev;
      }

      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setLoading(true);

    try {
      const trimmedDisplayName = displayName.trim();
      const trimmedEmail = email.trim();
      const validationErrors: Partial<Record<SignupErrorKey, string>> = {};

      if (trimmedDisplayName.length < 2) {
        validationErrors.displayName = 'Tell us what to call you (at least 2 characters).';
      }

      if (!emailPattern.test(trimmedEmail)) {
        validationErrors.email = 'Enter a valid email address.';
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
        validationErrors.password = `Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`;
      }

      if (password !== confirmPassword) {
        validationErrors.confirmPassword = 'Passwords must match exactly.';
      }

      if (Object.keys(validationErrors).length > 0) {
        setFieldErrors(validationErrors);
        return;
      }

      await signUp(trimmedEmail, password, trimmedDisplayName);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      let message = 'We could not create your account right now. Please try again.';

      if (err instanceof FirebaseError) {
        switch (err.code) {
          case 'auth/email-already-in-use':
            message = 'That email is already registered. Try logging in instead.';
            setFieldErrors((prev) => ({ ...prev, email: 'This email is already in use.' }));
            break;
          case 'auth/invalid-email':
            message = 'That email address looks incorrect. Please try again.';
            setFieldErrors((prev) => ({ ...prev, email: 'Enter a valid email address.' }));
            break;
          case 'auth/weak-password':
            message = 'That password is too weak. Try adding more characters or variety.';
            setFieldErrors((prev) => ({ ...prev, password: 'Choose a stronger password.' }));
            break;
          case 'auth/operation-not-allowed':
            message = 'Email and password sign-ups are disabled for now. Contact support for help.';
            break;
          default:
            message = 'Something unexpected happened. Please try again in a moment.';
        }
      }

      setFieldErrors((prev) => ({ ...prev, general: message }));
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled =
    loading || !displayName.trim() || !email.trim() || !password || !confirmPassword;

  return (
    <div className="flex min-h-[75vh] items-center justify-center bg-brand-background px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-brand-mint/60 bg-white p-8 shadow-subtle">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-brand-charcoal">Create your account</h1>
          <p className="mt-2 text-sm text-brand-slate">
            The Socratic tutor is ready to learn alongside you.
          </p>
        </div>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="displayName" className="text-sm font-medium text-brand-charcoal">
              Name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              placeholder="Alex Student"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                clearFieldError('displayName');
                clearFieldError('general');
              }}
              aria-invalid={Boolean(fieldErrors.displayName)}
              aria-describedby={fieldErrors.displayName ? 'signup-display-name-error' : undefined}
              className={`w-full rounded-xl border ${
                fieldErrors.displayName ? 'border-brand-coral' : 'border-brand-mint/60'
              } bg-brand-background px-4 py-3 text-sm outline-none transition focus:border-brand-sky focus:bg-white`}
            />
            {fieldErrors.displayName ? (
              <p id="signup-display-name-error" className="text-xs text-brand-coral">
                {fieldErrors.displayName}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-brand-charcoal">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearFieldError('email');
                clearFieldError('general');
              }}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined}
              className={`w-full rounded-xl border ${
                fieldErrors.email ? 'border-brand-coral' : 'border-brand-mint/60'
              } bg-brand-background px-4 py-3 text-sm outline-none transition focus:border-brand-sky focus:bg-white`}
            />
            {fieldErrors.email ? (
              <p id="signup-email-error" className="text-xs text-brand-coral">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-brand-charcoal">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFieldError('password');
                clearFieldError('general');
                clearFieldError('confirmPassword');
              }}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'signup-password-error' : undefined}
              className={`w-full rounded-xl border ${
                fieldErrors.password ? 'border-brand-coral' : 'border-brand-mint/60'
              } bg-brand-background px-4 py-3 text-sm outline-none transition focus:border-brand-sky focus:bg-white`}
            />
            {fieldErrors.password ? (
              <p id="signup-password-error" className="text-xs text-brand-coral">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-brand-charcoal">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                clearFieldError('confirmPassword');
                clearFieldError('general');
              }}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              aria-describedby={
                fieldErrors.confirmPassword ? 'signup-confirm-password-error' : undefined
              }
              className={`w-full rounded-xl border ${
                fieldErrors.confirmPassword ? 'border-brand-coral' : 'border-brand-mint/60'
              } bg-brand-background px-4 py-3 text-sm outline-none transition focus:border-brand-sky focus:bg-white`}
            />
            {fieldErrors.confirmPassword ? (
              <p id="signup-confirm-password-error" className="text-xs text-brand-coral">
                {fieldErrors.confirmPassword}
              </p>
            ) : null}
          </div>
          {fieldErrors.general ? (
            <p className="rounded-xl bg-[#FEE2E2] p-3 text-sm text-brand-coral" role="alert">
              {fieldErrors.general}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full rounded-full bg-brand-sky px-6 py-3 text-sm font-medium text-white shadow-subtle transition hover:bg-brand-sky/90 disabled:cursor-not-allowed disabled:bg-brand-slate"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-brand-slate">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-sky">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
