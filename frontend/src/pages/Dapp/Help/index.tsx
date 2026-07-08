import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HelpCircle,
  Wallet,
  Users,
  TrendingUp,
  Shield,
  DollarSign,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Info,
  Link
} from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import { PRICING_CONFIG } from "@/config/pricing";
import { useSettings } from '@/contexts/settings-context';

interface FAQItem {
  question: string;
  answer: string;
  category: 'getting-started' | 'agents' | 'affiliate' | 'wallet' | 'troubleshooting';
}

/**
 * Generate FAQ data with dynamic pricing from settings
 */
function getFAQData(licenseFee: number, agentMin: number, recommendedStart: number): FAQItem[] {

  return [
    // Getting Started
    {
      question: "What is Solairus?",
      answer: "Solairus is a decentralized AI trading platform built on Solana that allows users to activate AI trading agents and earn passive income through automated trading strategies. Users can also build affiliate networks to earn commissions.",
      category: "getting-started"
    },
    {
      question: "How do I get started?",
      answer: `1. Connect your Solana wallet (Phantom, Solflare, etc.)\n2. Activate your license for $${licenseFee} USDT\n3. Hire AI trading agents to start earning\n4. Share your referral link to build your network`,
      category: "getting-started"
    },
    {
      question: "What do I need to use Solairus?",
      answer: `You need a Solana wallet with USDT for license activation and agent hiring. We recommend starting with at least $${recommendedStart} USDT - $${licenseFee} for license and $${agentMin}+ for your first agent.`,
      category: "getting-started"
    },

    // AI Agents
    {
      question: "What are AI Trading Agents?",
      answer: "AI Trading Agents are autonomous trading systems that execute strategies on your behalf, each targeting a monthly performance objective based on market conditions and their tier level (NOVA, VEGA, ORION, PRIME).",
      category: "agents"
    },
    {
      question: "What are the different agent tiers?",
      answer: "• NOVA — Market Intelligence: 8.25%-8.5% target monthly, 175% yield cap\n• VEGA — Execution Intelligence: 8.75%-9% target monthly, 200% yield cap\n• ORION — Risk Intelligence: 9.25%-9.5% target monthly, 220% yield cap\n• PRIME — Strategic Allocation: 9.75%-10% target monthly, 250% yield cap\n\nThese are performance objectives, not guaranteed returns. All investing involves risk.",
      category: "agents"
    },
    {
      question: "How do agent withdrawals work?",
      answer: "You can withdraw your agent ROI once every 24 hours. The system tracks your last withdrawal time and enforces the cooldown period. Higher tier agents have higher daily limits.",
      category: "agents"
    },
    {
      question: "What is the yield cap?",
      answer: "The yield cap is the maximum total ROI you can earn from an agent (as a percentage of your initial investment). Once reached, the agent stops generating returns and you can hire a new one.",
      category: "agents"
    },

    // Affiliate System
    {
      question: "How does the affiliate system work?",
      answer: "Earn commissions when people use your referral link:\n• 5% on direct referrals (Level 1)\n• 3% on their referrals (Level 2)\n• 2% on Level 3 referrals\nCommissions apply to license activations and agent hirings.",
      category: "affiliate"
    },
    {
      question: "When do I receive affiliate earnings?",
      answer: "Affiliate earnings are credited immediately when your referrals make purchases. You can withdraw your accumulated earnings anytime from the Affiliate dashboard.",
      category: "affiliate"
    },
    {
      question: "How do I share my referral link?",
      answer: "Go to Affiliate > Share tab to get your unique referral link. Share it on social media, with friends, or through any marketing channels. Track your referrals in the Referrals tab.",
      category: "affiliate"
    },

    // Wallet & Technical
    {
      question: "Which wallets are supported?",
      answer: "We support all major Solana wallets including Phantom, Solflare, Backpack, and any wallet compatible with the Solana Wallet Adapter.",
      category: "wallet"
    },
    {
      question: "Why do I need USDT?",
      answer: `USDT is used for all transactions on Solairus - license activation ($${licenseFee}), agent hiring (varies by tier), and ROI payouts. It provides price stability for the platform economy.`,
      category: "wallet"
    },
    {
      question: "Is my wallet safe?",
      answer: "Yes! Solairus is fully decentralized on Solana. We never hold your private keys or funds. All transactions are executed through smart contracts that you approve.",
      category: "wallet"
    },

    // Troubleshooting
    {
      question: "Transaction failed - what should I do?",
      answer: "1. Check your USDT balance\n2. Ensure your wallet is connected\n3. Try refreshing the page\n4. Check Solana network status\n5. Increase transaction priority if needed",
      category: "troubleshooting"
    },
    {
      question: "My balance isn't updating",
      answer: "Balances update every few minutes. Click the refresh button or wait a moment. If the issue persists, disconnect and reconnect your wallet.",
      category: "troubleshooting"
    },
    {
      question: "I can't withdraw my ROI",
      answer: "Check: 1) 24-hour cooldown period, 2) Sufficient ROI balance, 3) Agent hasn't reached yield cap, 4) Wallet connection. The dashboard shows your next available withdrawal time.",
      category: "troubleshooting"
    }
  ];
}

