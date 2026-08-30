// Defensive loader for sharp (a native module). A bad/incompatible platform
// binary makes `require('sharp')` THROW, and since sharp is required at the top
// of routes loaded at boot, that would crash the entire API on startup — which
// is exactly what a sharp major bump did on Railway once (every request 502'd).
//
// Loading it here behind try/catch means a sharp failure can never take the
// server down: it exports `null`, and callers fall back to serving the original
// image bytes (no thumbnail / no compression) instead of crashing.
let sharp = null;
try {
  sharp = require('sharp');
} catch (err) {
  console.error(
    '[sharp] native module failed to load — image processing (thumbnails, ' +
      'compression, avatars) is disabled; originals will be served as-is:',
    err && err.message,
  );
}

module.exports = sharp; // the sharp factory, or null if it failed to load
