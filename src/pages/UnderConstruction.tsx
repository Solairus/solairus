import React from "react";

export default function UnderConstruction({ title }: { title: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="glass rounded-xl p-6 text-center w-full">
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground">This page is under construction.</p>
      </div>
    </div>
  );
}