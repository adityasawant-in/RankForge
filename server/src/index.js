import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
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

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(VIDEO_DATA_DIR));

app.use("/api/project", projectRouter);
app.use("/api/blocks", blocksRouter);
app.use("/api/media", mediaRouter);
app.use("/api/export", exportRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`RankForge API running on http://localhost:${PORT}`));
