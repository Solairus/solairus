import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import ContentSections from "@/components/ContentSections";
import Affiliate from "@/components/Affiliate";
import CTA from "@/components/CTA";
import CountdownFlip from "@/components/CountdownFlip";
import ConsentBanner from "@/components/ConsentBanner";
const Index = () => {
  // Show countdown unless VITE_SHOW_COMING_SOON is explicitly "false"
  const showComingSoon = import.meta.env.VITE_SHOW_COMING_SOON !== "false";
  // Fixed countdown target (24 hours from update time)
  const countdownTarget = "2025-10-13T15:00:00+08:00";
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

      {showComingSoon && <div className="fixed inset-0 z-[9999] bg-background/65 flex items-center justify-center select-none cursor-not-allowed" aria-hidden="true">
          <div className="container mx-auto px-6">
            <div className="bg-card glow-card border border-border rounded-2xl max-w-2xl mx-auto p-12 md:p-16 text-center my-8">
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight gradient-text mb-4">
                Deploying Trainned AI Agents
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-6">
                we are currently deploying our ai agents to the cloud...
              </p>
              
              <div className="mt-8">
                <CountdownFlip targetDate={countdownTarget} />
              </div>
            </div>
          </div>
        </div>}
    </div>;
};
export default Index;