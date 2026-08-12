const sharp = require('sharp');
const path = require('path');

// The feed shows this thumbnail. 800px (not 400) keeps mosaic tiles crisp on
// Retina/HiDPI, where a ~400 CSS-px tile is ~800 physical px at 2× DPR.
const THUMB_SIZE = 800;
const THUMB_QUALITY = 82;

/**
 * Generate a square, display-ready thumbnail from an image buffer.
 * Returns { buffer, name } or null (non-image input / failure).
 */
async function generateThumbnail(buffer, mimetype, originalName) {
  if (!mimetype || !mimetype.startsWith('image/')) return null;

  try {
    const thumbBuffer = await sharp(buffer)
      .rotate() // respect EXIF orientation (no-op if already baked in)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover', position: 'center' })
      .jpeg({ quality: THUMB_QUALITY })
      .toBuffer();

    const base = path.basename(originalName || 'image', path.extname(originalName || ''));
    return { buffer: thumbBuffer, name: `${base}_thumb.jpg` };
  } catch (e) {
    console.error('Thumbnail generation failed:', e);
    return null;
  }
}

module.exports = { generateThumbnail, THUMB_SIZE, THUMB_QUALITY };
