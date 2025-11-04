import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";

interface HeaderProps {
  showWalletConnect?: boolean; // when false, hide connect wallet button
}

export default function Header({ showWalletConnect = true }: HeaderProps) {
  const { openModal } = useWalletConnection();
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 glass">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <img src="/logo.png" alt="SOLAIRUS logo" className="h-[60px] w-auto object-contain" />
          </div>
          
          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              Home
            </a>
            <a href="#how" className="text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </a>
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#affiliate" className="text-muted-foreground hover:text-foreground transition-colors">
              Affiliate
            </a>
            <a href="#docs" className="text-muted-foreground hover:text-foreground transition-colors">
              Docs
            </a>
          </nav>
          
          {/* CTA */}
          <div className="flex items-center gap-4">
            {showWalletConnect && (
              <Button variant="ghost" className="hidden md:inline-flex" onClick={openModal}>
                Connect Wallet
              </Button>
            )}
            <Button asChild variant="hero">
              <a href="/dapp" aria-label="Launch App">Launch App</a>
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
