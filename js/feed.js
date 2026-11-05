// Lightweight DOM event feed + toast, usable from any module without cycles.
import { G } from './state.js';

const MAX_ENTRIES = 5;

export function feedEvent(text, side = 'neutral') {
  const feed = document.getElementById('feed');
  if (!feed) return;
  const el = document.createElement('div');
  el.className = 'feed-entry feed-' + side;
  el.textContent = text;
  feed.appendChild(el);
  while (feed.children.length > MAX_ENTRIES) feed.removeChild(feed.firstChild);
  setTimeout(() => { el.classList.add('feed-out'); setTimeout(() => el.remove(), 400); }, 5200);
}

export function showToast(text) {
  G.toast = { text, t: 2.4 };
  const el = document.getElementById('toast');
  if (el) { el.textContent = text; el.classList.add('visible'); }
}
export function hideToast() {
  G.toast = null;
  const el = document.getElementById('toast');
  if (el) el.classList.remove('visible');
}
