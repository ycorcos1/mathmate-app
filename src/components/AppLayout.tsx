import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-sky text-white shadow-subtle' : 'text-brand-charcoal hover:bg-white'
  }`;

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, loading, signOutUser } = useAuth();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const isTutorRoute = location.pathname.startsWith('/tutor');
  const mainClassName = `flex min-h-0 flex-1 flex-col ${isTutorRoute ? 'overflow-hidden' : 'overflow-y-auto'}`;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOutUser();
      navigate('/');
    } finally {
      setProfileMenuOpen(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-brand-background text-brand-charcoal">
      <header className="relative z-50 border-b border-brand-mint/40 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link
            to={user ? '/dashboard' : '/'}
            className="flex items-center gap-3 text-lg font-semibold text-brand-sky no-underline hover:no-underline"
          >
            <img src="/mathmate-icon.svg" alt="MathMate logo" className="size-8" />
            MathMate
          </Link>
          <nav className="flex items-center gap-2">
            {loading ? (
              <div
                className="h-9 w-20 animate-pulse rounded-full bg-brand-background"
                aria-hidden
              />
            ) : user ? (
              <>
                <NavLink to="/dashboard" className={navLinkClassName}>
                  Dashboard
                </NavLink>
                <NavLink to="/quiz" className={navLinkClassName}>
                  Quiz
                </NavLink>
                <NavLink to="/tutor" className={navLinkClassName}>
                  Tutor
                </NavLink>
                <div className="relative z-10" ref={profileMenuRef}>
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((open) => !open)}
                    className="rounded-full px-4 py-2 text-sm font-medium text-brand-charcoal transition hover:bg-white"
                    aria-haspopup="menu"
                    aria-expanded={isProfileMenuOpen}
                  >
                    Profile ▾
                  </button>
                  {isProfileMenuOpen ? (
                    <div className="absolute right-0 top-full z-[100] mt-2 w-48 rounded-2xl border border-brand-mint/60 bg-white py-1 shadow-lg">
                      <Link
                        to="/profile"
                        className="block rounded-t-2xl px-4 py-2 text-sm text-brand-charcoal transition hover:bg-brand-background"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        Profile
                      </Link>
                      <Link
                        to="/settings"
                        className="block px-4 py-2 text-sm text-brand-charcoal transition hover:bg-brand-background"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        Settings
                      </Link>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="block w-full rounded-b-2xl px-4 py-2 text-left text-sm text-brand-coral transition hover:bg-[#FEE2E2]"
                      >
                        Log out
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navLinkClassName}>
                  Login
                </NavLink>
                <NavLink to="/signup" className={navLinkClassName}>
                  Sign up
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className={mainClassName}>{children}</main>
      <footer className="border-t border-brand-mint/40 bg-white/70 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-6 text-sm text-brand-slate md:flex-row md:items-center">
          <span>
            © {new Date().getFullYear()} MathMate. Guided learning through Socratic dialogue.
          </span>
          <div className="flex gap-4">
            <Link to="/about" className="hover:text-brand-sky">
              About
            </Link>
            <Link to="/privacy" className="hover:text-brand-sky">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-brand-sky">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
