export function createScene(ctx, palette) {
  const tones = [palette.muted, palette.foreground, palette.accent];
  const levels = 6;
  const heads = new Int32Array(tones.length * levels);
  let width = 1;
  let height = 1;
  let columns = 0;
  let rows = 0;
  let worldX;
  let worldZ;
  let grain;
  let screenX;
  let screenY;
  let radius;
  let next;
  let horizon;
  let cursorX = 0;
  let cursorY = 0;
  let cursorStrength = 0;
  let hasCursor = false;

  function resize(w, h) {
    width = Math.max(1, w);
    height = Math.max(1, h);
    columns = Math.round(Math.min(164, Math.max(88, width / 7)));
    rows = Math.round(Math.min(78, Math.max(58, height / 7)));
    const count = columns * rows;
    worldX = new Float32Array(count);
    worldZ = new Float32Array(count);
    grain = new Float32Array(count);
    screenX = new Float32Array(count);
    screenY = new Float32Array(count);
    radius = new Float32Array(count);
    next = new Int32Array(count);
    horizon = new Float32Array(Math.ceil(width / 3) + 2);

    // A staggered, lightly irregular sample lattice reads as sand, not a wire mesh.
    let seed = 173;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const i = row * columns + col;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const a = seed / 4294967296;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const b = seed / 4294967296;
        worldX[i] = ((col + (row % 2) * 0.5 + (a - 0.5) * 0.3) / (columns - 1) - 0.5) * 4.4;
        worldZ[i] = Math.max(0, (row + (b - 0.5) * 0.22) / (rows - 1)) * 4.6;
        grain[i] = a;
      }
    }
  }

  function render(time, dt, pointer) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);
    if (!worldX) return;

    const step = Math.min(Math.max(dt, 0), 0.05);
    const follow = 1 - Math.exp(-step * 8);
    if (pointer.inside) {
      if (!hasCursor) {
        cursorX = pointer.x;
        cursorY = pointer.y;
        hasCursor = true;
      }
      cursorX += (pointer.x - cursorX) * follow;
      cursorY += (pointer.y - cursorY) * follow;
    }
    const targetStrength = pointer.inside ? (pointer.down ? 1.35 : 1) : 0;
    cursorStrength += (targetStrength - cursorStrength) * (1 - Math.exp(-step * 4.5));

    heads.fill(-1);
    horizon.fill(height + 100);
    const unit = width * 0.4;
    const relief = Math.min(height * 0.32, width * 0.3);
    const reach = Math.min(width, height) * 0.26;
    const inverseReach = 1 / (reach * reach);
    const drift = time * 0.075;
    const centerX = width * 0.5;
    const horizonY = height * 0.405;

    // Work from foreground to horizon. The one-dimensional depth mask hides
    // points on the backs of dunes without a mesh, z-buffer, or draw sorting.
    for (let row = 0; row < rows; row++) {
      const start = row * columns;
      const end = start + columns;
      for (let i = start; i < end; i++) {
        const x = worldX[i];
        const z = worldZ[i];
        const perspective = 1 / (1 + z * 0.58);
        const bend = Math.sin(z * 1.05 - drift * 0.7);
        const ridgeA = x - z * 0.48 + bend * 0.63 + 0.48;
        const ridgeB = x + z * 0.72 - 1.9 + Math.cos(z * 1.3 + drift * 0.5) * 0.38;
        const duneA = Math.exp(-ridgeA * ridgeA * 1.25);
        const duneB = Math.exp(-ridgeB * ridgeB * 1.8);
        const ripplePhase = x * 5.3 + z * 2.1 + Math.sin(x * 1.4 - z * 0.8) * 0.8 - drift;
        const ripple = Math.sin(ripplePhase);
        const elevation = 0.2 + duneA * 0.82 + duneB * 0.57 + ripple * 0.055;
        let px = centerX + x * unit * perspective;
        let py = horizonY + perspective * perspective * height * 0.69 - elevation * relief * perspective;
        let influence = 0;
        if (cursorStrength > 0.001) {
          const dx = px - cursorX;
          const dy = py - cursorY;
          influence = Math.exp(-(dx * dx + dy * dy) * inverseReach * 1.8) * cursorStrength;
          py -= influence * height * 0.18 * perspective;
          px += dx * influence * 0.045;
        }
        screenX[i] = px;
        screenY[i] = py;
        radius[i] = (0.48 + perspective * 0.7) * (0.88 + grain[i] * 0.24);
        if (px < -2 || px > width + 2 || py < 0 || py > height + 2) continue;
        const bin = Math.max(0, Math.min(horizon.length - 1, Math.floor(px / 3)));
        if (py > horizon[bin] + 1.2) continue;

        const slope = -2.05 * ridgeA * duneA - 2.05 * ridgeB * duneB;
        const light = Math.max(0, Math.min(1, 0.51 + slope * 0.3 + ripple * 0.07));
        const farFade = Math.min(1, (4.6 - z) / 0.75);
        const opacity = (0.2 + perspective * 0.49) * (0.45 + light * 0.55) * farFade;
        if (opacity < 0.045) continue;
        const tone = influence > 0.22 && grain[i] > 0.58 ? 2 : (light > 0.48 ? 1 : 0);
        const level = Math.min(levels - 1, Math.floor(opacity * levels / 0.76));
        const bucket = tone * levels + level;
        next[i] = heads[bucket];
        heads[bucket] = i;
      }

      // Interpolate the row's silhouette across gaps between its discrete dots.
      for (let i = start + 1; i < end; i++) {
        const ax = screenX[i - 1];
        const bx = screenX[i];
        if (bx < 0 || ax > width || bx <= ax) continue;
        const ay = screenY[i - 1];
        const by = screenY[i];
        const left = Math.max(0, Math.ceil(ax / 3));
        const right = Math.min(horizon.length - 1, Math.floor(bx / 3));
        const slope = (by - ay) / (bx - ax);
        for (let bin = left; bin <= right; bin++) {
          const y = ay + (bin * 3 - ax) * slope;
          if (y < horizon[bin]) horizon[bin] = y;
        }
      }
    }

    // Eighteen batched paths, independent of particle count. All geometry and
    // linked-list storage is reused; the animation creates no per-frame arrays.
    for (let bucket = 0; bucket < heads.length; bucket++) {
      if (heads[bucket] === -1) continue;
      ctx.fillStyle = tones[Math.floor(bucket / levels)];
      ctx.globalAlpha = ((bucket % levels) + 0.65) * 0.76 / levels;
      ctx.beginPath();
      for (let i = heads[bucket]; i !== -1; i = next[i]) {
        ctx.moveTo(screenX[i] + radius[i], screenY[i]);
        ctx.arc(screenX[i], screenY[i], radius[i], 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { resize, render };
}
