jest.mock('../../lib/prisma');
jest.mock('../../lib/storage');

const { Readable } = require('stream');
const sharp = require('sharp');
const prisma = require('../../lib/prisma');
const storage = require('../../lib/storage');
const { backfillThumbnails } = require('../../lib/backfillThumbnails');

// A real, decodable JPEG so sharp (used by generateThumbnail) actually produces a thumb.
async function realJpeg() {
  return sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .jpeg()
    .toBuffer();
}

function feedBatchesOnce(rows) {
  // findMany returns the rows on the first call, then empty (loop terminates).
  prisma.memory.findMany
    .mockResolvedValueOnce(rows)
    .mockResolvedValue([]);
}

describe('backfillThumbnails', () => {
  it('regenerates a stored thumbnail, updates the row, and deletes the old thumb', async () => {
    const jpeg = await realJpeg();
    storage.readFile.mockResolvedValue({ stream: Readable.from([jpeg]), contentType: 'image/jpeg' });
    storage.uploadFile.mockResolvedValue('thumbnails/new-hi-res.jpg');

    feedBatchesOnce([{ id: 'm1', fileUrl: 'memories/a.jpg', thumbnailUrl: 'thumbnails/old-400.jpg' }]);

    const stats = await backfillThumbnails(prisma, { batchSize: 25 });

    expect(stats.upgraded).toBe(1);
    expect(storage.readFile).toHaveBeenCalledWith('memories/a.jpg');
    expect(prisma.memory.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { thumbnailUrl: 'thumbnails/new-hi-res.jpg', thumbHiRes: true },
    });
    expect(storage.deleteFile).toHaveBeenCalledWith('thumbnails/old-400.jpg');
  });

  it('skips (marks done, never rewrites) external/seed images', async () => {
    feedBatchesOnce([{ id: 'm2', fileUrl: 'https://cdn.example.com/seed.jpg', thumbnailUrl: 'https://cdn.example.com/seed.jpg' }]);

    const stats = await backfillThumbnails(prisma, { batchSize: 25 });

    expect(stats.skipped).toBe(1);
    expect(storage.readFile).not.toHaveBeenCalled();
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(prisma.memory.update).toHaveBeenCalledWith({ where: { id: 'm2' }, data: { thumbHiRes: true } });
  });

  it('counts a failure without crashing and does not reselect it', async () => {
    storage.readFile.mockRejectedValue(new Error('S3 down'));
    feedBatchesOnce([{ id: 'm3', fileUrl: 'memories/b.jpg', thumbnailUrl: 'thumbnails/b_thumb.jpg' }]);

    const stats = await backfillThumbnails(prisma, { batchSize: 25 });

    expect(stats.failed).toBe(1);
    expect(stats.upgraded).toBe(0);
    // Second findMany call must exclude the failed id so we don't tight-loop.
    const secondCall = prisma.memory.findMany.mock.calls[1][0];
    expect(secondCall.where.id).toEqual({ notIn: ['m3'] });
  });

  it('is a no-op when nothing needs upgrading', async () => {
    prisma.memory.findMany.mockResolvedValue([]);

    const stats = await backfillThumbnails(prisma);

    expect(stats).toEqual({ processed: 0, upgraded: 0, skipped: 0, failed: 0 });
    expect(prisma.memory.update).not.toHaveBeenCalled();
  });
});
