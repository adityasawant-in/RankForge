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

async function uploadToSupabase(filePath, fileName, mimeType) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const cleanUrl = supabaseUrl.replace(/\/$/, "");
  const uploadUrl = `${cleanUrl}/storage/v1/object/media/${fileName}`;
  const fileBuffer = fs.readFileSync(filePath);

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${supabaseKey}`,
      "apikey": supabaseKey,
      "Content-Type": mimeType
    },
    body: fileBuffer
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase upload failed: ${errText}`);
  }

  return `${cleanUrl}/storage/v1/object/public/media/${fileName}`;
}

async function deleteFromSupabase(url) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey || !url.includes("supabase.co")) return;

  try {
    const cleanUrl = supabaseUrl.replace(/\/$/, "");
    const parts = url.split("/public/media/");
    if (parts.length < 2) return;
    const fileName = parts[1];

    const deleteUrl = `${cleanUrl}/storage/v1/object/media/${fileName}`;
    await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${supabaseKey}`,
        "apikey": supabaseKey
      }
    });
  } catch (err) {
    console.error("Failed to delete asset from Supabase Storage:", err.message);
  }
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const localPath = path.join(__dirname, "..", "..", "yt-dlp");
    let cmd, finalArgs;
    if (fs.existsSync(localPath)) {
      cmd = localPath;
      finalArgs = args;
    } else {
      cmd = process.platform === "win32" ? "python" : "python3";
      finalArgs = ["-m", "yt_dlp", ...args];
    }

    console.log(`[YT-DLP] Executing: ${cmd} ${finalArgs.join(" ")}`);
    execFile(cmd, finalArgs, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(stderr || error.message));
      }
      resolve(stdout);
    });
  });
}

function downloadVideo(url, outputPath) {
  return new Promise(async (resolve, reject) => {
    const cookieSources = [null, "chrome", "edge", "firefox", "brave", "opera"];
    let lastError = null;

    for (const source of cookieSources) {
      try {
        const args = ["-f", "best[ext=mp4]/best", "-o", outputPath];
        if (source) {
          args.push("--cookies-from-browser", source);
        }
        args.push(url);

        console.log(`[DOWNLOAD] Trying to download with cookie source: ${source || "none"}`);
        await runYtDlp(args);
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
        const args = ["--get-title"];
        if (source) {
          args.push("--cookies-from-browser", source);
        }
        args.push(url);
        const title = await runYtDlp(args);
        if (title) return resolve(title.trim());
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

router.get("/", async (req, res) => {
  const db = await readDb();
  res.json(db.media);
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const db = await readDb();
    const isAudio = req.file.mimetype.startsWith("audio");
    let assetUrl = `/uploads/${req.file.filename}`;

    // Upload to Supabase Storage if configured
    const cloudUrl = await uploadToSupabase(req.file.path, req.file.filename, req.file.mimetype);
    if (cloudUrl) {
      assetUrl = cloudUrl;
      // Clean up the local file immediately
      fs.unlinkSync(req.file.path);
    }

    const asset = {
      id: "med-" + nanoid(8),
      name: req.body.name || req.file.originalname,
      type: isAudio ? "audio" : "video",
      url: assetUrl,
      mimetype: req.file.mimetype,
      createdAt: Date.now()
    };
    db.media.push(asset);
    await writeDb(db);
    res.status(201).json(asset);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: `Failed to upload media: ${err.message}` });
  }
});

router.post("/import-url", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const filename = `${Date.now()}-${nanoid(6)}.mp4`;
    const outputPath = path.join(VIDEO_DATA_DIR, filename);

    const [title] = await Promise.all([
      getVideoTitle(url).catch(() => "Imported Video"),
      downloadVideo(url, outputPath)
    ]);

    if (!fs.existsSync(outputPath)) {
      throw new Error("Downloaded file was not found on disk");
    }

    const db = await readDb();
    let assetUrl = `/uploads/${filename}`;

    // Upload to Supabase Storage if configured
    const cloudUrl = await uploadToSupabase(outputPath, filename, "video/mp4");
    if (cloudUrl) {
      assetUrl = cloudUrl;
      // Clean up the local file immediately
      fs.unlinkSync(outputPath);
    }

    const asset = {
      id: "med-" + nanoid(8),
      name: title || "Imported Video",
      type: "video",
      url: assetUrl,
      mimetype: "video/mp4",
      createdAt: Date.now()
    };
    db.media.push(asset);
    await writeDb(db);

    res.status(201).json(asset);
  } catch (err) {
    console.error("Error importing URL:", err);
    res.status(500).json({ error: `Failed to import video: ${err.message}` });
  }
});

router.delete("/:id", async (req, res) => {
  const db = await readDb();
  const asset = db.media.find((m) => m.id === req.params.id);
  if (asset) {
    if (asset.url.startsWith("http")) {
      await deleteFromSupabase(asset.url);
    } else {
      const filePath = path.join(VIDEO_DATA_DIR, path.basename(asset.url));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
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
  await writeDb(db);
  res.status(204).end();
});

export default router;
