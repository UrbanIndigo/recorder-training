// Pitch-over-time chart: cents away from the target note, with shaded
// "in tune" and "close" bands. Readings on the wrong note are pinned to the
// top or bottom edge in red.

const RANGE = 50; // cents shown above and below the target

export function drawPitchChart(canvas, samples, targetMidi, duration) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const css = getComputedStyle(canvas);
  const color = (name) => css.getPropertyValue(name).trim();
  const padL = 40, padR = 8, padT = 8, padB = 20;
  const w = cssW - padL - padR;
  const h = cssH - padT - padB;
  const x = (t) => padL + (t / duration) * w;
  const y = (c) => padT + h / 2 - (c / RANGE) * (h / 2);

  // Bands.
  ctx.fillStyle = color('--band-close');
  ctx.fillRect(padL, y(25), w, y(-25) - y(25));
  ctx.fillStyle = color('--band-good');
  ctx.fillRect(padL, y(10), w, y(-10) - y(10));

  // Grid and labels.
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = color('--text-muted');
  ctx.strokeStyle = color('--grid');
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const c of [50, 25, 0, -25, -50]) {
    ctx.beginPath();
    ctx.moveTo(padL, y(c));
    ctx.lineTo(padL + w, y(c));
    ctx.stroke();
    ctx.fillText(c === 0 ? '0¢' : `${c > 0 ? '+' : ''}${c}`, padL - 6, y(c));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const stepS = duration > 12 ? 5 : 2;
  for (let t = 0; t <= duration + 1e-9; t += stepS) ctx.fillText(`${t}s`, x(t), padT + h + 4);

  // Target line.
  ctx.strokeStyle = color('--accent');
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padL, y(0));
  ctx.lineTo(padL + w, y(0));
  ctx.stroke();
  ctx.setLineDash([]);

  // Trace (break the line at silences and wrong notes).
  ctx.strokeStyle = color('--trace');
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let drawing = false;
  const wrong = [];
  for (const s of samples) {
    if (s.midi == null) {
      drawing = false;
      continue;
    }
    const cents = (s.midi - targetMidi) * 100;
    if (Math.abs(cents) > RANGE) {
      wrong.push({ t: s.t, up: cents > 0 });
      drawing = false;
      continue;
    }
    if (drawing) ctx.lineTo(x(s.t), y(cents));
    else ctx.moveTo(x(s.t), y(cents));
    drawing = true;
  }
  ctx.stroke();

  ctx.fillStyle = color('--bad');
  for (const p of wrong) ctx.fillRect(x(p.t) - 1, p.up ? padT : padT + h - 3, 2, 3);
}
