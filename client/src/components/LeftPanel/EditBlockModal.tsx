import { useState } from "react";
import { createPortal } from "react-dom";
import { RankingBlock } from "../../types";
import { useProject } from "../../store/ProjectContext";
import { getAssetUrl } from "../../api";

export default function EditBlockModal({
  block,
  onClose
}: {
  block: RankingBlock;
  onClose: () => void;
}) {
  const { updateBlock, importMediaFromUrl } = useProject();
  const [title, setTitle] = useState(block.title);
  const [duration, setDuration] = useState(block.duration);
  const [playbackSpeed, setPlaybackSpeed] = useState(block.playbackSpeed || 1.0);
  const [trimStart, setTrimStart] = useState(block.trimStart || 0);
  const [transitionType, setTransitionType] = useState(block.transitionType || "none");
  const [transitionDuration, setTransitionDuration] = useState(block.transitionDuration || 0.5);
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let mediaAssetId = block.mediaAssetId;
      let finalTitle = title.trim();
      let finalDuration = Number(duration) || 10;
      let finalTrimStart = Number(trimStart) || 0;

      if (videoUrl.trim()) {
        // Call import endpoint
        const asset = await importMediaFromUrl(videoUrl.trim());
        mediaAssetId = asset.id;
        // If user didn't customize the title or it was the default "Ranking Block #X", 
        // we can set the title to the imported video's name!
        if (!finalTitle || finalTitle === `Ranking Block #${block.rank}`) {
          finalTitle = asset.name;
        }

        // Programmatically fetch duration of imported video
        const tempVideo = document.createElement("video");
        tempVideo.src = getAssetUrl(asset.url);
        tempVideo.preload = "metadata";
        
        await Promise.race([
          new Promise<void>((resolve) => {
            tempVideo.onloadedmetadata = () => resolve();
            tempVideo.onerror = () => resolve();
            tempVideo.load();
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 1500)) // 1.5s fallback timeout
        ]);
        
        finalDuration = tempVideo.duration ? Math.round(tempVideo.duration) : 10;
        finalTrimStart = 0;
      }

      if (!finalTitle) {
        finalTitle = block.title;
      }

      updateBlock(block.id, {
        title: finalTitle,
        duration: finalDuration,
        mediaAssetId,
        playbackSpeed,
        trimStart: finalTrimStart,
        transitionType,
        transitionDuration: Number(transitionDuration) || 0.5
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to import video. Please check the URL and try again.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-surface-container border border-outline/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-outline/10 flex items-center justify-between">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">settings</span>
            Edit Ranking Block #{block.rank}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-variant rounded text-on-surface-variant hover:text-white transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-error/15 border border-error/30 rounded-xl text-error text-xs flex gap-2">
              <span className="material-symbols-outlined text-sm shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Block Title</label>
            <input
              type="text"
              disabled={loading}
              className="w-full text-sm bg-surface-variant/50 border border-outline/20 rounded-xl px-3 py-2 text-white outline-none focus:border-primary/50 transition-colors"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Double Cup Flip"
            />
          </div>



          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Playback Speed</label>
              <span className="text-xs text-primary font-mono font-bold">{playbackSpeed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.25}
              max={3.0}
              step={0.25}
              disabled={loading}
              value={playbackSpeed}
              onChange={(e) => {
                const newSpeed = Number(e.target.value);
                setPlaybackSpeed(newSpeed);
                const origDuration = block.duration * (block.playbackSpeed || 1.0);
                const newDur = Math.max(1, Math.round(origDuration / newSpeed));
                setDuration(newDur);
              }}
              className="w-full h-1 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
            />
          </div>

          <div className="space-y-3 p-3 bg-surface-variant/20 rounded-xl border border-outline/10">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-primary">swap_horiz</span>
              Transition to next clip
            </label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div>
                <label className="text-[9px] font-bold text-on-surface-variant/70 uppercase">Effect Type</label>
                <select
                  disabled={loading}
                  value={transitionType}
                  onChange={(e) => setTransitionType(e.target.value as any)}
                  className="w-full text-xs bg-surface-variant/50 border border-outline/20 rounded-xl px-2.5 py-1.5 mt-1 text-white outline-none focus:border-primary/50 transition-colors"
                >
                  <option value="none">None</option>
                  <option value="fade">Crossfade</option>
                  <option value="slideleft">Slide Left</option>
                  <option value="slideright">Slide Right</option>
                  <option value="wipeleft">Wipe Left</option>
                  <option value="wiperight">Wipe Right</option>
                  <option value="zoominstep">Zoom In</option>
                </select>
              </div>
              {transitionType !== "none" && (
                <div>
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-bold text-on-surface-variant/70 uppercase">Duration</label>
                    <span className="text-[10px] text-primary font-mono font-bold">{transitionDuration.toFixed(1)}s</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.5}
                    step={0.1}
                    disabled={loading}
                    value={transitionDuration}
                    onChange={(e) => setTransitionDuration(Number(e.target.value))}
                    className="w-full h-1 bg-surface-variant rounded-lg appearance-none cursor-pointer mt-3.5 accent-primary focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1 bg-surface-variant/20 p-3 rounded-xl border border-outline/10">
            <label className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">link</span>
              Import video from URL
            </label>
            <input
              type="url"
              disabled={loading}
              className="w-full text-xs bg-surface-variant/50 border border-outline/20 rounded-xl px-3 py-2 mt-1.5 text-white outline-none focus:border-primary/50 transition-colors placeholder:text-on-surface-variant/40"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Paste YouTube Shorts or Instagram link"
            />
            <p className="text-[10px] text-on-surface-variant mt-1.5 leading-normal">
              Provide a public video link. We will download the media directly into your project's upload directory using yt-dlp.
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-outline/10">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 border border-outline/30 text-white rounded-xl text-xs font-semibold hover:bg-surface-variant transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary text-on-primary font-semibold rounded-xl text-xs flex items-center gap-2 hover:bg-primary/95 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                  Downloading...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
