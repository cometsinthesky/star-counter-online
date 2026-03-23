const state = {
  imageBitmap: null,
  originalCanvas: document.createElement('canvas'),
  originalCtx: null,
  imageData: null,
  luminance: null,
  width: 0,
  height: 0,
  stars: [],
  variation: [],
  lastOverlay: [],
  progressStartedAt: 0,
};
state.originalCtx = state.originalCanvas.getContext('2d', { willReadFrequently: true });

const els = {
  imageInput: document.getElementById('imageInput'),
  fileName: document.getElementById('fileName'),
  sensitivitySlider: document.getElementById('sensitivitySlider'),
  sensitivityValue: document.getElementById('sensitivityValue'),
  sizeMinSlider: document.getElementById('sizeMinSlider'),
  sizeMaxSlider: document.getElementById('sizeMaxSlider'),
  sizeMinInput: document.getElementById('sizeMinInput'),
  sizeMaxInput: document.getElementById('sizeMaxInput'),
  rangeLabel: document.getElementById('rangeLabel'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  exportBtn: document.getElementById('exportBtn'),
  exportFormat: document.getElementById('exportFormat'),
  exportCaption: document.getElementById('exportCaption'),
  summedCount: document.getElementById('summedCount'),
  summedRangeLabel: document.getElementById('summedRangeLabel'),
  fwhmAvg: document.getElementById('fwhmAvg'),
  analysisSummary: document.getElementById('analysisSummary'),
  histogramCanvas: document.getElementById('histogramCanvas'),
  variationCanvas: document.getElementById('variationCanvas'),
  previewCanvas: document.getElementById('previewCanvas'),
  progressModal: document.getElementById('progressModal'),
  progressText: document.getElementById('progressText'),
  progressStage: document.getElementById('progressStage'),
  progressEta: document.getElementById('progressEta'),
  progressFill: document.getElementById('progressFill'),
};
const previewCtx = els.previewCanvas.getContext('2d', { willReadFrequently: true });
const histogramCtx = els.histogramCanvas.getContext('2d');
const variationCtx = els.variationCanvas.getContext('2d');

function formatPx(v) { return `${Number(v).toFixed(1).replace('.', ',')} px`; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function getSensitivityFactor() { return 0.35 + (Number(els.sensitivitySlider.value) / 100) * 1.65; }
function getDetectionSigmaK() { return lerp(4.2, 1.45, Number(els.sensitivitySlider.value) / 100); }
function getLocalWindow() { return state.width * state.height > 1600 * 1600 ? 17 : 13; }
function formatEta(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '00 min 00 s';
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')} min ${String(sec).padStart(2, '0')} s`;
}

function showProgress(value, stageText = '') {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  if (!state.progressStartedAt) state.progressStartedAt = performance.now();
  const elapsed = performance.now() - state.progressStartedAt;
  const etaMs = pct > 0 && pct < 100 ? (elapsed / pct) * (100 - pct) : 0;
  els.progressModal.hidden = false;
  els.progressText.textContent = `${pct}% carregado...`;
  els.progressStage.textContent = `Etapa: ${stageText || 'processando imagem...'}`;
  els.progressEta.textContent = `Tempo estimado: ${formatEta(etaMs)}`;
  els.progressFill.style.width = `${pct}%`;
}
function hideProgress() {
  els.progressModal.hidden = true;
  state.progressStartedAt = 0;
  els.progressText.textContent = '0% carregado...';
  els.progressStage.textContent = 'Etapa: aguardando início.';
  els.progressEta.textContent = 'Tempo estimado: XX min XX s';
  els.progressFill.style.width = '0%';
}
function nextFrame() { return new Promise(requestAnimationFrame); }

function applyRangeUI(min, max) {
  els.sizeMinSlider.value = min;
  els.sizeMaxSlider.value = max;
  els.sizeMinInput.value = min.toFixed(1);
  els.sizeMaxInput.value = max.toFixed(1);
  els.rangeLabel.textContent = `${formatPx(min)} — ${formatPx(max)}`;
  els.summedRangeLabel.textContent = `Somatória ${formatPx(min)}–${formatPx(max)}`;
  const minPercent = ((min - 0.1) / 99.9) * 100;
  const maxPercent = ((max - 0.1) / 99.9) * 100;
  const gradient = `linear-gradient(90deg, rgba(148,163,184,.28) 0%, rgba(148,163,184,.28) ${minPercent}%, rgba(99,102,241,.85) ${minPercent}%, rgba(99,102,241,.85) ${maxPercent}%, rgba(148,163,184,.28) ${maxPercent}%, rgba(148,163,184,.28) 100%)`;
  els.sizeMinSlider.style.background = gradient;
  els.sizeMaxSlider.style.background = gradient;
}

function syncRangeFromSliders(e) {
  let min = parseFloat(els.sizeMinSlider.value);
  let max = parseFloat(els.sizeMaxSlider.value);
  if (e?.target === els.sizeMinSlider && min > max) max = min;
  if (e?.target === els.sizeMaxSlider && max < min) min = max;
  if (!e && min > max) [min, max] = [max, min];
  applyRangeUI(min, max);
  renderPreview();
  if (state.stars.length) updateMetricsAndVariation();
}

function syncRangeFromInputs() {
  let min = clamp(parseFloat(els.sizeMinInput.value || '0.5'), 0.1, 100);
  let max = clamp(parseFloat(els.sizeMaxInput.value || '100'), 0.1, 100);
  if (min > max) [min, max] = [max, min];
  applyRangeUI(min, max);
  renderPreview();
  if (state.stars.length) updateMetricsAndVariation();
}

function getSelectedRange() {
  return {
    min: parseFloat(els.sizeMinInput.value || '0.5'),
    max: parseFloat(els.sizeMaxInput.value || '100'),
  };
}

async function loadImageFile(file) {
  if (!file) return;
  els.fileName.textContent = file.name;
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = async () => {
    try {
      const bitmap = await createImageBitmap(image);
      state.imageBitmap = bitmap;
      state.width = bitmap.width;
      state.height = bitmap.height;
      state.originalCanvas.width = bitmap.width;
      state.originalCanvas.height = bitmap.height;
      state.originalCtx.clearRect(0, 0, bitmap.width, bitmap.height);
      state.originalCtx.drawImage(bitmap, 0, 0);
      state.imageData = state.originalCtx.getImageData(0, 0, bitmap.width, bitmap.height);
      state.luminance = computeLuminance(state.imageData.data, bitmap.width, bitmap.height);
      drawHistogram(state.imageData.data, bitmap.width, bitmap.height);
      state.stars = [];
      state.variation = [];
      updateSummary('Imagem carregada. Ajuste os controles e clique em “Calcular Número de Estrelas”.');
      renderPreview();
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  image.src = url;
}

function computeLuminance(data, width, height) {
  const lum = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lum[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return lum;
}

function drawHistogram(data, width, height) {
  const histR = new Uint32Array(256);
  const histG = new Uint32Array(256);
  const histB = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    histR[data[i]]++;
    histG[data[i + 1]]++;
    histB[data[i + 2]]++;
  }
  const ctx = histogramCtx;
  const canvas = els.histogramCanvas;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, w, h);
  const pad = { l: 44, r: 14, t: 20, b: 34 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const maxValue = Math.max(...histR, ...histG, ...histB) || 1;

  ctx.strokeStyle = 'rgba(148,163,184,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (ih / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + iw, y);
    ctx.stroke();
  }

  const channels = [
    { data: histR, color: 'rgba(255,99,132,0.95)', fill: 'rgba(255,99,132,0.16)', label: 'R' },
    { data: histG, color: 'rgba(52,211,153,0.95)', fill: 'rgba(52,211,153,0.16)', label: 'G' },
    { data: histB, color: 'rgba(96,165,250,0.95)', fill: 'rgba(96,165,250,0.16)', label: 'B' },
  ];

  channels.forEach((channel) => {
    ctx.beginPath();
    channel.data.forEach((value, i) => {
      const x = pad.l + (i / 255) * iw;
      const y = pad.t + ih - (value / maxValue) * ih;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.l + iw, pad.t + ih);
    ctx.lineTo(pad.l, pad.t + ih);
    ctx.closePath();
    ctx.fillStyle = channel.fill;
    ctx.fill();

    ctx.beginPath();
    channel.data.forEach((value, i) => {
      const x = pad.l + (i / 255) * iw;
      const y = pad.t + ih - (value / maxValue) * ih;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = channel.color;
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px Inter, Arial';
  const labels = ['0', '64', '128', '192', '255'];
  labels.forEach((label, i) => {
    const x = pad.l + (i / 4) * iw;
    ctx.fillText(label, x - 8, h - 10);
  });

  ['R', 'G', 'B'].forEach((label, i) => {
    ctx.fillStyle = ['rgba(255,99,132,1)', 'rgba(52,211,153,1)', 'rgba(96,165,250,1)'][i];
    ctx.fillRect(pad.l + i * 58, 8, 18, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(label, pad.l + 24 + i * 58, 18);
  });
}

function buildIntegral(arr, width, height) {
  const stride = width + 1;
  const out = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y++) {
    let rowSum = 0;
    for (let x = 1; x <= width; x++) {
      rowSum += arr[(y - 1) * width + (x - 1)];
      out[y * stride + x] = out[(y - 1) * stride + x] + rowSum;
    }
  }
  return out;
}
function rectSum(integral, width, x0, y0, x1, y1) {
  const stride = width + 1;
  x0 = clamp(x0, 0, width);
  y0 = Math.max(y0, 0);
  x1 = clamp(x1, 0, width);
  y1 = Math.max(y1, 0);
  return integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0];
}

async function estimateStars(onProgress) {
  if (!state.imageData || !state.luminance) return [];
  const width = state.width;
  const height = state.height;
  const lum = state.luminance;
  const blur = new Float32Array(width * height);
  const w = getLocalWindow();
  const radius = Math.floor(w / 2);

  onProgress?.(8, 'preparando mapa de luminância');
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let s = 0;
      const idx = y * width + x;
      s += lum[idx] * 4;
      s += lum[idx - 1] + lum[idx + 1] + lum[idx - width] + lum[idx + width];
      blur[idx] = s / 8;
    }
    if (y % 48 === 0) {
      onProgress?.(8 + (y / height) * 22, 'calculando fundo local por janela deslizante');
      await nextFrame();
    }
  }

  const sq = new Float32Array(width * height);
  for (let i = 0; i < blur.length; i++) sq[i] = blur[i] * blur[i];
  const intBlur = buildIntegral(blur, width, height);
  const intSq = buildIntegral(sq, width, height);
  const candidates = [];

  const sigmaK = getDetectionSigmaK();
  const minPeak = lerp(14, 4, Number(els.sensitivitySlider.value) / 100);
  onProgress?.(34, 'buscando máximos locais candidatos');

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      const val = blur[idx];
      if (val < minPeak) continue;
      let localMax = true;
      for (let oy = -1; oy <= 1 && localMax; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          if (blur[idx + oy * width + ox] > val) { localMax = false; break; }
        }
      }
      if (!localMax) continue;
      const x0 = x - radius, y0 = y - radius, x1 = x + radius + 1, y1 = y + radius + 1;
      const area = (Math.min(width, x1) - Math.max(0, x0)) * (Math.min(height, y1) - Math.max(0, y0));
      const mean = rectSum(intBlur, width, x0, y0, x1, y1) / area;
      const meanSq = rectSum(intSq, width, x0, y0, x1, y1) / area;
      const variance = Math.max(0, meanSq - mean * mean);
      const sigma = Math.sqrt(variance) + 1e-3;
      const amp = val - mean;
      if (amp < Math.max(minPeak, sigmaK * sigma)) continue;

      const hotCross = blur[idx - 1] + blur[idx + 1] + blur[idx - width] + blur[idx + width];
      const hotDiag = blur[idx - width - 1] + blur[idx - width + 1] + blur[idx + width - 1] + blur[idx + width + 1];
      if ((hotCross + hotDiag) / 8 < mean + amp * 0.18) continue;

      const star = estimateStarProfile(x, y, blur, width, height, mean, amp);
      if (!star) continue;
      if (star.diameter < 0.1 || star.diameter > 100) continue;
      if (star.concentration < 0.12) continue;
      if (star.ellipticity > 0.88 && star.diameter < 1.2) continue;
      candidates.push(star);
    }
    if (y % 48 === 0) {
      onProgress?.(34 + (y / height) * 40, 'medindo perfis radiais e FWHM simplificada');
      await nextFrame();
    }
  }

  onProgress?.(78, 'consolidando detecções');
  candidates.sort((a, b) => b.peak - a.peak);
  const kept = [];
  for (let i = 0; i < candidates.length; i++) {
    const star = candidates[i];
    const tooClose = kept.some((k) => {
      const dx = k.x - star.x;
      const dy = k.y - star.y;
      const d = Math.hypot(dx, dy);
      return d < Math.max(1.1, Math.min(k.fwhm * 0.8 + star.fwhm * 0.8, 6));
    });
    if (!tooClose) kept.push(star);
    if (i % 250 === 0) {
      onProgress?.(78 + (i / Math.max(1, candidates.length)) * 18, 'removendo duplicatas e artefatos');
      await nextFrame();
    }
  }
  onProgress?.(100, 'análise concluída');
  return kept;
}

function estimateStarProfile(cx, cy, img, width, height, background, amp) {
  const maxRadius = 50;
  const rings = [];
  let totalFlux = 0;
  let weightedR2 = 0;
  let sumW = 0;
  let sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
  const aperture = Math.min(maxRadius, 16);
  for (let r = 0; r <= maxRadius; r += 0.5) {
    let ringFlux = 0;
    let samples = 0;
    const rMin = Math.max(0, r - 0.35);
    const rMax = r + 0.35;
    for (let oy = -Math.ceil(rMax); oy <= Math.ceil(rMax); oy++) {
      const y = cy + oy;
      if (y < 0 || y >= height) continue;
      for (let ox = -Math.ceil(rMax); ox <= Math.ceil(rMax); ox++) {
        const x = cx + ox;
        if (x < 0 || x >= width) continue;
        const dist = Math.hypot(ox, oy);
        if (dist >= rMin && dist < rMax) {
          ringFlux += img[y * width + x];
          samples++;
        }
      }
    }
    const mean = samples ? ringFlux / samples : background;
    rings.push({ r, mean });
  }

  const halfLevel = background + amp * 0.5;
  let halfRadius = null;
  for (let i = 1; i < rings.length; i++) {
    const prev = rings[i - 1], curr = rings[i];
    if (prev.mean >= halfLevel && curr.mean <= halfLevel) {
      const t = (halfLevel - prev.mean) / ((curr.mean - prev.mean) || 1e-6);
      halfRadius = prev.r + t * (curr.r - prev.r);
      break;
    }
  }
  if (halfRadius == null) halfRadius = amp > 28 ? 1.3 : 0.45;
  const fwhm = Math.max(0.1, halfRadius * 2);

  let growthRadius = Math.max(1.2, halfRadius * 3.2);
  for (let i = 1; i < rings.length; i++) {
    if (rings[i].mean < background + Math.max(amp * 0.12, 1.4)) {
      growthRadius = Math.max(growthRadius, rings[i].r);
      break;
    }
  }
  growthRadius = Math.min(growthRadius, maxRadius);
  const diameter = Math.max(0.1, Math.min(growthRadius * 2, 100));

  for (let oy = -Math.ceil(aperture); oy <= Math.ceil(aperture); oy++) {
    const y = cy + oy;
    if (y < 0 || y >= height) continue;
    for (let ox = -Math.ceil(aperture); ox <= Math.ceil(aperture); ox++) {
      const x = cx + ox;
      if (x < 0 || x >= width) continue;
      const dist = Math.hypot(ox, oy);
      if (dist <= Math.max(1.2, growthRadius)) {
        const val = img[y * width + x] - background;
        if (val > 0) {
          totalFlux += val;
          weightedR2 += val * dist * dist;
          sumW += val;
          sumX += val * ox;
          sumY += val * oy;
          sumXX += val * ox * ox;
          sumYY += val * oy * oy;
          sumXY += val * ox * oy;
        }
      }
    }
  }
  if (sumW <= 0) return null;
  const meanX = sumX / sumW, meanY = sumY / sumW;
  const covXX = Math.max(0, sumXX / sumW - meanX * meanX);
  const covYY = Math.max(0, sumYY / sumW - meanY * meanY);
  const covXY = sumXY / sumW - meanX * meanY;
  const trace = covXX + covYY;
  const detTerm = Math.sqrt(Math.max(0, (covXX - covYY) ** 2 + 4 * covXY * covXY));
  const l1 = Math.max(1e-6, (trace + detTerm) / 2);
  const l2 = Math.max(1e-6, (trace - detTerm) / 2);
  const ellipticity = 1 - Math.sqrt(l2 / l1);
  const rmsRadius = Math.sqrt(weightedR2 / sumW);
  const concentration = amp / (totalFlux + 1e-6);

  if (amp > 120 && diameter < 1.3) {
    return null;
  }
  if (fwhm < 0.18 && amp < 80) {
    return null;
  }
  return {
    x: cx,
    y: cy,
    peak: background + amp,
    background,
    amplitude: amp,
    fwhm,
    diameter,
    flux: totalFlux,
    ellipticity,
    concentration,
    rmsRadius,
  };
}

function renderPreview() {
  const bitmap = state.imageBitmap;
  if (!bitmap || !state.imageData) {
    previewCtx.clearRect(0, 0, els.previewCanvas.width, els.previewCanvas.height);
    return;
  }
  const targetMax = 860;
  const scale = Math.min(targetMax / state.width, targetMax / state.height, 1);
  els.previewCanvas.width = Math.max(1, Math.round(state.width * scale));
  els.previewCanvas.height = Math.max(1, Math.round(state.height * scale));

  const preview = new ImageData(new Uint8ClampedArray(state.imageData.data), state.width, state.height);
  const factor = getSensitivityFactor();
  const data = preview.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] * factor, 0, 255);
    data[i + 1] = clamp(data[i + 1] * factor, 0, 255);
    data[i + 2] = clamp(data[i + 2] * factor, 0, 255);
  }
  const temp = document.createElement('canvas');
  temp.width = state.width;
  temp.height = state.height;
  const tctx = temp.getContext('2d');
  tctx.putImageData(preview, 0, 0);
  previewCtx.clearRect(0, 0, els.previewCanvas.width, els.previewCanvas.height);
  previewCtx.drawImage(temp, 0, 0, els.previewCanvas.width, els.previewCanvas.height);
  drawOverlay(scale);
}

