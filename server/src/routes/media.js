import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import { readDb, writeDb } from "../db.js";
import { execFile } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_DATA_DIR = path.join(__dirname, "..", "..", "content", "video_data");
if (!fs.existsSync(VIDEO_DATA_DIR)) fs.mkdirSync(VIDEO_DATA_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEO_DATA_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${nanoid(6)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

const router = Router();

function downloadVideo(url, outputPath) {
  return new Promise(async (resolve, reject) => {
    const cookieSources = [null, "chrome", "edge", "firefox", "brave", "opera"];
    let lastError = null;

    for (const source of cookieSources) {
      try {
        await new Promise((res, rej) => {
          const args = ["-m", "yt_dlp", "-f", "best[ext=mp4]/best", "-o", outputPath];
          if (source) {
            args.push("--cookies-from-browser", source);
          }
          args.push(url);

          console.log(`[DOWNLOAD] Trying to download with cookie source: ${source || "none"}`);
          execFile("python", args, (error, stdout, stderr) => {
            if (error) {
              console.warn(`[DOWNLOAD] Failed with source ${source || "none"}:`, stderr || error.message);
              return rej(new Error(stderr || error.message));
            }
            res(stdout);
          });
        });
        console.log(`[DOWNLOAD] Succeeded using cookie source: ${source || "none"}`);
        return resolve();
      } catch (err) {
        lastError = err;
      }
    }

    reject(new Error(`Failed to download video from URL after trying all browser cookie backups. Error: ${lastError?.message}`));
  });
}

function getVideoTitle(url) {
  return new Promise(async (resolve) => {
    const cookieSources = [null, "chrome", "edge", "firefox", "brave", "opera"];
    for (const source of cookieSources) {
      try {
        const title = await new Promise((res, rej) => {
          const args = ["-m", "yt_dlp", "--get-title"];
          if (source) {
            args.push("--cookies-from-browser", source);
          }
          args.push(url);
          execFile("python", args, (error, stdout, stderr) => {
            if (error) return rej(error);
            res(stdout.trim());
          });
        });
        if (title) return resolve(title);
      } catch {
        // Continue
      }
    }
    try {
      const parsed = new URL(url);
      resolve(parsed.pathname.split("/").pop() || "Imported Video");
    } catch {
      resolve("Imported Video");
    }
  });
}

router.get("/", (req, res) => {
  const db = readDb();
  res.json(db.media);
});

router.post("/upload", upload.single("file"), (req, res) => {
  const db = readDb();
  const isAudio = req.file.mimetype.startsWith("audio");
  const asset = {
    id: "med-" + nanoid(8),
    name: req.body.name || req.file.originalname,
    type: isAudio ? "audio" : "video",
    url: `/uploads/${req.file.filename}`,
    mimetype: req.file.mimetype,
    createdAt: Date.now()
  };
  db.media.push(asset);
  writeDb(db);
  res.status(201).json(asset);
});

router.post("/import-url", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const filename = `${Date.now()}-${nanoid(6)}.mp4`;
    const outputPath = path.join(VIDEO_DATA_DIR, filename);

    // Fetch video title and download concurrently
    const [title] = await Promise.all([
      getVideoTitle(url).catch(() => "Imported Video"),
      downloadVideo(url, outputPath)
    ]);

    if (!fs.existsSync(outputPath)) {
      throw new Error("Downloaded file was not found on disk");
    }

    const db = readDb();
    const asset = {
      id: "med-" + nanoid(8),
      name: title || "Imported Video",
      type: "video",
      url: `/uploads/${filename}`,
      mimetype: "video/mp4",
      createdAt: Date.now()
    };
    db.media.push(asset);
    writeDb(db);

    res.status(201).json(asset);
  } catch (err) {
    console.error("Error importing URL:", err);
    res.status(500).json({ error: `Failed to import video: ${err.message}` });
  }
});

router.delete("/:id", (req, res) => {
  const db = readDb();
  const asset = db.media.find((m) => m.id === req.params.id);
  if (asset) {
    const filePath = path.join(VIDEO_DATA_DIR, path.basename(asset.url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.media = db.media.filter((m) => m.id !== req.params.id);
  db.blocks.forEach((b) => {
    if (b.mediaAssetId === req.params.id) b.mediaAssetId = null;
  });
  if (db.projects) {
    db.projects.forEach((p) => {
      if (p.backgroundMusicId === req.params.id) p.backgroundMusicId = null;
    });
  }
  writeDb(db);
  res.status(204).end();
});

export default router;
