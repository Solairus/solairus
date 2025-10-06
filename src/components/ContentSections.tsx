import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, Clock, TrendingUp, Zap, Shield, Sparkles, Target, Rocket, Activity, Cpu, Wifi } from "lucide-react";

const sections = [
  {
    id: 1,
    headline: "Plug in. Press go. Wake up richer.",
    description: "Three steps to automated wealth: Connect your wallet, hire your AI, and watch your earnings compound daily.",
    hashtags: ["#SOLAIRUSAI", "#DeFiAutomation", "#SolanaWealth"],
    icon: Zap,
    cta: true
  },
  {
    id: 2,
    headline: "DeFi on autopilot—Solairus never sleeps.",
    description: "24/7 autonomous trading engine. Your AI works around the clock so you don't have to.",
    hashtags: ["#AITrading", "#DeFiRevolution"],
    icon: Clock,
    cta: false
  },
  {
    id: 3,
    headline: "Humans trade on emotion. Solairus trades on precision.",
    description: "Remove fear and greed from the equation. Pure algorithmic execution, zero emotional interference.",
    hashtags: ["#AIFinance", "#CryptoPassiveIncome"],
    icon: Brain,
    cta: false
  },
  {
    id: 4,
    headline: "Meet the Solana bot that eats volatility for breakfast.",
    description: "Market chaos is our fuel. Advanced AI transforms turbulent markets into consistent yields.",
    hashtags: ["#SolanaTradingBot", "#AutonomousWealth"],
    icon: Activity,
    cta: true
  },
  {
    id: 5,
    headline: "From wallet to wealth in three clicks.",
    description: "No complicated setup. No trading knowledge required. Just connect, deploy, and earn.",
    hashtags: ["#DeFiSimplified", "#SOLAIRUSAI"],
    icon: Target,
    cta: false
  },
  {
    id: 6,
    headline: "You earn. Solairus learns. That's the future.",
    description: "Adaptive AI that evolves with market conditions. Each trade makes it smarter.",
    hashtags: ["#AIMoney", "#CryptoAutomation"],
    icon: Cpu,
    cta: false
  },
  {
    id: 7,
    headline: "Forget diamond hands—get AI hands.",
    description: "Why hold when you can multiply? AI hands don't shake, don't panic, don't sleep.",
    hashtags: ["#CryptoMemes", "#AIEra"],
    icon: Sparkles,
    cta: false
  },
  {
    id: 8,
    headline: "The smartest trader on Solana doesn't breathe.",
    description: "Millisecond execution. Zero emotion. Infinite patience. Your AI advantage.",
    hashtags: ["#SolanaAI", "#FutureOfFinance"],
    icon: Brain,
    cta: true
  },
  {
    id: 9,
    headline: "This isn't passive income. It's autonomous income.",
    description: "Non-custodial. Fully automated. You stay in control while AI does the work.",
    hashtags: ["#DeFiEducation", "#SolairusProtocol"],
    icon: Shield,
    cta: false
  },
  {
    id: 10,
    headline: "Your 24/7 trading team—compressed into one AI.",
    description: "Replace an entire trading desk with a single intelligent agent. Same results, zero overhead.",
    hashtags: ["#AIPoweredFinance", "#CryptoInnovation"],
    icon: Cpu,
    cta: false
  },
  {
    id: 11,
    headline: "Solairus: where AI meets Solana and prints results.",
    description: "Built on the fastest blockchain, powered by the smartest algorithms.",
    hashtags: ["#SolanaEcosystem", "#DeFiTools"],
    icon: Rocket,
    cta: true
  },
  {
    id: 12,
    headline: "You're early. The machines are taking over DeFi.",
    description: "Join the AI revolution before everyone else wakes up. First movers win biggest.",
    hashtags: ["#EarlyAdopter", "#AIBotTrading"],
    icon: Zap,
    cta: false
  },
  {
    id: 13,
    headline: "We built an AI trader so you don't have to be one.",
    description: "Years of trading expertise, encoded into algorithms. No learning curve required.",
    hashtags: ["#AIAgent", "#DeFiSimplified"],
    icon: Brain,
    cta: false
  },
  {
    id: 14,
    headline: "DeFi just got automated. You're welcome.",
    description: "The missing piece of the DeFi puzzle. Finally, finance that works for you.",
    hashtags: ["#CryptoAI", "#AutopilotEarnings"],
    icon: Sparkles,
    cta: true
  },
  {
    id: 15,
    headline: "The next bull run will be AI-driven. Starting here.",
    description: "Manual traders will miss the opportunities. AI traders will capture them all.",
    hashtags: ["#BullRun2025", "#AITradingBot"],
    icon: TrendingUp,
    cta: false
  },
  {
    id: 16,
    headline: "No signals. No noise. Just profit automation.",
    description: "Skip the telegram groups and Twitter calls. Let AI do the analysis.",
    hashtags: ["#DeFiAutomation", "#SmartTrading"],
    icon: Wifi,
    cta: false
  },
  {
    id: 17,
    headline: "Solairus turns your wallet into a wealth engine.",
    description: "Transform static holdings into dynamic earning machines. Fuel up and launch.",
    hashtags: ["#DeFiIncome", "#SolanaWallet"],
    icon: Rocket,
    cta: true
  },
  {
    id: 18,
    headline: "While you tweet, your AI trades.",
    description: "Live your life. Your bot handles business. Check gains between posts.",
    hashtags: ["#CryptoLifestyle", "#AutomatedEarnings"],
    icon: Activity,
    cta: false
  },
  {
    id: 19,
    headline: "Connect → Deploy → Earn. Repeat daily.",
    description: "The simplest wealth ritual in crypto. One-time setup, lifetime returns.",
    hashtags: ["#SolairusCycle", "#DailyUSDT"],
    icon: Target,
    cta: false
  },
  {
    id: 20,
    headline: "AI is the new alpha. Solairus is the proof.",
    description: "Outperform markets. Outperform traders. Outperform expectations.",
    hashtags: ["#AIAlpha", "#DefiEdge"],
    icon: TrendingUp,
    cta: true
  },
  {
    id: 21,
    headline: "Crypto's final boss just logged in.",
    description: "SOLAIRUS INITIATED. Game mode: Autonomous domination. Status: Online.",
    hashtags: ["#CryptoBoss", "#DeFiGameChanger"],
    icon: Zap,
    cta: false
  },
  {
    id: 22,
    headline: "The Solana protocol that thinks faster than you can refresh.",
    description: "Sub-second decision making. Real-time market adaptation. Always ahead.",
    hashtags: ["#HighFrequencyAI", "#SolanaProtocol"],
    icon: Activity,
    cta: false
  },
  {
    id: 23,
    headline: "Solairus doesn't guess—it calculates.",
    description: "Data-driven decisions. Mathematical precision. Predictable outcomes.",
    hashtags: ["#SmartDeFi", "#AITrading"],
    icon: Brain,
    cta: true
  },
  {
    id: 24,
    headline: "DeFi, but make it intelligent.",
    description: "Beautiful interface. Powerful intelligence. Seamless experience.",
    hashtags: ["#IntelligentFinance", "#SolairusAI"],
    icon: Sparkles,
    cta: false
  },
  {
    id: 25,
    headline: "The only flex that matters: automated earnings.",
    description: "Stop trading stories. Start showing results. Real gains, real time.",
    hashtags: ["#PassiveWealth", "#CryptoLifestyle"],
    icon: TrendingUp,
    cta: false
  },
  {
    id: 26,
    headline: "Manual trading is 2023. Solairus is 2025.",
    description: "The future arrived early. Stop living in the past. Upgrade now.",
    hashtags: ["#FutureOfDeFi", "#SolanaAI"],
    icon: Rocket,
    cta: true
  },
  {
    id: 27,
    headline: "Three steps. Infinite upside. That's Solairus AI.",
    description: "Minimal effort. Maximum return. Mathematical elegance.",
    hashtags: ["#AutomatedDeFi", "#SolairusWealth"],
    icon: Target,
    cta: false
  },
  {
    id: 28,
    headline: "Your wallet just got an AI upgrade.",
    description: "Same wallet. Enhanced capabilities. Exponential potential.",
    hashtags: ["#WalletUpgrade", "#AIFinance"],
    icon: Shield,
    cta: false
  },
  {
    id: 29,
    headline: "Plug your wallet → Hire your AI → Earn while you sleep.",
    description: "The complete autonomous wealth system. Wake up to confirmation notifications.",
    hashtags: ["#DeFiMadeSimple", "#SolairusProtocol"],
    icon: Clock,
    cta: true
  },
  {
    id: 30,
    headline: "The bot that never sleeps. The yield that never stops.",
    description: "Continuous operation. Perpetual optimization. Unstoppable momentum.",
    hashtags: ["#FinalCall", "#LaunchNow"],
    icon: Cpu,
    cta: true,
    isFinal: true
  }
];

