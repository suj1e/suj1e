const PARTICLES = 30;
const TRAIL_SAMPLES = 144;
const SAMPLE_INTERVAL = 1 / 30;
const TAU = Math.PI * 2;

export function createScene(ctx, palette) {
  const x = new Float32Array(PARTICLES);
  const y = new Float32Array(PARTICLES);
  const vx = new Float32Array(PARTICLES);
  const vy = new Float32Array(PARTICLES);
  const phase = new Float64Array(PARTICLES);
  const speed = new Float32Array(PARTICLES);
  const radius = new Float32Array(PARTICLES);
  const historyX = new Float32Array(PARTICLES * TRAIL_SAMPLES);
  const historyY = new Float32Array(PARTICLES * TRAIL_SAMPLES);
  const centerX = new Float32Array(3);
  const centerY = new Float32Array(3);
  const cosine = new Float32Array(3);
  const sine = new Float32Array(3);
  const flatten = new Float32Array([0.53, 0.67, 0.43]);
  let width = 1;
  let height = 1;
  let scale = 1;
  let sampleClock = 0;
  let newest = 0;
  let samples = 1;
  let influence = 0;

  // Three crossing, off-center ellipses form a loose drawing, not a star field.
  for (let group = 0; group < 3; group++) {
    const angle = group === 0 ? -0.64 : group === 1 ? 0.72 : -1.24;
    cosine[group] = Math.cos(angle);
    sine[group] = Math.sin(angle);
  }

  function resize(nextWidth, nextHeight) {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    scale = Math.min(width * 0.34, height * 0.36);
    centerX[0] = width * 0.43;
    centerX[1] = width * 0.57;
    centerX[2] = width * 0.5;
    centerY[0] = height * 0.49;
    centerY[1] = height * 0.47;
    centerY[2] = height * 0.55;
    sampleClock = 0;
    influence = 0;
    samples = 42;
    newest = samples - 1;

    for (let i = 0; i < PARTICLES; i++) {
      const group = Math.floor(i / 10);
      const strand = i % 10;
      radius[i] = scale * (0.69 + strand * 0.039);
      speed[i] = (0.19 + (strand % 4) * 0.026) * (group === 1 ? -1 : 1);
      phase[i] = strand * TAU / 10 + group * 1.9;
      const a = radius[i];
      const b = a * flatten[group];
      const c = cosine[group];
      const s = sine[group];
      const cp = Math.cos(phase[i]);
      const sp = Math.sin(phase[i]);
      x[i] = centerX[group] + cp * a * c - sp * b * s;
      y[i] = centerY[group] + cp * a * s + sp * b * c;
      vx[i] = (-sp * a * c - cp * b * s) * speed[i];
      vy[i] = (-sp * a * s + cp * b * c) * speed[i];

      // A short orbital lead-in keeps the first paused frame legible. Live
      // positions replace it as the drawing grows over the next few seconds.
      for (let j = 0; j < samples; j++) {
        const past = phase[i] - (samples - 1 - j) * SAMPLE_INTERVAL * speed[i];
        const pc = Math.cos(past);
        const ps = Math.sin(past);
        const index = i * TRAIL_SAMPLES + j;
        historyX[index] = centerX[group] + pc * a * c - ps * b * s;
        historyY[index] = centerY[group] + pc * a * s + ps * b * c;
      }
    }
    ctx.clearRect(0, 0, width, height);
  }

  function render(time, dt, pointer) {
    const elapsed = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.05)) : 0;
    const active = pointer && (pointer.inside || pointer.down);
    const pressed = active && pointer.down;
    const targetInfluence = pressed ? 1 : active ? 0.055 : 0;
    const steps = Math.max(1, Math.ceil(elapsed * 120));
    const step = elapsed / steps;
    const maxSpeed = Math.max(35, scale * 1.35);
    const maxSpeedSquared = maxSpeed * maxSpeed;
    const reachSquared = scale * scale * 3.2;

    for (let tick = 0; tick < steps; tick++) {
      influence += (targetInfluence - influence) * (1 - Math.exp(-step * 6));
      const orbitStrength = 1 - influence * 0.87;
      for (let i = 0; i < PARTICLES; i++) {
        const group = Math.floor(i / 10);
        phase[i] = (phase[i] + speed[i] * step) % TAU;
        const cp = Math.cos(phase[i]);
        const sp = Math.sin(phase[i]);
        const a = radius[i];
        const b = a * flatten[group];
        const c = cosine[group];
        const s = sine[group];
        const targetX = centerX[group] + cp * a * c - sp * b * s;
        const targetY = centerY[group] + cp * a * s + sp * b * c;
        const targetVX = (-sp * a * c - cp * b * s) * speed[i];
        const targetVY = (-sp * a * s + cp * b * c) * speed[i];
        let ax = (targetX - x[i]) * 2.6 * orbitStrength;
        let ay = (targetY - y[i]) * 2.6 * orbitStrength;
        ax += (targetVX * orbitStrength - vx[i]) * 1.8;
        ay += (targetVY * orbitStrength - vy[i]) * 1.8;

        if (active && influence > 0.001) {
          const dx = pointer.x - x[i];
          const dy = pointer.y - y[i];
          const distanceSquared = dx * dx + dy * dy;
          const core = Math.max(7, scale * (0.055 + (i % 5) * 0.012));
          const falloff = influence * 5.4 / (1 + distanceSquared / reachSquared);
          // A softened core and a little angular momentum keep held particles
          // moving around the finger instead of collapsing into one bright dot.
          const pull = falloff * (1 - core * core / (distanceSquared + 25));
          ax += dx * pull - dy * falloff * 0.19;
          ay += dy * pull + dx * falloff * 0.19;
        }

        const margin = Math.min(22, scale * 0.1);
        if (x[i] < margin) ax += (margin - x[i]) * 4;
        if (x[i] > width - margin) ax += (width - margin - x[i]) * 4;
        if (y[i] < margin) ay += (margin - y[i]) * 4;
        if (y[i] > height - margin) ay += (height - margin - y[i]) * 4;
        vx[i] += ax * step;
        vy[i] += ay * step;
        const velocitySquared = vx[i] * vx[i] + vy[i] * vy[i];
        if (velocitySquared > maxSpeedSquared) {
          const limit = maxSpeed / Math.sqrt(velocitySquared);
          vx[i] *= limit;
          vy[i] *= limit;
        }
        x[i] += vx[i] * step;
        y[i] += vy[i] * step;
      }

      sampleClock += step;
      if (sampleClock >= SAMPLE_INTERVAL) {
        sampleClock -= SAMPLE_INTERVAL;
        newest = (newest + 1) % TRAIL_SAMPLES;
        samples = Math.min(TRAIL_SAMPLES, samples + 1);
        for (let i = 0; i < PARTICLES; i++) {
          const index = i * TRAIL_SAMPLES + newest;
          historyX[index] = x[i];
          historyY[index] = y[i];
        }
      }
    }

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 0.75;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const oldest = (newest - samples + 1 + TRAIL_SAMPLES) % TRAIL_SAMPLES;

    // Age bands fade history deterministically: no frame-rate-dependent canvas
    // accumulation, no lingering heads, and a clean redraw when paused.
    for (let group = 0; group < 3; group++) {
      ctx.strokeStyle = group === 1 ? palette.accent : group === 2 ? palette.muted : palette.foreground;
      for (let band = 0; band < 6; band++) {
        const start = Math.floor((samples - 1) * band / 6);
        const end = Math.floor((samples - 1) * (band + 1) / 6);
        ctx.globalAlpha = 0.025 + (band / 5) ** 1.5 * (group === 1 ? 0.28 : 0.22);
        ctx.beginPath();
        for (let strand = 0; strand < 10; strand++) {
          const i = group * 10 + strand;
          const offset = i * TRAIL_SAMPLES;
          for (let j = start; j <= end; j++) {
            const index = offset + (oldest + j) % TRAIL_SAMPLES;
            if (j === start) ctx.moveTo(historyX[index], historyY[index]);
            else ctx.lineTo(historyX[index], historyY[index]);
          }
          if (band === 5) ctx.lineTo(x[i], y[i]);
        }
        ctx.stroke();
      }
    }

    // Only a handful of heads are marked; the fine curves carry the silhouette.
    for (let i = 0; i < PARTICLES; i += 3) {
      const accented = Math.floor(i / 10) === 1;
      ctx.globalAlpha = accented ? 0.85 : 0.63;
      ctx.fillStyle = accented ? palette.accent : palette.foreground;
      ctx.beginPath();
      ctx.arc(x[i], y[i], accented ? 1.65 : 1.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  return { resize, render };
}
