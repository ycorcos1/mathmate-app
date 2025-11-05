const AboutPage = () => (
  <div className="mx-auto w-full max-w-4xl px-4 py-16">
    <h1 className="text-3xl font-semibold text-brand-charcoal">About MathMate</h1>
    <p className="mt-4 text-brand-slate">
      MathMate pairs OpenAI-powered Socratic questioning with Firebase-backed persistence to keep learners on
      track. This page will evolve with richer storytelling and the pedagogical foundation in upcoming PRs.
    </p>
    <div className="mt-8 space-y-4 text-sm leading-relaxed text-brand-charcoal">
      <p>
        Our core belief is that understanding stems from guided exploration. MathMate focuses on asking the
        right next question, visualizing reasoning steps, and celebrating progress.
      </p>
      <p>
        This project roadmap includes image-based OCR, dynamic hints, personalized profiles, and session
        management. Voice mode, whiteboard collaboration, and practice problem generation arrive as stretch
        goals in later phases.
      </p>
    </div>
  </div>
);

export default AboutPage;
