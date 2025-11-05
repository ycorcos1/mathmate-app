import { Link } from 'react-router-dom';

const NotFoundPage = () => (
  <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-brand-background px-4 text-center">
    <span className="text-6xl">🔍</span>
    <h1 className="text-3xl font-semibold text-brand-charcoal">Page not found</h1>
    <p className="max-w-md text-sm text-brand-slate">
      The page you are looking for does not exist. Try heading back to the homepage or opening the tutor to
      continue learning.
    </p>
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Link
        to="/"
        className="rounded-full bg-brand-sky px-6 py-3 text-sm font-medium text-white shadow-subtle transition hover:bg-brand-sky/90"
      >
        Go home
      </Link>
      <Link
        to="/tutor"
        className="rounded-full border border-brand-sky px-6 py-3 text-sm font-medium text-brand-sky transition hover:bg-white"
      >
        Open tutor
      </Link>
    </div>
  </div>
);

export default NotFoundPage;
