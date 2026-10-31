import { createScene } from './starfield.js';
import { createSkyEffects } from './sky-effects.js';

const canvas = document.querySelector('#starfield');
const ctx = canvas.getContext('2d');
const styles = getComputedStyle(document.documentElement);
const palette = Object.fromEntries(['background', 'foreground', 'muted', 'accent'].map(key => [key, styles.getPropertyValue(`--${key}`).trim()]));
const scene = createScene(ctx, palette);
const effects = createSkyEffects(ctx, palette);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const pointer = { x: -1000, y: -1000, inside: false };
let paused = reducedMotion.matches;
let animation = 0;
let previous = 0;
let time = 0;
let holdTimer = 0;
let pressing = false;
let dragged = false;
let held = false;
let pressX = 0;
let pressY = 0;

function schedule() {
  if (!animation && !document.hidden) animation = requestAnimationFrame(draw);
}

function draw(timestamp) {
  animation = 0;
  const dt = paused ? 0 : Math.min(previous ? (timestamp - previous) / 1000 : 1 / 60, 0.034);
  previous = timestamp;
  time += dt;
  scene.render(time, dt, pointer);
  effects.render(time, dt);
  if (!paused) schedule();
}

function resize() {
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scene.resize(width, height);
  effects.resize(width, height);
  previous = 0;
  schedule();
}

function setPaused(value) {
  paused = value;
  clearHold();
  previous = 0;
  document.querySelector('#motion-state').textContent = paused ? '动效已暂停。聚焦画面后按空格继续。' : '动效已继续。';
  schedule();
}

function move(event) {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = event.clientX - bounds.left;
  pointer.y = event.clientY - bounds.top;
  pointer.inside = true;
  if (pressing && (pointer.x - pressX) ** 2 + (pointer.y - pressY) ** 2 > 100) {
    dragged = true;
    clearHold();
  }
}

function clearHold() {
  clearTimeout(holdTimer);
  holdTimer = 0;
}

function release() {
  pointer.inside = false;
  pressing = false;
  clearHold();
}

canvas.addEventListener('pointermove', move);
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  move(event);
  pressing = true;
  dragged = false;
  held = false;
  pressX = pointer.x;
  pressY = pointer.y;
  clearHold();
  if (!paused) holdTimer = setTimeout(() => {
    if (!pressing) return;
    held = true;
    effects.burst(pointer.x, pointer.y, 'finale');
  }, 650);
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointerup', event => {
  pressing = false;
  clearHold();
  if (event.pointerType !== 'mouse') pointer.inside = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('pointerleave', () => { pointer.inside = false; clearHold(); });
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('lostpointercapture', () => { pressing = false; clearHold(); });
canvas.addEventListener('click', event => {
  if (paused || held || dragged) return;
  const bounds = canvas.getBoundingClientRect();
  effects.burst(event.clientX - bounds.left, event.clientY - bounds.top, event.detail === 2 ? 'double' : 'small');
});
canvas.addEventListener('keydown', event => {
  if (event.code !== 'Space') return;
  event.preventDefault();
  if (!event.repeat) setPaused(!paused);
});
window.addEventListener('blur', release);
reducedMotion.addEventListener('change', event => setPaused(event.matches));
document.addEventListener('visibilitychange', () => {
  previous = 0;
  if (document.hidden) {
    cancelAnimationFrame(animation);
    animation = 0;
    release();
  } else schedule();
});
new ResizeObserver(resize).observe(canvas);
resize();