function drawOverlay(scale) {
  if (!state.stars.length) return;
  const { min, max } = getSelectedRange();
  const selected = state.stars.filter(s => s.diameter >= min && s.diameter <= max);
  state.lastOverlay = selected;
  for (const star of selected) {
    const x = star.x * scale;
    const y = star.y * scale;
    const r = Math.max(3, (star.fwhm * 0.5) * scale + 2);
    previewCtx.beginPath();
    previewCtx.arc(x, y, r, 0, Math.PI * 2);
    previewCtx.strokeStyle = 'rgba(103,232,249,0.95)';
    previewCtx.lineWidth = 1.4;
    previewCtx.stroke();
    previewCtx.beginPath();
    previewCtx.moveTo(x - 3, y);
    previewCtx.lineTo(x + 3, y);
    previewCtx.moveTo(x, y - 3);
    previewCtx.lineTo(x, y + 3);
    previewCtx.strokeStyle = 'rgba(255,255,255,0.9)';
    previewCtx.lineWidth = 1;
    previewCtx.stroke();
  }
}

function buildVariation(stars, rangeMin = 0.1, rangeMax = 100) {
  const start = Math.max(0.1, Math.min(rangeMin, rangeMax));
  const end = Math.max(start, Math.min(100, Math.max(rangeMin, rangeMax)));
  const span = end - start;
  const binCount = Math.max(1, Math.min(36, Math.ceil(span / 2.5), Math.ceil(stars.length || 1)));
  const binWidth = span / binCount || 0.1;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    start: start + i * binWidth,
    end: i === binCount - 1 ? end : start + (i + 1) * binWidth,
    count: 0,
  }));
  for (const star of stars) {
    if (star.diameter < start || star.diameter > end) continue;
    let idx = Math.floor((star.diameter - start) / (binWidth || 0.1));
    idx = Math.max(0, Math.min(binCount - 1, idx));
    bins[idx].count++;
  }
  return bins.map((b) => ({
    start: Number(b.start.toFixed(2)),
    end: Number(b.end.toFixed(2)),
    label: `${b.start.toFixed(1).replace('.', ',')}–${b.end.toFixed(1).replace('.', ',')}`,
    count: b.count,
  }));
}

