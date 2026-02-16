let table;
let countries = []; // { name, score }
let bubbles = [];   // { name, score, x, y, r, colors, ready }
let restIndex = null;

const NAME_FIXES = {
  "United States": "United States of America",
  "Russia": "Russian Federation",
  "Vietnam": "Viet Nam",
  "Iran": "Iran (Islamic Republic of)",
  "Syria": "Syrian Arab Republic",
  "Bolivia": "Bolivia (Plurinational State of)",
  "Venezuela": "Venezuela (Bolivarian Republic of)",
  "Tanzania": "Tanzania, United Republic of",
  "Congo (Brazzaville)": "Congo",
  "Congo (Kinshasa)": "Congo, Democratic Republic of the",
  "Laos": "Lao People's Democratic Republic",
  "South Korea": "Korea (Republic of)",
  "North Korea": "Korea (Democratic People's Republic of)",
  "Czechia": "Czech Republic",
  "Eswatini": "Swaziland",
  "Ivory Coast": "Côte d'Ivoire",
  "Palestine": "Palestine, State of",
};

function preload() {
  // Must be in same folder as index.html
  table = loadTable("World-happiness-report-2024.csv", "csv", "header");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif");

  // Your CSV: column 0 country, column 2 ladder score
  const countryCol = table.getColumn(0);
  const scoreCol = table.getColumn(2);

  countries = [];
  for (let i = 0; i < table.getRowCount(); i++) {
    const name = (countryCol[i] ?? "").trim();
    const score = Number(scoreCol[i]);
    if (name && Number.isFinite(score)) countries.push({ name, score });
  }

  // Sort happiest to least happy
  countries.sort((a, b) => b.score - a.score);

  buildLayout();
  loadRestCountriesIndex();
}

function draw() {
  background(246);

  drawTitle();

  const hovered = getHoveredBubble();

  for (const b of bubbles) {
    const isHovered = hovered === b;
    const rr = isHovered ? b.r * 1.12 : b.r;

    // Border indicates score range (legend explains)
    const border = scoreBorderColor(b.score);

    drawFlagCircle(b.x, b.y, rr, b.colors, b.ready, border);
    drawCenteredLabel(b.x, b.y, rr, b.name, b.colors, b.ready);
  }

  drawLegend();
  if (hovered) drawTooltip(hovered);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildLayout();
}

// ---------------- Layout (grid, no overlap) ----------------
function buildLayout() {
  bubbles = [];

  const topPad = 86;
  const bottomPad = 72;
  const leftPad = 18;
  const rightPad = 18;

  const usableW = max(1, width - leftPad - rightPad);
  const usableH = max(1, height - topPad - bottomPad);

  const n = countries.length;

  const idealCols = ceil(sqrt((n * usableW) / usableH));
  const cols = max(1, idealCols);
  const rows = ceil(n / cols);

  const cellW = usableW / cols;
  const cellH = usableH / rows;

  const scores = countries.map((c) => c.score);
  const minS = min(scores);
  const maxS = max(scores);

  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = floor(i / cols);

    const cx = leftPad + col * cellW + cellW / 2;
    const cy = topPad + row * cellH + cellH / 2;

    const t = (countries[i].score - minS) / max(0.0001, maxS - minS);
    const maxR = min(cellW, cellH) * 0.45;
    const minR = min(cellW, cellH) * 0.18;
    const r = lerp(minR, maxR, t);

    bubbles.push({
      name: countries[i].name,
      score: countries[i].score,
      x: cx,
      y: cy,
      r,
      colors: null,
      ready: false,
    });
  }
}

// ---------------- API: Rest Countries + flag sampling ----------------
async function loadRestCountriesIndex() {
  try {
    const url = "https://restcountries.com/v3.1/all?fields=name,altSpellings,flags";
    const res = await fetch(url);
    restIndex = await res.json();

    for (const b of bubbles) {
      const match = findRestCountryMatch(b.name);
      const flagUrl = match?.flags?.png || match?.flags?.svg;

      if (!flagUrl) {
        b.colors = [cObj(210, 210, 210), cObj(170, 170, 170), cObj(235, 235, 235)];
        b.ready = true;
        continue;
      }

      loadImage(
        flagUrl,
        (img) => {
          b.colors = extractDominantColors(img, 3);
          b.ready = true;
        },
        () => {
          b.colors = [cObj(210, 210, 210), cObj(170, 170, 170), cObj(235, 235, 235)];
          b.ready = true;
        }
      );
    }
  } catch (e) {
    console.warn("Rest Countries fetch failed:", e);
    for (const b of bubbles) {
      b.colors = [cObj(210, 210, 210), cObj(170, 170, 170), cObj(235, 235, 235)];
      b.ready = true;
    }
  }
}

