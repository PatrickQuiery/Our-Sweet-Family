jest.mock('../../lib/prisma');
jest.mock('../../lib/storage');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { Readable } = require('stream');
const ffmpegPath = require('ffmpeg-static');
const prisma = require('../../lib/prisma');
const storage = require('../../lib/storage');
const { enqueueTranscode, processJob } = require('../../lib/transcodeQueue');

jest.setTimeout(30000);

// A real source video, built once (compresses well so the swap path runs).
let srcBuf;
beforeAll(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-src-'));
  const src = path.join(tmp, 's.mp4');
  spawnSync(ffmpegPath, [
    '-f', 'lavfi', '-i', 'testsrc=duration=1:size=1920x1080:rate=30',
    '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', src, '-y',
  ]);
  srcBuf = fs.readFileSync(src);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('enqueueTranscode', () => {
  it('inserts a pending job with the memory + source key', async () => {
    prisma.transcodeJob.create.mockResolvedValue({ id: 'j1' });
    await enqueueTranscode('mem1', 'memories/orig.mp4');
    expect(prisma.transcodeJob.create).toHaveBeenCalledWith({ data: { memoryId: 'mem1', sourceKey: 'memories/orig.mp4' } });
  });
});

describe('processJob', () => {
  it('transcodes, swaps the memory file, reclaims the original, marks done', async () => {
    storage.readFile.mockResolvedValue({ stream: Readable.from(srcBuf), contentType: 'video/mp4' });
    storage.uploadFile.mockResolvedValue('memories/compressed.mp4');
    storage.deleteFile.mockResolvedValue();
    prisma.memory.update.mockResolvedValue({});
    prisma.transcodeJob.update.mockResolvedValue({});

    await processJob({ id: 'j1', memoryId: 'mem1', sourceKey: 'memories/orig.mp4', attempts: 1 });

    expect(prisma.memory.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'mem1' }, data: expect.objectContaining({ fileUrl: 'memories/compressed.mp4', processing: false }) })
    );
    expect(storage.deleteFile).toHaveBeenCalledWith('memories/orig.mp4');
    expect(prisma.transcodeJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'j1' }, data: expect.objectContaining({ status: 'done' }) })
    );
  });

  it('retries (status back to pending) on failure below max attempts', async () => {
    storage.readFile.mockResolvedValue({ stream: Readable.from(Buffer.from('not a video')), contentType: 'video/mp4' });
    prisma.transcodeJob.update.mockResolvedValue({});

    await processJob({ id: 'j2', memoryId: 'mem2', sourceKey: 'k', attempts: 1 });

    expect(prisma.transcodeJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'j2' }, data: expect.objectContaining({ status: 'pending' }) })
    );
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it('fails permanently at max attempts and clears the memory processing flag', async () => {
    storage.readFile.mockResolvedValue({ stream: Readable.from(Buffer.from('bad')), contentType: 'video/mp4' });
    prisma.transcodeJob.update.mockResolvedValue({});
    prisma.memory.update.mockResolvedValue({});

    await processJob({ id: 'j3', memoryId: 'mem3', sourceKey: 'k', attempts: 3 });

    expect(prisma.transcodeJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'j3' }, data: expect.objectContaining({ status: 'failed' }) })
    );
    expect(prisma.memory.update).toHaveBeenCalledWith({ where: { id: 'mem3' }, data: { processing: false } });
  });
});
