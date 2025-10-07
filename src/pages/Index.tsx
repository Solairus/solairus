import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import ContentSections from "@/components/ContentSections";
import Affiliate from "@/components/Affiliate";
import CTA from "@/components/CTA";
import CountdownFlip from "@/components/CountdownFlip";
const Index = () => {
  // Show countdown unless VITE_SHOW_COMING_SOON is explicitly "false"
  const showComingSoon = import.meta.env.VITE_SHOW_COMING_SOON !== "false";
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
        </div>
      </footer>

      {showComingSoon && <div className="fixed inset-0 z-[9999] bg-black/55 flex items-center justify-center select-none cursor-not-allowed" aria-hidden="true">
          <div className="container mx-auto px-6">
            <div className="bg-card glow-card border border-border rounded-2xl max-w-2xl mx-auto p-10 text-center">
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight gradient-text mb-4">
                Coming Soon
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-6">
                We’re putting the final touches on the Solairus yield engine.
              </p>
              
              <div className="mt-8">
                <CountdownFlip targetDate="2025-10-08T08:00:00Z" />
              </div>
            </div>
          </div>
        </div>}
    </div>;
};
export default Index;