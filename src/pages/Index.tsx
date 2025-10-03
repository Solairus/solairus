import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import Affiliate from "@/components/Affiliate";
import CTA from "@/components/CTA";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Affiliate />
        <CTA />
      </main>
      <footer className="border-t border-border/50 glass py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 SOLAIRUS. All rights reserved. Powered by Solana AI.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
