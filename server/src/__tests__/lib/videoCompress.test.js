jest.mock('../../lib/prisma');
jest.mock('../../lib/storage');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const prisma = require('../../lib/prisma');
const storage = require('../../lib/storage');
const { compressVideoInBackground } = require('../../lib/videoCompress');

// Real ffmpeg transcode — give it plenty of time.
jest.setTimeout(30000);

describe('compressVideoInBackground', () => {
  it('transcodes a video, swaps it in, and deletes the original', async () => {
    // Build a real source video (1080p) that will visibly shrink when compressed.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-vct-'));
    const src = path.join(tmp, 'src.mp4');
    spawnSync(ffmpegPath, [
      '-f', 'lavfi', '-i', 'testsrc=duration=1:size=1920x1080:rate=30',
      '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', src, '-y',
    ]);
    const buffer = fs.readFileSync(src);

    storage.uploadFile.mockResolvedValue('memories/compressed.mp4');
    storage.deleteFile.mockResolvedValue();
    prisma.memory.update.mockResolvedValue({});

    await compressVideoInBackground('mem1', buffer, 'memories/original.mp4');

    // Uploaded the compressed file and pointed the memory at it, cleared processing.
    expect(storage.uploadFile).toHaveBeenCalled();
    expect(prisma.memory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mem1' },
        data: expect.objectContaining({ fileUrl: 'memories/compressed.mp4', processing: false }),
      })
    );
    // Reclaimed the original's storage.
    expect(storage.deleteFile).toHaveBeenCalledWith('memories/original.mp4');
    // The compressed bytes were smaller than the source.
    const compressedBytes = storage.uploadFile.mock.calls[0][0].length;
    expect(compressedBytes).toBeLessThan(buffer.length);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('keeps the original (no delete) when the file cannot be transcoded', async () => {
    prisma.memory.update.mockResolvedValue({});
    await compressVideoInBackground('mem2', Buffer.from('not a video'), 'memories/original.mp4');

    // Best-effort: clears processing, never uploads or deletes.
    expect(prisma.memory.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'mem2' }, data: { processing: false } })
    );
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });
});
