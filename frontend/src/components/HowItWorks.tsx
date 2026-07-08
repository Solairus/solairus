import { Wallet, Bot, TrendingUp } from "lucide-react";

const steps = [
  {
    icon: Wallet,
    title: "Connect Wallet",
    description: "Link your Solana wallet in seconds. Secure, non-custodial, and fully encrypted."
  },
  {
    icon: Bot,
    title: "Hire AI Bot",
    description: "Choose your strategy and activate your autonomous trading agent. AI handles the rest."
  },
  {
    icon: TrendingUp,
    title: "Target Monthly Growth",
    description: "Track performance toward each agent's monthly target. Transparent, predictable, sustainable."
  }
];

export default function HowItWorks() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background overlay image */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(/media/images/img13.jpeg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.35
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background z-0" />

      <div className="container mx-auto px-4 z-10 relative">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            How <span className="gradient-text">SOLAIRUS</span> Works
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Three simple steps to autonomous portfolio growth
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className="relative glass rounded-2xl p-8 glow-card hover:scale-105 transition-all duration-300 group"
              >
                {/* Step number */}
                <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-lg shadow-[0_0_20px_rgba(0,217,255,0.4)]">
                  {index + 1}
                </div>
                
                <div className="mb-6 inline-flex p-4 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-8 h-8 text-primary" />
                </div>
                
                <h3 className="text-2xl font-bold mb-3 text-foreground">
                  {step.title}
                </h3>
                
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