export default function ContentSections() {
  return (
    <div className="py-12 relative overflow-hidden">
      {sections.map((section, index) => {
        const Icon = section.icon;
        const isEven = index % 2 === 0;
        
        return (
          <section
            key={section.id}
            className={`py-16 md:py-24 relative animate-fade-in`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="container mx-auto px-4">
              <div className={`max-w-6xl mx-auto flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-12`}>
                {/* Icon/Visual Side */}
                <div className="flex-1 flex justify-center">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-3xl group-hover:blur-4xl transition-all duration-500" />
                    <div className="relative glass rounded-3xl p-12 glow-border group-hover:scale-110 transition-all duration-500">
                      <Icon className="w-24 h-24 text-primary animate-pulse" />
                    </div>
                  </div>
                </div>

                {/* Content Side */}
                <div className="flex-1 space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-mono text-primary">
                    {String(section.id).padStart(2, '0')}
                  </div>
                  
                  <h2 className="text-3xl md:text-5xl font-bold leading-tight">
                    {section.headline.split(' ').map((word, i) => {
                      // Highlight key action words
                      if (['AI', 'Solairus', 'DeFi', 'automated', 'autonomous'].some(key => word.toLowerCase().includes(key.toLowerCase()))) {
                        return <span key={i} className="gradient-text">{word} </span>;
                      }
                      return <span key={i} className="text-foreground">{word} </span>;
                    })}
                  </h2>
                  
                  <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                    {section.description}
                  </p>
                  
                  {/* Hashtags */}
                  <div className="flex flex-wrap gap-2">
                    {section.hashtags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 text-xs font-mono text-primary/80 bg-primary/5 border border-primary/20 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  {/* Mini CTAs */}
                  {section.cta && (
                    <div className="flex flex-wrap gap-4 pt-4">
                      <Button variant={section.isFinal ? "hero" : "neon"} size="lg" className="group">
                        {section.isFinal ? "Launch App Now" : "Hire Your Bot"}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </Button>
                      {section.isFinal && (
                        <Button variant="outline" size="lg" className="border-primary/50 text-primary hover:bg-primary/10">
                          View Dashboard
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            {index % 3 === 0 && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/2 right-1/4 w-48 h-48 bg-secondary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
