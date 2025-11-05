const TermsPage = () => (
  <div className="mx-auto w-full max-w-4xl px-4 py-16">
    <h1 className="text-3xl font-semibold text-brand-charcoal">Terms of Use</h1>
    <p className="mt-4 text-sm text-brand-slate">
      These terms outline expected usage once MathMate is publicly available. Final legal review will occur
      closer to launch; the bullets below summarize guiding principles.
    </p>
    <ol className="mt-8 list-decimal space-y-3 pl-6 text-sm text-brand-charcoal">
      <li>MathMate is an educational assistant and not a substitute for classroom instruction.</li>
      <li>Users must provide accurate information and respect academic integrity policies.</li>
      <li>Any misuse, including harmful or abusive language, may result in account suspension.</li>
      <li>Usage of AI features is subject to OpenAI’s acceptable use policy and rate limits.</li>
    </ol>
  </div>
);

export default TermsPage;
