import { Router } from "express";
import { readDb } from "../db.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { nanoid } from "nanoid";
import ffmpegPath from "ffmpeg-static";
import { Readable } from "stream";
import { finished } from "stream/promises";

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.statusText}`);
  const fileStream = fs.createWriteStream(destPath);
  await finished(Readable.fromWeb(res.body).pipe(fileStream));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_DATA_DIR = path.join(__dirname, "..", "..", "content", "video_data");
const localLinuxFfmpeg = path.resolve(__dirname, "..", "..", "ffmpeg");
const FFMPEG_PATH = process.env.FFMPEG_PATH || (fs.existsSync(localLinuxFfmpeg) ? localLinuxFfmpeg : ffmpegPath);
const TEMP_DIR = path.join(__dirname, "..", "..", "temp");

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const emojiCacheDir = path.join(TEMP_DIR, "emojis");
if (!fs.existsSync(emojiCacheDir)) fs.mkdirSync(emojiCacheDir, { recursive: true });

async function getEmojiImage(emoji) {
  if (!emoji) return null;
  const cp = [...emoji]
    .map((c) => c.codePointAt(0).toString(16))
    .filter((x) => x !== "fe0f")
    .join("-");
  
  const cachePath = path.join(emojiCacheDir, `${cp}.png`);
  if (fs.existsSync(cachePath)) {
    return cachePath;
  }

  const url = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${cp}.png`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(cachePath, Buffer.from(buffer));
    return cachePath;
  } catch (err) {
    console.warn(`Failed to download emoji ${emoji} from ${url}:`, err.message);
    return null;
  }
}
function parseFfmpegColor(colorStr) {
  if (!colorStr) return "0x000000";
  if (colorStr.startsWith("#")) {
    const clean = colorStr.replace("#", "");
    if (clean.length === 8) {
      const rgb = clean.slice(0, 6);
      const alpha = parseInt(clean.slice(6, 8), 16) / 255;
      return `0x${rgb}@${alpha.toFixed(2)}`;
    }
    return `0x${clean}`;
  }
  if (colorStr.startsWith("rgba")) {
    const parts = colorStr.match(/[\d\.]+/g);
    if (parts && parts.length >= 4) {
      const r = parseInt(parts[0]).toString(16).padStart(2, "0");
      const g = parseInt(parts[1]).toString(16).padStart(2, "0");
      const b = parseInt(parts[2]).toString(16).padStart(2, "0");
      const a = parseFloat(parts[3]).toFixed(2);
      return `0x${r}${g}${b}@${a}`;
    }
  }
  if (colorStr.startsWith("rgb")) {
    const parts = colorStr.match(/\d+/g);
    if (parts && parts.length >= 3) {
      const r = parseInt(parts[0]).toString(16).padStart(2, "0");
      const g = parseInt(parts[1]).toString(16).padStart(2, "0");
      const b = parseInt(parts[2]).toString(16).padStart(2, "0");
      return `0x${r}${g}${b}`;
    }
  }
  return colorStr;
}

function getAtempoFilter(speed) {
  if (!speed || speed === 1.0) return "atempo=1.0";
  let remaining = speed;
  const parts = [];
  while (remaining > 2.0) {
    parts.push("atempo=2.0");
    remaining /= 2.0;
  }
  while (remaining < 0.5) {
    parts.push("atempo=0.5");
    remaining /= 0.5;
  }
  if (remaining !== 1.0) {
    parts.push(`atempo=${remaining.toFixed(4)}`);
  }
  return parts.join(",");
}

const router = Router();

function escapeFfmpegText(str) {
  if (!str) return "''";
  const escaped = str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "’")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%");
  return `'${escaped}'`;
}

