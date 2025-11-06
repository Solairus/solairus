import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Play } from "lucide-react";
import heroNetwork from "@/assets/hero-network.jpg";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useEffect, useRef, useState } from "react";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${heroNetwork})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.3
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background z-0" />
      
      {/* Content */}
      <div className="container mx-auto px-4 z-10 text-center">
        <div className="animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/30 mb-6 hover:glow-border transition-all">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Powered by Solana AI Agents</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="gradient-text">AI That Trades.</span>
            <br />
            <span className="text-foreground">You Earn.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12">
            Earn automated daily profits through intelligent Solana-based DeFi strategies.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button asChild variant="hero" size="xl" className="group">
              <a href="/dapp" aria-label="Launch App">
                Launch App
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
            </Button>
            {/* Replace hire button with Watch Intro that opens an overlay video */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="neon" size="xl" aria-label="Watch Intro Video" className="group">
                  <Play className="w-5 h-5 mr-2" />
                  Watch Intro
                </Button>
              </DialogTrigger>
              {/* Overlay video player */}
              <DialogContent className="max-w-3xl w-[90vw] sm:w-[800px] bg-black border-none p-4 shadow-2xl" aria-describedby="video-description">
                <VisuallyHidden>
                  <DialogTitle>Solairus Introduction Video</DialogTitle>
                </VisuallyHidden>
                <VisuallyHidden>
                  <p id="video-description">Watch the Solairus platform introduction video</p>
                </VisuallyHidden>
                {/* Purpose: Show intro video in an overlay. Inputs: none. Outputs: video playback UI. */}
                <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                  {/**
                   * Playback sources with fallback strategy.
                   * If ivideo.mp4 404s or fails to decode in production, switch to a known-good video.
                   */}
                  {(() => {
                    const FALLBACKS = [
                      "/media/videos/ivideo.mp4",
                      "/media/videos/vid03.mp4",
                    ];
                    const videoRef = useRef<HTMLVideoElement | null>(null);
                    const [currentVideo, setCurrentVideo] = useState<string>(FALLBACKS[0]);

                    useEffect(() => {
                      const v = videoRef.current;
                      if (!v) return;
                      try {
                        v.load();
                        const p = v.play();
                        if (p && typeof p.then === "function") {
                          p.catch(() => {});
                        }
                      } catch {}
                    }, [currentVideo]);

                    return (
                      <video
                        ref={videoRef}
                        controls
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-full h-full"
                        style={{ backgroundColor: '#000' }}
                        // Debug: log playback lifecycle to diagnose issues with specific files
                        onLoadedMetadata={(e) => {
                          const v = e.currentTarget;
                          console.info('[HeroVideo] loadedmetadata', {
                            src: v.currentSrc || currentVideo,
                            duration: v.duration,
                            videoWidth: v.videoWidth,
                            videoHeight: v.videoHeight,
                          });
                        }}
                        onLoadedData={(e) => {
                          const v = e.currentTarget;
                          console.info('[HeroVideo] loadeddata', { src: v.currentSrc || currentVideo });
                        }}
                        onCanPlay={(e) => {
                          const v = e.currentTarget;
                          console.info('[HeroVideo] canplay', { src: v.currentSrc || currentVideo });
                        }}
                        onCanPlayThrough={(e) => {
                          const v = e.currentTarget;
                          console.info('[HeroVideo] canplaythrough', { src: v.currentSrc || currentVideo });
                        }}
                        onPlay={(e) => {
                          const v = e.currentTarget;
                          console.info('[HeroVideo] play', { src: v.currentSrc || currentVideo });
                        }}
                        onPause={(e) => {
                          const v = e.currentTarget;
                          console.info('[HeroVideo] pause', { src: v.currentSrc || currentVideo });
                        }}
                        onWaiting={(e) => {
                          const v = e.currentTarget;
                          console.warn('[HeroVideo] waiting', { src: v.currentSrc || currentVideo });
                        }}
                        onStalled={(e) => {
                          const v = e.currentTarget;
                          console.warn('[HeroVideo] stalled', { src: v.currentSrc || currentVideo });
                        }}
                        onError={(e) => {
                          const v = e.currentTarget as HTMLVideoElement;
                          const err = (v.error && {
                            code: v.error.code,
                            message:
                              v.error.code === 1
                                ? 'MEDIA_ERR_ABORTED'
                                : v.error.code === 2
                                ? 'MEDIA_ERR_NETWORK'
                                : v.error.code === 3
                                ? 'MEDIA_ERR_DECODE'
                                : v.error.code === 4
                                ? 'MEDIA_ERR_SRC_NOT_SUPPORTED'
                                : 'UNKNOWN',
                          }) || null;
                          console.error('[HeroVideo] error', { src: v.currentSrc || currentVideo, error: err });

                          // Fallback: switch to the next source if available
                          const idx = FALLBACKS.indexOf(currentVideo);
                          if (idx !== -1 && idx + 1 < FALLBACKS.length) {
                            const next = FALLBACKS[idx + 1];
                            console.warn('[HeroVideo] switching to fallback source', { next });
                            setCurrentVideo(next);
                          }
                        }}
                      >
                        {/* Current source; React re-renders on state change */}
                        <source src={currentVideo} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    );
                  })()}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mt-20">
            <div className="glass rounded-xl p-6 glow-card hover:scale-105 transition-transform">
              <div className="text-3xl font-bold gradient-text mb-2">$2.4M+</div>
              <div className="text-sm text-muted-foreground">Total Earned</div>
            </div>
            <div className="glass rounded-xl p-6 glow-card hover:scale-105 transition-transform">
              <div className="text-3xl font-bold gradient-text mb-2">5,200+</div>
              <div className="text-sm text-muted-foreground">Active Bots</div>
            </div>
            <div className="glass rounded-xl p-6 glow-card hover:scale-105 transition-transform">
              <div className="text-3xl font-bold gradient-text mb-2">98.7%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
