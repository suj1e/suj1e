const canvas = document.querySelector('#scene');
const ctx = canvas.getContext('2d');
const stage = document.querySelector('#stage');
const pauseButton = document.querySelector('#pause');
const themeButton = document.querySelector('#theme');
const tabs = [...document.querySelectorAll('[data-scene]')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const darkMode = matchMedia('(prefers-color-scheme: dark)');
const scenes = {
  terrain: { title: '粒子地形', description: '像风经过沙丘，形状一直在缓慢变化。', hint: '移动指针，让地形轻轻隆起', load: () => import('./terrain.js') },
  gravity: { title: '引力实验', description: '不画星空，只留下运动经过的轨迹。', hint: '在画面中按住，让粒子靠近你', load: () => import('./gravity.js') },
  signature: { title: '粒子签名', description: '一个由细小粒子构成的 s，触碰后仍会归位。', hint: '触碰字形，让粒子散开；按住时更明显', load: () => import('./signature.js') },
};
const pointer = { x: -1000, y: -1000, inside: false, down: false };
let activeName = 'terrain';
let scene;
let width = 1;
let height = 1;
let time = 0;
let previous = 0;
let animation = 0;
let loadVersion = 0;
let paused = reducedMotion.matches;
let theme = darkMode.matches ? 'dark' : 'light';

function palette() {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(['background', 'foreground', 'muted', 'accent'].map(key => [key, style.getPropertyValue(`--${key}`).trim()]));
}

function requestFrame() {
  if (!animation && !document.hidden) animation = requestAnimationFrame(draw);
}

function draw(timestamp) {
  animation = 0;
  const dt = paused ? 0 : Math.min(previous ? (timestamp - previous) / 1000 : 1 / 60, 0.034);
  previous = timestamp;
  if (!paused) time += dt;
  if (scene) scene.render(time, dt, pointer);
  if (!paused && scene) requestFrame();
}

function resize() {
  const bounds = stage.getBoundingClientRect();
  width = bounds.width;
  height = bounds.height;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scene?.resize(width, height);
  previous = 0;
  requestFrame();
}

async function selectScene(name) {
  const version = ++loadVersion;
  const config = scenes[name];
  try {
    const module = await config.load();
    if (version !== loadVersion) return;
    activeName = name;
    scene = module.createScene(ctx, palette());
    scene.resize(width, height);
    time = 0;
    previous = 0;
    pointer.down = false;
    pointer.inside = false;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    document.querySelector('#scene-title').textContent = config.title;
    document.querySelector('#scene-description').textContent = config.description;
    document.querySelector('#hint').textContent = config.hint;
    document.querySelector('#scene-number').textContent = String(Object.keys(scenes).indexOf(name) + 1).padStart(2, '0');
    canvas.setAttribute('aria-label', `${config.title}交互动画`);
    canvas.dataset.scene = name;
    tabs.forEach(tab => {
      if (tab.dataset.scene === name) tab.setAttribute('aria-current', 'true');
      else tab.removeAttribute('aria-current');
    });
    document.querySelector('#error').hidden = true;
    requestFrame();
  } catch (error) {
    const output = document.querySelector('#error');
    output.textContent = `动画加载失败：${error.message}`;
    output.hidden = false;
    console.error(error);
  }
}

function updatePause() {
  pauseButton.textContent = paused ? '播放动效' : '暂停动效';
  pauseButton.setAttribute('aria-pressed', String(paused));
  previous = 0;
  requestFrame();
}

function updateTheme() {
  document.documentElement.dataset.theme = theme;
  themeButton.textContent = theme === 'dark' ? '浅色' : '深色';
  themeButton.setAttribute('aria-label', `切换到${theme === 'dark' ? '浅色' : '深色'}`);
}

function updatePointer(event) {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = event.clientX - bounds.left;
  pointer.y = event.clientY - bounds.top;
  pointer.inside = true;
  if (paused) requestFrame();
}

canvas.addEventListener('pointermove', updatePointer);
canvas.addEventListener('pointerdown', event => {
  updatePointer(event);
  pointer.down = true;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointerup', event => {
  pointer.down = false;
  if (event.pointerType !== 'mouse') pointer.inside = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
canvas.addEventListener('pointercancel', () => { pointer.down = false; pointer.inside = false; });
canvas.addEventListener('lostpointercapture', () => { pointer.down = false; });
window.addEventListener('blur', () => { pointer.down = false; pointer.inside = false; });
pauseButton.addEventListener('click', () => { paused = !paused; updatePause(); });
themeButton.addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; updateTheme(); selectScene(activeName); });
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectScene(tab.dataset.scene));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
    selectScene(tabs[next].dataset.scene);
  });
});
reducedMotion.addEventListener('change', event => { paused = event.matches; updatePause(); });
document.addEventListener('visibilitychange', () => {
  previous = 0;
  if (document.hidden) { cancelAnimationFrame(animation); animation = 0; }
  else requestFrame();
});
new ResizeObserver(resize).observe(stage);
updateTheme();
resize();
updatePause();
selectScene(activeName);
