const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const sharp = require('sharp');
const { extractPosterBuffer } = require('../../lib/videoPoster');

// Synthesize a tiny real MP4 with ffmpeg's test source so we exercise the actual
// frame-extraction + thumbnail path (no fixture binary to check in).
function makeTestVideo() {
  return new Promise((resolve, reject) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-vidtest-'));
    const out = path.join(dir, 'test.mp4');
    const args = ['-f', 'lavfi', '-i', 'testsrc=duration=1:size=320x240:rate=10', '-pix_fmt', 'yuv420p', '-y', out];
    const p = spawn(ffmpegPath, args);
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(fs.readFileSync(out)) : reject(new Error(err.slice(-300)))));
  });
}

describe('extractPosterBuffer', () => {
  jest.setTimeout(20000);

  it('returns a square 800px JPEG poster from a real video', async () => {
    const video = await makeTestVideo();
    const poster = await extractPosterBuffer(video);
    expect(Buffer.isBuffer(poster)).toBe(true);
    const meta = await sharp(poster).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(800);
  });

  it('returns null (never throws) for non-video input', async () => {
    const poster = await extractPosterBuffer(Buffer.from('definitely not a video'));
    expect(poster).toBeNull();
  });
});
