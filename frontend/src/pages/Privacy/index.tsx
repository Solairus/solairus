import React from "react";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground mb-6">
          Last updated: October 2025
        </p>

        <section className="space-y-4 text-sm leading-relaxed">
          <p>
            We are committed to protecting your personal data and respecting your privacy. This
            Policy explains what information we collect, how we use it, and your rights under the
            General Data Protection Regulation (GDPR).
          </p>

          <h2 className="text-xl font-semibold">Information We Collect</h2>
          <ul className="list-disc ml-6">
            <li>Account and contact details you provide voluntarily.</li>
            <li>Wallet addresses and on-chain interactions needed to deliver services.</li>
            <li>Basic device and usage data to improve performance and security.</li>
          </ul>

          <h2 className="text-xl font-semibold">How We Use Information</h2>
          <ul className="list-disc ml-6">
            <li>Provide and maintain our dApp and related features.</li>
            <li>Communicate updates, security notices, and support.</li>
            <li>Comply with legal obligations and prevent abuse.</li>
          </ul>

          <h2 className="text-xl font-semibold">Legal Bases</h2>
          <p>
            We process personal data on the basis of consent, legitimate interests, and compliance
            with legal obligations, as applicable.
          </p>

          <h2 className="text-xl font-semibold">Your Rights</h2>
          <ul className="list-disc ml-6">
            <li>Access, rectify, or erase your personal data.</li>
            <li>Object to or restrict certain processing activities.</li>
            <li>Data portability, where technically feasible.</li>
          </ul>

          <h2 className="text-xl font-semibold">Data Retention</h2>
          <p>
            We retain data only as long as necessary for the purposes described above or as required
            by law.
          </p>

          <h2 className="text-xl font-semibold">Contact</h2>
          <p>
            To exercise your rights or ask questions, contact us at
            {" "}
            <a className="underline" href="mailto:privacy@solairus.ai">privacy@solairus.ai</a>.
          </p>
        </section>

        <div className="mt-8">
          <a href="/" className="underline">Return to Home</a>
        </div>
      </div>
    </div>
  );
};

export default Privacy;