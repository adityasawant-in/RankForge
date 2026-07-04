import { useRef, useState } from "react";
import { useProject } from "../../store/ProjectContext";
import { getAssetUrl } from "../../api";

export default function MediaLibrarySection() {
  const { media, uploadMedia, deleteMedia, blocks, updateBlock } = useProject();
  const [open, setOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const videoAssets = media.filter((m) => m.type === "video");
  const sortedBlocks = [...blocks].sort((a, b) => a.rank - b.rank);
  const activeBlockId = selectedBlockId || sortedBlocks[0]?.id || "";

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      await uploadMedia(file);
    }
    setUploading(false);
  };

  const assign = (assetId: string) => {
    if (!activeBlockId) return;
    const asset = media.find((m) => m.id === assetId);
    if (!asset) return;

    const video = document.createElement("video");
    video.src = getAssetUrl(asset.url);
    video.onloadedmetadata = () => {
      const dur = Math.round(video.duration) || 10;
      updateBlock(activeBlockId, {
        mediaAssetId: assetId,
        duration: dur,
        trimStart: 0
      });
    };
    video.onerror = () => {
      updateBlock(activeBlockId, {
        mediaAssetId: assetId,
        duration: 10,
        trimStart: 0
      });
    };
  };

  return (
    <div className="p-4 border-b border-outline/20 shrink-0 flex flex-col">
      <div className="flex items-center justify-between w-full mb-3">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 group">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">
            Media Library ({videoAssets.length})
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:text-primary transition-colors">
            {open ? "expand_less" : "expand_more"}
          </span>
        </button>
        {open && (
          <button
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-1 bg-primary text-on-primary text-[10px] font-bold px-2 py-1 rounded hover:brightness-110 active:scale-95 transition-all"
            title="Upload new video asset"
          >
            <span className="material-symbols-outlined text-xs">upload</span>
            {uploading ? "Uploading…" : "Upload"}
          </button>
        )}
        <input ref={fileInput} type="file" accept="video/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {open && (
        <div className="space-y-3 pt-1">
          {videoAssets.length > 0 && (
            <div className="flex items-center gap-2 bg-surface-variant/20 p-2 rounded-lg border border-outline/10">
              <span className="text-[10px] text-on-surface-variant shrink-0 font-bold">Assign to:</span>
              <select
                value={activeBlockId}
                onChange={(e) => setSelectedBlockId(e.target.value)}
                className="flex-1 bg-surface-container border border-outline/25 rounded px-2 py-1 text-[11px] text-white outline-none focus:border-primary"
              >
                {sortedBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    Rank #{b.rank} — {b.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {videoAssets.map((asset) => (
              <div key={asset.id} className="group relative bg-surface-container rounded-lg overflow-hidden border border-outline/20 flex flex-col">
                <video src={getAssetUrl(asset.url)} className="w-full h-16 object-cover" muted />
                <div className="p-1 text-center bg-surface-container-high shrink-0">
                  <p className="text-[9px] truncate max-w-full text-on-surface-variant">{asset.name}</p>
                </div>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                  <button onClick={() => assign(asset.id)} className="text-[9px] bg-primary text-on-primary px-1.5 py-0.5 rounded font-bold hover:brightness-110">
                    Assign
                  </button>
                  <button onClick={() => deleteMedia(asset.id)} className="text-[9px] bg-error text-on-error px-1.5 py-0.5 rounded font-bold hover:brightness-110">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {videoAssets.length === 0 && (
            <div className="text-[10px] text-on-surface-variant/70 text-center py-4">
              No clips uploaded yet. Click Upload to add video files.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