function findRestCountryMatch(datasetName) {
  if (!restIndex) return null;

  const fixed = NAME_FIXES[datasetName] || datasetName;
  const target = normName(fixed);

  let best = null;
  let bestScore = -1;

  for (const c of restIndex) {
    const names = [
      c?.name?.common,
      c?.name?.official,
      ...(c?.altSpellings || []),
    ].filter(Boolean);

    for (const n of names) {
      const cand = normName(n);
      if (cand === target) return c;

      const s = tokenOverlapScore(target, cand);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
  }

  return bestScore >= 0.34 ? best : null;
}

function normName(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlapScore(a, b) {
  const A = new Set(a.split(" ").filter((w) => w.length > 2));
  const B = new Set(b.split(" ").filter((w) => w.length > 2));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return inter / union;
}

// ---------------- Drawing ----------------
function drawTitle() {
  push();
  noStroke();
  fill(20);
  textAlign(LEFT, TOP);

  textSize(min(28, width * 0.03));
  text("World Happiness Report 2024", 18, 14);

  fill(90);
  textSize(min(14, width * 0.018));
  text("Size = ladder score • Fill = flag colors • Border = score range (see legend) • Hover for exact score", 18, 48);
  pop();
}

function drawFlagCircle(x, y, r, colors, ready, borderCol) {
  push();
  translate(x, y);
  noStroke();

  if (!ready || !colors || !colors.length) {
    fill(230);
    circle(0, 0, r * 2);
    stroke(200);
    noFill();
    circle(0, 0, r * 2);
    pop();
    return;
  }

  const k = colors.length;
  const step = TWO_PI / k;

  for (let i = 0; i < k; i++) {
    const c = colors[i];
    fill(c.r, c.g, c.b);
    arc(0, 0, r * 2, r * 2, i * step, (i + 1) * step, PIE);
  }

  stroke(borderCol);
  strokeWeight(max(1, r * 0.06));
  noFill();
  circle(0, 0, r * 2);

  pop();
}

function drawCenteredLabel(x, y, r, label, colors, ready) {
  push();
  translate(x, y);

  // Choose text color based on average fill brightness
  let fillCol = color(20);
  if (ready && colors && colors.length) {
    const avg = avgColor(colors);
    const lum = relLum(avg.r, avg.g, avg.b);
    fillCol = lum > 0.55 ? color(15) : color(255);
  }

  // Outline for readability
  const outline = (fillCol.levels[0] > 200) ? color(0, 140) : color(255, 170);

  textAlign(CENTER, CENTER);
  textLeading(r * 0.28);

  let ts = constrain(r * 0.34, 9, 18);
  if (label.length > 14) ts = max(9, ts * 0.85);
  if (label.length > 22) ts = max(9, ts * 0.75);
  textSize(ts);

  stroke(outline);
  strokeWeight(3);
  fill(fillCol);

  // Use bounding box so longer names wrap
  const boxW = r * 1.55;
  const boxH = r * 1.25;
  text(label, 0, 0, boxW, boxH);

  pop();
}

function getHoveredBubble() {
  for (const b of bubbles) {
    if (dist(mouseX, mouseY, b.x, b.y) <= b.r) return b;
  }
  return null;
}

function drawTooltip(b) {
  const pad = 10;
  const lines = [`${b.name}`, `Ladder score: ${b.score.toFixed(3)}`];

  push();
  textAlign(LEFT, TOP);
  textSize(13);

  const w = max(textWidth(lines[0]), textWidth(lines[1])) + pad * 2;
  const h = 44;

  const x = constrain(mouseX + 14, 10, width - w - 10);
  const y = constrain(mouseY + 14, 10, height - h - 10);

  noStroke();
  fill(255, 245);
  rect(x, y, w, h, 10);

  stroke(0, 40);
  noFill();
  rect(x, y, w, h, 10);

  noStroke();
  fill(20);
  text(lines[0], x + pad, y + 7);
  fill(60);
  text(lines[1], x + pad, y + 24);

  pop();
}

// Legend: border colors indicate score ranges
function drawLegend() {
  const items = [
    { label: "High (≥ 6.5)", col: color(40, 170, 70) },
    { label: "Medium (5.5–6.49)", col: color(230, 170, 20) },
    { label: "Low (< 5.5)", col: color(220, 60, 60) },
  ];

  const x = 18;
  const y = height - 54;

  push();
  noStroke();
  fill(30);
  textAlign(LEFT, TOP);
  textSize(12);
  text("Score ranges (border):", x, y);

  let cx = x;
  let cy = y + 18;

  for (const it of items) {
    stroke(it.col);
    strokeWeight(5);
    noFill();
    circle(cx + 10, cy + 10, 18);

    noStroke();
    fill(50);
    text(it.label, cx + 26, cy + 2);

    cy += 20;
  }
  pop();
}

function scoreBorderColor(score) {
  if (score >= 6.5) return color(40, 170, 70);
  if (score >= 5.5) return color(230, 170, 20);
  return color(220, 60, 60);
}

// ---------------- Flag color extraction (simple k-means) ----------------
function extractDominantColors(img, k = 3) {
  img.loadPixels();
  const step = 8;
  const samples = [];

  for (let y = 0; y < img.height; y += step) {
    for (let x = 0; x < img.width; x += step) {
      const idx = 4 * (y * img.width + x);
      const r = img.pixels[idx];
      const g = img.pixels[idx + 1];
      const b = img.pixels[idx + 2];
      const a = img.pixels[idx + 3];

      if (a < 200) continue;
      if (r > 245 && g > 245 && b > 245) continue; // ignore near-white background

      samples.push([r, g, b]);
    }
  }

  if (samples.length < 10) {
    return [cObj(210, 210, 210), cObj(170, 170, 170), cObj(235, 235, 235)];
  }

  const centers = [];
  for (let i = 0; i < k; i++) {
    centers.push(samples[floor(random(samples.length))].slice());
  }

  for (let iter = 0; iter < 6; iter++) {
    const buckets = Array.from({ length: k }, () => ({ sum: [0, 0, 0], n: 0 }));

    for (const p of samples) {
      let bestI = 0;
      let bestD = Infinity;
      for (let i = 0; i < k; i++) {
        const d = sq(p[0] - centers[i][0]) + sq(p[1] - centers[i][1]) + sq(p[2] - centers[i][2]);
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      }
      buckets[bestI].sum[0] += p[0];
      buckets[bestI].sum[1] += p[1];
      buckets[bestI].sum[2] += p[2];
      buckets[bestI].n += 1;
    }

    for (let i = 0; i < k; i++) {
      if (!buckets[i].n) continue;
      centers[i][0] = buckets[i].sum[0] / buckets[i].n;
      centers[i][1] = buckets[i].sum[1] / buckets[i].n;
      centers[i][2] = buckets[i].sum[2] / buckets[i].n;
    }
  }

  // Sort by saturation-ish so we keep “flaggy” colors
  const cols = centers
    .map((c) => cObj(round(c[0]), round(c[1]), round(c[2])))
    .sort((a, b) => chroma(b) - chroma(a));

  return cols.slice(0, k);
}

function cObj(r, g, b) {
  return { r, g, b };
}

function avgColor(colors) {
  let r = 0, g = 0, b = 0;
  for (const c of colors) { r += c.r; g += c.g; b += c.b; }
  const n = max(1, colors.length);
  return { r: r / n, g: g / n, b: b / n };
}

function relLum(r, g, b) {
  const sr = r / 255, sg = g / 255, sb = b / 255;
  return 0.2126 * sr + 0.7152 * sg + 0.0722 * sb;
}

function chroma(c) {
  return max(c.r, c.g, c.b) - min(c.r, c.g, c.b);
}