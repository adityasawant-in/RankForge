import { useMemo, useRef, useState } from "react";
import { useProject } from "../../store/ProjectContext";
import { buildSegments, totalDuration, formatTime, Segment } from "../../utils/timeline";
import { RankingBlock } from "../../types";
import EditBlockModal from "../LeftPanel/EditBlockModal";

const PX_PER_SEC = 24;

function segmentColor(seg: Segment) {
  if (seg.type === "intro") return "bg-blue-500/30 border-blue-400/50 text-blue-200";
  if (seg.type === "outro") return "bg-purple-500/30 border-purple-400/50 text-purple-200";
  return "bg-primary/40 border-primary/50 text-white";
}

export default function Timeline({
  playhead,
  setPlayhead,
  isPlaying,
  setIsPlaying
}: {
  playhead: number;
  setPlayhead: (n: number) => void;
  isPlaying: boolean;
  setIsPlaying: (b: boolean) => void;
}) {
  const { blocks, project, media, updateBlock, splitBlock, deleteBlock } = useProject();
  const [zoomMultiplier, setZoomMultiplier] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<RankingBlock | null>(null);
  const trackAreaRef = useRef<HTMLDivElement>(null);

  const segments = useMemo(() => buildSegments(blocks, project?.shuffleBlocks, project?.id), [blocks, project?.shuffleBlocks, project?.id]);
  const duration = useMemo(() => totalDuration(segments), [segments]);
  const pxPerSec = PX_PER_SEC * zoomMultiplier;
  const musicAsset = media.find((m) => m.id === project?.backgroundMusicId);

  const jump = (dir: "prev" | "next") => {
    const bounds = segments.map((s) => s.start).concat(duration);
    if (dir === "next") {
      const nextB = bounds.find((b) => b > playhead + 0.05);
      setPlayhead(nextB ?? duration);
    } else {
      const prevBounds = bounds.filter((b) => b < playhead - 0.05);
      setPlayhead(prevBounds.length ? prevBounds[prevBounds.length - 1] : 0);
    }
  };

  const handleRulerClick = (e: React.MouseEvent) => {
    if (!trackAreaRef.current) return;
    const rect = trackAreaRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + trackAreaRef.current.scrollLeft;
    setPlayhead(Math.max(0, Math.min(duration, x / pxPerSec)));
  };

  const handleScrubStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!trackAreaRef.current) return;

    const updatePlayheadFromX = (clientX: number) => {
      if (!trackAreaRef.current) return;
      const rect = trackAreaRef.current.getBoundingClientRect();
      const x = clientX - rect.left + trackAreaRef.current.scrollLeft;
      const newPlayhead = Math.max(0, Math.min(duration, x / pxPerSec));
      setPlayhead(Number(newPlayhead.toFixed(3)));
    };

    updatePlayheadFromX(e.clientX);

    const onPointerMove = (moveEvent: PointerEvent) => {
      updatePlayheadFromX(moveEvent.clientX);
    };

    const onPointerUp = () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerup", onPointerUp, { passive: true });
  };

  const handleSplit = async () => {
    const activeSeg = segments.find(
      (s) => playhead >= s.start && playhead < s.start + s.duration
    );
    if (!activeSeg || activeSeg.type !== "rank" || !activeSeg.block) {
      return;
    }
    const splitOffset = playhead - activeSeg.start;
    if (splitOffset < 0.2 || splitOffset > activeSeg.duration - 0.2) {
      return;
    }
    await splitBlock(activeSeg.block.id, splitOffset);
  };

  const handleDeleteSelected = async () => {
    if (!selectedId) return;
    const activeSeg = segments.find((s) => s.id === selectedId);
    if (!activeSeg || !activeSeg.block) return;

    const blockId = activeSeg.block.id;
    setSelectedId(null);
    await deleteBlock(blockId);
  };

  const handleTrimStart = (
    e: React.PointerEvent,
    blockId: string,
    mode: "left" | "right"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const blockToTrim = blocks.find((b) => b.id === blockId);
    if (!blockToTrim) return;

    const startX = e.clientX;
    const startDuration = blockToTrim.duration;
    const startTrimStart = blockToTrim.trimStart || 0;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSec = deltaX / pxPerSec;

      if (mode === "left") {
        const maxPossibleTrim = startTrimStart + startDuration - 1;
        const rawNewTrimStart = startTrimStart + deltaSec;
        const newTrimStart = Math.max(0, Math.min(maxPossibleTrim, rawNewTrimStart));
        const diff = newTrimStart - startTrimStart;
        const newDuration = Math.max(1, startDuration - diff);

        updateBlock(blockId, {
          trimStart: Number(newTrimStart.toFixed(2)),
          duration: Number(newDuration.toFixed(2))
        });
      } else {
        const rawNewDuration = startDuration + deltaSec;
        const newDuration = Math.max(1, rawNewDuration);

        updateBlock(blockId, {
          duration: Number(newDuration.toFixed(2))
        });
      }
    };

    const onPointerUp = () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerup", onPointerUp, { passive: true });
  };

  const rulerMarks = [];
  for (let s = 0; s <= duration; s += 5) rulerMarks.push(s);

  return (
    <footer className="h-full lg:h-64 bg-surface-dim lg:border-t border-outline/30 flex flex-col flex-1 lg:flex-initial lg:shrink-0">
      <div className="h-10 border-b border-outline/20 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button onClick={() => jump("prev")} className="p-1 hover:bg-surface-container rounded">
              <span className="material-symbols-outlined text-xl">skip_previous</span>
            </button>
            <button onClick={() => setIsPlaying(!isPlaying)} className="p-1 hover:bg-surface-container rounded text-primary">
              <span className="material-symbols-outlined text-2xl">{isPlaying ? "pause" : "play_arrow"}</span>
            </button>
            <button onClick={() => jump("next")} className="p-1 hover:bg-surface-container rounded">
              <span className="material-symbols-outlined text-xl">skip_next</span>
            </button>
          </div>
          <span className="text-xs font-mono text-primary font-bold">
            {formatTime(playhead)} / {formatTime(duration)}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 border-r border-outline/10 pr-4">
            <button
              onClick={handleSplit}
              className="px-2.5 py-1 bg-surface border border-outline/20 hover:border-outline/50 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 hover:bg-surface-variant"
              title="Split active clip at playhead"
            >
              <span className="material-symbols-outlined text-xs text-primary font-bold">content_cut</span>
              Split
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={!selectedId}
              className="px-2.5 py-1 bg-error/10 border border-error/20 hover:border-error/50 hover:bg-error/20 text-error disabled:opacity-30 disabled:pointer-events-none rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95"
              title="Delete selected clip"
            >
              <span className="material-symbols-outlined text-xs font-bold">delete</span>
              Delete
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setZoomMultiplier((z) => Math.max(0.4, z - 0.2))} className="material-symbols-outlined text-on-surface-variant text-sm">
              zoom_out
            </button>
            <input
              className="w-24 h-1 bg-surface-variant rounded-full appearance-none accent-primary"
              type="range"
              min={0.4}
              max={3}
              step={0.1}
              value={zoomMultiplier}
              onChange={(e) => setZoomMultiplier(Number(e.target.value))}
            />
            <button onClick={() => setZoomMultiplier((z) => Math.min(3, z + 0.2))} className="material-symbols-outlined text-on-surface-variant text-sm">
              zoom_in
            </button>
          </div>
        </div>
      </div>

      <div ref={trackAreaRef} className="flex-1 overflow-x-auto overflow-y-hidden relative" onClick={handleRulerClick}>
        <div 
          className="h-6 border-b border-outline/10 flex items-end px-2 text-[10px] text-on-surface-variant font-mono relative cursor-ew-resize select-none" 
          style={{ width: duration * pxPerSec + 40 }}
          onPointerDown={handleScrubStart}
        >
          {rulerMarks.map((s) => (
            <span key={s} className="absolute" style={{ left: s * pxPerSec }}>
              {s}s
            </span>
          ))}
        </div>

        <div
          className="absolute top-0 w-px bg-primary z-10 shadow-[0_0_10px_rgba(192,193,255,0.5)] pointer-events-none"
          style={{ left: playhead * pxPerSec, height: "100%" }}
        >
          <div 
            onPointerDown={handleScrubStart}
            className="w-3.5 h-3.5 bg-primary absolute -top-1.5 -left-1.5 rounded-sm rotate-45 pointer-events-auto cursor-ew-resize hover:scale-110 active:scale-95 transition-transform" 
          />
        </div>

        <div className="p-4 space-y-2" style={{ width: duration * pxPerSec + 40 }}>
          <div className="h-12 relative flex gap-0" onClick={(e) => e.stopPropagation()}>
            {segments.map((seg) => {
              const isSelected = selectedId === seg.id;
              return (
                <div
                  key={seg.id}
                  onClick={() => {
                    setSelectedId(seg.id);
                    setPlayhead(seg.start);
                  }}
                  className={`border rounded-lg flex items-center justify-between px-3 text-[11px] font-bold cursor-pointer shrink-0 relative select-none ${segmentColor(seg)} ${
                    isSelected ? "ring-2 ring-white border-transparent" : ""
                  }`}
                  style={{ width: seg.duration * pxPerSec }}
                  title={seg.block?.title}
                >
                  {/* Left Trim Handle */}
                  {seg.block && (
                    <div
                      onPointerDown={(e) => handleTrimStart(e, seg.block!.id, "left")}
                      className="absolute left-0 top-0 bottom-0 w-2.5 hover:w-3.5 cursor-ew-resize bg-white/10 hover:bg-white/40 active:bg-primary/50 transition-all rounded-l-lg flex items-center justify-center z-10"
                      title="Drag to trim start"
                    >
                      <div className="w-[1.5px] h-3.5 bg-white/40" />
                    </div>
                  )}

                  <span className="truncate select-none mx-2 w-full text-center">{seg.label}</span>

                  {/* Right Trim Handle */}
                  {seg.block && (
                    <div
                      onPointerDown={(e) => handleTrimStart(e, seg.block!.id, "right")}
                      className="absolute right-0 top-0 bottom-0 w-2.5 hover:w-3.5 cursor-ew-resize bg-white/10 hover:bg-white/40 active:bg-primary/50 transition-all rounded-r-lg flex items-center justify-center z-10"
                      title="Drag to trim end"
                    >
                      <div className="w-[1.5px] h-3.5 bg-white/40" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Transition Markers Overlay */}
            {segments.slice(0, -1).map((seg) => {
              if (!seg.block) return null;
              const boundarySec = seg.start + seg.duration;
              const xPos = boundarySec * pxPerSec;
              
              const transitionType = seg.block.transitionType || "none";
              const transitionDuration = seg.block.transitionDuration || 0.5;
              const hasTransition = transitionType !== "none";

              return (
                <div
                  key={`trans-${seg.id}`}
                  className="absolute z-25"
                  style={{
                    left: xPos,
                    top: "24px",
                    transform: "translate(-50%, -50%)"
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setEditingBlock(seg.block!)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center shadow-lg border transition-all hover:scale-110 active:scale-95 ${
                      hasTransition
                        ? "bg-primary border-primary text-on-primary"
                        : "bg-surface border-outline/35 text-on-surface-variant hover:text-white hover:border-outline/80"
                    }`}
                    title={hasTransition ? `Transition: ${transitionType} (${transitionDuration}s) - Click to edit` : "Add clip transition"}
                  >
                    <span className="material-symbols-outlined text-[13px] font-bold">
                      {hasTransition ? "swap_horiz" : "add"}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="h-8 flex gap-1">
            <div
              className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center px-3 text-[10px] text-yellow-500 font-medium"
              style={{ width: duration * pxPerSec }}
            >
              Global Ranking Titles Overlay
            </div>
          </div>

          <div className="h-10 flex">
            {musicAsset ? (
              <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-lg relative overflow-hidden" style={{ width: duration * pxPerSec }}>
                <div className="absolute inset-0 flex items-center justify-around px-2 opacity-30">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="w-1 bg-emerald-400" style={{ height: 6 + ((i * 37) % 20) }} />
                  ))}
                </div>
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-emerald-400">{musicAsset.name}</span>
              </div>
            ) : (
              <div className="border border-dashed border-outline/30 rounded-lg flex items-center px-3 text-[10px] text-on-surface-variant" style={{ width: duration * pxPerSec }}>
                No background music selected — add one from the Background Music panel
              </div>
            )}
          </div>
        </div>
      </div>
      {editingBlock && (
        <EditBlockModal block={editingBlock} onClose={() => setEditingBlock(null)} />
      )}
    </footer>
  );
}
