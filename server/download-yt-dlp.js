import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
}

download().catch((err) => {
  console.error("Failed to download dependencies:", err.message);
  process.exit(1);
});
