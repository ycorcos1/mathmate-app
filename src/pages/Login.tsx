import { FirebaseError } from 'firebase/app';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const emailPattern = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

  const clearFieldError = (key: 'email' | 'password' | 'general') => {
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
      const trimmedEmail = email.trim();
      const validationErrors: { email?: string; password?: string } = {};

      if (!emailPattern.test(trimmedEmail)) {
        validationErrors.email = 'Enter a valid email address.';
      }

      if (!password || password.length < 6) {
        validationErrors.password = 'Passwords must be at least 6 characters long.';
      }

      if (Object.keys(validationErrors).length > 0) {
        setFieldErrors(validationErrors);
        return;
      }

      await signIn(trimmedEmail, password);
      const redirectPath = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard';
      navigate(redirectPath, { replace: true });
    } catch (err) {
      let message = 'We could not sign you in. Double-check your email and password and try again.';

      if (err instanceof FirebaseError) {
        switch (err.code) {
          case 'auth/invalid-email':
            message = 'That email address looks incorrect. Please try again.';
            setFieldErrors((prev) => ({ ...prev, email: 'Enter a valid email address.' }));
            break;
          case 'auth/user-disabled':
            message = 'This account has been disabled. Contact support for help reconnecting.';
            break;
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            message = 'We could not find an account with that email and password combination.';
            setFieldErrors((prev) => ({ ...prev, password: 'Check your password and try again.' }));
            break;
          case 'auth/too-many-requests':
            message = 'Too many login attempts. Please wait a minute before trying again.';
            break;
          default:
            message = 'Something went wrong while signing you in. Try again in a moment.';
        }
      }

      setFieldErrors((prev) => ({ ...prev, general: message }));
    } finally {
      setLoading(false);
    }
  };

  const isSubmittingDisabled = loading || !email.trim() || !password;

  return (
    <div className="flex min-h-[75vh] items-center justify-center bg-brand-background px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-brand-mint/60 bg-white p-8 shadow-subtle">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-brand-charcoal">Welcome back</h1>
          <p className="mt-2 text-sm text-brand-slate">Sign in to resume your MathMate sessions.</p>
        </div>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
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
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              className={`w-full rounded-xl border ${
                fieldErrors.email ? 'border-brand-coral' : 'border-brand-mint/60'
              } bg-brand-background px-4 py-3 text-sm outline-none transition focus:border-brand-sky focus:bg-white`}
            />
            {fieldErrors.email ? (
              <p id="login-email-error" className="text-xs text-brand-coral">
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
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFieldError('password');
                clearFieldError('general');
              }}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
              className={`w-full rounded-xl border ${
                fieldErrors.password ? 'border-brand-coral' : 'border-brand-mint/60'
              } bg-brand-background px-4 py-3 text-sm outline-none transition focus:border-brand-sky focus:bg-white`}
            />
            {fieldErrors.password ? (
              <p id="login-password-error" className="text-xs text-brand-coral">
                {fieldErrors.password}
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
            disabled={isSubmittingDisabled}
            className="w-full rounded-full bg-brand-sky px-6 py-3 text-sm font-medium text-white shadow-subtle transition hover:bg-brand-sky/90 disabled:cursor-not-allowed disabled:bg-brand-slate"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="mt-6 flex justify-between text-sm">
          <Link to="/forgot-password" className="text-brand-sky">
            Forgot password?
          </Link>
          <span className="text-brand-slate">
            New here?{' '}
            <Link to="/signup" className="font-medium text-brand-sky">
              Create account
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
