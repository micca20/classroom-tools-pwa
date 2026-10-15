// YouTube playlists/videos via the official IFrame Player API (privacy-enhanced youtube-nocookie host).
import { registerSource, claim } from './music.js';
import { ICONS } from './icons.js';

export function parseYouTube(input) {
  const s = (input || '').trim();
  if (!s) return null;
  let url;
  try { url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { url = null; }
  let list = null; let video = null;
  if (url && /(^|\.)youtube\.com$|(^|\.)youtube-nocookie\.com$|^youtu\.be$|^music\.youtube\.com$/i.test(url.hostname)) {
    list = url.searchParams.get('list');
    if (url.hostname.toLowerCase() === 'youtu.be') video = url.pathname.slice(1).split('/')[0];
    else if (url.searchParams.get('v')) video = url.searchParams.get('v');
    else { const m = url.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/); if (m) video = m[1]; }
  } else if (/^(PL|UU|OL|RD|FL|LL)[\w-]{10,}$/.test(s)) list = s;
  else if (/^[\w-]{11}$/.test(s)) video = s;
  if (video && !/^[\w-]{11}$/.test(video)) video = null;
  if (list && !/^[\w-]{10,}$/.test(list)) list = null;
  if (!list && !video) return null;
  return { list, video };
}

let apiP = null;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiP) {
    apiP = new Promise((res, rej) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); res(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { apiP = null; rej(new Error('offline')); };
      document.head.append(s);
      setTimeout(() => rej(new Error('timeout')), 15000);
    });
  }
  return apiP;
}

const yt = { player: null, host: null, item: null, ready: false, onchange: null, volume: 70 };
export const ytState = yt;
const emit = () => yt.onchange?.();

// The player iframe lives in ONE fixed element (moving an iframe in the DOM reloads it and stops the music).
// It's positioned over a slot on the Music Box page, or shown as a mini player elsewhere.
let slotEl = null;
function hostEl() {
  if (!yt.host) {
    yt.host = document.createElement('div');
    yt.host.className = 'yt-host hidden';
    yt.host.innerHTML = '<div class="yt-frame"><div id="yt-player"></div></div>'
      + '<div class="yt-bar"><button data-a="open" class="yt-title">YouTube</button>'
      + `<button data-a="toggle" aria-label="Play/pause"><span class="ic">${ICONS.play}</span></button><button data-a="next" aria-label="Next"><span class="ic">${ICONS.next}</span></button><button data-a="close" aria-label="Stop"><span class="ic">${ICONS.close}</span></button></div>`;
    yt.host.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'toggle') ytToggle(); else if (a === 'next') ytNext(); else if (a === 'close') stopYouTube();
      else if (a === 'open') location.hash = '#/tool/music';
    });
    document.body.append(yt.host);
    const place = () => {
      const h = yt.host;
      if (slotEl?.isConnected && yt.item) {
        const r = slotEl.getBoundingClientRect();
        h.className = 'yt-host docked';
        Object.assign(h.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      } else if (yt.item) {
        h.className = 'yt-host mini';
        Object.assign(h.style, { left: '', top: '', width: '', height: '' });
        const t = h.querySelector('.yt-title'); const title = ytTitle(); if (t.textContent !== title) t.textContent = title || 'YouTube';
      } else {
        h.className = 'yt-host hidden';
      }
      requestAnimationFrame(place);
    };
    requestAnimationFrame(place);
  }
  return yt.host;
}
export function dockPlayer(slot) { slotEl = slot || null; hostEl(); }

export async function playYouTube(item) {
  claim('yt');
  const YT = await loadApi();
  hostEl();
  yt.item = item;
  const vars = { playsinline: 1, rel: 0, modestbranding: 1, autoplay: 1, origin: location.origin };
  if (item.list) { vars.listType = 'playlist'; vars.list = item.list; }
  if (yt.player && yt.ready) {
    if (item.list) yt.player.loadPlaylist({ list: item.list, listType: 'playlist', index: 0 });
    else yt.player.loadVideoById(item.video);
    emit(); return;
  }
  await new Promise((res, rej) => {
    yt.player = new YT.Player('yt-player', {
      host: 'https://www.youtube-nocookie.com',
      width: '100%', height: '100%',
      videoId: item.list ? undefined : item.video,
      playerVars: vars,
      events: {
        onReady: (e) => { yt.ready = true; e.target.setVolume(yt.volume); e.target.playVideo(); res(); emit(); },
        onStateChange: () => emit(),
        onError: (e) => { yt.error = e.data; emit(); rej(new Error(`yt-${e.data}`)); },
      },
    });
    setTimeout(res, 12000);
  });
}

export const YT_ERRORS = { 2: 'That link isn’t valid.', 5: 'This video can’t play here.', 100: 'Video not found or private.', 101: 'The owner doesn’t allow this video to be embedded.', 150: 'The owner doesn’t allow this video to be embedded.', 153: 'This video can’t be embedded here.' };

export function ytPlaying() { try { return yt.ready && yt.player.getPlayerState() === 1; } catch { return false; } }
export function ytTitle() { try { return yt.player.getVideoData()?.title || ''; } catch { return ''; } }
export function ytToggle() {
  if (!yt.ready) return false;
  if (ytPlaying()) yt.player.pauseVideo(); else { claim('yt'); yt.player.playVideo(); }
  return true;
}
export function ytNext() { if (yt.ready) { try { yt.player.nextVideo(); } catch { /* ignore */ } } }
export function ytPrev() { if (yt.ready) { try { yt.player.previousVideo(); } catch { /* ignore */ } } }
export function ytVolume(v) { yt.volume = v; if (yt.ready) try { yt.player.setVolume(v); } catch { /* ignore */ } }
export function stopYouTube() { if (yt.ready) { try { yt.player.stopVideo(); } catch { /* ignore */ } } yt.item = null; emit(); }

registerSource('yt', () => stopYouTube());
