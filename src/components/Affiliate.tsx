import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";

export default function Affiliate() {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto glass rounded-3xl p-12 glow-card relative overflow-hidden">
          {/* Background gradient effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 pointer-events-none" />
          
          <div className="relative z-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-4">
                <Share2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Referral Program</span>
              </div>
              
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Grow Your <span className="gradient-text">Network</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                Earn passive income from your community's success
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 mb-10">
              <div className="text-center p-6 rounded-xl bg-background/50 backdrop-blur-sm border border-border/50">
                <div className="text-4xl font-bold gradient-text mb-2">5%</div>
                <div className="text-sm text-muted-foreground">Level 1 Commission</div>
              </div>
              <div className="text-center p-6 rounded-xl bg-background/50 backdrop-blur-sm border border-border/50">
                <div className="text-4xl font-bold gradient-text mb-2">3%</div>
                <div className="text-sm text-muted-foreground">Level 2 Commission</div>
              </div>
              <div className="text-center p-6 rounded-xl bg-background/50 backdrop-blur-sm border border-border/50">
                <div className="text-4xl font-bold gradient-text mb-2">2%</div>
                <div className="text-sm text-muted-foreground">Level 3 Commission</div>
              </div>
            </div>
            
            <div className="text-center">
              <Button variant="hero" size="lg">
                Get Your Referral Link
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