const estimateWordWidth = (word, fontSize = 32) => {
  let width = 0;
  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    if (char === " ") {
      width += fontSize * 0.35;
    } else if (/[iIvl1\.,;!']/.test(char)) {
      width += fontSize * 0.28;
    } else if (/[A-Z]/.test(char)) {
      width += fontSize * 0.72;
    } else if (/[mw]/.test(char)) {
      width += fontSize * 0.85;
    } else if (/[MW]/.test(char)) {
      width += fontSize * 0.95;
    } else if (/[0-9]/.test(char)) {
      width += fontSize * 0.6;
    } else {
      width += fontSize * 0.6; // standard lowercase
    }
  }
  return Math.round(width);
};

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    console.log(`Running FFmpeg with args:`, args.join(" "));
    execFile(FFMPEG_PATH, args, (error, stdout, stderr) => {
      if (error) {
        console.error("FFmpeg error:", stderr);
        return reject(new Error(stderr || error.message));
      }
      resolve(stdout);
    });
  });
}

async function renderSegment({ block, asset, project, blocks, playedRanks, tempOut }) {
  const duration = block.duration || 10;
  const trimStart = block.trimStart || 0;
  const titleText = escapeFfmpegText((project.videoTitle || "").toUpperCase());
  const rawSubText = (project.subtitleText || "").toUpperCase();
  const rawSubEmoji = project.subtitleEmoji || "";

  // Convert CSS color (Hex, RGB, RGBA) to FFmpeg color syntax
  const headerColorVal = parseFfmpegColor(project.headerBgColor || "#000000");

  // Resolve absolute path to our static Roboto-Bold font file
  const fontFile = path.resolve(__dirname, "..", "..", "data", "font.ttf")
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:");

  const fontCheckPath = fontFile.replace(/\\:/g, ":");
  if (!fs.existsSync(fontCheckPath)) {
    console.error(`[EXPORT] Font file check failed! Checked path: ${fontCheckPath}`);
    throw new Error(`System font file is missing on server: ${fontCheckPath}`);
  }

  const subBgColorVal = parseFfmpegColor(project.subtitleBgColor || "#0b0e14");

  // 1. Draw top header banner and bottom footer banner
  const drawBanners = `drawbox=y=0:w=720:h=180:color=${headerColorVal}:t=fill,drawbox=y=1100:w=720:h=180:color=${subBgColorVal}:t=fill`;

  // 2. Draw global title centered in header. Handle word highlights if defined.
  let drawTitle = "";
  const rawTitle = (project.videoTitle || "Untitled Video").toUpperCase();
  const highlightStr = project.highlightWords || "";
  const highlightTargets = highlightStr
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);

  const titleFontSize = Math.round((project.titleFontSize || 32) * 0.175 * 7.2);
  const titleYOffset = (project.titleYOffset !== undefined ? project.titleYOffset : 0) * 2;

  const lines = rawTitle.split("\n");
  const L = lines.length;
  const lineHeight = titleFontSize;
  const yStart = 90 - (L * lineHeight) / 2 + 10 + titleYOffset;
  const drawParts = [];
  let firstMatchDone = false;

  if (highlightTargets.length > 0) {
    lines.forEach((line, lineIdx) => {
      const yLine = Math.round(yStart + lineIdx * lineHeight);
      const words = line.split(/(\s+)/).filter(w => w.length > 0);
      if (words.length === 0) return;

      // Track colors for each word in this line
      const wordColors = words.map((w) => {
        const clean = w.toLowerCase().trim();
        const isTarget = highlightTargets.indexOf(clean) !== -1;
        let color = "white";
        if (isTarget) {
          color = project.highlightColor1 || "red";
          if (firstMatchDone) color = project.highlightColor2 || "yellow";
          firstMatchDone = true;
        }
        return color;
      });

      // Calculate total line width and start X position using estimateWordWidth
      const totalWidth = words.reduce((sum, w) => sum + estimateWordWidth(w, titleFontSize), 0);
      let currentX = Math.round((720 - totalWidth) / 2);

      words.forEach((w, idx) => {
        if (w.trim() === "") {
          currentX += estimateWordWidth(w, titleFontSize);
          return;
        }
        const escapedWord = escapeFfmpegText(w);
        const color = wordColors[idx];
        drawParts.push(`drawtext=fontfile='${fontFile}':text=${escapedWord}:x=${currentX}:y=${yLine}:fontsize=${titleFontSize}:fontcolor=${color}:borderw=4:bordercolor=black`);
        currentX += estimateWordWidth(w, titleFontSize);
      });
    });

    drawTitle = drawParts.join(",");
  } else {
    lines.forEach((line, lineIdx) => {
      const yLine = Math.round(yStart + lineIdx * lineHeight);
      const titleText = escapeFfmpegText(line);
      drawParts.push(`drawtext=fontfile='${fontFile}':text=${titleText}:x=(w-text_w)/2:y=${yLine}:fontsize=${titleFontSize}:fontcolor=white:borderw=4:bordercolor=black`);
    });

    drawTitle = drawParts.join(",");
  }
  
  // 3. Draw global subtitle centered in footer with fallback for emojis
  const subTextColor = (project.subtitleColor || "#ffff33").replace("#", "0x");
  const subFontSize = Math.round((project.subtitleFontSize || 28) * 0.17 * 7.2);

  const emojiFile = await getEmojiImage(rawSubEmoji);
  let drawSub = "";
  let emojiFilterChain = "";

  const subYOffset = (project.subtitleYOffset !== undefined ? project.subtitleYOffset : 0) * 2;

  if (rawSubText || emojiFile) {
    if (rawSubText) {
      if (emojiFile) {
        const textWidth = estimateWordWidth(rawSubText, subFontSize);
        const gap = Math.round(subFontSize * 0.35);
        const totalWidth = textWidth + gap + subFontSize;
        const startX = Math.round((720 - totalWidth) / 2);
        const emojiX = startX + textWidth + gap;

        drawSub = `drawtext=fontfile='${fontFile}':text=${escapeFfmpegText(rawSubText)}:x=${startX}:y=1190-text_h/2+${subYOffset}:fontsize=${subFontSize}:fontcolor=${subTextColor}:borderw=3:bordercolor=black`;
        const moviePath = emojiFile.replace(/\\/g, "/").replace(/:/g, "\\:");
        emojiFilterChain = `movie='${moviePath}',scale=${subFontSize}:${subFontSize}[emoji_scaled];[v_drawn][emoji_scaled]overlay=${emojiX}:${Math.round(1190 - subFontSize / 2 + subYOffset)}`;
      } else {
        drawSub = `drawtext=fontfile='${fontFile}':text=${escapeFfmpegText(rawSubText)}:x=(w-text_w)/2:y=1190-text_h/2+${subYOffset}:fontsize=${subFontSize}:fontcolor=${subTextColor}:borderw=3:bordercolor=black`;
      }
    } else if (emojiFile) {
      const startX = Math.round((720 - subFontSize) / 2);
      const moviePath = emojiFile.replace(/\\/g, "/").replace(/:/g, "\\:");
      emojiFilterChain = `movie='${moviePath}',scale=${subFontSize}:${subFontSize}[emoji_scaled];[v_drawn][emoji_scaled]overlay=${startX}:${Math.round(1190 - subFontSize / 2 + subYOffset)}`;
    }
  }

  // 4. Draw the left-side ranking list overlay
  const rankDrawFilters = [];
  const activeRank = block.rank; // The rank currently playing

  const rankListXPos = project.rankListXPos !== undefined ? project.rankListXPos : 20;
  const rankFontSize = Math.round((project.rankListFontSize || 36) * 0.139 * 7.2);

  const itemHeight = rankFontSize;
  const listSpacing = (project.rankListSpacing !== undefined ? project.rankListSpacing : 12) * 2;
  const sortedBlocks = [...blocks].sort((a, b) => a.rank - b.rank);
  const totalListHeight = sortedBlocks.length * itemHeight + (sortedBlocks.length - 1) * listSpacing;
  const middleCenterY = 180 + 920 / 2; // 640
  const startY = middleCenterY - totalListHeight / 2;

  sortedBlocks.forEach((b, index) => {
    let numColor = "white";
    if (b.rank === 1) numColor = "red";
    else if (b.rank === 2) numColor = "orange";
    else if (b.rank === 3) numColor = "yellow";

    const yPos = Math.round(startY + index * (itemHeight + listSpacing));
    const isActive = b.rank === activeRank;

    const fSize = String(rankFontSize);
    const bW = isActive ? "4" : "3";
    
    const numX = rankListXPos * 2;
    const textX = Math.round((rankListXPos + 22.5) * 2);

    // Draw number
    rankDrawFilters.push(`drawtext=fontfile='${fontFile}':text=${escapeFfmpegText(b.rank + ".")}:x=${numX}:y=${yPos}:fontsize=${fSize}:fontcolor=${numColor}:borderw=${bW}:bordercolor=black`);

    // Check if title is revealed (its rank is in playedRanks) AND is customized
    const isRevealed = playedRanks && playedRanks.includes(b.rank);
    const hasCustomTitle = b.title && b.title !== `Ranking Block #${b.rank}`;
    if (isRevealed && hasCustomTitle) {
      const escapedTitle = escapeFfmpegText(" " + b.title.toUpperCase());
      rankDrawFilters.push(`drawtext=fontfile='${fontFile}':text=${escapedTitle}:x=${textX}:y=${yPos}:fontsize=${fSize}:fontcolor=white:borderw=${bW}:bordercolor=black`);
    }
  });

  const rankOverlayFilters = rankDrawFilters.join(",");

  if (asset) {
    let videoPath = asset.url.startsWith("http")
      ? asset.url
      : path.join(VIDEO_DATA_DIR, path.basename(asset.url));

    let downloadedTempFile = null;
    if (videoPath.startsWith("http")) {
      const assetId = nanoid(6);
      const runTempDir = path.dirname(tempOut);
      downloadedTempFile = path.join(runTempDir, `input_${assetId}.mp4`);
      console.log(`[EXPORT] Downloading video asset to local disk to save memory: ${videoPath}`);
      await downloadFile(videoPath, downloadedTempFile);
      videoPath = downloadedTempFile;
    } else if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    try {
      const backdropOp = project.backdropOpacity !== undefined ? project.backdropOpacity : 45;
      const overlayDarkness = (100 - backdropOp) / 100;
      const blurSize = Math.max(1, project.backdropBlur !== undefined ? project.backdropBlur : 20);
      const scaledBlur = Math.max(1, Math.round(blurSize / 4));

      const speed = block.playbackSpeed !== undefined ? block.playbackSpeed : 1.0;
      const inputDuration = duration * speed;
      const setptsVal = (1 / speed).toFixed(4);
      const videoFilter = speed !== 1.0 ? `,setpts=${setptsVal}*PTS` : "";

      const drawTextChain = [drawBanners, drawTitle, drawSub, rankOverlayFilters].filter(Boolean).join(",");
      const filterComplex = emojiFilterChain
        ? `[0:v]split[bg][fg];[bg]scale=180:320:force_original_aspect_ratio=increase,crop=180:320,boxblur=${scaledBlur}:2,scale=720:1280,drawbox=color=0x0b0e14@${overlayDarkness}:t=fill${videoFilter}[bg_blurred];[fg]scale=720:920:force_original_aspect_ratio=decrease,setsar=1${videoFilter}[fg_scaled];[bg_blurred][fg_scaled]overlay=(W-w)/2:180+(920-h)/2[base];[base]${drawTextChain}[v_drawn];${emojiFilterChain}[v]`
        : `[0:v]split[bg][fg];[bg]scale=180:320:force_original_aspect_ratio=increase,crop=180:320,boxblur=${scaledBlur}:2,scale=720:1280,drawbox=color=0x0b0e14@${overlayDarkness}:t=fill${videoFilter}[bg_blurred];[fg]scale=720:920:force_original_aspect_ratio=decrease,setsar=1${videoFilter}[fg_scaled];[bg_blurred][fg_scaled]overlay=(W-w)/2:180+(920-h)/2[base];[base]${drawTextChain}[v]`;

      const audioArgs = speed !== 1.0 ? ["-af", getAtempoFilter(speed)] : [];

      try {
        // Attempt using original audio
        const args = [
          "-y",
          "-threads", "1",
          "-filter_threads", "1",
          "-ss", String(trimStart),
          "-t", String(inputDuration),
          "-i", videoPath,
          "-filter_complex", filterComplex,
          "-map", "[v]",
          "-map", "0:a",
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-tune", "fastdecode",
          "-rc-lookahead", "0",
          "-bf", "0",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          ...audioArgs,
          "-ar", "44100",
          "-ac", "2",
          "-r", "30",
          "-shortest",
          tempOut
        ];
        await runFfmpeg(args);
      } catch (err) {
        console.warn(`Failed to render segment with audio. Retrying with silence. Reason:`, err.message);
        // Fallback: merge with silent stereo audio stream
        const args = [
          "-y",
          "-threads", "1",
          "-filter_threads", "1",
          "-ss", String(trimStart),
          "-t", String(inputDuration),
          "-i", videoPath,
          "-f", "lavfi",
          "-i", "anullsrc=r=44100:cl=stereo",
          "-t", String(duration),
          "-filter_complex", filterComplex,
          "-map", "[v]",
          "-map", "1:a",
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-tune", "fastdecode",
          "-rc-lookahead", "0",
          "-bf", "0",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          ...audioArgs,
          "-ar", "44100",
          "-ac", "2",
          "-r", "30",
          "-shortest",
          tempOut
        ];
        await runFfmpeg(args);
      }
    } finally {
      if (downloadedTempFile && fs.existsSync(downloadedTempFile)) {
        try {
          fs.unlinkSync(downloadedTempFile);
          console.log(`[EXPORT] Cleaned up temporary download file: ${downloadedTempFile}`);
        } catch (unlinkErr) {
          console.error(`[EXPORT] Failed to delete temporary download file:`, unlinkErr);
        }
      }
    }
  } else {
    // Render high quality static slate block
    const blockTitleText = escapeFfmpegText((block.title || `Ranking Block #${block.rank}`).toUpperCase());
    const drawRankCenter = `drawtext=fontfile='${fontFile}':text=${escapeFfmpegText("RANK #" + block.rank)}:x=(w-text_w)/2:y=500:fontsize=72:fontcolor=0x40E0D0:borderw=4:bordercolor=black`;
    const drawBlockTitleCenter = `drawtext=fontfile='${fontFile}':text=${blockTitleText}:x=(w-text_w)/2:y=620:fontsize=36:fontcolor=white:borderw=3:bordercolor=black`;
    const drawNoMedia = `drawtext=fontfile='${fontFile}':text=${escapeFfmpegText("NO MEDIA ASSIGNED")}:x=(w-text_w)/2:y=800:fontsize=20:fontcolor=gray`;

    const drawTextChain = [drawBanners, drawTitle, drawSub, drawRankCenter, drawBlockTitleCenter, drawNoMedia, rankOverlayFilters].filter(Boolean).join(",");
    const filterComplex = emojiFilterChain
      ? `[0:v]${drawTextChain}[v_drawn];${emojiFilterChain}[v]`
      : `[0:v]${drawTextChain}[v]`;

    const args = [
      "-y",
      "-threads", "1",
      "-filter_threads", "1",
      "-f", "lavfi",
      "-i", `color=c=0x0b0e14:s=720x1280:d=${duration}:r=30`,
      "-f", "lavfi",
      "-i", "anullsrc=r=44100:cl=stereo",
      "-t", String(duration),
      "-filter_complex", filterComplex,
      "-map", "[v]",
      "-map", "1:a",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "fastdecode",
      "-rc-lookahead", "0",
      "-bf", "0",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-ar", "44100",
      "-ac", "2",
      tempOut
    ];
    await runFfmpeg(args);
  }
}

