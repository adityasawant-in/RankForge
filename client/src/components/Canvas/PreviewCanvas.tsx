import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProject } from "../../store/ProjectContext";
import { buildSegments, activeSegment, totalDuration } from "../../utils/timeline";
import { TitleOverlay } from "../../types";
import { getAssetUrl } from "../../api";

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const hexToRgba = (colorStr: string, opacityPercent: number) => {
  const opacity = opacityPercent / 100;
  if (!colorStr) return `rgba(0, 0, 0, ${opacity})`;
  if (colorStr.startsWith("rgba")) {
    return colorStr.replace(/[\d\.]+\)$/, `${opacity})`);
  }
  if (colorStr.startsWith("rgb")) {
    return colorStr.replace(/\)$/, `, ${opacity})`).replace(/^rgb/, "rgba");
  }
  const cleanHex = colorStr.startsWith("#") ? colorStr : `#${colorStr}`;
  const r = parseInt(cleanHex.slice(1, 3), 16) || 0;
  const g = parseInt(cleanHex.slice(3, 5), 16) || 0;
  const b = parseInt(cleanHex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

interface DragState {
  mode: "move" | "resize";
  startX: number;
  startY: number;
  orig: TitleOverlay;
}

export default function PreviewCanvas({
  playhead,
  isPlaying,
  setPlayhead,
  setIsPlaying
}: {
  playhead: number;
  isPlaying: boolean;
  setPlayhead?: React.Dispatch<React.SetStateAction<number>>;
  setIsPlaying?: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { project, blocks, media, updateProject, updateBlock } = useProject();
  const [zoom, setZoom] = useState(75);
  const dragRef = useRef<DragState | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const blurVideoRef = useRef<HTMLVideoElement>(null);
  const syncedDurationsRef = useRef<Record<string, string>>({});

  const segments = useMemo(() => buildSegments(blocks, project?.shuffleBlocks, project?.id), [blocks, project?.shuffleBlocks, project?.id]);
  const current = useMemo(() => activeSegment(segments, playhead), [segments, playhead]);
  const asset = current?.block ? media.find((m) => m.id === current.block!.mediaAssetId) : undefined;

  const rankedAscending = useMemo(() => [...blocks].sort((a, b) => a.rank - b.rank), [blocks]);
  const duration = useMemo(() => totalDuration(segments), [segments]);

  const activeTransition = useMemo(() => {
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (!seg.block) continue;
      
      const type = seg.block.transitionType || "none";
      if (type === "none") continue;
      
      const durationVal = seg.block.transitionDuration || 0.5;
      const boundarySec = seg.start + seg.duration;
      
      const startWin = boundarySec - durationVal / 2;
      const endWin = boundarySec + durationVal / 2;
      
      if (playhead >= startWin && playhead < endWin) {
        const progress = (playhead - startWin) / durationVal;
        return { type, progress };
      }
    }
    return null;
  }, [segments, playhead]);

  const transitionStyle = useMemo(() => {
    if (!activeTransition) return {};
    const { type, progress } = activeTransition;
    
    if (type === "fade") {
      const opacity = progress < 0.5 ? 1 - progress * 2 : (progress - 0.5) * 2;
      return { opacity };
    }
    if (type === "slideleft") {
      const transform = progress < 0.5 
        ? `translateX(${-progress * 2 * 100}%)` 
        : `translateX(${(1 - (progress - 0.5) * 2) * 100}%)`;
      return { transform };
    }
    if (type === "slideright") {
      const transform = progress < 0.5 
        ? `translateX(${progress * 2 * 100}%)` 
        : `translateX(${((progress - 0.5) * 2 - 1) * 100}%)`;
      return { transform };
    }
    if (type === "wipeleft") {
      const clipPath = progress < 0.5 
        ? `inset(0 ${progress * 2 * 100}% 0 0)` 
        : `inset(0 0 0 ${(1 - (progress - 0.5) * 2) * 100}%)`;
      return { clipPath };
    }
    if (type === "wiperight") {
      const clipPath = progress < 0.5 
        ? `inset(0 0 0 ${progress * 2 * 100}%)` 
        : `inset(0 ${(1 - (progress - 0.5) * 2) * 100}% 0 0)`;
      return { clipPath };
    }
    if (type === "zoominstep") {
      const scale = progress < 0.5 ? 1 - progress : progress;
      const opacity = progress < 0.5 ? 1 - progress * 2 : (progress - 0.5) * 2;
      return { transform: `scale(${scale})`, opacity };
    }
    return {};
  }, [activeTransition]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!document.fullscreenElement) return; // only activate shortcuts in fullscreen
      if (e.code === "Space" && setIsPlaying) {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === "ArrowLeft" && setPlayhead) {
        e.preventDefault();
        setPlayhead((prev) => Math.max(0, prev - 2));
      } else if (e.code === "ArrowRight" && setPlayhead) {
        e.preventDefault();
        setPlayhead((prev) => Math.min(duration, prev + 2));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setIsPlaying, setPlayhead, duration]);

  const startDrag = useCallback(
    (mode: "move" | "resize") => (e: React.MouseEvent) => {
      if (!project) return;
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = { mode, startX: e.clientX, startY: e.clientY, orig: { ...project.titleOverlay } };

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current || !stageRef.current) return;
        const rect = stageRef.current.getBoundingClientRect();
        const dxPct = ((ev.clientX - dragRef.current.startX) / rect.width) * 100;
        const dyPct = ((ev.clientY - dragRef.current.startY) / rect.height) * 100;
        const orig = dragRef.current.orig;
        if (dragRef.current.mode === "move") {
          const x = Math.max(0, Math.min(100 - orig.w, orig.x + dxPct));
          const y = Math.max(0, Math.min(100 - orig.h, orig.y + dyPct));
          updateProject({ titleOverlay: { ...orig, x, y } }, { commit: false });
        } else {
          const w = Math.max(15, Math.min(100 - orig.x, orig.w + dxPct));
          const h = Math.max(8, Math.min(100 - orig.y, orig.h + dyPct));
          updateProject({ titleOverlay: { ...orig, w, h } }, { commit: false });
        }
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [project, updateProject]
  );

  const toggleFullscreen = () => {
    if (wrapperRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        wrapperRef.current.requestFullscreen().catch((err) => {
          console.error("Error entering fullscreen:", err);
        });
      }
    }
  };

  if (!project) return null;

  return (
    <section className="flex-1 canvas-bg flex items-center justify-center relative p-2 lg:p-12 overflow-hidden">
      <div ref={wrapperRef} id="stage-fullscreen-wrapper" className="relative group flex items-center justify-center">
        <div
          ref={stageRef}
          id="stage-container"
          className="bg-black rounded-[20px] lg:rounded-[32px] border-[4px] lg:border-[8px] border-surface-variant relative overflow-hidden flex flex-col [container-type:size]"
          style={isMobile ? {
            height: "calc(38vh - 24px)",
            width: "calc((38vh - 24px) * 9 / 16)",
            maxWidth: "90vw",
            aspectRatio: "9/16"
          } : {
            height: `calc(min(70vh, calc(100vh - 320px)) * ${zoom / 75})`,
            aspectRatio: "9/16",
            maxHeight: "90%"
          }}
        >
        {/* Custom Header Banner with adjustable bg color */}
        <div
          className="h-[14%] border-b border-black/15 flex flex-col items-center justify-center px-4 py-2 z-10 text-center select-none shadow-md"
          style={{ backgroundColor: project.headerBgColor || "#000000" }}
        >
          <h2
            className="text-white font-extrabold uppercase leading-tight select-none text-stroke-thick flex flex-col items-center justify-center w-full"
            style={{
              fontSize: `${(project.titleFontSize || 32) * 0.175}cqw`,
              fontFamily: "'Arial Black', Impact, sans-serif",
              transform: `translateY(${project.titleYOffset || 0}px)`
            }}
          >
            {(() => {
              const rawTitle = project.videoTitle || "Untitled Video";
              const highlightStr = project.highlightWords || "";
              const targets = highlightStr
                .split(",")
                .map((w) => w.trim().toLowerCase())
                .filter(Boolean);

              const lines = rawTitle.split("\n");

              return lines.map((line, lineIdx) => {
                if (!highlightStr.trim() || targets.length === 0) {
                  return <div key={lineIdx} className="w-full text-center">{line}</div>;
                }

                // Split into tokens (keeping spaces intact)
                const words = line.split(/(\s+)/);

                return (
                  <div key={lineIdx} className="w-full text-center">
                    {words.map((part, idx) => {
                      const cleanWord = part.toLowerCase().trim();
                      const matchedIdx = targets.indexOf(cleanWord);

                      if (matchedIdx !== -1) {
                        const colors = [
                          project.highlightColor1 || "#ff3333",
                          project.highlightColor2 || "#ffff33",
                          project.highlightColor3 || "#33ff33",
                          project.highlightColor4 || "#33ffff"
                        ];
                        const color = colors[matchedIdx % colors.length];
                        return (
                          <span key={idx} style={{ color }}>
                            {part}
                          </span>
                        );
                      }
                      return <span key={idx}>{part}</span>;
                    })}
                  </div>
                );
              });
            })()}
          </h2>
        </div>

        {/* Video Sync Logic */}
        {(() => {
          // eslint-disable-next-line react-hooks/rules-of-hooks
          useEffect(() => {
            const video = videoRef.current;
            const blurVideo = blurVideoRef.current;
            if (!video) return;

            const speed = current?.block?.playbackSpeed || 1.0;
            video.playbackRate = speed;
            if (blurVideo) blurVideo.playbackRate = speed;

            const videoDuration = video.duration || 0;
            const timeInSeg = playhead - (current?.start || 0);
            const trimStart = current?.block?.trimStart || 0;
            const expectedTime = videoDuration > 0
              ? Math.min(videoDuration - 0.05, Math.max(trimStart, trimStart + timeInSeg * speed))
              : trimStart + timeInSeg * speed;

            if (isPlaying) {
              video.play().catch(() => {});
              if (blurVideo) blurVideo.play().catch(() => {});
            } else {
              video.pause();
              if (blurVideo) blurVideo.pause();
            }

            if (video.readyState >= 1) {
              const drift = Math.abs(video.currentTime - expectedTime);
              if (!isPlaying || drift > 0.3) {
                video.currentTime = expectedTime;
                if (blurVideo && blurVideo.readyState >= 1) blurVideo.currentTime = expectedTime;
              }
            }
          }, [isPlaying, playhead, current?.start, asset?.url, current?.block?.playbackSpeed]);
          return null;
        })()}

        {/* Main video area */}
        <div className="flex-1 relative bg-[#0b0e14] overflow-hidden flex items-center justify-center">
          {current?.type === "intro" ? (
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-6 text-center">
              <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[10px] font-bold tracking-widest uppercase rounded-full mb-3">
                Intro Clip
              </span>
              <h1 className="text-white text-base font-extrabold tracking-tight drop-shadow-md truncate max-w-full">
                {project.videoTitle || "Untitled Video"}
              </h1>
              <div className="mt-4 flex items-center gap-1.5 text-[10px] text-white/40">
                <span className="material-symbols-outlined text-xs animate-pulse">play_arrow</span>
                <span>Starting in {Math.max(0, Math.ceil(3 - playhead))}s</span>
              </div>
            </div>
          ) : current?.type === "outro" ? (
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-6 text-center">
              <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-bold tracking-widest uppercase rounded-full mb-3">
                Outro
              </span>
              <h1 className="text-white text-base font-extrabold tracking-tight drop-shadow-md">
                Thanks for Watching!
              </h1>
              <span className="text-white/40 text-[10px] mt-2">End of Timeline</span>
            </div>
          ) : asset ? (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden" style={transitionStyle}>
              {/* Blurred background video layer */}
              <video
                ref={blurVideoRef}
                src={getAssetUrl(asset.url)}
                className="absolute inset-0 w-full h-full object-cover scale-110 pointer-events-none select-none z-0"
                style={{
                  opacity: (project.backdropOpacity !== undefined ? project.backdropOpacity : 45) / 100,
                  filter: `blur(${project.backdropBlur !== undefined ? project.backdropBlur : 20}px)`
                }}
                muted
                playsInline
              />
              {/* Main sharp centered video layer */}
              <video
                ref={videoRef}
                src={getAssetUrl(asset.url)}
                className="relative w-full h-full object-contain z-10"
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget;
                  const videoDuration = video.duration || 0;
                  const speed = current?.block?.playbackSpeed || 1.0;
                  
                  if (videoDuration > 0 && current?.block) {
                    const roundedDuration = Math.round(videoDuration / speed);
                    if (syncedDurationsRef.current[current.block.id] !== asset.id) {
                      syncedDurationsRef.current[current.block.id] = asset.id;
                      updateBlock(current.block.id, {
                        duration: roundedDuration,
                        trimStart: 0
                      });
                    }
                  }

                  const timeInSeg = playhead - (current?.start || 0);
                  const expectedTime = videoDuration > 0 ? Math.min(videoDuration - 0.05, Math.max(0, timeInSeg * speed)) : timeInSeg * speed;
                  video.currentTime = expectedTime;
                  video.playbackRate = speed;
                  
                  if (isPlaying) {
                    video.play().catch(() => {});
                  } else {
                    video.pause();
                  }
                }}
              />
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-950 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-3 shadow-lg shadow-primary/5">
                <span className="text-primary text-xl font-black">#{current?.block?.rank}</span>
              </div>
              <h3 className="text-white font-bold text-xs px-2 truncate max-w-full">
                {current?.block?.title || `Ranking Block #${current?.block?.rank}`}
              </h3>
              <span className="text-white/30 text-[10px] mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">video_file</span>
                No media assigned
              </span>
            </div>
          )}

          {/* Left-Side Rank List Overlay (exact match to screenshot!) */}
          <div
            className="absolute top-1/2 -translate-y-1/2 flex flex-col z-20 select-none"
            style={{
              left: `${project.rankListXPos !== undefined ? project.rankListXPos : 20}px`,
              gap: `${project.rankListSpacing !== undefined ? project.rankListSpacing : 12}px`
            }}
          >
            {rankedAscending.map((b) => {
              let numColor = "text-[#ffffff]"; // default is white outline text
              if (b.rank === 1) numColor = "text-[#ff3333]";
              else if (b.rank === 2) numColor = "text-[#ff9933]";
              else if (b.rank === 3) numColor = "text-[#ffff33]";

              // Progressive reveal based on timeline playback order
              const segForB = segments.find((s) => s.block?.id === b.id);
              const isRevealed = segForB ? segForB.start <= (current?.start || 0) : false;

              // Only show title if it's customized (does not match default "Ranking Block #X") and revealed
              const hasCustomTitle = b.title && b.title !== `Ranking Block #${b.rank}`;
              const isCurrent = current?.block?.id === b.id;

              return (
                <div
                  key={`${b.id}-${isCurrent}`}
                  className={`flex items-center gap-1.5 text-left font-bold uppercase select-none leading-none text-stroke-thick ${
                    isCurrent ? "animate-rank-pop" : ""
                  }`}
                  style={{
                    fontSize: `${(project.rankListFontSize || 36) * 0.139}cqw`,
                    fontFamily: "'Arial Black', Impact, sans-serif"
                  }}
                >
                  <span className={`${numColor} font-black`}>{b.rank}.</span>
                  {isRevealed && hasCustomTitle && (
                    <span className="text-white tracking-wide">{b.title}</span>
                  )}
                  {isCurrent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse ml-0.5 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Subtitle Banner */}
        <div
          className="h-[12%] border-t border-black/20 flex items-center justify-center p-3 z-10 text-center select-none shadow-inner"
          style={{ backgroundColor: project.subtitleBgColor || "#0b0e14" }}
        >
          <input
            className="bg-transparent font-extrabold uppercase outline-none text-center w-full select-none text-stroke-thick animate-pulse-slow"
            style={{
              color: project.subtitleColor || "#ffff33",
              fontSize: `${(project.subtitleFontSize || 28) * 0.17}cqw`,
              fontFamily: project.subtitleFont ? `'${project.subtitleFont}', sans-serif` : "'Arial Black', Impact, sans-serif",
              transform: `translateY(${project.subtitleYOffset || 0}px)`
            }}
            value={`${project.subtitleText} ${project.subtitleEmoji}`}
            onChange={(e) => {
              const val = e.target.value;
              updateProject({ subtitleText: val });
            }}
          />
        </div>

        {/* Floating Fullscreen Controls Bar Overlay */}
        {isFullscreen && setIsPlaying && setPlayhead && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col gap-3 bg-black/80 backdrop-blur-md px-6 py-3.5 rounded-2xl border border-white/10 shadow-2xl z-30 pointer-events-auto w-[85%] max-w-[400px]">
            {/* Fullscreen Progress Slider */}
            <div className="flex items-center gap-2.5 w-full">
              <span className="text-[10px] font-mono text-white/60 select-none">
                {formatTime(playhead)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 10}
                step={0.05}
                value={playhead}
                onChange={(e) => setPlayhead(Number(e.target.value))}
                className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
              />
              <span className="text-[10px] font-mono text-white/60 select-none">
                {formatTime(duration)}
              </span>
            </div>

            {/* Playback action buttons */}
            <div className="flex items-center justify-center gap-5 w-full">
              {/* Skip backward 2 seconds */}
              <button
                className="material-symbols-outlined text-white/80 hover:text-primary transition-colors text-xl"
                onClick={(e) => {
                  e.stopPropagation();
                  setPlayhead((prev) => Math.max(0, prev - 2));
                }}
              >
                replay_5
              </button>

              {/* Play / Pause toggle */}
              <button
                className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md animate-pulse-slow"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPlaying((prev) => !prev);
                }}
              >
                <span className="material-symbols-outlined text-xl">
                  {isPlaying ? "pause" : "play_arrow"}
                </span>
              </button>

              {/* Skip forward 2 seconds */}
              <button
                className="material-symbols-outlined text-white/80 hover:text-primary transition-colors text-xl"
                onClick={(e) => {
                  e.stopPropagation();
                  setPlayhead((prev) => Math.min(duration, prev + 2));
                }}
              >
                forward_5
              </button>

              <div className="w-px h-4 bg-white/20" />

              {/* Fullscreen Exit button */}
              <button
                className="material-symbols-outlined text-white/80 hover:text-red-400 transition-colors text-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  if (document.fullscreenElement) {
                    document.exitFullscreen();
                  }
                }}
              >
                fullscreen_exit
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      {!isMobile && (
        <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-surface-dim/80 backdrop-blur rounded-full border border-outline/30 px-3 py-1.5 z-40">
          <button onClick={() => setZoom((z) => Math.max(25, z - 10))} className="material-symbols-outlined text-lg text-on-surface-variant hover:text-white">
            zoom_out
          </button>
          <span className="text-xs font-medium text-on-surface-variant w-9 text-center">{zoom}%</span>
          <button onClick={() => setZoom((z) => Math.min(150, z + 10))} className="material-symbols-outlined text-lg text-on-surface-variant hover:text-white">
            zoom_in
          </button>
          <div className="h-4 w-px bg-outline/30" />
          <button onClick={toggleFullscreen} className="material-symbols-outlined text-lg text-on-surface-variant hover:text-white">
            fullscreen
          </button>
        </div>
      )}
    </section>
  );
}
