
/*
    Get 0 column in csv, country name
    get 2 column in csv, ladder score
    show text for each country
    show happiness score in the circle
    use ai to make it cool
*/

let table;
let items = [];

// visual params
let minDiameter = 40;
let maxDiameter = 140;
let cols = 1;
let cellSize = 200;


async function setup() {
  createCanvas(windowWidth, windowHeight);
  table = await loadTable('/Data/World-happiness-report-2024.csv', ',', 'header');
  console.log(table);

  let country = table.getColumn(0);
  let happiness = table.getColumn(2).map(v => parseFloat(v));

  // build items
  items = country.map((c, i) => ({
    name: c,
    score: isNaN(happiness[i]) ? 0 : happiness[i],
    colors: null,
    flagImg: null,
    x: 0,
    y: 0,
    d: 0,
    loaded: false
  }));

  computeLayout();

  // fetch flags and extract colors for each country (async)
  items.forEach((it, idx) => fetchFlagAndExtractColors(it, idx));
}

function draw() {
  background(245);


  // draw circles in grid
  let hovered = null;
  for (let i = 0; i < items.length; i++) {
    let it = items[i];
    let radius = it.d / 2;
    let mx = mouseX;
    let my = mouseY;
    let distToMouse = dist(mx, my, it.x, it.y);
    let isHover = distToMouse < radius;

    push();
    translate(it.x, it.y);

    let drawD = it.d * (isHover ? 1.12 : 1);

    // draw circle using all extracted flag colors (as pie slices). fallback to single color
    if (it.colors && it.colors.length > 0) {
      drawCircleWithColors(it.colors, drawD);
    } else {
      fill(color(200));
      noStroke();
      ellipse(0, 0, drawD, drawD);
    }

    // stroke based on score ranges to show score category
    let strokeCol = scoreStrokeColor(it.score);
    stroke(strokeCol);
    strokeWeight(2);
    noFill();
    ellipse(0, 0, drawD, drawD);

    // no on-canvas text: all info shown in tooltip only

    pop();

    if (isHover) hovered = it;
  }

  // tooltip
  if (hovered) drawTooltip(hovered, mouseX, mouseY);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeLayout();
}

function computeLayout() {
  // map scores to diameters
  if (!items || items.length === 0) {
    resizeCanvas(windowWidth, windowHeight);
    return;
  }
  let scores = items.map(it => it.score);
  let minS = Math.min(...scores.filter(s => s > 0));
  let maxS = Math.max(...scores);
  if (!isFinite(minS)) minS = 0; // fallback

  // pick base diameters (before scaling)
  items.forEach(it => {
    it.d = map(it.score, minS, maxS, minDiameter, maxDiameter);
    if (!isFinite(it.d)) it.d = minDiameter;
  });

  // We'll compute a cellSize that accounts for hover enlargement so hovered nodes still fit.
  const hoverFactor = 1.12;
  const spacing = 24; // gap between cells

  // start with max diameter
  let maxD = Math.max(...items.map(it => it.d));

  // iterative adjustment: compute cols/rows and a global scale so the whole grid fits
  let offsetY = 60; // top offset
  let margin = 24;
  let scale = 1;

  for (let iter = 0; iter < 6; iter++) {
    let effectiveD = maxD * hoverFactor * scale;
    let cell = effectiveD + spacing;
    let colsTry = max(1, floor((width - margin * 2) / cell));
    let rowsTry = ceil(items.length / colsTry);
    let requiredW = colsTry * cell;
    let requiredH = rowsTry * cell;
    let availW = max(width - margin * 2, 80);
    let availH = max(windowHeight - offsetY - margin, 80);
    // compute new scale to fit both dimensions
    let scaleW = availW / requiredW;
    let scaleH = availH / requiredH;
    let newScale = min(1, scaleW, scaleH) * scale;
    // prevent shrinking below min diameter
    let minOriginalD = Math.min(...items.map(it => it.d));
    let minScaleLimit = minDiameter / (minOriginalD * hoverFactor);
    if (newScale < minScaleLimit) newScale = minScaleLimit;
    // if scale stabilizes, break
    if (abs(newScale - scale) < 1e-3) {
      scale = newScale;
      cols = colsTry;
      break;
    }
    scale = newScale;
    cols = colsTry;
  }

  // apply final scale to diameters and recompute layout
  items.forEach(it => it.d = it.d * scale);
  maxD = Math.max(...items.map(it => it.d));
  cellSize = maxD * hoverFactor + spacing;
  cols = max(1, floor((width - margin * 2) / cellSize));
  let rows = ceil(items.length / cols);
  let totalW = cols * cellSize;
  let offsetX = (width - totalW) / 2 + cellSize / 2;

  // position items in grid
  for (let i = 0; i < items.length; i++) {
    let c = i % cols;
    let r = floor(i / cols);
    items[i].x = offsetX + c * cellSize;
    items[i].y = offsetY + r * cellSize;
  }

  // ensure canvas uses full window size
  resizeCanvas(windowWidth, windowHeight);
}

