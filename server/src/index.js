import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { readDb, acquireLock } from "./db.js";
import authMiddleware from "./middleware/authMiddleware.js";
import authRouter from "./routes/auth.js";
import projectRouter from "./routes/project.js";
import blocksRouter from "./routes/blocks.js";
import mediaRouter from "./routes/media.js";
import exportRouter from "./routes/export.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VIDEO_DATA_DIR = path.join(__dirname, "..", "content", "video_data");
const TEST_DIR = path.join(__dirname, "..", "content", "test");
if (!fs.existsSync(VIDEO_DATA_DIR)) fs.mkdirSync(VIDEO_DATA_DIR, { recursive: true });
if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });

// Migrate old uploads files to content/video_data if folder exists
const oldUploadsDir = path.join(__dirname, "..", "uploads");
if (fs.existsSync(oldUploadsDir)) {
  try {
    const files = fs.readdirSync(oldUploadsDir);
    files.forEach((file) => {
      const oldPath = path.join(oldUploadsDir, file);
      const newPath = path.join(VIDEO_DATA_DIR, file);
      if (fs.statSync(oldPath).isFile()) {
        try {
          fs.renameSync(oldPath, newPath);
        } catch {
          fs.copyFileSync(oldPath, newPath);
          fs.unlinkSync(oldPath);
        }
      }
    });
    fs.rmdirSync(oldUploadsDir);
  } catch (e) {
    console.warn("Migration warning:", e.message);
  }
}

import { execSync } from "child_process";
import ffmpegPath from "ffmpeg-static";
try {
  const nodeVer = execSync("node -v").toString().trim();
  console.log(`[DIAGNOSTIC] Global node: ${nodeVer}`);
} catch (err) {
  console.error(`[DIAGNOSTIC] Global node check failed: ${err.message}`);
}
try {
  const nodePath = execSync("which node").toString().trim();
  console.log(`[DIAGNOSTIC] which node: ${nodePath}`);
} catch (err) {
  console.error(`[DIAGNOSTIC] which node failed: ${err.message}`);
}
console.log(`[DIAGNOSTIC] process.execPath: ${process.execPath}`);

const localLinuxFfmpeg = path.resolve(__dirname, "..", "ffmpeg");
console.log(`[DIAGNOSTIC] Local Linux FFmpeg path: ${localLinuxFfmpeg}, exists: ${fs.existsSync(localLinuxFfmpeg)}`);
try {
  console.log(`[DIAGNOSTIC] Files in server directory:`, fs.readdirSync(path.resolve(__dirname, "..")));
} catch (dirErr) {
  console.error(`[DIAGNOSTIC] Failed to read server directory: ${dirErr.message}`);
}

const selectedFfmpeg = process.env.FFMPEG_PATH || (fs.existsSync(localLinuxFfmpeg) ? localLinuxFfmpeg : ffmpegPath);

try {
  const filters = execSync(`"${selectedFfmpeg}" -filters`).toString();
  const hasDrawtext = filters.includes("drawtext");
  console.log(`[DIAGNOSTIC] FFmpeg binary at ${selectedFfmpeg} has drawtext support: ${hasDrawtext}`);
} catch (err) {
  console.error(`[DIAGNOSTIC] FFmpeg filters check failed: ${err.message}`);
}

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
}, express.static(VIDEO_DATA_DIR));

app.use("/api/auth", authRouter);

const writeLockMiddleware = async (req, res, next) => {
  if (!req.user || !req.user.id) return next();
  
  const release = await acquireLock(req.user.id);
  
  const originalJson = res.json;
  const originalSend = res.send;
  const originalEnd = res.end;
  
  let released = false;
  const doRelease = () => {
    if (!released) {
      released = true;
      release();
    }
  };
  
  res.json = function(...args) {
    doRelease();
    return originalJson.apply(this, args);
  };
  
  res.send = function(...args) {
    doRelease();
    return originalSend.apply(this, args);
  };
  
  res.end = function(...args) {
    doRelease();
    return originalEnd.apply(this, args);
  };
  
  req.on("close", doRelease);
  next();
};

app.use("/api/project", authMiddleware, writeLockMiddleware, projectRouter);
app.use("/api/blocks", authMiddleware, writeLockMiddleware, blocksRouter);
app.use("/api/media", authMiddleware, writeLockMiddleware, mediaRouter);
app.use("/api/export", (req, res, next) => {
  if (req.path === "/download") return next();
  return authMiddleware(req, res, next);
}, writeLockMiddleware, exportRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/debug/db", async (req, res) => {
  try {
    if (process.env.DATABASE_URL) {
      const pg = await import("pg");
      const client = new pg.default.Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes("supabase") ? { rejectUnauthorized: false } : false
      });
      await client.connect();
      try {
        const users = await client.query("SELECT id, username FROM users");
        const projects = await client.query("SELECT id, name, \"userId\" FROM projects");
        const blocks = await client.query("SELECT id, \"projectId\", rank, title FROM blocks");
        const media = await client.query("SELECT id, name, url FROM media");
        return res.json({
          users: users.rows,
          projects: projects.rows,
          blocks: blocks.rows,
          media: media.rows
        });
      } finally {
        await client.end();
      }
    }
    const db = await readDb("Aditya@123");
    res.json({
      local: true,
      media: db.media,
      projects: db.projects,
      blocks: db.blocks
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`RankForge API running on http://localhost:${PORT}`));
