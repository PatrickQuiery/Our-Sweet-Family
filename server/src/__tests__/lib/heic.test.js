const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { isHeicUpload, heicToJpeg } = require('../../lib/heic');

describe('isHeicUpload', () => {
  it('detects HEIC/HEIF by mimetype', () => {
    expect(isHeicUpload('image/heic', 'x')).toBe(true);
    expect(isHeicUpload('image/heif', 'x')).toBe(true);
    expect(isHeicUpload('image/HEIC', 'x')).toBe(true);
  });

  it('detects by filename extension (mimetype missing/opaque)', () => {
    expect(isHeicUpload('application/octet-stream', 'IMG_0001.HEIC')).toBe(true);
    expect(isHeicUpload('', 'photo.heif')).toBe(true);
  });

  it('is false for jpeg/png/other', () => {
    expect(isHeicUpload('image/jpeg', 'x.jpg')).toBe(false);
    expect(isHeicUpload('image/png', 'x.png')).toBe(false);
    expect(isHeicUpload('video/mp4', 'x.mp4')).toBe(false);
    expect(isHeicUpload(undefined, undefined)).toBe(false);
  });
});

describe('heicToJpeg', () => {
  it('converts a HEIC buffer into a sharp-readable JPEG', async () => {
    const heic = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'sample.heic'));

    // Raw sharp cannot DECODE HEIC pixels (no HEVC plugin) — this is why we convert first.
    await expect(sharp(heic).jpeg().toBuffer()).rejects.toThrow();

    const jpeg = await heicToJpeg(heic);
    const meta = await sharp(jpeg).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);
  }, 30000);
});