function drawTitle() {
  push();
  textAlign(CENTER, CENTER);
  textSize(28);
  fill(30);
  text('World Happiness — 2024 (circle size ∝ score)', width / 2, 40);
  pop();
}

function drawLegend() {
  let legendX = 16;
  let legendY = 64;
  let boxSize = 14;
  let ranges = [ {label: '< 4', col: color(220,70,70)}, {label: '4–5.5', col: color(240,160,60)}, {label: '5.5–6.9', col: color(240,220,90)}, {label: '≥ 6.9', col: color(120,200,120)} ];
  textSize(12);
  textAlign(LEFT, CENTER);
  fill(50);
  noStroke();
  text('Score category (border):', legendX, legendY - 12);
  for (let i = 0; i < ranges.length; i++) {
    fill(ranges[i].col);
    rect(legendX, legendY + i * 20, boxSize, boxSize, 3);
    fill(40);
    text(ranges[i].label, legendX + boxSize + 8, legendY + i * 20 + boxSize / 2);
  }
}

function scoreStrokeColor(score) {
  if (score <= 4) return color(220,70,70);
  if (score <= 5.5) return color(240,160,60);
  if (score <= 6.9) return color(240,220,90);
  return color(120,200,120);
}

function drawTooltip(it, mx, my) {
  // multi-line tooltip: name on first line, score on second
  let line1 = it.name || '';
  let line2 = `Score: ${isFinite(it.score) && it.score !== 0 ? it.score.toFixed(2) : '—'}`;
  textSize(12);
  let pad = 8;
  let lines = [line1, line2];
  let maxW = 0;
  lines.forEach(l => { maxW = max(maxW, textWidth(l)); });
  let w = maxW + pad * 2;
  let h = lines.length * 18 + pad;
  let x = mx + 14;
  let y = my + 8;
  push();
  fill(40, 230);
  stroke(0, 80);
  rect(x, y, w, h, 6);
  fill(255);
  noStroke();
  textAlign(LEFT, TOP);
  for (let i = 0; i < lines.length; i++) {
    text(lines[i], x + pad, y + pad / 2 + i * 18);
  }
  pop();
}

function chooseContrast(c) {
  // expects p5.Color or hex
  let col = c instanceof p5.Color ? c : color(c);
  let r = red(col), g = green(col), b = blue(col);
  // relative luminance
  let L = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return L > 0.55 ? color(0) : color(255);
}

