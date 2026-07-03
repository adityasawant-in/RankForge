import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dest = path.join(__dirname, "yt-dlp");

async function download() {
  console.log("Downloading yt-dlp binary...");
  const url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download yt-dlp: ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buffer));
  fs.chmodSync(dest, "755");
  console.log("yt-dlp binary downloaded successfully to", dest);
}

download().catch((err) => {
  console.error("Failed to download yt-dlp:", err.message);
  process.exit(1);
});
