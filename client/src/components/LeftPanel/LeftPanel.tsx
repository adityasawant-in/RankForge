import VideoTitleSection from "./VideoTitleSection";
import RankingBlocksSection from "./RankingBlocksSection";
import MediaLibrarySection from "./MediaLibrarySection";
import BackgroundMusicSection from "./BackgroundMusicSection";

interface LeftPanelProps {
  style?: React.CSSProperties;
}

export default function LeftPanel({ style }: LeftPanelProps) {
  return (
    <aside 
      className="w-full lg:w-auto glass-panel flex flex-col shrink-0 overflow-y-auto lg:border-r border-outline/30 select-none scrollbar-thin" 
      style={style}
    >
      <VideoTitleSection />
      <RankingBlocksSection />
      <MediaLibrarySection />
      <BackgroundMusicSection />
    </aside>
  );
}
