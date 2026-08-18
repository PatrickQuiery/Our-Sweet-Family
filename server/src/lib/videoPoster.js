const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const { generateThumbnail } = require('./thumbnails');

// Grab a single frame at `seek` seconds into the video.
function ffmpegFrame(inPath, outPath, seek) {
  return new Promise((resolve, reject) => {
    const args = ['-ss', String(seek), '-i', inPath, '-frames:v', '1', '-q:v', '3', '-y', outPath];
    const proc = spawn(ffmpegPath, args);
    let errTail = '';
    proc.stderr.on('data', (d) => { errTail = (errTail + d.toString()).slice(-400); });
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg frame exited ${code}: ${errTail.slice(-200)}`))));
  });
}

/**
 * Extract a poster frame from a video buffer and return a square hi-res JPEG
 * thumbnail buffer (same size/shape as photo thumbnails), or null on failure.
 * Best-effort — never throws.
 */
async function extractPosterBuffer(videoBuffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-poster-'));
  const inPath = path.join(dir, 'in');
  const framePath = path.join(dir, 'frame.jpg');
  try {
    fs.writeFileSync(inPath, videoBuffer);
    // Prefer ~1s in (avoids a black opening frame); fall back to frame 0 for very
    // short clips where seeking to 1s yields nothing.
    try { await ffmpegFrame(inPath, framePath, 1); } catch { /* fall back below */ }
    if (!fs.existsSync(framePath) || fs.statSync(framePath).size === 0) {
      await ffmpegFrame(inPath, framePath, 0);
    }
    const frame = fs.readFileSync(framePath);
    const thumb = await generateThumbnail(frame, 'image/jpeg', 'poster.jpg');
    return thumb ? thumb.buffer : null;
  } catch (e) {
    console.error('poster extraction failed:', e.message);
    return null;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
  }
}

module.exports = { extractPosterBuffer };
