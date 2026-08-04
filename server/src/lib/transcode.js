const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

// Transcode a video file to a smaller H.264/AAC MP4 (max 1280px wide, CRF 28,
// web faststart). Resolves on success; rejects on a non-zero ffmpeg exit.
// ffmpeg is a spawned child process, so this never blocks the Node event loop.
function runFfmpeg(inPath, outPath) {
  return new Promise((resolve, reject) => {
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
}

module.exports = { runFfmpeg };
