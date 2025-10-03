import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import heroNetwork from "@/assets/hero-network.jpg";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${heroNetwork})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.3
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background z-0" />
      
      {/* Content */}
      <div className="container mx-auto px-4 z-10 text-center">
        <div className="animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/30 mb-6 hover:glow-border transition-all">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Powered by Solana AI Agents</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="gradient-text">AI That Trades.</span>
            <br />
            <span className="text-foreground">You Earn.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12">
            Autonomous DeFi wealth powered by intelligent Solana AI agents.
            <br />
            <span className="text-primary font-semibold">1-5% daily USDT rewards</span> on autopilot.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button variant="hero" size="xl" className="group">
              Launch App
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="neon" size="xl">
              Hire Your First Bot
            </Button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mt-20">
            <div className="glass rounded-xl p-6 glow-card hover:scale-105 transition-transform">
              <div className="text-3xl font-bold gradient-text mb-2">$2.4M+</div>
              <div className="text-sm text-muted-foreground">Total Earned</div>
            </div>
            <div className="glass rounded-xl p-6 glow-card hover:scale-105 transition-transform">
              <div className="text-3xl font-bold gradient-text mb-2">5,200+</div>
              <div className="text-sm text-muted-foreground">Active Bots</div>
            </div>
            <div className="glass rounded-xl p-6 glow-card hover:scale-105 transition-transform">
              <div className="text-3xl font-bold gradient-text mb-2">98.7%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
