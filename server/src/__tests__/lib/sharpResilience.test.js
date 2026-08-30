// Guards the fix for the "sharp crashed the API on boot" incident: image
// processing must degrade gracefully (serve originals) when sharp is
// unavailable, never throw — so a bad native binary can't take the server down.

describe('sharp resilience (graceful degradation when sharp fails to load)', () => {
  beforeEach(() => jest.resetModules());

  it('generateThumbnail resolves to null (no throw) when sharp is unavailable', async () => {
    jest.doMock('../../lib/sharpSafe', () => null);
    const { generateThumbnail } = require('../../lib/thumbnails');
    await expect(generateThumbnail(Buffer.from('x'), 'image/jpeg', 'x.jpg')).resolves.toBeNull();
  });

  it('generateThumbnail still works normally when sharp is present', async () => {
    jest.dontMock('../../lib/sharpSafe');
    const sharp = require('sharp');
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer();
    const { generateThumbnail } = require('../../lib/thumbnails');
    const out = await generateThumbnail(png, 'image/png', 'pic.png');
    expect(out).not.toBeNull();
    expect(out.buffer.length).toBeGreaterThan(0);
    expect(out.name).toMatch(/_thumb\.jpg$/);
  });
});
