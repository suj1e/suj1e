export function createScene(ctx, palette) {
  const halo = document.createElement('canvas');
  halo.width = halo.height = 48;
  const haloCtx = halo.getContext('2d');
  const glow = haloCtx.createRadialGradient(24, 24, 0, 24, 24, 24);
  glow.addColorStop(0, '#d7e7ff80');
  glow.addColorStop(0.12, '#b5d0fb38');
  glow.addColorStop(0.4, '#8fb7f50b');
  glow.addColorStop(1, '#8fb7f500');
  haloCtx.fillStyle = glow;
  haloCtx.fillRect(0, 0, 48, 48);

  const spotlight = document.createElement('canvas');
  spotlight.width = spotlight.height = 256;
  const spotlightCtx = spotlight.getContext('2d');
  const light = spotlightCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
  light.addColorStop(0, '#8cbcff22');
  light.addColorStop(0.32, '#78a9f515');
  light.addColorStop(0.7, '#6794d507');
  light.addColorStop(1, '#6794d500');
  spotlightCtx.fillStyle = light;
  spotlightCtx.fillRect(0, 0, 256, 256);

  let stars = new Float32Array(0);
  let screenX = new Float32Array(0);
  let screenY = new Float32Array(0);
  let proximity = new Float32Array(0);
  let displacementX = new Float32Array(0);
  let displacementY = new Float32Array(0);
  let velocityX = new Float32Array(0);
  let velocityY = new Float32Array(0);
  const nearby = new Int16Array(48);
  let count = 0;
  let width = 1;
  let height = 1;
  let offsetX = 0;
  let offsetY = 0;
  let cursorX = 0;
  let cursorY = 0;
  let cursorLight = 0;
  let cursorVelocityX = 0;
  let cursorVelocityY = 0;
  let cursorPositioned = false;
  let seed = 317;

  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function resize(w, h) {
    width = Math.max(1, w);
    height = Math.max(1, h);
    count = Math.round(Math.min(1650, Math.max(320, width * height / 1100)));
    stars = new Float32Array(count * 8);
    screenX = new Float32Array(count);
    screenY = new Float32Array(count);
    proximity = new Float32Array(count);
    displacementX = new Float32Array(count);
    displacementY = new Float32Array(count);
    velocityX = new Float32Array(count);
    velocityY = new Float32Array(count);
    seed = 317;
    for (let i = 0; i < count; i++) {
      const k = i * 8;
      const depth = random() ** 2;
      stars[k] = random();
      stars[k + 1] = random();
      stars[k + 2] = depth;
      stars[k + 3] = 0.3 + depth * 0.8 + (random() > 0.985 ? 0.55 : 0);
      stars[k + 4] = 0.2 + random() * 0.5 + depth * 0.23;
      stars[k + 5] = random() * Math.PI * 2;
      stars[k + 6] = 0.28 + random() * 0.65;
      stars[k + 7] = random() * Math.PI * 2;
    }
  }

  function render(time, dt, pointer) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);
    const step = Math.min(Math.max(dt, 0), 0.05);
    const targetX = pointer.inside ? (pointer.x / width - 0.5) * 2 : 0;
    const targetY = pointer.inside ? (pointer.y / height - 0.5) * 2 : 0;
    const follow = 1 - Math.exp(-step * 3.5);
    offsetX += (targetX - offsetX) * follow;
    offsetY += (targetY - offsetY) * follow;
    let cursorDeltaX = 0;
    let cursorDeltaY = 0;
    if (pointer.inside) {
      if (!cursorPositioned) {
        cursorX = pointer.x;
        cursorY = pointer.y;
        cursorPositioned = true;
      }
      const cursorFollow = 1 - Math.exp(-step * 14);
      cursorDeltaX = (pointer.x - cursorX) * cursorFollow;
      cursorDeltaY = (pointer.y - cursorY) * cursorFollow;
      cursorX += cursorDeltaX;
      cursorY += cursorDeltaY;
    }
    if (step > 0) {
      const velocityFollow = 1 - Math.exp(-step * 10);
      cursorVelocityX += (Math.max(-1000, Math.min(1000, cursorDeltaX / step)) - cursorVelocityX) * velocityFollow;
      cursorVelocityY += (Math.max(-1000, Math.min(1000, cursorDeltaY / step)) - cursorVelocityY) * velocityFollow;
    }
    cursorLight += ((pointer.inside ? 1 : 0) - cursorLight) * (1 - Math.exp(-step * 7));
    const reach = Math.min(240, Math.max(160, width * 0.34));
    const reachSquared = reach * reach;
    const spanX = width + 100;
    const spanY = height + 100;
    const engage = 1 - Math.exp(-step * 10);
    const release = 1 - Math.exp(-step * 3.5);
    const substeps = Math.max(1, Math.ceil(step * 120));
    const tick = step / substeps;
    let nearbyCount = 0;

    for (let i = 0; i < count; i++) {
      const k = i * 8;
      const depth = stars[k + 2];
      const drift = 4 + depth * 13;
      const baseX = ((stars[k] * spanX + time * drift) % spanX) - 50 + offsetX * (3 + depth * 15);
      const baseY = ((stars[k + 1] * spanY + time * drift * 0.35) % spanY) - 50 + offsetY * (2 + depth * 11);
      const dx = baseX + displacementX[i] - cursorX;
      const dy = baseY + displacementY[i] - cursorY;
      const falloff = Math.max(0, 1 - (dx * dx + dy * dy) / reachSquared);
      const targetInfluence = falloff * falloff * cursorLight;
      proximity[i] += (targetInfluence - proximity[i]) * (targetInfluence > proximity[i] ? engage : release);

      // Keep each star's own orbit; the cursor carries a local constellation,
      // rather than collapsing every star onto a single attractor.
      const attraction = 0.25 + depth * 0.2;
      const carry = 0.18 + depth * 0.14;
      let goalX = ((cursorX - baseX) * attraction + cursorVelocityX * carry) * proximity[i];
      let goalY = ((cursorY - baseY) * attraction + cursorVelocityY * carry) * proximity[i];
      const distanceSquared = goalX * goalX + goalY * goalY;
      const limit = reach * 0.8;
      if (distanceSquared > limit * limit) {
        const scale = limit / Math.sqrt(distanceSquared);
        goalX *= scale;
        goalY *= scale;
      }
      for (let n = 0; n < substeps; n++) {
        velocityX[i] += ((goalX - displacementX[i]) * 38 - velocityX[i] * 8.5) * tick;
        velocityY[i] += ((goalY - displacementY[i]) * 38 - velocityY[i] * 8.5) * tick;
        displacementX[i] += velocityX[i] * tick;
        displacementY[i] += velocityY[i] * tick;
      }
      screenX[i] = baseX + displacementX[i];
      screenY[i] = baseY + displacementY[i];
      if (proximity[i] > 0.035 && nearbyCount < nearby.length) nearby[nearbyCount++] = i;
    }

    if (cursorLight > 0.002) {
      ctx.globalAlpha = cursorLight;
      ctx.drawImage(spotlight, cursorX - reach, cursorY - reach, reach * 2, reach * 2);
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 0.7;
      const linkReach = Math.min(110, width * 0.28);
      const linkReachSquared = linkReach * linkReach;
      let links = 0;
      for (let a = 0; a < nearbyCount && links < 96; a++) {
        const i = nearby[a];
        for (let b = a + 1; b < nearbyCount && links < 96; b++) {
          const j = nearby[b];
          const dx = screenX[i] - screenX[j];
          const dy = screenY[i] - screenY[j];
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared >= linkReachSquared) continue;
          ctx.globalAlpha = Math.sqrt(proximity[i] * proximity[j]) * (1 - distanceSquared / linkReachSquared) * 0.52;
          ctx.beginPath();
          ctx.moveTo(screenX[i], screenY[i]);
          ctx.lineTo(screenX[j], screenY[j]);
          ctx.stroke();
          links++;
        }
      }
    }

    for (let i = 0; i < count; i++) {
      const k = i * 8;
      const depth = stars[k + 2];
      const near = proximity[i];
      const radius = stars[k + 3] + near * 0.85;
      const x = screenX[i];
      const y = screenY[i];
      const twinkle = 0.78 + Math.sin(time * stars[k + 6] * 1.4 + stars[k + 5]) * 0.16 + Math.sin(time * 0.3 + stars[k + 7]) * 0.06;
      const alpha = Math.min(1, stars[k + 4] * twinkle + near * 0.78);
      if (radius > 0.96 || near > 0.12) {
        const size = radius * (15 + near * 7);
        ctx.globalAlpha = Math.min(1, alpha * 0.72 + near * 0.4);
        ctx.drawImage(halo, x - size / 2, y - size / 2, size, size);
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = near > 0.15 ? palette.foreground : i % 11 === 0 ? palette.accent : depth < 0.18 ? palette.muted : palette.foreground;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { resize, render };
}