const exportJobs = new Map();

async function runExportInBackground(jobId, projectId, project, db) {
  let blocks = [...db.blocks].filter((b) => b.projectId === projectId).sort((a, b) => a.rank - b.rank);

  if (project.shuffleBlocks) {
    const rank1Block = blocks.find((b) => b.rank === 1);
    const otherBlocks = blocks.filter((b) => b.rank !== 1);
    
    // Deterministic shuffle using seeded random based on project ID
    const seed = project.id || "default";
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
    }
    const rnd = function() {
      let t = (h += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    for (let i = otherBlocks.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const temp = otherBlocks[i];
      otherBlocks[i] = otherBlocks[j];
      otherBlocks[j] = temp;
    }
    
    if (rank1Block) {
      blocks = [...otherBlocks, rank1Block];
    } else {
      blocks = otherBlocks;
    }
  }

  const mediaById = Object.fromEntries(db.media.map((m) => [m.id, m]));

  const exportId = nanoid(6);
  const runTempDir = path.join(TEMP_DIR, `export_${exportId}`);
  if (!fs.existsSync(runTempDir)) fs.mkdirSync(runTempDir, { recursive: true });

  const tempFiles = [];

  try {
    // 1. Render all block segments to temp mp4 files
    const playedRanks = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      playedRanks.push(b.rank);
      const asset = mediaById[b.mediaAssetId];
      const tempOut = path.join(runTempDir, `seg_${i}.mp4`);
      
      await renderSegment({ block: b, asset, project, blocks, playedRanks, tempOut });
      tempFiles.push(tempOut);
    }

    if (tempFiles.length === 0) {
      throw new Error("No ranking blocks to export");
    }

    // 2. Concatenate segments (applying transitions if configured)
    const mergedVideoPath = path.join(runTempDir, "merged_video.mp4");
    const hasTransitions = blocks.some((b, idx) => idx < blocks.length - 1 && b.transitionType && b.transitionType !== "none");

    if (hasTransitions) {
      console.log("[SERVER] Compiling video segments with transition filters complex graph");
      const inputArgs = [];
      tempFiles.forEach((f) => {
        inputArgs.push("-i", f);
      });

      let filterComplex = "";
      let vStream = "[0:v]";
      let aStream = "[0:a]";
      let currentDuration = blocks[0].duration;

      for (let i = 1; i < blocks.length; i++) {
        const prevBlock = blocks[i - 1];
        const nextBlock = blocks[i];
        
        const type = prevBlock.transitionType || "none";
        const isNone = type === "none";
        const dur = isNone ? 0.02 : (prevBlock.transitionDuration !== undefined ? prevBlock.transitionDuration : 0.5);
        
        const offset = currentDuration - dur;
        const outV = `v_trans_${i}`;
        const outA = `a_trans_${i}`;

        let transitionName = type;
        if (type === "none" || type === "fade") {
          transitionName = "fade";
        }

        filterComplex += (filterComplex ? ";" : "") + 
          `${vStream}[${i}:v]xfade=transition=${transitionName}:duration=${dur}:offset=${offset.toFixed(2)}[${outV}];` +
          `${aStream}[${i}:a]acrossfade=d=${dur}:c1=tri:c2=tri[${outA}]`;

        vStream = `[${outV}]`;
        aStream = `[${outA}]`;
        currentDuration = currentDuration + nextBlock.duration - dur;
      }

      const complexArgs = [
        "-y",
        "-threads", "1",
        "-filter_threads", "1",
        ...inputArgs,
        "-filter_complex", filterComplex,
        "-map", vStream,
        "-map", aStream,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-tune", "fastdecode",
        "-rc-lookahead", "0",
        "-bf", "0",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-ar", "44100",
        "-ac", "2",
        mergedVideoPath
      ];
      await runFfmpeg(complexArgs);
    } else {
      console.log("[SERVER] Compiling video segments using fast concat demuxer");
      const concatTxtPath = path.join(runTempDir, "concat.txt");
      const concatContent = tempFiles.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n");
      fs.writeFileSync(concatTxtPath, concatContent);

      const concatArgs = [
        "-y",
        "-threads", "1",
        "-f", "concat",
        "-safe", "0",
        "-i", concatTxtPath,
        "-c", "copy",
        mergedVideoPath
      ];
      await runFfmpeg(concatArgs);
    }

    // 4. Mix background music if present
    const musicAsset = mediaById[project.backgroundMusicId];
    const finalOutPath = path.join(runTempDir, "final_export.mp4");

    if (musicAsset) {
      const musicPath = musicAsset.url.startsWith("http")
        ? musicAsset.url
        : path.join(VIDEO_DATA_DIR, path.basename(musicAsset.url));
      if (musicPath.startsWith("http") || fs.existsSync(musicPath)) {
        const isHttp = musicPath.startsWith("http");
        const mixArgs = [
          "-y",
          "-threads", "1",
          "-i", mergedVideoPath,
          "-stream_loop", "-1",
          ...(isHttp ? ["-tls_verify", "0"] : []),
          "-i", musicPath,
          "-filter_complex", "[1:a]volume=0.15[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[a]",
          "-map", "0:v",
          "-map", "[a]",
          "-c:v", "copy",
          "-c:a", "aac",
          "-shortest",
          finalOutPath
        ];
        await runFfmpeg(mixArgs);
      } else {
        fs.renameSync(mergedVideoPath, finalOutPath);
      }
    } else {
      fs.renameSync(mergedVideoPath, finalOutPath);
    }

    const outputFilename = `${project.name.replace(/\s+/g, "_")}.mp4`;
    exportJobs.set(jobId, { status: "completed", filePath: finalOutPath, filename: outputFilename });
    console.log(`[SERVER] Export job ${jobId} completed successfully.`);
  } catch (err) {
    console.error(`Export process failed for job ${jobId}:`, err);
    exportJobs.set(jobId, { status: "failed", error: err.message });
    // Cleanup temp files on failure
    try {
      fs.rmSync(runTempDir, { recursive: true, force: true });
    } catch (rmErr) {
      console.error("Cleanup failed:", rmErr);
    }
  }
}

