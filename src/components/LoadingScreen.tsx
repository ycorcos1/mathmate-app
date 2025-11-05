export const LoadingScreen = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <span className="size-10 animate-spin rounded-full border-4 border-brand-mint border-t-brand-sky" />
      <p className="text-sm text-brand-slate">MathMate is getting set up…</p>
    </div>
  </div>
);
