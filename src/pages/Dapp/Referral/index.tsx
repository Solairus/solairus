import React, { useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { decryptAddress, isValidSolAddress, storeSponsorAddress } from "@/lib/address-crypto";

export default function DappReferral() {
  const navigate = useNavigate();
  const location = useLocation();
  const { code } = useParams();

  useEffect(() => {
    if (!code) return;
    try {
      const sponsor = decryptAddress(code);
      if (isValidSolAddress(sponsor)) {
        storeSponsorAddress(sponsor, 30);
      }
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("Failed to decrypt referral code", err);
      }
    }

    try {
      const searchParams = new URLSearchParams(location.search);
      const tracker = searchParams.get("track");
      let target = "/dapp";
      switch (tracker) {
        case "qb":
          target = "/dapp/hire"; // quick-buy analogue
          break;
        case "market":
          target = "/dapp/market";
          break;
        default:
          target = "/dapp";
      }
      const timer = setTimeout(() => navigate(target), 1200);
      return () => clearTimeout(timer);
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("Referral redirect handling failed", err);
      }
    }
  }, [code, location.search, navigate]);

  return (
    <div className="p-6 min-h-[70vh] flex items-center justify-center">
      <div className="rounded-xl border bg-card text-card-foreground p-6 text-center w-full max-w-md">
        <h2 className="text-lg font-semibold">Applying Referral...</h2>
        <p className="text-sm text-muted-foreground mt-2">Processing your invite and redirecting.</p>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mt-6" />
      </div>
    </div>
  );
}