import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dest = path.join(__dirname, "yt-dlp");
const fontDest = path.join(__dirname, "data", "font.ttf");

// Ensure data folder exists
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function download() {
  console.log("Downloading yt-dlp binary...");
  const url = "https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download yt-dlp: ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buffer));
  fs.chmodSync(dest, "755");
  console.log("yt-dlp binary downloaded successfully to", dest);

  console.log("Downloading Roboto-Bold.ttf font...");
  const fontUrl = "https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf";
  const fontRes = await fetch(fontUrl);
  if (!fontRes.ok) {
    throw new Error(`Failed to download font: ${fontRes.statusText}`);
  }
  const fontBuffer = await fontRes.arrayBuffer();
  fs.writeFileSync(fontDest, Buffer.from(fontBuffer));
  console.log("Roboto-Bold.ttf font downloaded successfully to", fontDest);

  if (process.platform === "linux") {
    console.log("Downloading official BtbN full static FFmpeg build for Linux...");
    const archivePath = path.join(__dirname, "ffmpeg.tar.xz");
    const ffmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz";
    
    const ffmpegRes = await fetch(ffmpegUrl);
    if (!ffmpegRes.ok) {
      throw new Error(`Failed to download static FFmpeg: ${ffmpegRes.statusText}`);
    }
    const ffmpegBuffer = await ffmpegRes.arrayBuffer();
    fs.writeFileSync(archivePath, Buffer.from(ffmpegBuffer));
    console.log("Archive downloaded. Extracting using tar...");

    const extractTempDir = path.join(__dirname, "ffmpeg_temp");
    if (!fs.existsSync(extractTempDir)) fs.mkdirSync(extractTempDir, { recursive: true });
    
    execSync(`tar -xJf "${archivePath}" -C "${extractTempDir}"`);
    
    const subdirs = fs.readdirSync(extractTempDir);
    const buildDirName = subdirs.find(d => d.includes("ffmpeg") || d.includes("static"));
    if (buildDirName) {
      const pathWithBin = path.join(extractTempDir, buildDirName, "bin", "ffmpeg");
      const pathWithoutBin = path.join(extractTempDir, buildDirName, "ffmpeg");
      const srcFfmpeg = fs.existsSync(pathWithBin) ? pathWithBin : pathWithoutBin;
      
      const destFfmpeg = path.join(__dirname, "ffmpeg");
      fs.copyFileSync(srcFfmpeg, destFfmpeg);
      fs.chmodSync(destFfmpeg, "755");
      console.log("Official BtbN FFmpeg binary successfully installed to", destFfmpeg);
    }
    
    // Cleanup
    fs.rmSync(archivePath, { force: true });
    fs.rmSync(extractTempDir, { recursive: true, force: true });
  }
}

download().catch((err) => {
  console.error("Failed to download dependencies:", err.message);
  process.exit(1);
});
