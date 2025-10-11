import { Button } from "@/components/ui/button";
import { Share2, Copy } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { encryptAddress } from "@/lib/address-crypto";
import { toast } from "sonner";

export default function Affiliate() {
  const { publicKey } = useWallet();
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const account = publicKey ? publicKey.toBase58() : "";
  const referralCode = account ? encryptAddress(account) : "CONNECT_WALLET";
  const referralLink = `${baseUrl}/dapp/ref/${referralCode}`;

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
            
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-background/60 border text-sm">
                <span className="opacity-75">Your link:</span>
                <span className="font-medium">{referralLink}</span>
                <button
                  aria-label="Copy referral link"
                  className="hover:opacity-100 opacity-70 transition"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(referralLink);
                    } catch (err) {
                      toast.error("Failed to copy referral link.");
                    }
                    toast.success("Referral link copied.");
                  }}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <Button variant="hero" size="lg">
                <Share2 className="w-4 h-4 mr-2" /> Get Your Referral Link
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
