const PrivacyPage = () => (
  <div className="mx-auto w-full max-w-4xl px-4 py-16">
    <h1 className="text-3xl font-semibold text-brand-charcoal">Privacy Policy</h1>
    <p className="mt-4 text-sm text-brand-slate">
      A comprehensive privacy policy will be published prior to production deployment. The content below is a
      placeholder to acknowledge the commitment to responsible data use.
    </p>
    <ul className="mt-8 space-y-3 text-sm text-brand-charcoal">
      <li>• User authentication is managed through Firebase Auth with secure credential handling.</li>
      <li>• Session data is stored in Firestore under user-specific collections to protect privacy.</li>
      <li>• Uploaded images are stored in Firebase Storage with per-user access controls.</li>
      <li>• OpenAI API interactions are proxied through secure backend functions.</li>
    </ul>
  </div>
);

export default PrivacyPage;
