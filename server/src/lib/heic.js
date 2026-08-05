const convert = require('heic-convert');

// iPhones capture photos as HEIC by default. sharp/libvips can't decode HEIC
// (no HEVC decoding plugin in the prebuilt binaries), so any sharp op on a HEIC
// buffer throws — or, on some Linux builds, crashes the process. We detect HEIC
// uploads and decode them to JPEG with heic-convert (pure-JS libheif) up front,
// so the rest of the photo pipeline (compression, thumbnails) works normally and
// stored/served photos are web-compatible.

function isHeicUpload(mimetype, filename) {
  return /image\/hei[cf]/i.test(mimetype || '') || /\.(heic|heif)$/i.test(filename || '');
}

async function heicToJpeg(buffer) {
  return convert({ buffer, format: 'JPEG', quality: 0.9 });
}

module.exports = { isHeicUpload, heicToJpeg };
