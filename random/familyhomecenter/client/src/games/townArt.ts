/**
 * 🎨 Tiny Town tiles that are drawn rather than a single emoji, so the town looks more real:
 * 🌳 parks (trees, paths, benches, ponds, swings), 🎠 playgrounds (swings, slides, see-saws,
 * roundabouts), 🚜 farms (corn, wheat, sunflowers, pumpkins — growing through the days, then
 * harvested and planted again) and 🏢 skyscrapers. Each tile picks its look from where it is, so a
 * row of parks or fields isn't all the same.
 */

const hash = (i: number) => {
  let h = (i + 1) * 2654435761;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return h >>> 0;
};

type G = CanvasRenderingContext2D;
const circle = (g: G, x: number, y: number, r: number, fill: string) => {
  g.fillStyle = fill;
  g.beginPath();
  g.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  g.fill();
};
const line = (g: G, x1: number, y1: number, x2: number, y2: number, colour: string, w: number) => {
  g.strokeStyle = colour;
  g.lineWidth = Math.max(0.6, w);
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
};
function tree(g: G, x: number, y: number, r: number, shade = 0) {
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath();
  g.ellipse(x + r * 0.25, y + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#6d4c41';
  g.fillRect(x - r * 0.12, y, r * 0.24, r * 0.8);
  circle(g, x, y - r * 0.1, r, shade ? '#2e7d32' : '#388e3c');
  circle(g, x - r * 0.3, y - r * 0.35, r * 0.55, shade ? '#43a047' : '#4caf50');
}
/** A swing set: an A-frame each end, a bar, and two swings. */
function swings(g: G, x: number, y: number, w: number, h: number) {
  const post = '#5d4037';
  const lw = Math.max(1, w / 18);
  line(g, x, y + h, x + w * 0.08, y, post, lw);
  line(g, x + w * 0.16, y + h, x + w * 0.08, y, post, lw);
  line(g, x + w, y + h, x + w * 0.92, y, post, lw);
  line(g, x + w * 0.84, y + h, x + w * 0.92, y, post, lw);
  line(g, x + w * 0.08, y, x + w * 0.92, y, '#8d6e63', lw * 1.2);
  for (const f of [0.35, 0.65]) {
    line(g, x + w * f - w * 0.06, y, x + w * f - w * 0.06, y + h * 0.75, '#9e9e9e', lw * 0.6);
    line(g, x + w * f + w * 0.06, y, x + w * f + w * 0.06, y + h * 0.75, '#9e9e9e', lw * 0.6);
    g.fillStyle = f < 0.5 ? '#e53935' : '#1e88e5';
    g.fillRect(x + w * f - w * 0.09, y + h * 0.75, w * 0.18, Math.max(1, h * 0.09));
  }
}
function slide(g: G, x: number, y: number, s: number) {
  const lw = Math.max(1, s / 14);
  line(g, x, y, x, y + s, '#757575', lw); // ladder
  line(g, x + s * 0.18, y, x + s * 0.18, y + s, '#757575', lw);
  for (let k = 1; k < 4; k++) line(g, x, y + (s * k) / 4, x + s * 0.18, y + (s * k) / 4, '#9e9e9e', lw * 0.7);
  g.fillStyle = '#ffb300';
  g.fillRect(x - s * 0.04, y - s * 0.06, s * 0.3, s * 0.12); // the top
  line(g, x + s * 0.24, y, x + s * 0.95, y + s, '#e53935', lw * 2.6); // the slide
}

function park(g: G, i: number, px: number, py: number, T: number) {
  const h = hash(i);
  g.fillStyle = '#7cb342';
  g.fillRect(px, py, T, T);
  // a path across, one way or the other
  g.strokeStyle = '#e0cfa9';
  g.lineWidth = T * 0.12;
  g.beginPath();
  if (h & 1) {
    g.moveTo(px, py + T * 0.62);
    g.quadraticCurveTo(px + T * 0.5, py + T * 0.4, px + T, py + T * 0.7);
  } else {
    g.moveTo(px + T * 0.35, py);
    g.quadraticCurveTo(px + T * 0.6, py + T * 0.5, px + T * 0.4, py + T);
  }
  g.stroke();
  const v = (h >>> 3) % 4;
  if (v === 0) {
    swings(g, px + T * 0.1, py + T * 0.12, T * 0.5, T * 0.32);
    tree(g, px + T * 0.75, py + T * 0.62, T * 0.17);
  } else if (v === 1) {
    // a pond with a duck
    g.fillStyle = '#4fa3e0';
    g.beginPath();
    g.ellipse(px + T * 0.62, py + T * 0.3, T * 0.24, T * 0.15, 0, 0, Math.PI * 2);
    g.fill();
    circle(g, px + T * 0.6, py + T * 0.3, T * 0.04, '#fff59d');
    tree(g, px + T * 0.25, py + T * 0.72, T * 0.18, 1);
  } else {
    tree(g, px + T * 0.27, py + T * 0.3, T * 0.18);
    tree(g, px + T * 0.74, py + T * 0.68, T * 0.16, 1);
    if (v === 2) {
      // a bench
      g.fillStyle = '#8d6e63';
      g.fillRect(px + T * 0.55, py + T * 0.2, T * 0.3, T * 0.06);
      g.fillRect(px + T * 0.55, py + T * 0.12, T * 0.3, T * 0.04);
    } else {
      // flowers
      for (let k = 0; k < 6; k++) circle(g, px + T * (0.5 + ((h >>> (k + 5)) % 7) * 0.05), py + T * (0.15 + ((h >>> (k + 9)) % 5) * 0.05), T * 0.035, ['#e91e63', '#ffeb3b', '#ffffff', '#ab47bc'][k % 4]);
    }
  }
}

function playground(g: G, i: number, px: number, py: number, T: number) {
  const h = hash(i);
  g.fillStyle = '#7cb342';
  g.fillRect(px, py, T, T);
  g.fillStyle = '#f1dca0'; // sand
  g.beginPath();
  if (g.roundRect) g.roundRect(px + T * 0.06, py + T * 0.06, T * 0.88, T * 0.88, T * 0.18);
  else g.rect(px + T * 0.06, py + T * 0.06, T * 0.88, T * 0.88);
  g.fill();
  swings(g, px + T * 0.12, py + T * 0.12, T * 0.5, T * 0.34);
  slide(g, px + T * 0.6, py + T * 0.14, T * 0.32);
  if (h & 1) {
    // see-saw
    line(g, px + T * 0.16, py + T * 0.82, px + T * 0.56, py + T * 0.66, '#43a047', Math.max(1.2, T * 0.06));
    g.fillStyle = '#5d4037';
    g.fillRect(px + T * 0.33, py + T * 0.72, T * 0.06, T * 0.1);
  } else {
    // roundabout
    circle(g, px + T * 0.33, py + T * 0.72, T * 0.15, '#1e88e5');
    line(g, px + T * 0.2, py + T * 0.72, px + T * 0.46, py + T * 0.72, '#fdd835', Math.max(1, T * 0.04));
    line(g, px + T * 0.33, py + T * 0.59, px + T * 0.33, py + T * 0.85, '#fdd835', Math.max(1, T * 0.04));
  }
  circle(g, px + T * 0.8, py + T * 0.78, T * 0.08, '#ef5350'); // a ball
}

const CROPS = ['corn', 'wheat', 'sunflower', 'pumpkin'] as const;
/** 🌾 A field: planted, growing, ripe, then harvested — a 60-day year, each field a little apart. */
function farm(g: G, i: number, px: number, py: number, T: number, day: number) {
  const h = hash(i);
  const crop = CROPS[h % 4];
  const age = (day + (h >>> 4) % 25) % 60;
  const stage = age < 8 ? 0 : age < 26 ? 1 : age < 50 ? 2 : 3; // ploughed / growing / ripe / harvested
  g.fillStyle = stage === 3 && crop === 'wheat' ? '#c9a24f' : '#8d6e4f';
  g.fillRect(px, py, T, T);
  const rows = 4;
  const lw = Math.max(1, T / 22);
  for (let r = 0; r < rows; r++) {
    const y = py + T * (0.16 + (r * 0.72) / (rows - 1));
    line(g, px + T * 0.04, y + T * 0.05, px + T * 0.96, y + T * 0.05, 'rgba(60,40,20,0.35)', lw); // furrow
    if (stage === 0) continue;
    for (let k = 0; k < 5; k++) {
      const x = px + T * (0.12 + k * 0.19);
      const grow = stage === 1 ? (age - 8) / 18 : 1;
      if (stage === 3) {
        line(g, x, y + T * 0.05, x, y - T * 0.02, '#a1887f', lw); // stubble
        continue;
      }
      if (crop === 'corn') {
        const top = y - T * (0.05 + 0.18 * grow);
        line(g, x, y + T * 0.05, x, top, '#558b2f', lw * 1.3);
        line(g, x, y - T * 0.03, x - T * 0.06, y - T * 0.07, '#7cb342', lw);
        if (stage === 2) circle(g, x + T * 0.03, y - T * 0.07, T * 0.035, '#fdd835');
      } else if (crop === 'wheat') {
        const top = y - T * (0.03 + 0.12 * grow);
        line(g, x - T * 0.03, y + T * 0.05, x - T * 0.03, top, stage === 2 ? '#e0b94a' : '#9ccc65', lw);
        line(g, x + T * 0.03, y + T * 0.05, x + T * 0.03, top, stage === 2 ? '#d4a63a' : '#8bc34a', lw);
        if (stage === 2) circle(g, x, top, T * 0.03, '#f0c75e');
      } else if (crop === 'sunflower') {
        const top = y - T * (0.04 + 0.17 * grow);
        line(g, x, y + T * 0.05, x, top, '#558b2f', lw);
        if (stage === 2) {
          circle(g, x, top, T * 0.055, '#fdd835');
          circle(g, x, top, T * 0.025, '#5d4037');
        } else circle(g, x, top, T * 0.03, '#7cb342');
      } else {
        line(g, x - T * 0.07, y + T * 0.02, x + T * 0.07, y + T * 0.03, '#689f38', lw);
        circle(g, x, y - T * 0.01, T * 0.04, '#7cb342');
        if (stage === 2 && k % 2 === 0) circle(g, x + T * 0.02, y, T * (0.045 + 0.02 * ((h >>> k) & 1)), '#fb8c00');
      }
    }
  }
  // now and then a red barn in the corner
  if ((h >>> 9) % 5 === 0) {
    const s = T * 0.3;
    g.fillStyle = '#c62828';
    g.fillRect(px + T - s - T * 0.04, py + T * 0.04 + s * 0.35, s, s * 0.65);
    g.fillStyle = '#8e2424';
    g.beginPath();
    g.moveTo(px + T - s - T * 0.06, py + T * 0.04 + s * 0.38);
    g.lineTo(px + T - s / 2 - T * 0.04, py + T * 0.04);
    g.lineTo(px + T - T * 0.02, py + T * 0.04 + s * 0.38);
    g.fill();
    g.fillStyle = '#fff';
    g.fillRect(px + T - s / 2 - T * 0.04 - s * 0.12, py + T * 0.04 + s * 0.62, s * 0.24, s * 0.38);
  }
}

/** 🏙️ A glass skyscraper (or 🏢 brick apartment towers) seen from above at an angle, with its shadow. */
function skyscraper(g: G, i: number, px: number, py: number, T: number, homes = false) {
  const h = hash(i);
  g.fillStyle = '#bdbdbd';
  g.fillRect(px + 1, py + 1, T - 2, T - 2);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(px + T * 0.3, py + T * 0.3, T * 0.66, T * 0.66); // shadow
  const x = px + T * 0.14, y = py + T * 0.06, w = T * 0.62, hh = T * 0.82;
  const grad = g.createLinearGradient(x, y, x + w, y + hh);
  const tint = homes ? ['#bf8f6b', '#d7a77f', '#a1887f'][h % 3] : ['#64b5f6', '#4dd0e1', '#90a4ae'][h % 3];
  grad.addColorStop(0, homes ? '#efd9c4' : '#e3f2fd');
  grad.addColorStop(0.5, tint);
  grad.addColorStop(1, homes ? '#5d4037' : '#37474f');
  g.fillStyle = grad;
  g.fillRect(x, y, w, hh);
  g.fillStyle = homes ? '#6d4c41' : '#455a64';
  g.fillRect(x + w, y + T * 0.06, T * 0.12, hh - T * 0.06); // the side
  if (T >= 16 && homes) {
    // windows with balconies, some lit
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 3; c++) {
        g.fillStyle = (h >>> ((r * 3 + c) % 24)) & 1 ? '#fff59d' : '#cfd8dc';
        g.fillRect(x + w * (0.12 + c * 0.3), y + hh * (0.08 + r * 0.15), w * 0.16, hh * 0.07);
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.fillRect(x + w * (0.08 + c * 0.3), y + hh * (0.15 + r * 0.15), w * 0.24, hh * 0.02);
      }
  } else if (T >= 16) {
    g.fillStyle = 'rgba(255,255,255,0.55)';
    const cols = 4, rows = 7;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if ((h >>> ((r * cols + c) % 24)) & 1) g.fillRect(x + w * (0.1 + c * 0.22), y + hh * (0.06 + r * 0.13), w * 0.12, hh * 0.06);
  }
  g.fillStyle = '#eceff1';
  g.fillRect(x + w * 0.4, y - T * 0.04, w * 0.2, T * 0.06); // roof top
}

/** Draws the tile if it has its own art; false → draw it the usual way (an emoji). */
export function drawArt(g: G, ch: string, i: number, px: number, py: number, T: number, day: number): boolean {
  if (ch === 'p') park(g, i, px, py, T);
  else if (ch === 'y') playground(g, i, px, py, T);
  else if (ch === 'm') farm(g, i, px, py, T, day);
  else if (ch === 'O') skyscraper(g, i, px, py, T);
  else if (ch === 'K') skyscraper(g, i, px, py, T, true);
  else return false;
  return true;
}