const categoryLabels = {
  'getting-started': 'Getting Started',
  'agents': 'AI Agents',
  'affiliate': 'Affiliate System',
  'wallet': 'Wallet & Security',
  'troubleshooting': 'Troubleshooting'
};

const categoryIcons = {
  'getting-started': Info,
  'agents': TrendingUp,
  'affiliate': Users,
  'wallet': Wallet,
  'troubleshooting': AlertCircle
};

export default function HelpPage() {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Dynamic license fee from backend (micro-USDT → whole USDT), falls back to env var
  const { licenseFeeUsdtMicro } = useSettings();
  const licenseFee = licenseFeeUsdtMicro > 0 ? licenseFeeUsdtMicro / 1_000_000 : PRICING_CONFIG.licenseFeeUsd;
  const agentMin = PRICING_CONFIG.agentMinimumUsd;
  const recommendedStart = licenseFee + agentMin;

  const faqData = getFAQData(licenseFee, agentMin, recommendedStart);

  const filteredFAQs = selectedCategory === 'all'
    ? faqData
    : faqData.filter((faq: FAQItem) => faq.category === selectedCategory);

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-blue-500" />
              Help Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Everything you need to know about Solairus
            </p>
          </div>
        </div>

        {/* Official Links Card */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link className="w-5 h-5 text-blue-500" />
              Official Links & Community
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Connect with us and stay updated on the latest news, updates, and community discussions.
            </p>
            <Button 
              className="w-full" 
              onClick={() => window.open('https://linktr.ee/Solairua.ai', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Visit Our Official Linktree
            </Button>
          </CardContent>
        </Card>

        {/* Quick Start Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Quick Start Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">🚀 Get Started in 4 Steps</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">1</Badge>
                    <span>Connect your Solana wallet</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">2</Badge>
                    <span>Activate license (${licenseFee} USDT)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">3</Badge>
                    <span>Hire your first AI agent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">4</Badge>
                    <span>Start targeting monthly returns</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium text-sm">💰 Earning Opportunities</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div>• <strong>Agent Performance:</strong> Up to 8.25%–10% target monthly, by tier</div>
                  <div>• <strong>Referrals:</strong> 5% + 3% + 2% commissions</div>
                  <div>• <strong>Network Building:</strong> Passive income growth</div>
                  <div>• <strong>Compound Growth:</strong> Reinvest for scaling</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="faq" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="faq" className="text-xs">FAQ</TabsTrigger>
            <TabsTrigger value="features" className="text-xs">Features</TabsTrigger>
            <TabsTrigger value="support" className="text-xs">Support</TabsTrigger>
          </TabsList>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="space-y-4">
            {/* Category Filter */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setSelectedCategory('all')}
                    variant={selectedCategory === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs"
                  >
                    All Topics
                  </Button>
                  {Object.entries(categoryLabels).map(([key, label]) => {
                    const Icon = categoryIcons[key as keyof typeof categoryIcons];
                    return (
                      <Button
                        key={key}
                        onClick={() => setSelectedCategory(key)}
                        variant={selectedCategory === key ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs"
                      >
                        <Icon className="w-3 h-3 mr-1" />
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* FAQ List */}
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredFAQs.map((faq: FAQItem, index: number) => {
                    const isExpanded = expandedFAQ === index;
                    const Icon = categoryIcons[faq.category];
                    
                    return (
                      <div key={index} className="p-4">
                        <button
                          onClick={() => toggleFAQ(index)}
                          className="w-full flex items-center justify-between text-left hover:bg-muted/50 -m-2 p-2 rounded-lg transition-all duration-200 hover:scale-[1.01]"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{faq.question}</span>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                        
                        {isExpanded && (
                          <div className="mt-3 pl-7 animate-in slide-in-from-top-2 duration-200">
                            <div className="text-sm text-muted-foreground whitespace-pre-line">
                              {faq.answer}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* AI Agents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    AI Trading Agents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Autonomous AI agents that target a monthly performance objective through advanced market, execution, and risk intelligence.
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">NOVA</span>
                      <span className="text-muted-foreground">8.25-8.5% monthly target</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">VEGA</span>
                      <span className="text-muted-foreground">8.75-9% monthly target</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">ORION</span>
                      <span className="text-muted-foreground">9.25-9.5% monthly target</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">PRIME</span>
                      <span className="text-muted-foreground">9.75-10% monthly target</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Affiliate System */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="w-5 h-5 text-purple-500" />
                    Affiliate Network
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Build your network and earn multi-level commissions on all referral activities.
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Level 1 (Direct)</span>
                      <span className="text-green-600 font-medium">5%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Level 2</span>
                      <span className="text-green-600 font-medium">3%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Level 3</span>
                      <span className="text-green-600 font-medium">2%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="w-5 h-5 text-green-500" />
                    Security & Trust
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Built on Solana blockchain with full decentralization and transparency.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Non-custodial (you control your funds)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Open-source smart contracts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Audited and verified</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Economics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign className="w-5 h-5 text-yellow-500" />
                    Platform Economics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Sustainable tokenomics designed for long-term growth and user rewards.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>License Fee</span>
                      <span className="font-medium">${licenseFee} USDT</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Agent Minimum</span>
                      <span className="font-medium">${PRICING_CONFIG.agentMinimumUsd} USDT</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Withdrawal Fee</span>
                      <span className="font-medium">{PRICING_CONFIG.withdrawalFeePercent}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Support Tab */}
          <TabsContent value="support" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Contact Support */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Need More Help?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Can't find what you're looking for? Our support team is here to help.
                  </p>
                  
                  <div className="space-y-3">
                    <Button 
                      className="w-full justify-start" 
                      variant="outline"
                      onClick={() => window.open('https://linktr.ee/Solairua.ai', '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Official Links & Community
                    </Button>
                    
                    <Button className="w-full justify-start" variant="outline">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Join Telegram Community
                    </Button>
                    
                    <Button className="w-full justify-start" variant="outline">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Discord Support
                    </Button>
                    
                    <Button className="w-full justify-start" variant="outline">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Email Support
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Resources */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Additional Resources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Learn more about Solairus and blockchain technology.
                  </p>
                  
                  <div className="space-y-3">
                    <Button className="w-full justify-start" variant="outline">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Whitepaper
                    </Button>
                    
                    <Button className="w-full justify-start" variant="outline">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Smart Contract Code
                    </Button>
                    
                    <Button className="w-full justify-start" variant="outline">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Video Tutorials
                    </Button>
                    
                    <Button className="w-full justify-start" variant="outline">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Solana Explorer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Important Notice */}
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-yellow-800">Important Disclaimer</h4>
                    <p className="text-sm text-yellow-700">
                      Cryptocurrency trading involves risk. Past performance does not guarantee future results. 
                      Only invest what you can afford to lose. Solairus is a decentralized platform - 
                      users are responsible for their own funds and decisions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}