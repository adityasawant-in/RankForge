import { useState } from "react";
import { useProject } from "../../store/ProjectContext";
import RankingBlockCard from "./RankingBlockCard";

export default function RankingBlocksSection() {
  const { blocks, media, addBlock, project, updateProject } = useProject();
  const [open, setOpen] = useState(true);
  const sorted = [...blocks].sort((a, b) => a.rank - b.rank);

  return (
    <div className="p-4 border-b border-outline/20 shrink-0 flex flex-col">
      <div className="flex items-center justify-between w-full mb-3 shrink-0">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 group">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">
            Ranking Blocks ({blocks.length})
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:text-primary transition-colors">
            {open ? "expand_less" : "expand_more"}
          </span>
        </button>
        <div className="flex items-center gap-2">
          {/* Shuffle Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (project) {
                updateProject({ shuffleBlocks: !project.shuffleBlocks });
              }
            }}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
              project?.shuffleBlocks
                ? "bg-primary/20 border-primary text-primary"
                : "bg-surface-variant/30 border-outline/30 text-on-surface-variant hover:text-white hover:border-outline/50"
            }`}
            title="Shuffle blocks playback order (Rank 1 plays last)"
          >
            <span className="material-symbols-outlined text-[10px]">shuffle</span>
            <span>SHUFFLE: {project?.shuffleBlocks ? "ON" : "OFF"}</span>
          </button>
          
          {/* Add button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              addBlock();
            }}
            className="p-1 hover:bg-surface-variant rounded text-on-surface-variant hover:text-white"
            title="Add Block"
          >
            <span className="material-symbols-outlined text-lg">add</span>
          </button>
        </div>
      </div>
      {open && (
        <div className="space-y-2 pr-1">
          {sorted.map((block, i) => (
            <RankingBlockCard key={block.id} block={block} media={media} isFirst={i === 0} isLast={i === sorted.length - 1} />
          ))}
          {sorted.length === 0 && (
            <div className="text-xs text-on-surface-variant text-center py-6">No ranking blocks yet. Click + to add one.</div>
          )}
        </div>
      )}
    </div>
  );
}
