import React, { useState } from "react";
import { Bot, Rocket, LayoutDashboard, Coins, ArrowRightLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/contexts/wallet-context";
import { UserService } from "@/services/user/user-service";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";

type WalletActionsCardProps = Record<string, never>;

export default function WalletActionsCard(_props: WalletActionsCardProps) {
  const navigate = useNavigate();
  const { publicKey, anchorProvider } = useWallet();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAddress, setTransferAddress] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [userCreditBalance, setUserCreditBalance] = useState<number>(0);

  const Action: React.FC<{
    label: string;
    icon: React.ReactNode;
    onClick?: () => void;
    ariaLabel: string;
  }> = ({ label, icon, onClick, ariaLabel }) => (
    <div className="flex flex-col items-center gap-2">
      <button
        aria-label={ariaLabel}
        onClick={onClick}
        className="w-12 h-12 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center active:scale-95 transition"
      >
        {icon}
      </button>
      <span className="text-xs text-white/80">{label}</span>
    </div>
  );

  const handleMyAgents = () => {
    navigate('/dapp/history');
  };

  const handleDeployAgent = () => {
    navigate('/dapp/hire');
  };

  const handleAccount = () => {
    navigate('/dapp/summary');
  };

  const handleStake = () => {
    navigate('/dapp/coming-soon');
  };

  const fetchUserCreditBalance = async () => {
    if (!publicKey || !anchorProvider) {
      setUserCreditBalance(0);
      return;
    }

    try {
      const userService = new UserService(anchorProvider);
      const balance = await userService.getUserCreditBalance(publicKey);
      setUserCreditBalance(balance);
    } catch (error) {
      console.error('Error fetching user credit balance:', error);
      setUserCreditBalance(0);
    }
  };

  const handleTransfer = async () => {
    await fetchUserCreditBalance();
    setShowTransferModal(true);
  };

  const handleTransferSubmit = async () => {
    if (!publicKey || !anchorProvider || !transferAddress || !transferAmount) {
      toast.error("Please fill in all fields");
      return;
    }

    if (transferAddress === publicKey.toString()) {
      toast.error("Cannot transfer to yourself");
      return;
    }

    const amount = parseFloat(transferAmount);
    if (amount <= 0) {
      toast.error("Transfer amount must be greater than 0");
      return;
    }

    // Convert to contract units (6 decimals for USDT)
    const amountInUnits = Math.floor(amount * 1_000_000);
    
    // Check if user has sufficient balance
    if (amountInUnits > userCreditBalance) {
      const availableBalance = (userCreditBalance / 1_000_000).toFixed(2);
      toast.error(`Insufficient balance. You have $${availableBalance} available`);
      return;
    }

    // Validate recipient address
    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(transferAddress.trim());
    } catch {
      toast.error("Invalid recipient address");
      return;
    }

    setIsTransferring(true);
    try {
      const userService = new UserService(anchorProvider);
      
      // Use the dedicated user-to-user transfer method
      await userService.transferCredit({
        fromUser: publicKey,
        toUser: recipientPubkey,
        amount: amountInUnits,
        provider: anchorProvider
      });

      toast.success(`Successfully transferred $${amount.toFixed(2)} to recipient`);
      
      // Reset form and close modal
      setShowTransferModal(false);
      setTransferAddress("");
      setTransferAmount("");
      
      // Refresh balance
      await fetchUserCreditBalance();
      
    } catch (error: unknown) {
      console.error("Transfer failed:", error);
      toast.error(error instanceof Error ? error.message : "Transfer failed. Please try again.");
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mt-0 mb-0 text-white">
        <Action 
          label="My Agents" 
          ariaLabel="View My Agents" 
          onClick={handleMyAgents} 
          icon={<Bot className="w-5 h-5" />} 
        />
        <Action 
          label="Deploy Agent" 
          ariaLabel="Deploy New Agent" 
          onClick={handleDeployAgent} 
          icon={<Rocket className="w-5 h-5" />} 
        />
        <Action 
          label="Account" 
          ariaLabel="Account Summary" 
          onClick={handleAccount} 
          icon={<LayoutDashboard className="w-5 h-5" />} 
        />
        <Action 
          label="Stake" 
          ariaLabel="Stake Tokens" 
          onClick={handleStake} 
          icon={<Coins className="w-5 h-5" />} 
        />
        <Action 
          label="Transfer" 
          ariaLabel="Transfer Credits" 
          onClick={handleTransfer} 
          icon={<ArrowRightLeft className="w-5 h-5" />} 
        />
      </div>

      {/* Transfer Credit Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Transfer Credit Balance</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transfer-address" className="text-sm">Recipient Wallet Address</Label>
              <Input
                id="transfer-address"
                type="text"
                placeholder="Enter wallet address..."
                value={transferAddress}
                onChange={(e) => setTransferAddress(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-amount" className="text-sm">Amount (USDT)</Label>
              <Input
                id="transfer-amount"
                type="number"
                placeholder="0.00"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                min="0"
                step="0.01"
                max={(userCreditBalance / 1_000_000).toString()}
                className="text-sm"
              />
              <div className="text-xs text-muted-foreground">
                Available: ${(userCreditBalance / 1_000_000).toFixed(2)}
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Current Balance:</strong> ${(userCreditBalance / 1_000_000).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You can transfer your credit balance to other users. This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowTransferModal(false)}
                className="flex-1"
                disabled={isTransferring}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleTransferSubmit}
                className="flex-1"
                disabled={isTransferring || !transferAddress || !transferAmount}
              >
                {isTransferring ? "Transferring..." : "Transfer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}