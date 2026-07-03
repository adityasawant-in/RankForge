import { RankingBlock } from "../types";

export interface Segment {
  id: string;
  type: "intro" | "rank" | "outro";
  label: string;
  start: number;
  duration: number;
  block?: RankingBlock;
}

export const INTRO_DURATION = 3;
export const OUTRO_DURATION = 2;

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function() {
    let t = (h += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSegments(blocks: RankingBlock[], shuffleBlocks?: boolean, seed: string = "default"): Segment[] {
  let orderedBlocks = [...blocks].sort((a, b) => a.rank - b.rank); // ascending order: #1 first, #N last

  if (shuffleBlocks) {
    const rank1Block = orderedBlocks.find((b) => b.rank === 1);
    const otherBlocks = orderedBlocks.filter((b) => b.rank !== 1);
    const rnd = seededRandom(seed);
    
    for (let i = otherBlocks.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const temp = otherBlocks[i];
      otherBlocks[i] = otherBlocks[j];
      otherBlocks[j] = temp;
    }
    
    if (rank1Block) {
      orderedBlocks = [...otherBlocks, rank1Block];
    } else {
      orderedBlocks = otherBlocks;
    }
  }

  let cursor = 0;
  const segments: Segment[] = [];

  for (const b of orderedBlocks) {
    segments.push({ id: b.id, type: "rank", label: `Rank #${b.rank}`, start: cursor, duration: b.duration, block: b });
    cursor += b.duration;
  }

  return segments;
}

export function totalDuration(segments: Segment[]): number {
  const last = segments[segments.length - 1];
  return last ? last.start + last.duration : 0;
}

export function activeSegment(segments: Segment[], time: number): Segment | undefined {
  return segments.find((s) => time >= s.start && time < s.start + s.duration) ?? segments[segments.length - 1];
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${cs.toString().padStart(2, "0")}`;
}
