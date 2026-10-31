export function createScene(ctx, palette) {
  const mask = document.createElement('canvas');
  const maskCtx = mask.getContext('2d', { willReadFrequently: true });
  let width = 1;
  let height = 1;
  let particles = new Float32Array(0);
  let count = 0;
  let seed = 2026;
  let influence = 0;

  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function resize(w, h) {
    width = w;
    height = h;
    seed = 2026;
    mask.width = Math.ceil(w);
    mask.height = Math.ceil(h);
    const fontSize = Math.min(w * 0.78, h * 0.93);
    maskCtx.font = `700 ${fontSize}px Arial, sans-serif`;
    maskCtx.textAlign = 'center';
    maskCtx.textBaseline = 'alphabetic';
    const metrics = maskCtx.measureText('s');
    const baseline = h * 0.47 + metrics.actualBoundingBoxAscent / 2;
    maskCtx.fillText('s', w / 2, baseline);
    const image = maskCtx.getImageData(0, 0, mask.width, mask.height);
    const step = Math.max(3.5, fontSize / 86);
    const targets = [];
    for (let y = step; y < h; y += step) {
      for (let x = step; x < w; x += step) {
        if (image.data[(Math.floor(y) * mask.width + Math.floor(x)) * 4 + 3] > 150) {
          targets.push(x, y);
        }
      }
    }
    count = targets.length / 2;
    particles = new Float32Array(count * 8);
    for (let i = 0; i < count; i++) {
      const k = i * 8;
      particles[k] = targets[i * 2];
      particles[k + 1] = targets[i * 2 + 1];
      particles[k + 2] = targets[i * 2] + (random() - 0.5) * 32;
      particles[k + 3] = targets[i * 2 + 1] + (random() - 0.5) * 32;
      particles[k + 6] = random() * Math.PI * 2;
      particles[k + 7] = 0.4 + random() * 0.6;
    }
  }

  function render(time, dt, pointer) {
    ctx.clearRect(0, 0, width, height);
    const tick = Math.min(dt, 0.033);
    influence += ((pointer.inside ? 1 : 0) - influence) * (1 - Math.exp(-tick * 5));
    const reach = Math.min(width * 0.26, 115);
    const damping = Math.exp(-tick * 8);
    for (let i = 0; i < count; i++) {
      const k = i * 8;
      const phase = particles[k + 6];
      const weight = particles[k + 7];
      const drift = 1.5 + Math.pow(Math.sin(phase), 8) * 5;
      const targetX = particles[k] + Math.sin(time * 0.48 + phase) * drift;
      const targetY = particles[k + 1] + Math.cos(time * 0.41 + phase) * drift;
      let ax = (targetX - particles[k + 2]) * 31;
      let ay = (targetY - particles[k + 3]) * 31;
      const dx = particles[k + 2] - pointer.x;
      const dy = particles[k + 3] - pointer.y;
      const distance = Math.hypot(dx, dy);
      if (influence > 0.001 && distance < reach) {
        const force = (1 - distance / reach) ** 2 * (pointer.down ? 3300 : 1500) * influence;
        ax += dx / Math.max(distance, 1) * force;
        ay += dy / Math.max(distance, 1) * force;
      }
      particles[k + 4] = (particles[k + 4] + ax * tick) * damping;
      particles[k + 5] = (particles[k + 5] + ay * tick) * damping;
      particles[k + 2] += particles[k + 4] * tick;
      particles[k + 3] += particles[k + 5] * tick;
      ctx.globalAlpha = 0.35 + weight * 0.5;
      ctx.fillStyle = i % 13 === 0 ? palette.accent : palette.foreground;
      ctx.beginPath();
      ctx.arc(particles[k + 2], particles[k + 3], 0.55 + weight * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = palette.accent;
    for (let i = 0; i < 24; i++) {
      const phase = i * 2.39996;
      const radiusX = Math.min(width * 0.34, height * 0.37) + Math.sin(i * 3.1) * 14;
      const radiusY = height * 0.35 + Math.cos(i) * 12;
      const angle = phase + time * (0.025 + (i % 3) * 0.006);
      ctx.globalAlpha = 0.12 + (Math.sin(time * 0.5 + phase) + 1) * 0.13;
      ctx.beginPath();
      ctx.arc(width / 2 + Math.cos(angle) * radiusX, height * 0.48 + Math.sin(angle) * radiusY, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { resize, render };
}
