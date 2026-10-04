'use strict';
const $ = id => document.getElementById(id);
const presentation = $('presentation');
let slides = [], current = 0, blackout = false, outlineBuilt = false, controlTimer;
const presentationMode = new URLSearchParams(location.search).get('present') === '1';
if (presentationMode) {
  document.body.classList.add('presentation-mode');
  $('exit-fullscreen').hidden = false;
}
function indexFromHash() {
  const match = location.hash.match(/^#slide-(\d+)$/);
  return Math.max(0, Math.min(slides.length - 1, match ? Number(match[1]) - 1 : 0));
}
function show(index, updateHash = true) {
  if (!slides.length) return;
  current = Math.max(0, Math.min(slides.length - 1, index));
  const slide = slides[current];
  $('slide-image').src = slide.image;
  $('slide-image').alt = `Slaid ${slide.number}: ${slide.title}`;
  $('slide-title').textContent = slide.title;
  $('counter').textContent = `${current + 1} / ${slides.length}`;
  $('slide-text').textContent = slide.content;
  $('previous').disabled = current === 0;
  $('next').disabled = current === slides.length - 1;
  $('progress-fill').style.width = `${(current + 1) / slides.length * 100}%`;
  $('image-error').hidden = true;
  document.querySelectorAll('[data-slide]').forEach(button => button.setAttribute('aria-current', String(Number(button.dataset.slide) === current)));
  if (updateHash) history.replaceState(null, '', `#slide-${current + 1}`);
  for (const i of [current - 1, current + 1, current + 2]) {
    if (slides[i]) { const image = new Image(); image.src = slides[i].image; }
  }
}
function toggleBlackout() {
  blackout = !blackout;
  $('blackout').hidden = !blackout;
  $('blackout-toggle').setAttribute('aria-pressed', String(blackout));
  $('blackout-toggle').textContent = blackout ? 'Kembali ke slaid' : 'Rehatkan skrin';
}
function showControls() {
  presentation.classList.add('show-controls');
  clearTimeout(controlTimer);
  controlTimer = setTimeout(() => presentation.classList.remove('show-controls'), 2500);
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (presentation.requestFullscreen) await presentation.requestFullscreen();
    else enterPresentationMode();
  } catch (_) { enterPresentationMode(); }
  showControls();
}
function enterPresentationMode() {
  document.body.classList.add('presentation-mode');
  $('exit-fullscreen').hidden = false;
  showControls();
}
function exitPresentation() {
  if (document.fullscreenElement) document.exitFullscreen();
  document.body.classList.remove('presentation-mode');
  $('exit-fullscreen').hidden = true;
}
function toggleOutline() {
  const open = $('outline').hidden;
  if (open && !outlineBuilt) {
    slides.forEach((slide, i) => {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.slide = i;
      button.setAttribute('aria-label', `Buka slaid ${i + 1}: ${slide.title}`);
      const image = document.createElement('img');
      image.src = slide.image; image.alt = ''; image.loading = 'lazy';
      const caption = document.createElement('span');
      const number = document.createElement('b'); number.textContent = String(i + 1).padStart(2, '0');
      caption.append(number, document.createTextNode(slide.title));
      button.append(image, caption);
      button.addEventListener('click', () => {
        show(i); $('outline').hidden = true; $('outline-toggle').setAttribute('aria-expanded', 'false'); $('stage').focus();
      });
      $('outline').append(button);
    });
    outlineBuilt = true; show(current, false);
  }
  $('outline').hidden = !open;
  $('outline-toggle').setAttribute('aria-expanded', String(open));
  if (open) $('outline').querySelector(`[data-slide="${current}"]`).focus();
}
$('previous').addEventListener('click', () => show(current - 1));
$('next').addEventListener('click', () => show(current + 1));
$('fullscreen').addEventListener('click', toggleFullscreen);
$('exit-fullscreen').addEventListener('click', exitPresentation);
$('outline-toggle').addEventListener('click', toggleOutline);
$('blackout-toggle').addEventListener('click', toggleBlackout);
$('slide-image').addEventListener('error', () => $('image-error').hidden = false);
$('slide-image').addEventListener('load', () => $('image-error').hidden = true);
document.addEventListener('fullscreenchange', () => {
  $('exit-fullscreen').hidden = !document.fullscreenElement && !document.body.classList.contains('presentation-mode');
  showControls();
});
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.key === ' ' && /BUTTON|A|SUMMARY/.test(event.target.tagName)) return;
  const key = event.key.toLowerCase();
  if (['arrowright', 'arrowdown', 'pagedown', ' '].includes(key)) { event.preventDefault(); show(current + 1); }
  else if (['arrowleft', 'arrowup', 'pageup'].includes(key)) { event.preventDefault(); show(current - 1); }
  else if (key === 'home') { event.preventDefault(); show(0); }
  else if (key === 'end') { event.preventDefault(); show(slides.length - 1); }
  else if (key === 'f') { event.preventDefault(); toggleFullscreen(); }
  else if (key === 'b') { event.preventDefault(); toggleBlackout(); }
  else if (key === 'escape') {
    if (blackout) toggleBlackout();
    $('outline').hidden = true; $('outline-toggle').setAttribute('aria-expanded', 'false');
    if (!document.fullscreenElement) exitPresentation();
  }
});
let touchStart;
$('stage').addEventListener('touchstart', e => { const t = e.changedTouches[0]; touchStart = {x:t.clientX, y:t.clientY}; }, {passive:true});
$('stage').addEventListener('touchend', e => {
  if (!touchStart) return;
  const t = e.changedTouches[0], dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
  else showControls();
  touchStart = null;
}, {passive:true});
presentation.addEventListener('pointermove', showControls);
window.addEventListener('hashchange', () => show(indexFromHash(), false));
fetch('slides.json').then(response => {
  if (!response.ok) throw new Error('slides');
  return response.json();
}).then(data => {
  slides = data; show(indexFromHash());
  if (presentationMode) showControls();
  // Cache nearby images as they are viewed; the full deck is also downloadable.
}).catch(() => {
  $('message').hidden = false;
  $('message').textContent = 'Senarai slaid tidak dapat dimuatkan. Muat semula laman atau buka fail PDF pembentangan.';
  $('previous').disabled = $('next').disabled = true;
});
