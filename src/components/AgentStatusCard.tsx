import React from "react";
import { Card } from "@/components/Card";

type AgentStatusCardProps = {
  mode?: string;
  uptime?: string;
};

export default function AgentStatusCard({ mode = "Passive", uptime = "24/7" }: AgentStatusCardProps) {
  return (
    <Card title="AI Agent" subtitle="Status">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Mode</span>
        <span className="text-sm">{mode}</span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm text-muted-foreground">Uptime</span>
        <span className="text-sm">{uptime}</span>
      </div>
    </Card>
  );
}