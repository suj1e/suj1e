export function createSkyEffects(ctx, palette) {
  const capacity = 480;
  const sparks = new Float32Array(capacity * 9);
  const pending = new Float32Array(8 * 4);
  const colors = [palette.accent, '#f2d7a4', '#e6efff'];
  let nextSpark = 0;
  let width = 1;
  let height = 1;
  let meteorDelay = 2.8 + Math.random() * 0.7;
  let meteorAge = -1;
  let meteorX = 0;
  let meteorY = 0;
  let meteorVX = 0;
  let meteorVY = 0;
  let meteorLife = 1;

  function resize(w, h) {
    width = w;
    height = h;
    meteorAge = -1;
    sparks.fill(0);
    pending.fill(0);
  }

  function emit(x, y, power) {
    const total = Math.round(20 + power * 10);
    const rotation = Math.random() * Math.PI * 2;
    const tone = Math.random() > 0.55 ? 1 : 0;
    for (let i = 0; i < total; i++) {
      const k = nextSpark * 9;
      nextSpark = (nextSpark + 1) % capacity;
      const angle = rotation + i / total * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
      const speed = (25 + Math.random() * 55) * power;
      const life = 0.65 + Math.random() * 0.75;
      sparks[k] = x;
      sparks[k + 1] = y;
      sparks[k + 2] = Math.cos(angle) * speed;
      sparks[k + 3] = Math.sin(angle) * speed;
      sparks[k + 4] = life;
      sparks[k + 5] = life;
      sparks[k + 6] = 0.65 + Math.random() * 0.35;
      sparks[k + 7] = i % 7 === 0 ? 2 : tone;
      sparks[k + 8] = 0.65 + Math.random() * 0.7;
    }
  }

  function schedule(x, y, delay, power) {
    for (let i = 0; i < pending.length; i += 4) {
      if (pending[i + 3] !== 0) continue;
      pending[i] = x;
      pending[i + 1] = y;
      pending[i + 2] = delay;
      pending[i + 3] = power;
      break;
    }
  }

  function burst(x, y, kind = 'small') {
    if (kind === 'small') emit(x, y, 0.85);
    else if (kind === 'double') {
      emit(x, y, 1.3);
      schedule(x - 28, y - 24, 0.17, 0.9);
      schedule(x + 32, y - 15, 0.32, 1);
    } else if (kind === 'finale') {
      emit(x, y, 1.7);
      schedule(x - 50, y - 40, 0.2, 1.1);
      schedule(x + 48, y - 58, 0.4, 1.3);
      schedule(x + 4, y - 86, 0.62, 0.8);
    }
  }

  function render(time, dt) {
    const step = Math.min(Math.max(dt, 0), 0.05);
    const drag = Math.exp(-step * 1.3);
    for (let i = 0; i < pending.length; i += 4) {
      if (pending[i + 3] === 0) continue;
      pending[i + 2] -= step;
      if (pending[i + 2] <= 0) {
        emit(pending[i], pending[i + 1], pending[i + 3]);
        pending[i + 3] = 0;
      }
    }

    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < capacity; i++) {
      const k = i * 9;
      if (sparks[k + 4] <= 0) continue;
      sparks[k + 4] = Math.max(0, sparks[k + 4] - step);
      sparks[k + 2] *= drag;
      sparks[k + 3] = sparks[k + 3] * drag + 19 * step;
      sparks[k] += sparks[k + 2] * step;
      sparks[k + 1] += sparks[k + 3] * step;
      const progress = sparks[k + 4] / sparks[k + 5];
      const shimmer = 0.82 + Math.sin(time * 23 + i * 2.4) * 0.18;
      ctx.globalAlpha = progress * progress * sparks[k + 6] * shimmer;
      ctx.strokeStyle = colors[sparks[k + 7]];
      ctx.lineWidth = sparks[k + 8];
      ctx.beginPath();
      ctx.moveTo(sparks[k], sparks[k + 1]);
      ctx.lineTo(sparks[k] - sparks[k + 2] * 0.045, sparks[k + 1] - sparks[k + 3] * 0.045 - 0.6);
      ctx.stroke();
    }

    meteorDelay -= step;
    if (meteorDelay <= 0 && meteorAge < 0) {
      meteorX = width * (0.08 + Math.random() * 0.58);
      meteorY = height * (0.06 + Math.random() * 0.3);
      const speed = Math.min(width * 0.8, 780) + 100;
      meteorVX = speed * 0.83;
      meteorVY = speed * 0.55;
      meteorAge = 0;
      meteorLife = 0.85 + Math.random() * 0.35;
      meteorDelay = 9 + Math.random() * 15;
    }
    if (meteorAge >= 0) {
      meteorAge += step;
      if (meteorAge > meteorLife) meteorAge = -1;
      else {
        const x = meteorX + meteorVX * meteorAge;
        const y = meteorY + meteorVY * meteorAge;
        const envelope = Math.min(1, meteorAge * 8, (meteorLife - meteorAge) * 4);
        const tail = Math.min(0.19, meteorAge);
        ctx.strokeStyle = palette.foreground;
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * tail;
          const b = (i + 1) / 12 * tail;
          ctx.globalAlpha = envelope * (1 - i / 12) ** 2 * 0.75;
          ctx.lineWidth = 1.3 - i / 12 * 0.95;
          ctx.beginPath();
          ctx.moveTo(x - meteorVX * a, y - meteorVY * a);
          ctx.lineTo(x - meteorVX * b, y - meteorVY * b);
          ctx.stroke();
        }
        ctx.globalAlpha = envelope * 0.9;
        ctx.fillStyle = palette.foreground;
        ctx.beginPath();
        ctx.arc(x, y, 1.15, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  return { resize, render, burst };
}
