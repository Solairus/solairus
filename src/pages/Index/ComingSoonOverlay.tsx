import CountdownFlip from "@/components/CountdownFlip";

export default function ComingSoonOverlay({ targetDate, title, message }: { targetDate: string | Date; title: string; message: string }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-background/65 flex items-center justify-center select-none cursor-not-allowed" aria-hidden="true">
      <div className="container mx-auto px-6">
        <div className="bg-card glow-card border border-border rounded-2xl max-w-2xl mx-auto p-12 md:p-16 text-center my-8">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight gradient-text mb-4">
            {title}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-6">
            {message}
          </p>
          <div className="mt-8">
            <CountdownFlip targetDate={targetDate} />
          </div>
        </div>
      </div>
    </div>
  );
}