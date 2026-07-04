import Header from "./components/Header";
import LeftPanel from "./components/LeftPanel/LeftPanel";
import PreviewCanvas from "./components/Canvas/PreviewCanvas";
import Timeline from "./components/Timeline/Timeline";
import AuthScreen from "./components/Auth/AuthScreen";
import { useProject } from "./store/ProjectContext";
import { useState, useEffect, useRef, useMemo } from "react";
import { buildSegments, totalDuration } from "./utils/timeline";
import { getAssetUrl } from "./api";

export default function App() {
  const { loading, project, media, blocks, isAuthenticated } = useProject();
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(360);
  const [activeMobileTab, setActiveMobileTab] = useState<"settings" | "timeline">("settings");

  const segments = useMemo(() => buildSegments(blocks || []), [blocks]);
  const duration = useMemo(() => totalDuration(segments), [segments]);

  const rafRef = useRef<number>();
  const lastTsRef = useRef<number>();
  const audioRef = useRef<HTMLAudioElement>(null);

  const musicAsset = useMemo(() => {
    if (!media || !project) return null;
    return media.find((m) => m.id === project.backgroundMusicId) || null;
  }, [media, project]);

  useEffect(() => {
    if (!isPlaying) {
      lastTsRef.current = undefined;
      return;
    }
    const tick = (ts: number) => {
      if (lastTsRef.current !== undefined) {
        const dt = (ts - lastTsRef.current) / 1000;
        setPlayhead((prev) => {
          const next = prev + dt;
          if (next >= duration) {
            setIsPlaying(false);
            return duration;
          }
          return next;
        });
      }
      lastTsRef.current = ts;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, duration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }

    const drift = Math.abs(audio.currentTime - playhead);
    if (!isPlaying || drift > 0.3) {
      audio.currentTime = playhead;
    }
  }, [isPlaying, playhead, musicAsset?.url]);

  const handleDragPanelStart = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftPanelWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(280, Math.min(600, startWidth + deltaX));
      setLeftPanelWidth(newWidth);
    };

    const onPointerUp = () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  };

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  if (loading || !project) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background text-on-surface gap-4 font-sans select-none">
        {/* Loading Spinner */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-primary/10 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-base font-bold tracking-widest uppercase text-primary">RankForge</h2>
          <p className="text-[11px] text-on-surface-variant/60 animate-pulse">Initializing editor workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-on-surface">
      <Header />
      
      {/* Desktop view (visible on lg and up: >= 1024px) */}
      <div className="hidden lg:flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 flex overflow-hidden">
          <LeftPanel style={{ width: leftPanelWidth }} />
          
          {/* Resize Handle Divider */}
          <div
            onPointerDown={handleDragPanelStart}
            className="w-1 bg-outline/10 hover:bg-primary/50 cursor-col-resize shrink-0 transition-all select-none z-30 relative flex items-center justify-center border-l border-r border-outline/10"
            title="Drag to resize panel"
          >
            <div className="flex flex-col gap-1.5 opacity-30 pointer-events-none">
              <div className="w-[3px] h-[3px] bg-white rounded-full" />
              <div className="w-[3px] h-[3px] bg-white rounded-full" />
              <div className="w-[3px] h-[3px] bg-white rounded-full" />
            </div>
          </div>

          <PreviewCanvas playhead={playhead} isPlaying={isPlaying} setPlayhead={setPlayhead} setIsPlaying={setIsPlaying} />
        </main>
        <Timeline playhead={playhead} setPlayhead={setPlayhead} isPlaying={isPlaying} setIsPlaying={setIsPlaying} />
      </div>

      {/* Mobile/Tablet view (visible below lg: < 1024px) */}
      <div className="flex lg:hidden flex-col flex-1 overflow-hidden">
        {/* Top: Permanent Preview Canvas */}
        <div className="h-[38vh] bg-[#0b0e14] border-b border-outline/10 relative shrink-0 flex flex-col overflow-hidden">
          <PreviewCanvas playhead={playhead} isPlaying={isPlaying} setPlayhead={setPlayhead} setIsPlaying={setIsPlaying} />
        </div>
        
        {/* Bottom: Tabbed Panels */}
        <div className="flex-1 flex flex-col overflow-hidden bg-surface-dim">
          {/* Mobile Tab bar navigation (moved to top of panels) */}
          <div className="h-12 bg-surface-container border-b border-outline/20 flex items-center justify-around px-4 shrink-0 select-none">
            <button
              type="button"
              onClick={() => setActiveMobileTab("settings")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                activeMobileTab === "settings" ? "text-primary bg-primary/10 font-bold scale-105" : "text-on-surface-variant/60 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-base">tune</span>
              <span className="text-[11px] font-bold uppercase tracking-wider">Settings & Media</span>
            </button>
            
            <button
              type="button"
              onClick={() => setActiveMobileTab("timeline")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                activeMobileTab === "timeline" ? "text-primary bg-primary/10 font-bold scale-105" : "text-on-surface-variant/60 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-base">splitscreen</span>
              <span className="text-[11px] font-bold uppercase tracking-wider">Timeline</span>
            </button>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {activeMobileTab === "settings" && (
              <div className="w-full h-full overflow-y-auto bg-surface-dim">
                <LeftPanel />
              </div>
            )}
            
            {activeMobileTab === "timeline" && (
              <div className="w-full h-full overflow-y-auto bg-surface-dim">
                <Timeline playhead={playhead} setPlayhead={setPlayhead} isPlaying={isPlaying} setIsPlaying={setIsPlaying} />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {musicAsset && (
        <audio
          ref={audioRef}
          src={getAssetUrl(musicAsset.url)}
          loop
          onLoadedMetadata={(e) => {
            const audio = e.currentTarget;
            audio.currentTime = playhead;
            if (isPlaying) {
              audio.play().catch(() => {});
            } else {
              audio.pause();
            }
          }}
        />
      )}
      
      {/* Developer Badge in the bottom-right corner */}
      <div className="fixed bottom-3 right-3 bg-surface-container/60 backdrop-blur-sm border border-outline/15 text-[10px] font-semibold text-on-surface-variant px-3 py-1 rounded-full z-50 select-none shadow-sm pointer-events-none">
        Developer: Aditya Sawant
      </div>
    </div>
  );
}
