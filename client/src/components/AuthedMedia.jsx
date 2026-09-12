import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';

// Private media is served only by authenticated endpoints, so <img>/<video> can't
// load it directly (no auth header). These components fetch the bytes with the
// bearer token, then render them from a blob object URL. Absolute external URLs
// (e.g. seed/stock images) are rendered directly.

const isExternal = (src) => /^https?:\/\//i.test(src || '');

function useBlobUrl(src) {
  const [url, setUrl] = useState(isExternal(src) ? src : null);

  useEffect(() => {
    if (!src) { setUrl(null); return; }
    if (isExternal(src)) { setUrl(src); return; }

    let active = true;
    let objUrl;
    setUrl(null);
    api.get(src, { responseType: 'blob' })
      .then((res) => {
        if (!active) return;
        objUrl = URL.createObjectURL(res.data);
        setUrl(objUrl);
      })
      .catch(() => { if (active) setUrl(null); });

    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [src]);

  return url;
}

export function AuthedImage({ src, className = '', alt = '', ...props }) {
  const url = useBlobUrl(src);
  if (!url) return <div className={`${className} bg-ink/5 animate-pulse`} aria-hidden="true" />;
  return <img src={url} className={className} alt={alt} {...props} />;
}

export function AuthedVideo({ src, className = '', muted, loadingClassName, showFullscreenButton = false, ...props }) {
  const url = useBlobUrl(src);
  const ref = useRef(null);
  const [fullscreenError, setFullscreenError] = useState('');
  // React's `muted` attribute alone is unreliable — browsers often ignore it and
  // block muted autoplay. Set the DOM property directly so autoplay is allowed.
  useEffect(() => {
    if (ref.current) ref.current.muted = !!muted;
  }, [muted, url]);
  if (!url) {
    return (
      <div className={`${loadingClassName ?? className} bg-gray-900 flex items-center justify-center`} aria-hidden="true">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white/70" />
      </div>
    );
  }
  const video = <video ref={ref} src={url} className={className} muted={muted} {...props} />;
  if (!showFullscreenButton) return video;
  const openFullscreen = async () => {
    setFullscreenError('');
    const player = ref.current;
    try {
      // iPhone exposes native video fullscreen separately from the standard API.
      if (typeof player?.webkitEnterFullscreen === 'function') player.webkitEnterFullscreen();
      else if (typeof player?.requestFullscreen === 'function') await player.requestFullscreen();
      else throw new Error('Fullscreen unavailable');
    } catch {
      setFullscreenError('Full screen is unavailable here. You can still watch using the video controls.');
    }
  };
  return (
    <div className="w-full">
      {video}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-black px-4 py-3 text-white">
        {props.autoPlay && muted && <span className="text-xs text-white/75">Starts muted · use the sound control to unmute</span>}
        <button type="button" onClick={openFullscreen} className="rounded-full border border-white/40 px-4 py-2 text-sm font-medium hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Full screen</button>
        {fullscreenError && <p role="status" className="w-full text-sm">{fullscreenError}</p>}
      </div>
    </div>
  );
}
