export interface TitleOverlay {
  x: number; // percent
  y: number; // percent
  w: number; // percent
  h: number; // percent
}

export interface Project {
  id: string;
  name: string;
  videoTitle: string;
  titleFont: string;
  titleFontSize: number;
  titleOverlay: TitleOverlay;
  subtitleText: string;
  subtitleEmoji: string;
  backgroundMusicId: string | null;
  totalDurationTarget: number;
  headerBgColor?: string;
  highlightWords?: string; // comma-separated keywords
  highlightColor1?: string; // hex color for first match
  highlightColor2?: string; // hex color for second match
  subtitleFont?: string;
  subtitleFontSize?: number;
  subtitleColor?: string;
  subtitleBgColor?: string;
  rankListSpacing?: number;
  backdropOpacity?: number;
  backdropBlur?: number;
  titleYOffset?: number;
  subtitleYOffset?: number;
  rankListXPos?: number;
  rankListFontSize?: number;
  shuffleBlocks?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RankingBlock {
  id: string;
  projectId: string;
  rank: number;
  title: string;
  duration: number;
  mediaAssetId: string | null;
  playbackSpeed?: number;
  trimStart?: number;
  transitionType?: "none" | "fade" | "slideleft" | "slideright" | "wipeleft" | "wiperight" | "zoominstep";
  transitionDuration?: number;
}

export interface MediaAsset {
  id: string;
  name: string;
  type: "video" | "audio";
  url: string;
  mimetype: string;
  createdAt: number;
}