async function fetchFlagAndExtractColors(item, idx) {
  // try restcountries API
  let name = item.name;
  let url = `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fullText=false`;
  try {
    let res = await fetch(url);
    if (!res.ok) throw new Error('not found');
    let data = await res.json();
    // choose first match
    let first = data[0];
    let flagUrl = first && first.flags && (first.flags.png || first.flags.svg) ? (first.flags.png || first.flags.svg) : null;
    if (flagUrl) {
      loadImage(flagUrl, img => {
        item.flagImg = img;
        item.colors = extractColorsFromImage(img, 4);
        item.loaded = true;
      }, err => {
        item.colors = [color(200)];
        item.loaded = true;
      });
    } else {
      item.colors = [color(200)];
      item.loaded = true;
    }
  } catch (e) {
    // fallback: try a simpler search (first word)
    let firstWord = name.split(' ')[0];
    if (firstWord && firstWord.toLowerCase() !== name.toLowerCase()) {
      try {
        let res2 = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(firstWord)}?fullText=false`);
        if (res2.ok) {
          let data2 = await res2.json();
          let flagUrl = data2[0] && data2[0].flags && (data2[0].flags.png || data2[0].flags.svg);
          if (flagUrl) {
            loadImage(flagUrl, img => {
              item.flagImg = img;
              item.colors = extractColorsFromImage(img, 4);
              item.loaded = true;
            }, () => { item.colors = [color(200)]; item.loaded = true; });
            return;
          }
        }
      } catch (e2) {}
    }
    item.colors = [color(200)];
    item.loaded = true;
  }
}

function extractColorsFromImage(img, topN = 3) {
  // draw small version and sample pixels to find dominant colors
  let g = createGraphics(32, 32);
  g.imageMode(CENTER);
  g.background(255);
  let s = min(g.width, g.height);
  g.push();
  g.translate(g.width / 2, g.height / 2);
  g.image(img, 0, 0, s, s);
  g.pop();
  g.loadPixels();
  let counts = {};
  for (let x = 0; x < g.width; x += 2) {
    for (let y = 0; y < g.height; y += 2) {
      let i = (x + y * g.width) * 4;
      let r = g.pixels[i];
      let gg = g.pixels[i + 1];
      let b = g.pixels[i + 2];
      // quantize
      let qr = Math.round(r / 32) * 32;
      let qg = Math.round(gg / 32) * 32;
      let qb = Math.round(b / 32) * 32;
      let key = `${qr},${qg},${qb}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  let entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  let cols = entries.slice(0, topN).map(e => {
    let parts = e[0].split(',').map(v => parseInt(v));
    return color(parts[0], parts[1], parts[2]);
  });
  if (cols.length === 0) cols = [color(200)];
  return cols;
}

function drawCircleWithColors(colsArr, diameter) {
  let n = colsArr.length;
  let r = diameter / 2;
  push();
  noStroke();
  for (let i = 0; i < n; i++) {
    let a0 = (TWO_PI / n) * i - HALF_PI;
    let a1 = (TWO_PI / n) * (i + 1) - HALF_PI;
    fill(colsArr[i]);
    arc(0, 0, diameter, diameter, a0, a1, PIE);
  }
  pop();
}

function averageColor(colsArr) {
  let rs = 0, gs = 0, bs = 0;
  colsArr.forEach(c => {
    let col = c instanceof p5.Color ? c : color(c);
    rs += red(col);
    gs += green(col);
    bs += blue(col);
  });
  let n = colsArr.length || 1;
  return color(rs / n, gs / n, bs / n);
}

/*
    Please edit my code so that theh text shows up in the center of each circle. Each circle should be the colors of the national flag of the country it represents. You can use an API to get the flag colors based on the country name. Make sure to handle cases where the country name might not match perfectly with the API's database. Make sure none of the circles overlap each other, and that the text is clearly visible against the circle's background color. You can also add a tooltip that shows the exact happiness score when hovering over each circle. The circles should be in a grid layout to ensure they do not overlap, and the size of each circle should be proportional to the happiness score. Additionally, you can add a legend that explains the color coding of the circles based on the happiness score ranges. When hovered over, the circle should be a bit larger t0 show that it is being interacted with, and the tooltip should appear next to the cursor. You can also add a title and labels to make the visualization more informative. Make sure to test your code with different screen sizes to ensure it is responsive and looks good on all devices.

*/