function drawVariationChart() {
  const points = state.variation;
  const ctx = variationCtx;
  const canvas = els.variationCanvas;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, w, h);
  const pad = { l: 56, r: 20, t: 24, b: 56 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const minX = 0.1;
  const maxX = 10;
  const spanX = maxX - minX;

  if (!points.length) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '14px Inter, Arial';
    ctx.fillText('Execute a análise para visualizar o gráfico.', 24, 30);
    return;
  }

  const visible = points.filter(p => p.end >= minX && p.start <= maxX);
  const maxCount = Math.max(1, ...visible.map(p => p.count), 0);

  ctx.strokeStyle = 'rgba(148,163,184,0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (ih / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + iw, y);
    ctx.stroke();
    const val = Math.round(maxCount - (maxCount * i / 4));
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, Arial';
    ctx.fillText(String(val), 20, y + 4);
  }

  const xAt = (v) => pad.l + ((v - minX) / spanX) * iw;
  const linePoints = visible.map((p) => ({
    x: xAt((p.start + p.end) / 2),
    y: pad.t + ih - (p.count / maxCount) * ih,
  }));

  ctx.beginPath();
  linePoints.forEach((pt, i) => {
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.strokeStyle = 'rgba(129,140,248,0.98)';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(191,219,254,0.95)';
  linePoints.forEach((pt) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2.7, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.strokeStyle = 'rgba(226,232,240,0.85)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t + ih);
  ctx.lineTo(pad.l + iw, pad.t + ih);
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px Inter, Arial';
  const ticks = [0.1, 2.5, 5.0, 7.5, 10.0];
  ticks.forEach((tick) => {
    const x = xAt(tick);
    ctx.beginPath();
    ctx.moveTo(x, pad.t + ih);
    ctx.lineTo(x, pad.t + ih + 6);
    ctx.strokeStyle = 'rgba(148,163,184,0.42)';
    ctx.stroke();
    ctx.textAlign = tick === minX ? 'left' : tick === maxX ? 'right' : 'center';
    ctx.fillText(`${tick.toFixed(1).replace('.', ',')} px`, x, h - 14);
  });
  ctx.textAlign = 'left';
}

function updateMetricsAndVariation() {
  const { min, max } = getSelectedRange();
  const selected = state.stars.filter(s => s.diameter >= min && s.diameter <= max);
  state.variation = buildVariation(selected, min, max);
  const selectedCount = selected.length;
  const avgFwhm = selectedCount ? selected.reduce((acc, s) => acc + s.fwhm, 0) / selectedCount : 0;
  const summedCount = state.variation.reduce((acc, p) => acc + p.count, 0);

  els.summedCount.textContent = String(summedCount);
  els.fwhmAvg.textContent = `${avgFwhm.toFixed(2).replace('.', ',')} px`;
  renderPreview();
  drawVariationChart();

  updateSummary([
    `Estrelas detectadas na faixa selecionada: <strong>${selectedCount}</strong>.`,
    `Somatória no intervalo atual do slider: <strong>${summedCount}</strong>.`,
    `FWHM média no intervalo: <strong>${avgFwhm.toFixed(2).replace('.', ',')} px</strong>.`,
    `Método: fundo local por janela deslizante, limiar adaptativo por sigma local, rejeição de hot pixels por suporte vizinho e perfil radial com FWHM simplificada.`,
  ].join(' '));
}

function updateSummary(html) {
  els.analysisSummary.innerHTML = html;
}

async function runAnalysis() {
  if (!state.imageData) {
    updateSummary('Carregue uma imagem antes de executar a análise.');
    return;
  }
  try {
    state.progressStartedAt = performance.now();
    showProgress(0, 'iniciando análise');
    updateSummary('Processando imagem: calculando fundo local, picos candidatos, perfil radial e FWHM simplificada...');
    await nextFrame();
    state.stars = await estimateStars((pct, text) => showProgress(pct, text));
    updateMetricsAndVariation();
    showProgress(100, 'resultado calculado');
    await new Promise(r => setTimeout(r, 450));
  } finally {
    hideProgress();
  }
}

function exportMarkedImage() {
  if (!state.imageData) return;
  const out = document.createElement('canvas');
  const upscale = 2;
  out.width = state.width * upscale;
  out.height = state.height * upscale;
  const ctx = out.getContext('2d');
  ctx.drawImage(state.originalCanvas, 0, 0, out.width, out.height);
  ctx.save();
  ctx.scale(upscale, upscale);
  const { min, max } = getSelectedRange();
  const selected = state.stars.filter(s => s.diameter >= min && s.diameter <= max);
  selected.forEach(star => {
    const r = Math.max(4, star.fwhm * 0.6 + 2.5);
    ctx.beginPath();
    ctx.arc(star.x, star.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(103,232,249,0.96)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(star.x - 4, star.y);
    ctx.lineTo(star.x + 4, star.y);
    ctx.moveTo(star.x, star.y - 4);
    ctx.lineTo(star.x, star.y + 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 1.05;
    ctx.stroke();
  });
  ctx.restore();

  if (els.exportCaption.checked) {
    const avgFwhm = selected.length ? selected.reduce((acc, s) => acc + s.fwhm, 0) / selected.length : 0;
    const lines = [
      `Estrelas detectadas: ${selected.length}`,
      `Faixa de diâmetro detectado: ${min.toFixed(1).replace('.', ',')}–${max.toFixed(1).replace('.', ',')} px`,
      `FWHM média no intervalo: ${avgFwhm.toFixed(2).replace('.', ',')} px`,
      'Método: fundo local por janela deslizante, limiar adaptativo por sigma local,',
      'rejeição de hot pixels por suporte vizinho e perfil radial com FWHM simplificada.',
    ];
    const pad = 20;
    const boxPad = 12;
    const lineHeight = 28;
    ctx.save();
    const fontSize = 24;
    ctx.font = `${fontSize}px Lora, serif`;
    const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
    const boxWidth = maxWidth + boxPad * 2;
    const boxHeight = lines.length * lineHeight + boxPad * 2;
    const x = pad;
    const y = out.height - boxHeight - pad;
    ctx.fillStyle = 'rgba(0,0,0,0.60)';
    ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => ctx.fillText(line, x + boxPad, y + boxPad + i * lineHeight));
    ctx.restore();
  }

  const format = els.exportFormat.value;
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = format === 'png' ? undefined : 0.97;
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `star-counter-marked.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, mime, quality);
}

els.imageInput.addEventListener('change', (e) => loadImageFile(e.target.files?.[0]));
els.sensitivitySlider.addEventListener('input', () => {
  els.sensitivityValue.textContent = `${els.sensitivitySlider.value}%`;
  renderPreview();
});
els.sizeMinSlider.addEventListener('input', syncRangeFromSliders);
els.sizeMaxSlider.addEventListener('input', syncRangeFromSliders);
els.sizeMinInput.addEventListener('input', syncRangeFromInputs);
els.sizeMaxInput.addEventListener('input', syncRangeFromInputs);
els.analyzeBtn.addEventListener('click', runAnalysis);
els.exportBtn.addEventListener('click', exportMarkedImage);

syncRangeFromSliders();
