import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, Clock, TrendingUp, Zap, Shield, Sparkles, Target, Rocket, Activity, Cpu, Wifi } from "lucide-react";

const sections = [
  {
    id: 1,
    headline: "The World's Leading Autonomous AI Financial Intelligence Platform",
    description: "SOLAIRUS gives individuals and institutions access to sophisticated market intelligence across digital assets and global financial markets — powered entirely by autonomous AI.",
    hashtags: ["#AIFinance", "#InstitutionalGradeAI"],
    icon: Brain,
    cta: false
  },
  {
    id: 2,
    headline: "Markets Never Sleep. Humans Do.",
    description: "Traditional investing is limited by human emotion, slow decision-making, narrow market coverage, and information overload — in markets that run 24 hours a day.",
    hashtags: ["#MarketIntelligence", "#DeFiEducation"],
    icon: Clock,
    cta: false
  },
  {
    id: 3,
    headline: "Solairus Augments Human Intelligence With Autonomous Analysis",
    description: "An ecosystem of specialized AI agents continuously analyzes multiple financial markets — not to replace investors, but to extend what they can see and act on.",
    hashtags: ["#AutonomousIntelligence", "#SolairusAI"],
    icon: Sparkles,
    cta: true
  },
  {
    id: 4,
    headline: "NOVA — Market Intelligence Engine",
    description: "Scans millions of market data points to identify momentum, volatility, and macro opportunities across digital assets. Target: 8.25%–8.5% monthly.",
    hashtags: ["#MarketIntelligence", "#NovaAgent"],
    icon: Target,
    cta: false
  },
  {
    id: 5,
    headline: "VEGA — Execution Intelligence",
    description: "Optimizes execution timing by analyzing liquidity, spreads, and market depth in real time. Target: 8.75%–9% monthly.",
    hashtags: ["#ExecutionIntelligence", "#VegaAgent"],
    icon: Zap,
    cta: false
  },
  {
    id: 6,
    headline: "ORION — Risk Intelligence",
    description: "Continuously evaluates exposure and adjusts portfolio risk as market conditions change. Target: 9.25%–9.5% monthly.",
    hashtags: ["#RiskIntelligence", "#OrionAgent"],
    icon: Shield,
    cta: false
  },
  {
    id: 7,
    headline: "PRIME — Strategic Decision Engine",
    description: "Coordinates all four agents, ranks opportunities, and optimizes capital allocation into a single portfolio recommendation. Target: 9.75%–10% monthly.",
    hashtags: ["#StrategicAI", "#PrimeAgent"],
    icon: Cpu,
    cta: true
  },
  {
    id: 8,
    headline: "One Platform. Every Market That Matters.",
    description: "Crypto, digital assets, forex, tokenized assets, DeFi, Web3, and emerging financial markets — all under continuous AI analysis.",
    hashtags: ["#MultiMarketIntelligence", "#Web3"],
    icon: Activity,
    cta: false
  },
  {
    id: 9,
    headline: "Built Risk-First, Not Hype-First",
    description: "Multi-agent architecture, continuous monitoring, cross-market intelligence, adaptive learning, institutional-grade analytics, and infrastructure built to scale.",
    hashtags: ["#RiskFirstDesign", "#InstitutionalGrade"],
    icon: TrendingUp,
    cta: false
  },
  {
    id: 10,
    headline: "The Technology Behind the Intelligence",
    description: "Artificial intelligence, machine learning, large language models, quantitative analytics, blockchain infrastructure, and predictive analytics — working together in real time.",
    hashtags: ["#AIInfrastructure", "#QuantAnalytics"],
    icon: Rocket,
    cta: false
  },
  {
    id: 11,
    headline: "We Don't Promise Profits. We Show Our Work.",
    description: "SOLAIRUS is designed to identify high-probability opportunities using AI-driven analysis. All investing involves risk, and past performance does not guarantee future results.",
    hashtags: ["#PerformancePhilosophy", "#RiskDisclosure"],
    icon: Wifi,
    cta: false
  },
  {
    id: 12,
    headline: "Enterprise-Grade Infrastructure, Transparent by Design",
    description: "Multi-layer encryption, smart risk controls, continuous AI monitoring, and transparent reporting protect every agent activation.",
    hashtags: ["#SecurityFirst", "#TransparentReporting"],
    icon: Shield,
    cta: false
  },
  {
    id: 13,
    headline: "Democratizing Institutional-Grade Financial Intelligence",
    description: "Our mission is to give every investor — not just institutions — access to the same caliber of autonomous, AI-driven market intelligence.",
    hashtags: ["#SolairusAI", "#AutonomousWealthInfrastructure"],
    icon: Brain,
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
                        {section.isFinal ? "Launch App Now" : "Activate an Agent"}
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
