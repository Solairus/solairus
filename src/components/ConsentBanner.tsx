import React, { useEffect, useState } from "react";

type ConsentValue = "accepted" | "rejected" | null;

const CONSENT_KEY = "solairus_consent";
const CONSENT_DISMISSED_SESSION_KEY = "solairus_consent_dismissed";

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [consent, setConsent] = useState<ConsentValue>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CONSENT_KEY) as ConsentValue;
      const dismissed = window.sessionStorage.getItem(CONSENT_DISMISSED_SESSION_KEY) === "1";
      setConsent(stored);
      setVisible(!stored && !dismissed);
    } catch {
      // If storage is unavailable, show the banner
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try {
      window.localStorage.setItem(CONSENT_KEY, "accepted");
    } catch (err) {
      // Storage may be unavailable (private mode, quotas, etc.)
      void err;
    }
    setConsent("accepted");
    setVisible(false);
  };

  const reject = () => {
    try {
      window.localStorage.setItem(CONSENT_KEY, "rejected");
    } catch (err) {
      // Storage may be unavailable (private mode, quotas, etc.)
      void err;
    }
    setConsent("rejected");
    setVisible(false);
  };

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(CONSENT_DISMISSED_SESSION_KEY, "1");
    } catch (err) {
      // Storage may be unavailable (private mode, quotas, etc.)
      void err;
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[10000] px-4 pb-6">
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card shadow-xl">
        <div className="p-4 md:p-6">
          <h3 className="text-sm font-semibold mb-2">Privacy & Cookies</h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            We use cookies and similar technologies to enhance your experience, analyze usage, and
            improve our services. You can accept or reject non-essential cookies at any time. See our
            {" "}
            <a href="/privacy" className="underline">Privacy Policy</a>.
          </p>
          <div className="mt-4 flex flex-col md:flex-row gap-2">
            <button
              onClick={accept}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground border border-primary/40 hover:bg-secondary transition"
            >
              Accept
            </button>
            <button
              onClick={reject}
              className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition"
            >
              Reject
            </button>
            <button
              onClick={dismiss}
              className="px-4 py-2 rounded-lg border border-border bg-transparent hover:bg-muted transition"
              aria-label="Dismiss consent banner"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}