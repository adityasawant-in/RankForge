import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "db.json");

function defaultData() {
  return {
    project: {
      id: "project-1",
      name: "Unexpected Trickshots 2024",
      videoTitle: "Ranking Best Unexpected Trickshots",
      titleFont: "Geist Bold",
      titleFontSize: 24,
      titleOverlay: { x: 10, y: 6, w: 80, h: 16 },
      subtitleText: "Over Excited",
      subtitleEmoji: "😂",
      backgroundMusicId: null,
      totalDurationTarget: 15,
      headerBgColor: "#000000",
      highlightWords: "",
      highlightColor1: "#ff3333",
      highlightColor2: "#ffff33",
      subtitleFont: "Geist Bold",
      subtitleFontSize: 28,
      subtitleColor: "#ffff33",
      subtitleBgColor: "rgba(0,0,0,0.8)",
      rankListSpacing: 12,
      backdropOpacity: 45,
      backdropBlur: 20,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    blocks: [
      { id: "blk-1", projectId: "project-1", rank: 1, title: "Water Bottle Flip Champion", duration: 12, mediaAssetId: null },
      { id: "blk-2", projectId: "project-1", rank: 2, title: "Ranking Block #2", duration: 10, mediaAssetId: null },
      { id: "blk-3", projectId: "project-1", rank: 3, title: "Ranking Block #3", duration: 10, mediaAssetId: null },
      { id: "blk-4", projectId: "project-1", rank: 4, title: "Ranking Block #4", duration: 10, mediaAssetId: null },
      { id: "blk-5", projectId: "project-1", rank: 5, title: "Ranking Block #5", duration: 10, mediaAssetId: null },
      { id: "blk-6", projectId: "project-1", rank: 6, title: "Ranking Block #6", duration: 10, mediaAssetId: null },
      { id: "blk-7", projectId: "project-1", rank: 7, title: "Ranking Block #7", duration: 10, mediaAssetId: null }
    ],
    media: []
  };
}

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const data = defaultData();
    data.projects = [data.project];
    delete data.project;
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      if (data.project && !data.projects) {
        data.projects = [data.project];
        delete data.project;
        data.blocks.forEach((b) => {
          if (!b.projectId) b.projectId = "project-1";
        });
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.error("Failed to migrate database schema:", err.message);
    }
  }
}

export function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

export function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  return data;
}
