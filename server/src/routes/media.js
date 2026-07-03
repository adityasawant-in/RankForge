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
const TEMP_DIR = path.join(__dirname, "..", "..", "temp");
if (!fs.existsSync(VIDEO_DATA_DIR)) fs.mkdirSync(VIDEO_DATA_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

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
    if (process.platform !== "win32" && fs.existsSync(localPath)) {
      cmd = localPath;
      finalArgs = [...args];
    } else {
      cmd = process.platform === "win32" ? "python" : "python3";
      finalArgs = ["-m", "yt_dlp", ...args];
    }

    // Solve JS signatures using remote ejs package on GitHub
    finalArgs.push("--remote-components", "ejs:github");
    finalArgs.push("--js-runtimes", "node");
    finalArgs.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    finalArgs.push("-v");

    let cookiesPath = null;
    const localCookies = path.join(__dirname, "..", "..", "cookies.txt");
    const repoCookies = path.join(__dirname, "..", "..", "..", "cookies.txt");
    let finalCookiesPath = null;

    if (fs.existsSync(localCookies)) {
      finalCookiesPath = localCookies;
    } else if (fs.existsSync(repoCookies)) {
      finalCookiesPath = repoCookies;
    }

    if (finalCookiesPath) {
      console.log(`[YT-DLP] Using local secret cookies file: ${finalCookiesPath}`);
      finalArgs.push("--cookies", finalCookiesPath);
    } else if (process.env.YOUTUBE_COOKIES) {
      cookiesPath = path.join(TEMP_DIR, `cookies-${Date.now()}-${nanoid(4)}.txt`);
      try {
        fs.writeFileSync(cookiesPath, process.env.YOUTUBE_COOKIES, "utf8");
        finalArgs.push("--cookies", cookiesPath);
      } catch (cErr) {
        console.error("Failed to write temporary cookies file:", cErr.message);
      }
    }

    const nodeDir = path.dirname(process.execPath);
    const customPath = `${nodeDir}${path.delimiter}${process.env.PATH || ""}`;
    const execOptions = {
      env: {
        ...process.env,
        PATH: customPath,
        HOME: TEMP_DIR,
        XDG_CONFIG_HOME: TEMP_DIR,
        XDG_CACHE_HOME: TEMP_DIR
      }
    };

    console.log(`[YT-DLP] Executing: ${cmd} ${finalArgs.join(" ")}`);
    execFile(cmd, finalArgs, execOptions, (error, stdout, stderr) => {
      if (cookiesPath && fs.existsSync(cookiesPath)) {
        try {
          fs.unlinkSync(cookiesPath);
        } catch {}
      }

      if (error) {
        return reject(new Error(stderr || error.message));
      }
      resolve(stdout);
    });
  });
}

async function downloadViaCobalt(url, outputPath) {
  console.log(`[COBALT] Attempting direct download for: ${url}`);
  const response = await fetch("https://api.cobalt.tools/", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: url,
      videoQuality: "720",
      downloadMode: "video"
    })
  });

  if (!response.ok) {
    throw new Error(`Cobalt API failed with status ${response.status}`);
  }

  const data = await response.json();
  if (data.status === "error") {
    throw new Error(data.text || "Cobalt API returned error status");
  }

  const streamUrl = data.url;
  if (!streamUrl) {
    throw new Error("Cobalt API did not return a stream URL");
  }

  console.log(`[COBALT] Downloading stream from: ${streamUrl}`);
  const fileRes = await fetch(streamUrl);
  if (!fileRes.ok) {
    throw new Error(`Failed to download stream from Cobalt: ${fileRes.statusText}`);
  }

  const buffer = await fileRes.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  console.log(`[COBALT] Download completed successfully via Cobalt to: ${outputPath}`);
}

function downloadVideo(url, outputPath) {
  return new Promise(async (resolve, reject) => {
    const cookieSources = (process.platform === "win32")
      ? [null, "chrome", "edge", "firefox", "brave", "opera"]
      : [null];
    let lastError = null;

    for (const source of cookieSources) {
      try {
        const args = ["-f", "best[ext=mp4]/best", "-o", outputPath];
        if (source) {
          args.push("--cookies-from-browser", source);
        }
        if (url.includes("youtube.com") || url.includes("youtu.be")) {
          args.push("--extractor-args", "youtube:player_client=default,-android_sdkless");
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

    // Fall back to Cobalt API if yt-dlp fails
    console.warn(`[DOWNLOAD] yt-dlp failed: ${lastError?.message}. Falling back to Cobalt API...`);
    try {
      await downloadViaCobalt(url, outputPath);
      resolve();
    } catch (cobaltErr) {
      reject(new Error(`Failed to download video. yt-dlp error: ${lastError?.message || "unknown"}. Cobalt error: ${cobaltErr.message}`));
    }
  });
}

function getVideoTitle(url) {
  return new Promise(async (resolve) => {
    const cookieSources = (process.platform === "win32")
      ? [null, "chrome", "edge", "firefox", "brave", "opera"]
      : [null];
    for (const source of cookieSources) {
      try {
        const args = ["--get-title"];
        if (source) {
          args.push("--cookies-from-browser", source);
        }
        if (url.includes("youtube.com") || url.includes("youtu.be")) {
          args.push("--extractor-args", "youtube:player_client=default,-android_sdkless");
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

    const title = await getVideoTitle(url).catch(() => "Imported Video");
    await downloadVideo(url, outputPath);

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
