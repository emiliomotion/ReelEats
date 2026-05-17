const express = require("express");
const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const execFileAsync = promisify(execFile);
const app = express();
app.use(express.json());

const SECRET = process.env.DOWNLOAD_SERVICE_SECRET;

// Auth middleware
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const authHeader = req.headers.authorization;
  if (!SECRET || authHeader !== `Bearer ${SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/download", async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url required" });
  }

  const tmpDir = path.join(os.tmpdir(), `reel_${crypto.randomBytes(8).toString("hex")}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // Step 1: Download reel with yt-dlp
    const videoPath = path.join(tmpDir, "video.mp4");
    const infoPath = path.join(tmpDir, "info.json");

    await execFileAsync("yt-dlp", [
      url,
      "--output", videoPath,
      "--write-info-json",
      "--write-thumbnail",
      "--convert-thumbnails", "jpg",
      "--no-playlist",
      "--max-filesize", "200m",
      "--merge-output-format", "mp4",
    ], { timeout: 60_000 });

    // Parse metadata
    const infoFiles = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".info.json"));
    let caption = "";
    let creatorHandle = "";
    if (infoFiles.length > 0) {
      const info = JSON.parse(fs.readFileSync(path.join(tmpDir, infoFiles[0]), "utf8"));
      caption = info.description ?? "";
      creatorHandle = info.uploader_id ?? info.uploader ?? "";
    }

    // Step 2: Extract audio as 16kHz mono WAV for Whisper
    const audioPath = path.join(tmpDir, "audio.wav");
    await execFileAsync("ffmpeg", [
      "-i", videoPath,
      "-vn",
      "-ar", "16000",
      "-ac", "1",
      "-f", "wav",
      audioPath,
      "-y",
    ], { timeout: 30_000 });

    // Step 3: Extract frames at 1fps → named frame_NNNN.jpg
    const framesDir = path.join(tmpDir, "frames");
    fs.mkdirSync(framesDir, { recursive: true });
    await execFileAsync("ffmpeg", [
      "-i", videoPath,
      "-vf", "fps=0.5",
      "-q:v", "4",
      path.join(framesDir, "frame_%04d.jpg"),
      "-y",
    ], { timeout: 30_000 });

    // Rename frames so timestamp = frame number * 2 seconds
    const frameFiles = fs.readdirSync(framesDir).filter((f) => f.endsWith(".jpg")).sort();
    for (let i = 0; i < frameFiles.length; i++) {
      const ts = i * 2;
      const oldPath = path.join(framesDir, frameFiles[i]);
      const newPath = path.join(framesDir, `frame_${String(ts).padStart(4, "0")}.jpg`);
      if (oldPath !== newPath) fs.renameSync(oldPath, newPath);
    }

    // Find thumbnail
    const thumbFiles = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".jpg") && !f.includes("frame"));
    const thumbnailPath = thumbFiles.length > 0 ? path.join(tmpDir, thumbFiles[0]) : null;

    res.json({
      videoPath,
      audioPath,
      thumbnailPath,
      framesDir,
      caption,
      creatorHandle,
      sourceUrl: url,
    });
  } catch (err) {
    // Clean up on error
    fs.rmSync(tmpDir, { recursive: true, force: true });

    const msg = err.message ?? "";
    let code = "UNKNOWN";
    if (msg.includes("private") || msg.includes("login required")) code = "PRIVATE";
    else if (msg.includes("not found") || msg.includes("removed") || msg.includes("deleted")) code = "DELETED";
    else if (msg.includes("429") || msg.includes("rate limit")) code = "RATE_LIMITED";

    res.status(422).json({ error: msg, code });
  }
});

// Cleanup endpoint: called by Next.js after processing is done
app.post("/cleanup", (req, res) => {
  const { dir } = req.body;
  if (dir && typeof dir === "string" && dir.startsWith(os.tmpdir())) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  res.json({ ok: true });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`Download service listening on :${PORT}`));
