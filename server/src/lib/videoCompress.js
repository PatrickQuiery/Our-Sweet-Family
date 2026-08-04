const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const prisma = require('./prisma');
const { uploadFile, deleteFile } = require('./storage');

// Transcode a video to a smaller H.264/AAC MP4 (max 1280px wide, CRF 28,
// faststart for web streaming) and swap it in as the memory's stored file.
//
// Runs in-process AFTER the upload response is sent. ffmpeg is a spawned child
// process, so it doesn't block the event loop. Best-effort: on any failure — or
// if compression doesn't actually shrink the file — the original is kept.
async function compressVideoInBackground(memoryId, originalBuffer, originalKey) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-vid-'));
  const inPath = path.join(dir, 'in');
  const outPath = path.join(dir, 'out.mp4');
  try {
    fs.writeFileSync(inPath, originalBuffer);

    await new Promise((resolve, reject) => {
      const args = [
        '-i', inPath,
        '-vf', "scale='min(1280,iw)':-2",
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        '-y', outPath,
      ];
      const proc = spawn(ffmpegPath, args);
      let errTail = '';
      proc.stderr.on('data', (d) => { errTail = (errTail + d.toString()).slice(-600); });
      proc.on('error', reject);
      proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${errTail.slice(-300)}`))));
    });

    const out = fs.readFileSync(outPath);
    if (out.length > 0 && out.length < originalBuffer.length) {
      const compressedKey = await uploadFile(out, 'compressed.mp4', 'video/mp4', 'memories');
      await prisma.memory.update({
        where: { id: memoryId },
        data: { fileUrl: compressedKey, size: out.length, processing: false },
      });
      await deleteFile(originalKey); // reclaim the original's storage
      console.log(`video ${memoryId} compressed ${originalBuffer.length} -> ${out.length} bytes`);
    } else {
      // Compression didn't help — keep the original as-is.
      await prisma.memory.update({ where: { id: memoryId }, data: { processing: false } });
    }
  } catch (e) {
    console.error('video compression failed:', e.message);
    try {
      await prisma.memory.update({ where: { id: memoryId }, data: { processing: false } });
    } catch { /* memory may have been deleted meanwhile */ }
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
  }
}

module.exports = { compressVideoInBackground };
