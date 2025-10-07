import React, { PropsWithChildren } from "react";

/**
 * Card
 * Purpose: Reusable glassmorphic card for mobile content sections.
 * Inputs:
 * - title: string title
 * - subtitle: optional string subtitle
 * - children: content body
 */
export function Card({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <section className="glass rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-primary">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}