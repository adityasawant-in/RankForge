import { Router } from "express";
import { nanoid } from "nanoid";
import { readDb, writeDb } from "../db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();

// GET all projects
router.get("/list", (req, res) => {
  const db = readDb();
  res.json(db.projects || []);
});

// GET single project
router.get("/:id", (req, res) => {
  const db = readDb();
  const p = (db.projects || []).find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Project not found" });
  res.json(p);
});

// POST create new project
router.post("/", (req, res) => {
  const db = readDb();
  if (!db.projects) db.projects = [];
  
  const newProject = {
    id: "project-" + nanoid(8),
    name: req.body.name || "New Video Project",
    videoTitle: "Ranking Best Unexpected Moments",
    titleFont: "Roboto",
    titleFontSize: 32,
    titleOverlay: { x: 10, y: 6, w: 80, h: 16 },
    subtitleText: "Over Excited",
    subtitleEmoji: "😂",
    backgroundMusicId: null,
    totalDurationTarget: 15,
    headerBgColor: "#000000",
    highlightWords: "",
    highlightColor1: "#ff3333",
    highlightColor2: "#ffff33",
    subtitleFont: "Roboto",
    subtitleFontSize: 28,
    subtitleColor: "#ffff33",
    subtitleBgColor: "rgba(0,0,0,0.8)",
    rankListSpacing: 12,
    rankListXPos: 20,
    rankListFontSize: 36,
    backdropOpacity: 45,
    backdropBlur: 20,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  db.projects.push(newProject);
  writeDb(db);
  res.status(201).json(newProject);
});

// PUT update project
router.put("/:id", (req, res) => {
  const db = readDb();
  if (!db.projects) db.projects = [];
  const idx = db.projects.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Project not found" });
  
  db.projects[idx] = {
    ...db.projects[idx],
    ...req.body,
    id: db.projects[idx].id,
    updatedAt: Date.now()
  };
  writeDb(db);
  res.json(db.projects[idx]);
});

// DELETE project
router.delete("/:id", (req, res) => {
  const db = readDb();
  if (!db.projects) db.projects = [];
  
  // Find all blocks for this project
  const projectBlocks = db.blocks.filter((b) => b.projectId === req.params.id);
  
  // Collect all mediaAssetIds referenced by this project
  const projectMediaIds = projectBlocks.map((b) => b.mediaAssetId).filter(Boolean);
  
  // Also collect background music of this project
  const targetProj = db.projects.find((p) => p.id === req.params.id);
  if (targetProj && targetProj.backgroundMusicId) {
    projectMediaIds.push(targetProj.backgroundMusicId);
  }
  
  // For each media asset, check if it's referenced by any blocks in OTHER projects
  const otherBlocks = db.blocks.filter((b) => b.projectId !== req.params.id);
  const otherMediaIds = new Set(otherBlocks.map((b) => b.mediaAssetId).filter(Boolean));
  
  // If a background music is configured for other projects, check that too
  db.projects.forEach((proj) => {
    if (proj.id !== req.params.id && proj.backgroundMusicId) {
      otherMediaIds.add(proj.backgroundMusicId);
    }
  });

  const mediaToDelete = projectMediaIds.filter((id) => !otherMediaIds.has(id));

  // Physically delete the files for those media assets
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const VIDEO_DATA_DIR = path.join(__dirname, "..", "..", "content", "video_data");
  
  mediaToDelete.forEach((mediaId) => {
    const asset = db.media.find((m) => m.id === mediaId);
    if (asset) {
      const filePath = path.join(VIDEO_DATA_DIR, path.basename(asset.url));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Deleted media asset file: ${filePath}`);
        } catch (err) {
          console.error(`Failed to delete media asset file: ${filePath}`, err.message);
        }
      }
    }
  });

  // Remove the media records from the database
  db.media = db.media.filter((m) => !mediaToDelete.includes(m.id));

  // Filter out the project and its blocks
  db.projects = db.projects.filter((x) => x.id !== req.params.id);
  db.blocks = db.blocks.filter((b) => b.projectId !== req.params.id);
  
  writeDb(db);
  res.status(204).end();
});

export default router;
