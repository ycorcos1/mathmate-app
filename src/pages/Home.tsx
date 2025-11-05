import { Link } from 'react-router-dom';

const featureCards = [
  {
    title: 'Chat-first tutoring',
    description:
      'Engage with a patient guide that nudges you toward the next step instead of jumping to the answer.'
  },
  {
    title: 'Workspace insights',
    description:
      'See each reasoning step unfold in a dedicated panel with KaTeX-rendered math and dynamic hints.'
  },
  {
    title: 'Image understanding',
    description:
      'Upload textbook shots or notes—MathMate extracts the math so you can focus on solving together.'
  }
];

const HomePage = () => {
  return (
    <div className="bg-brand-background">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16 md:flex-row md:items-center">
        <div className="md:w-1/2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-sky shadow-subtle">
            Think it through — together
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-tight text-brand-charcoal md:text-5xl">
            Guided math reasoning powered by Socratic conversation.
          </h1>
          <p className="mt-4 text-lg text-brand-slate">
            MathMate helps you unpack problems, validate each step, and build confidence. Whether you type a
            question or upload a worksheet, the tutor meets you where you are.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/signup"
              className="rounded-full bg-brand-sky px-6 py-3 text-sm font-medium text-white shadow-subtle transition hover:bg-brand-sky/90"
            >
              Get started
            </Link>
          </div>
        </div>
        <div className="md:w-1/2">
          <div className="rounded-3xl bg-white p-6 shadow-subtle">
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-7 space-y-4">
                <div className="rounded-2xl bg-brand-sky/10 p-4 shadow-subtle">
                  <p className="text-xs font-medium text-brand-slate">MathMate</p>
                  <p className="mt-2 text-brand-charcoal">
                    What’s the very first thing we want to know about this equation?
                  </p>
                </div>
                <div className="rounded-2xl bg-brand-mint/20 p-4">
                  <p className="text-xs font-medium text-brand-slate">You</p>
                  <p className="mt-2 text-brand-charcoal">
                    Probably what value of <span className="font-mono">x</span> makes it true.
                  </p>
                </div>
              </div>
              <div className="col-span-5 space-y-4">
                <div className="rounded-xl border border-brand-yellow bg-[#FFF9E6] p-4 text-sm text-brand-charcoal">
                  <p className="font-medium">Hint</p>
                  <p className="mt-2 text-sm text-brand-slate">
                    Try isolating <span className="font-mono">x</span> by undoing the addition before the
                    multiplication.
                  </p>
                </div>
                <div className="rounded-xl border border-brand-mint bg-white p-4">
                  <p className="text-xs font-medium text-brand-slate">Step 1</p>
                  <p className="mt-2 font-mono text-brand-charcoal">2x + 5 = 13</p>
                  <p className="mt-1 text-xs text-brand-slate">Subtract 5 from both sides.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-white py-16">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-semibold text-brand-charcoal">Why students choose MathMate</h2>
              <p className="mt-2 max-w-2xl text-brand-slate">
                Built with the “Friendly Academic Minimalism” aesthetic, the interface keeps focus on the
                conversation and conceptual understanding.
              </p>
            </div>
            <Link to="/about" className="text-sm font-medium text-brand-sky">
              Learn about our approach →
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {featureCards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-brand-mint/60 bg-brand-background p-6">
                <h3 className="text-xl font-semibold text-brand-charcoal">{card.title}</h3>
                <p className="mt-2 text-sm text-brand-slate">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