router.get("/", async (req, res) => {
  try {
    console.log(`[EXPORT] Received export request for projectId: ${req.query.projectId}`);
    const db = await readDb();
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: "projectId is required" });
    
    const project = (db.projects || []).find((p) => p.id === projectId);
    if (!project) {
      console.warn(`[EXPORT] Project not found in database: ${projectId}`);
      return res.status(404).json({ error: "Project not found" });
    }

    const jobId = nanoid(8);
    exportJobs.set(jobId, { status: "pending", error: null });

    console.log(`[EXPORT] Starting background job ${jobId} for project: ${project.name}`);
    runExportInBackground(jobId, projectId, project, db).catch(err => {
      console.error("Uncaught background export error:", err);
    });

    res.status(202).json({ jobId });
  } catch (err) {
    console.error("[EXPORT] Failed to initialize export:", err);
    res.status(500).json({ error: `Failed to start export: ${err.message}` });
  }
});

router.get("/status", (req, res) => {
  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: "jobId is required" });
  const job = exportJobs.get(jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

router.get("/download", (req, res) => {
  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: "jobId is required" });
  const job = exportJobs.get(jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status !== "completed") return res.status(400).json({ error: "Job is not completed yet" });

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Disposition", `attachment; filename="${job.filename}"`);
  
  res.sendFile(job.filePath, (err) => {
    if (err) console.error("Error sending file:", err);
    try {
      const runTempDir = path.dirname(job.filePath);
      fs.rmSync(runTempDir, { recursive: true, force: true });
      exportJobs.delete(jobId);
    } catch (rmErr) {
      console.error("Cleanup failed:", rmErr);
    }
  });
});

export default router;
