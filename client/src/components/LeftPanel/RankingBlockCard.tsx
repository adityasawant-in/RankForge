import { useState } from "react";
import { RankingBlock, MediaAsset } from "../../types";
import { useProject } from "../../store/ProjectContext";
import EditBlockModal from "./EditBlockModal";

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RankingBlockCard({
  block,
  media,
  isFirst,
  isLast
}: {
  block: RankingBlock;
  media: MediaAsset[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const { deleteBlock, moveBlock, reorderBlocks } = useProject();
  const [showEditModal, setShowEditModal] = useState(false);
  const asset = media.find((m) => m.id === block.mediaAssetId);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", block.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain");
    if (sourceId && sourceId !== block.id) {
      await reorderBlocks(sourceId, block.id);
    }
  };

  return (
    <>
      <div 
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => setShowEditModal(true)}
        className="bg-surface-container/50 border border-outline/20 rounded-xl p-2 flex gap-3 group hover:border-primary/40 cursor-grab active:cursor-grabbing transition-colors"
      >
        <div className="relative w-20 h-14 bg-surface-variant rounded-lg overflow-hidden shrink-0">
          {asset ? (
            <video src={asset.url} className="w-full h-full object-cover" muted />
          ) : (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant text-lg">movie</span>
            </div>
          )}
          <span className="absolute top-1 left-1 bg-black/60 text-[10px] px-1 rounded text-white font-bold">
            #{block.rank}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-1">
            <span className="text-xs font-semibold truncate">{block.title}</span>
            <span className="text-[10px] text-on-surface-variant/80 font-mono bg-surface-variant/30 px-1.5 py-0.5 rounded">
              {formatDuration(block.duration)}
              {block.playbackSpeed && block.playbackSpeed !== 1.0 && ` (${block.playbackSpeed.toFixed(2)}x)`}
            </span>
          </div>
          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowEditModal(true);
              }} 
              className="p-1 hover:bg-surface-variant rounded" 
              title="Edit"
            >
              <span className="material-symbols-outlined text-xs text-primary">edit</span>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                moveBlock(block.id, "up");
              }} 
              disabled={isFirst} 
              className="p-1 hover:bg-surface-variant rounded disabled:opacity-30" 
              title="Move up"
            >
              <span className="material-symbols-outlined text-xs">arrow_upward</span>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                moveBlock(block.id, "down");
              }} 
              disabled={isLast} 
              className="p-1 hover:bg-surface-variant rounded disabled:opacity-30" 
              title="Move down"
            >
              <span className="material-symbols-outlined text-xs">arrow_downward</span>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                deleteBlock(block.id);
              }} 
              className="p-1 hover:bg-surface-variant rounded" 
              title="Delete"
            >
              <span className="material-symbols-outlined text-xs text-error">delete</span>
            </button>
          </div>
        </div>
      </div>

      {showEditModal && (
        <EditBlockModal block={block} onClose={() => setShowEditModal(false)} />
      )}
    </>
  );
}

export { formatDuration };
