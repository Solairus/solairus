import { Shield, Zap, Users, BarChart3, Lock, Coins } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "AI-Powered Trading",
    description: "Sophisticated algorithms analyze market conditions 24/7 to maximize returns"
  },
  {
    icon: Shield,
    title: "200% Cap Protection",
    description: "Sustainable earnings model with built-in profit caps for long-term stability"
  },
  {
    icon: Users,
    title: "3-Level Referrals",
    description: "Earn 5%, 3%, 2% from your network's success. Grow together."
  },
  {
    icon: Coins,
    title: "USDT Payouts",
    description: "Direct stablecoin rewards. No token dependency. Real value, real trust."
  },
  {
    icon: Lock,
    title: "Non-Custodial",
    description: "You own your keys. Your funds stay in your wallet, always."
  },
  {
    icon: BarChart3,
    title: "Live Dashboard",
    description: "Track all your bots, earnings, and referrals in a beautiful real-time interface"
  }
];

export default function Features() {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Built for <span className="gradient-text">Performance</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Enterprise-grade features designed for the modern DeFi investor
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="glass rounded-xl p-6 hover:glow-card transition-all duration-300 group cursor-pointer"
              >
                <div className="mb-4 inline-flex p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                
                <h3 className="text-xl font-bold mb-2 text-foreground group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
