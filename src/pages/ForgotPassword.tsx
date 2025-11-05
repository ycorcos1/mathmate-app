import { FirebaseError } from 'firebase/app';
import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ForgotPasswordPage = () => {
  const { sendResetEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    status: 'idle' | 'success' | 'error';
    message?: string;
  }>({
    status: 'idle',
  });
  const [loading, setLoading] = useState(false);
  const emailPattern = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError(null);
    setFeedback({ status: 'idle' });
    const trimmedEmail = email.trim();

    if (!emailPattern.test(trimmedEmail)) {
      setFieldError('Enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      await sendResetEmail(trimmedEmail);
      setFeedback({
        status: 'success',
        message: 'Check your inbox for a password reset link. It may take a minute to arrive.',
      });
    } catch (err) {
      let message = 'We could not send the reset email. Please verify the address and try again.';

      if (err instanceof FirebaseError) {
        switch (err.code) {
          case 'auth/invalid-email':
            message = 'That email address looks incorrect. Please try again.';
            setFieldError('Enter a valid email address.');
            break;
          case 'auth/user-not-found':
            message =
              'We do not see an account with that email yet. Double-check or sign up first.';
            break;
          case 'auth/too-many-requests':
            message =
              'We have sent too many reset emails recently. Please wait a bit and try again.';
            break;
          case 'auth/network-request-failed':
            message = 'Network error. Check your connection and try again.';
            break;
          default:
            message = 'Something went wrong while sending the reset email. Try again shortly.';
        }
      }

      setFeedback({ status: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-brand-background px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-brand-mint/60 bg-white p-8 shadow-subtle">
        <h1 className="text-2xl font-semibold text-brand-charcoal">Forgot your password?</h1>
        <p className="mt-2 text-sm text-brand-slate">
          Enter the email tied to your MathMate account and we&apos;ll send a link to reset your
          password.
        </p>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-brand-charcoal">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldError(null);
                setFeedback({ status: 'idle' });
              }}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? 'forgot-email-error' : undefined}
              className={`w-full rounded-xl border ${
                fieldError ? 'border-brand-coral' : 'border-brand-mint/60'
              } bg-brand-background px-4 py-3 text-sm outline-none transition focus:border-brand-sky focus:bg-white`}
            />
            {fieldError ? (
              <p id="forgot-email-error" className="text-xs text-brand-coral">
                {fieldError}
              </p>
            ) : null}
          </div>
          {feedback.status !== 'idle' && feedback.message ? (
            <p
              className={`rounded-xl p-3 text-sm ${
                feedback.status === 'success'
                  ? 'bg-brand-mint/40 text-brand-charcoal'
                  : 'bg-[#FEE2E2] text-brand-coral'
              }`}
              role="alert"
            >
              {feedback.message}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full rounded-full bg-brand-sky px-6 py-3 text-sm font-medium text-white shadow-subtle transition hover:bg-brand-sky/90 disabled:cursor-not-allowed disabled:bg-brand-slate"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-brand-slate">
          Ready to sign in?{' '}
          <Link to="/login" className="font-medium text-brand-sky">
            Return to login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
