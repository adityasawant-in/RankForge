import { useState } from "react";
import { useProject } from "../../store/ProjectContext";

const FONTS = ["Geist Bold", "Geist", "JetBrains Mono", "Inter", "Roboto"];

export default function VideoTitleSection() {
  const { project, updateProject } = useProject();
  const [openTitle, setOpenTitle] = useState(true);
  const [openLayout, setOpenLayout] = useState(true);
  const [openSub, setOpenSub] = useState(true);

  if (!project) return null;

  return (
    <div className="border-b border-outline/20">
      {/* Title Section */}
      <div className="p-4 border-b border-outline/10">
        <button onClick={() => setOpenTitle((o) => !o)} className="flex items-center justify-between w-full mb-3 group">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">
            Video Title Settings
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">
            {openTitle ? "expand_less" : "expand_more"}
          </span>
        </button>
        {openTitle && (
          <div className="space-y-3">
            <textarea
              className="w-full bg-surface-container border border-outline/30 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-0 transition-all text-white resize-y min-h-[60px]"
              placeholder="Enter top video title..."
              rows={2}
              value={project.videoTitle}
              onChange={(e) => updateProject({ videoTitle: e.target.value })}
            />
            
            {/* Header background color selector */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">
                Header Background Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-9 h-9 rounded cursor-pointer border border-outline/30 bg-transparent"
                  value={project.headerBgColor || "#000000"}
                  onChange={(e) => updateProject({ headerBgColor: e.target.value })}
                />
                <input
                  type="text"
                  className="flex-1 bg-surface-container border border-outline/30 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase"
                  value={project.headerBgColor || "#000000"}
                  onChange={(e) => updateProject({ headerBgColor: e.target.value })}
                />
              </div>
            </div>

            {/* Keyword highlight values */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">
                Keywords to Highlight (comma-separated)
              </label>
              <input
                className="w-full bg-surface-container border border-outline/30 rounded-lg px-3 py-1.5 text-xs text-white"
                type="text"
                placeholder="e.g. Funniest, Parkour"
                value={project.highlightWords || ""}
                onChange={(e) => updateProject({ highlightWords: e.target.value })}
              />
            </div>

            {/* Highlight color picker items */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-3">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-white/50 tracking-wider">
                  Highlight Color 1
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    className="w-6 h-6 rounded cursor-pointer border border-outline/30 bg-transparent"
                    value={project.highlightColor1 || "#ff3333"}
                    onChange={(e) => updateProject({ highlightColor1: e.target.value })}
                  />
                  <span className="text-[10px] text-white/70 uppercase">Color 1</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-white/50 tracking-wider">
                  Highlight Color 2
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    className="w-6 h-6 rounded cursor-pointer border border-outline/30 bg-transparent"
                    value={project.highlightColor2 || "#ffff33"}
                    onChange={(e) => updateProject({ highlightColor2: e.target.value })}
                  />
                  <span className="text-[10px] text-white/70 uppercase">Color 2</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-white/50 tracking-wider">
                  Highlight Color 3
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    className="w-6 h-6 rounded cursor-pointer border border-outline/30 bg-transparent"
                    value={project.highlightColor3 || "#33ff33"}
                    onChange={(e) => updateProject({ highlightColor3: e.target.value })}
                  />
                  <span className="text-[10px] text-white/70 uppercase">Color 3</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-white/50 tracking-wider">
                  Highlight Color 4
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    className="w-6 h-6 rounded cursor-pointer border border-outline/30 bg-transparent"
                    value={project.highlightColor4 || "#33ffff"}
                    onChange={(e) => updateProject({ highlightColor4: e.target.value })}
                  />
                  <span className="text-[10px] text-white/70 uppercase">Color 4</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Font Style</label>
                <select
                  className="w-full bg-surface-container border border-outline/30 rounded-lg px-3 py-1.5 text-xs text-white appearance-none"
                  value={project.titleFont}
                  onChange={(e) => updateProject({ titleFont: e.target.value })}
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title Font Size slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Title Font Size</label>
                  <span className="text-xs text-primary font-mono font-bold">{project.titleFontSize || 32}px</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={80}
                  value={project.titleFontSize || 32}
                  onChange={(e) => updateProject({ titleFontSize: Number(e.target.value) })}
                  className="w-full h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                />
              </div>

              {/* Title Y-Offset slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Title Y-Offset</label>
                  <span className="text-xs text-primary font-mono font-bold">{project.titleYOffset || 0}px</span>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={project.titleYOffset || 0}
                  onChange={(e) => updateProject({ titleYOffset: Number(e.target.value) })}
                  className="w-full h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Layout Customizations Section */}
      <div className="p-4 border-b border-outline/10">
        <button onClick={() => setOpenLayout((o) => !o)} className="flex items-center justify-between w-full mb-3 group">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">
            Layout Customizations
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">
            {openLayout ? "expand_less" : "expand_more"}
          </span>
        </button>
        {openLayout && (
          <div className="space-y-4">
            {/* Rank overlay spacing */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">
                  Rank List Spacing
                </label>
                <span className="text-xs text-primary font-mono font-bold">
                  {project.rankListSpacing !== undefined ? project.rankListSpacing : 12}px
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={40}
                value={project.rankListSpacing !== undefined ? project.rankListSpacing : 12}
                onChange={(e) => updateProject({ rankListSpacing: Number(e.target.value) })}
                className="w-full h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
              />
            </div>

            {/* Backdrop Opacity slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">
                  Backdrop Opacity
                </label>
                <span className="text-xs text-primary font-mono font-bold">
                  {project.backdropOpacity !== undefined ? project.backdropOpacity : 45}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={project.backdropOpacity !== undefined ? project.backdropOpacity : 45}
                onChange={(e) => updateProject({ backdropOpacity: Number(e.target.value) })}
                className="w-full h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
              />
            </div>

            {/* Backdrop Blur slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">
                  Backdrop Blur Sizing
                </label>
                <span className="text-xs text-primary font-mono font-bold">
                  {project.backdropBlur !== undefined ? project.backdropBlur : 20}px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                value={project.backdropBlur !== undefined ? project.backdropBlur : 20}
                onChange={(e) => updateProject({ backdropBlur: Number(e.target.value) })}
                className="w-full h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
              />
            </div>

            {/* Rank List X-Position slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">
                  Rank List Horizontal position
                </label>
                <span className="text-xs text-primary font-mono font-bold">
                  {project.rankListXPos !== undefined ? project.rankListXPos : 20}px
                </span>
              </div>
              <input
                type="range"
                min={4}
                max={300}
                value={project.rankListXPos !== undefined ? project.rankListXPos : 20}
                onChange={(e) => updateProject({ rankListXPos: Number(e.target.value) })}
                className="w-full h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
              />
            </div>

            {/* Rank List Font Size slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">
                  Rank List Font Size
                </label>
                <span className="text-xs text-primary font-mono font-bold">
                  {project.rankListFontSize !== undefined ? project.rankListFontSize : 36}px
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={60}
                value={project.rankListFontSize !== undefined ? project.rankListFontSize : 36}
                onChange={(e) => updateProject({ rankListFontSize: Number(e.target.value) })}
                className="w-full h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
              />
            </div>

            {/* Shuffle Blocks toggle */}
            <div className="flex justify-between items-center py-1">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">
                  Shuffle Video Playback
                </span>
                <span className="text-[9px] text-on-surface-variant/60 leading-normal max-w-[200px]">
                  Play blocks in random order but always reveal Rank #1 last.
                </span>
              </div>
              <button
                type="button"
                onClick={() => updateProject({ shuffleBlocks: !project.shuffleBlocks })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  project.shuffleBlocks ? "bg-primary" : "bg-surface-container-highest"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    project.shuffleBlocks ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subtitle Section */}
      <div className="p-4">
        <button onClick={() => setOpenSub((o) => !o)} className="flex items-center justify-between w-full mb-3 group">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">
            Video Subtitle Settings
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">
            {openSub ? "expand_less" : "expand_more"}
          </span>
        </button>
        {openSub && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <input
                className="col-span-2 bg-surface-container border border-outline/30 rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-0 transition-all text-white"
                type="text"
                placeholder="Subtitle Text"
                value={project.subtitleText}
                onChange={(e) => updateProject({ subtitleText: e.target.value })}
              />
              <input
                className="bg-surface-container border border-outline/30 rounded-lg px-3 py-2 text-sm text-center focus:border-primary focus:ring-0 transition-all text-white"
                type="text"
                placeholder="Emoji"
                value={project.subtitleEmoji}
                onChange={(e) => updateProject({ subtitleEmoji: e.target.value })}
              />
            </div>

            {/* Quick Emoji Preset Selector */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">
                Quick Emoji Presets
              </label>
              <div className="flex flex-wrap gap-1 bg-surface-container/50 p-1.5 rounded-lg border border-outline/20">
                {["😂", "🔥", "🤯", "😎", "⚠️", "❤️", "⭐", "👇"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => updateProject({ subtitleEmoji: emoji })}
                    className={`w-7 h-7 rounded flex items-center justify-center text-sm hover:bg-surface-variant transition-colors ${
                      project.subtitleEmoji === emoji ? "bg-primary/20 border border-primary/40" : "border border-transparent"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => updateProject({ subtitleEmoji: "" })}
                  className={`w-7 h-7 rounded flex items-center justify-center text-xs text-on-surface-variant hover:bg-surface-variant transition-colors border ${
                    !project.subtitleEmoji ? "bg-primary/20 border-primary/40" : "border-transparent"
                  }`}
                  title="Clear Emoji"
                >
                  <span className="material-symbols-outlined text-sm text-red-400">close</span>
                </button>
              </div>
            </div>

            {/* Subtitle color picking grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">
                  Text Color
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    className="w-6 h-6 rounded cursor-pointer border border-outline/30 bg-transparent"
                    value={project.subtitleColor || "#ffff33"}
                    onChange={(e) => updateProject({ subtitleColor: e.target.value })}
                  />
                  <span className="text-[10px] text-white/70 uppercase">Text</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">
                  Background Color
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    className="w-6 h-6 rounded cursor-pointer border border-outline/30 bg-transparent"
                    value={project.subtitleBgColor === "transparent" ? "#000000" : (project.subtitleBgColor || "#0b0e14")}
                    onChange={(e) => updateProject({ subtitleBgColor: e.target.value })}
                  />
                  <span className="text-[10px] text-white/70 uppercase">Backdrop</span>
                </div>
              </div>
            </div>

            {/* Subtitle Font Family & Size */}
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Font Style</label>
                <select
                  className="w-full bg-surface-container border border-outline/30 rounded-lg px-3 py-1.5 text-xs text-white appearance-none"
                  value={project.subtitleFont || "Geist Bold"}
                  onChange={(e) => updateProject({ subtitleFont: e.target.value })}
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subtitle Font Size slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Subtitle Font Size</label>
                  <span className="text-xs text-primary font-mono font-bold">{project.subtitleFontSize || 28}px</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={80}
                  value={project.subtitleFontSize || 28}
                  onChange={(e) => updateProject({ subtitleFontSize: Number(e.target.value) })}
                  className="w-full h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                />
              </div>

              {/* Subtitle Y-Offset slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Subtitle Y-Offset</label>
                  <span className="text-xs text-primary font-mono font-bold">{project.subtitleYOffset || 0}px</span>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={project.subtitleYOffset || 0}
                  onChange={(e) => updateProject({ subtitleYOffset: Number(e.target.value) })}
                  className="w-full h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
