import { useRef, useState } from "react";
import { useProject } from "../../store/ProjectContext";

export default function BackgroundMusicSection() {
  const { media, uploadMedia, deleteMedia, project, updateProject } = useProject();
  const [open, setOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const audioAssets = media.filter((m) => m.type === "audio");

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      await uploadMedia(file);
    }
    setUploading(false);
  };

  return (
    <div className="p-4 border-b border-outline/20 shrink-0 flex flex-col">
      <div className="flex items-center justify-between w-full mb-3">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 group">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">
            Background Music ({audioAssets.length})
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:text-primary transition-colors">
            {open ? "expand_less" : "expand_more"}
          </span>
        </button>
        {open && (
          <button
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-1 bg-primary text-on-primary text-[10px] font-bold px-2 py-1 rounded hover:brightness-110 active:scale-95 transition-all"
            title="Upload background track"
          >
            <span className="material-symbols-outlined text-xs">upload</span>
            {uploading ? "Uploading…" : "Upload"}
          </button>
        )}
        <input ref={fileInput} type="file" accept="audio/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {open && (
        <div className="space-y-2 pt-1 max-h-48 overflow-y-auto pr-1">
          {audioAssets.map((asset) => {
            const active = project?.backgroundMusicId === asset.id;
            return (
              <div
                key={asset.id}
                className={`flex items-center gap-2 p-1.5 rounded-lg border transition-colors ${
                  active ? "border-secondary bg-secondary/10" : "border-outline/20 bg-surface-container/40 hover:border-outline/40"
                }`}
              >
                <span className="material-symbols-outlined text-secondary text-sm shrink-0">music_note</span>
                <span className="flex-1 text-[11px] truncate text-white">{asset.name}</span>
                <button
                  type="button"
                  onClick={() => updateProject({ backgroundMusicId: active ? null : asset.id })}
                  className={`text-[9px] px-2 py-0.5 rounded font-bold transition-all ${
                    active ? "bg-secondary text-on-secondary" : "bg-surface-variant hover:bg-surface-variant/80 text-white"
                  }`}
                >
                  {active ? "Active" : "Use"}
                </button>
                <button 
                  type="button"
                  onClick={() => deleteMedia(asset.id)} 
                  className="p-1 hover:bg-surface-variant rounded shrink-0"
                >
                  <span className="material-symbols-outlined text-xs text-error">delete</span>
                </button>
              </div>
            );
          })}
          {audioAssets.length === 0 && (
            <div className="text-[10px] text-on-surface-variant/70 text-center py-4">
              No tracks uploaded yet. Click Upload to add audio files.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
