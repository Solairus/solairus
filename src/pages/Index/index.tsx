import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import ContentSections from "@/components/ContentSections";
import Affiliate from "@/components/Affiliate";
import CTA from "@/components/CTA";
import ComingSoonOverlay from "./ComingSoonOverlay";
import ConsentBanner from "@/components/ConsentBanner";
const Index = () => {
  // Show countdown unless VITE_SHOW_COMING_SOON is explicitly "false"
  const showComingSoon = import.meta.env.VITE_SHOW_COMING_SOON !== "false";
  // Countdown target
  const countdownTarget = "2025-10-13T00:00:00+08:00";
  return <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <ContentSections />
        <Affiliate />
        <CTA />
      </main>
      <footer className="border-t border-border/50 glass py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 SOLAIRUS. All rights reserved. Powered by Solana AI.</p>
          <div className="mt-3 text-xs md:text-sm">
            <span>
              We comply with GDPR. By using this site, you agree to our
              {" "}
              <a href="/privacy" className="underline hover:text-foreground" aria-label="Privacy Policy">
                Privacy Policy
              </a>
              .
            </span>
          </div>
        </div>
      </footer>

      <ConsentBanner />

      {showComingSoon && (
        <ComingSoonOverlay
          targetDate={countdownTarget}
          title="Deploying Trainned AI Agents"
          message="we are currently deploying our ai agents to the cloud..."
        />
      )}
    </div>;
};
export default Index;