import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Check, Users } from "lucide-react";
import { useWallet } from "@/contexts/wallet-context";
import { encryptAddress } from "@/lib/address-crypto";
import { toast } from "sonner";

export default function AffiliateLinkCard() {
  const { account } = useWallet();
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const referralCode = account ? encryptAddress(account) : null;
  const referralLink = referralCode ? `${baseUrl}/dapp/ref/${referralCode}` : null;

  const handleCopy = async () => {
    if (!referralLink) {
      toast.error("Connect your wallet to generate referral link");
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Referral link copied!");

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handleShare = async () => {
    if (!referralLink) {
      toast.error("Connect your wallet to generate referral link");
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Solairus",
          text: "Join me on Solairus and earn with AI agents!",
          url: referralLink,
        });
      } catch (err) {
        // User cancelled sharing or share failed
        handleCopy(); // Fallback to copy
      }
    } else {
      handleCopy(); // Fallback to copy if Web Share API not supported
    }
  };

  if (!account) {
    return (
      <Card className="p-3 bg-background/50 border-border/30">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-full bg-primary/10">
            <Users className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-xs">Referral Program</h3>
            <p className="text-xs text-muted-foreground/80">Connect wallet for your link</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 bg-background/50 border-border/30">
      <div className="space-y-2.5">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-full bg-primary/10">
            <Users className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-xs">Referral Link</h3>
            <p className="text-xs text-muted-foreground/80">Earn 5% + 3% + 2%</p>
          </div>
        </div>

        {/* Link Display */}
        {referralLink && (
          <div className="bg-background/60 rounded-md p-2 border border-border/20">
            <div className="text-xs font-mono text-muted-foreground/90 break-all leading-tight">
              {referralLink}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="flex-1 h-7 text-xs"
            disabled={!referralLink}
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="flex-1 h-7 text-xs"
            disabled={!referralLink}
          >
            <Share2 className="w-3 h-3 mr-1" />
            Share
          </Button>
        </div>

        {/* Commission Info */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-background/40 rounded-md p-1.5 text-center">
            <div className="text-xs font-semibold text-primary">5%</div>
            <div className="text-xs text-muted-foreground/70">L1</div>
          </div>
          <div className="bg-background/40 rounded-md p-1.5 text-center">
            <div className="text-xs font-semibold text-primary">3%</div>
            <div className="text-xs text-muted-foreground/70">L2</div>
          </div>
          <div className="bg-background/40 rounded-md p-1.5 text-center">
            <div className="text-xs font-semibold text-primary">2%</div>
            <div className="text-xs text-muted-foreground/70">L3</div>
          </div>
        </div>
      </div>
    </Card>
  );
}