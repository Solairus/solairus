import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BackButton from "@/components/ui/BackButton";
import { Wallet } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { PaymentOrderPanel } from "@/components/payment/PaymentOrderPanel";
import type { PaymentOrder } from "@/services/payment/orders-service";

/**
 * DepositPage — top up internal credit balance via the shared per-order pay flow.
 * Open amount: whatever USDT lands at the address is swept and credited to credit_balance.
 */
export default function DepositPage() {
  const navigate = useNavigate();
  const { user, refreshSession } = useAuth();

  const [showPay, setShowPay] = useState(false);
  const [done, setDone] = useState(false);

  const formatUsdtMicro = (micro: number | string) => {
    try {
      const digits = (typeof micro === "string" ? micro : String(micro)).replace(/[^0-9]/g, "");
      const padded = digits.padStart(7, "0");
      const whole = padded.slice(0, -6) || "0";
      const frac = padded.slice(-6).slice(0, 2);
      return `${Number(whole).toLocaleString("en-US")}.${frac}`;
    } catch {
      return "0.00";
    }
  };

  const handleCompleted = useCallback(async (_order: PaymentOrder) => {
    setShowPay(false);
    setDone(true);
    try { await refreshSession(); } catch { /* balance refresh best-effort */ }
  }, [refreshSession]);

  const creditDisplay = user?.credit_balance_micro && user.credit_balance_micro !== "0"
    ? `$${formatUsdtMicro(user.credit_balance_micro)}`
    : "$0.00";

  return (
    <div className="max-w-sm mx-auto space-y-3 p-3">
      <div className="flex items-center justify-between">
        <BackButton to="/dapp" />
        <Badge variant="outline" className="text-xs px-2 py-1 border-green-500 text-green-700 bg-green-50">
          Balance: {creditDisplay}
        </Badge>
      </div>

      <Card className="bg-gradient-to-br from-slate-50 to-gray-100 border-gray-200">
        <CardContent className="p-4 text-center space-y-3">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Wallet className="w-6 h-6 text-green-600" />
          </div>

          {done ? (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-green-800">Deposit received</h2>
              <p className="text-sm text-green-700">Your funds have been added to your balance.</p>
              <p className="text-xs text-gray-500">New balance: {creditDisplay}</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setDone(false)} variant="outline" size="sm">Deposit more</Button>
                <Button onClick={() => navigate("/dapp")} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">Done</Button>
              </div>
            </div>
          ) : !showPay ? (
            <>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-gray-800">Top up your balance</h2>
                <p className="text-sm text-gray-600">
                  Send USDT to a unique address. Once detected, it's credited to your balance —
                  use it to deploy agents without paying on-chain each time.
                </p>
              </div>
              <Button onClick={() => setShowPay(true)} className="w-full bg-green-600 hover:bg-green-700 text-white">
                <Wallet className="w-4 h-4 mr-2" /> Generate deposit address
              </Button>
            </>
          ) : (
            <PaymentOrderPanel
              type="deposit"
              onCompleted={handleCompleted}
              onCancel={() => setShowPay(false)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
