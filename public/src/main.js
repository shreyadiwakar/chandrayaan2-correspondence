/**
 * Chandrayaan-2 Lunar Image Correspondence - Frontend Client
 */

let currentPreset = null;
let currentResult = null;
let errorChartInstance = null;
let activeView = 'correspondence';

// Initialize App on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Initialize Cinematic Sky Hero Scroll Animation
  initCinematicSkyHero();

  // Bind UI Event Listeners
  bindEventListeners();

  // Load Presets from Node.js Express Backend
  await loadPresets();

  // Initialize Error Histogram Chart
  initChart();
});

function bindEventListeners() {
  const runBtn = document.getElementById('runRegistrationBtn');
  if (runBtn) runBtn.addEventListener('click', runRegistration);

  const algSel = document.getElementById('algSelector');
  if (algSel) algSel.addEventListener('change', runRegistration);

  const gridBinsSel = document.getElementById('gridBinsSelector');
  if (gridBinsSel) gridBinsSel.addEventListener('change', runRegistration);

  const maxPointsSel = document.getElementById('maxPointsSelector');
  if (maxPointsSel) maxPointsSel.addEventListener('change', runRegistration);

  const srcUpload = document.getElementById('sourceUploadInput');
  if (srcUpload) srcUpload.addEventListener('change', handleUpload);

  const refUpload = document.getElementById('refUploadInput');
  if (refUpload) refUpload.addEventListener('change', handleUpload);
}

// Fetch Presets Catalog from Backend
async function loadPresets() {
  try {
    const response = await fetch('/api/presets');
    const data = await response.json();

    if (data.success && data.presets.length > 0) {
      renderPresets(data.presets);
      selectPreset(data.presets[0]);
    }
  } catch (err) {
    console.error('Failed to fetch presets:', err);
  }
}

// Render Presets Cards
function renderPresets(presets) {
  const container = document.getElementById('presetsContainer');
  if (!container) return;
  container.innerHTML = '';

  presets.forEach(p => {
    const card = document.createElement('div');
    card.className = 'preset-card p-3 rounded-xl flex flex-col justify-between space-y-2';
    card.dataset.id = p.id;
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between text-[11px] font-mono text-cyan-400 mb-1">
          <span>${p.category}</span>
          <span class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">${p.scaleDisparity || p.shadowDisparity || p.spectralMode}</span>
        </div>
        <div class="font-bold text-xs text-slate-200">${p.title}</div>
        <p class="text-[11px] text-slate-400 mt-1 line-clamp-2">${p.description}</p>
      </div>
      <div class="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800 flex justify-between">
        <span>Src: ${p.source.instrument}</span>
        <span>Ref: ${p.reference.instrument}</span>
      </div>
    `;

    card.addEventListener('click', () => selectPreset(p));
    container.appendChild(card);
  });
}

// Select a Preset Scenario
function selectPreset(preset) {
  currentPreset = preset;

  // Highlight active preset card
  document.querySelectorAll('.preset-card').forEach(card => {
    card.classList.toggle('active', card.dataset.id === preset.id);
  });

  // Update Image Elements
  const srcImg = document.getElementById('sourceImg');
  const refImg = document.getElementById('refImg');
  const wipeSrc = document.getElementById('wipeSourceImg');
  const wipeRef = document.getElementById('wipeRefImg');

  if (srcImg) srcImg.src = preset.source.imagePath;
  if (refImg) refImg.src = preset.reference.imagePath;
  if (wipeSrc) wipeSrc.src = preset.source.imagePath;
  if (wipeRef) wipeRef.src = preset.reference.imagePath;

  // Update Metadata Badges
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setTxt('srcInstrumentBadge', preset.source.instrument);
  setTxt('refInstrumentBadge', preset.reference.instrument);
  setTxt('srcSensor', preset.source.instrument);
  setTxt('refSensor', preset.reference.instrument);
  setTxt('srcRes', `${preset.source.resolution} m/px`);
  setTxt('refRes', `${preset.reference.resolution} m/px`);
  setTxt('srcSunElev', preset.source.sunElevation ? `${preset.source.sunElevation}°` : 'N/A');
  setTxt('refSunElev', preset.reference.sunElevation ? `${preset.reference.sunElevation}°` : 'N/A');

  // Set recommended algorithm
  const algSel = document.getElementById('algSelector');
  if (preset.recommendedAlg && algSel) {
    algSel.value = preset.recommendedAlg;
  }

  // Run Correspondence Registration
  runRegistration();
}

// Trigger Registration Endpoint via Express Backend
async function runRegistration() {
  const algEl = document.getElementById('algSelector');
  const binsEl = document.getElementById('gridBinsSelector');
  const maxPtsEl = document.getElementById('maxPointsSelector');

  const requestBody = {
    algorithm: algEl ? algEl.value : 'SIFT-ORB-HYBRID',
    bins: binsEl ? binsEl.value : '4x4',
    maxPoints: maxPtsEl ? maxPtsEl.value : '1000',
    sourceMeta: currentPreset ? currentPreset.source : {},
    referenceMeta: currentPreset ? currentPreset.reference : {}
  };

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await res.json();
    if (data.success) {
      currentResult = data;
      updateMetricsUI(data);
      renderAllCanvases(data);
    }
  } catch (err) {
    console.error('Error running registration:', err);
  }
}

// Update Analytics Dashboard UI
function updateMetricsUI(data) {
  const metrics = data.subPixelMetrics;
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // Header badges
  setTxt('headerUniformity', `${data.uniformityScorePct}%`);
  setTxt('headerStatus', metrics.targetMet ? 'Sub-Pixel Precision' : 'Matching Active');
  setTxt('srcKeypointsCount', `${data.correspondencesCount} pts`);
  setTxt('refKeypointsCount', `${data.correspondencesCount} pts`);

  // Status Cards
  setTxt('rmseValue', `${metrics.rmsePx} px`);
  setTxt('meanErrorVal', `${metrics.meanErrorPx} px`);
  setTxt('maxErrorVal', `${metrics.maxErrorPx} px`);
  setTxt('precisionVal', `${metrics.subPixelPrecisionPct}%`);
  setTxt('stdDevVal', `${metrics.stdDevPx} px`);
  setTxt('uniformityScoreBadge', `${data.uniformityScorePct}%`);

  // Homography Matrix Grid
  const H = data.homographyMatrix;
  const matrixContainer = document.getElementById('homographyMatrixGrid');
  if (matrixContainer && H) {
    matrixContainer.innerHTML = `
      <div>${H[0][0].toFixed(4)}</div><div>${H[0][1].toFixed(4)}</div><div>${H[0][2].toFixed(3)}</div>
      <div>${H[1][0].toFixed(4)}</div><div>${H[1][1].toFixed(4)}</div><div>${H[1][2].toFixed(3)}</div>
      <div>${H[2][0].toFixed(4)}</div><div>${H[2][1].toFixed(4)}</div><div>${H[2][2].toFixed(4)}</div>
    `;
  }

  // Transformation readouts
  const tf = data.transformation;
  if (tf) {
    setTxt('transX', `${tf.translationX_px > 0 ? '+' : ''}${tf.translationX_px} px`);
    setTxt('transY', `${tf.translationY_px > 0 ? '+' : ''}${tf.translationY_px} px`);
    setTxt('rotDeg', `${tf.rotation_deg}°`);
    setTxt('scaleFactor', `${tf.scaleFactor}x`);
  }

  // Update Error Histogram Chart
  updateChart(data.errorHistogram);

  // Render Spatial Uniformity Heatmap
  renderSpatialHeatmap(data.spatialGridBins);
}

// Render Spatial Grid Uniformity Heatmap
function renderSpatialHeatmap(spatialGridBins) {
  const container = document.getElementById('spatialHeatmapContainer');
  if (!container || !spatialGridBins || !spatialGridBins.cellCounts) return;

  const counts = spatialGridBins.cellCounts;
  const bins = counts.length;
  container.style.gridTemplateColumns = `repeat(${bins}, minmax(0, 1fr))`;
  container.innerHTML = '';

  const maxVal = Math.max(...counts.flat()) || 1;

  for (let r = 0; r < bins; r++) {
    for (let c = 0; c < bins; c++) {
      const cnt = counts[r][c];
      const alpha = Math.max(0.15, (cnt / maxVal) * 0.85);

      const tile = document.createElement('div');
      tile.className = 'rounded-sm transition-all duration-200 hover:scale-125 hover:z-20 cursor-pointer';
      tile.style.backgroundColor = `rgba(6, 182, 212, ${alpha})`;
      tile.title = `Grid [${r},${c}]: ${cnt} Keypoints`;
      container.appendChild(tile);
    }
  }
}

// Render Canvases for Source, Reference, and Selected View Mode
function renderAllCanvases(data) {
  renderSourceKeypoints(data.correspondences);
  renderRefKeypoints(data.correspondences);
  renderCorrespondenceLines(data.correspondences);
  renderCheckerboardCanvas();
  renderQuiverCanvas(data.correspondences);
}

// Render Keypoints on Source Image
function renderSourceKeypoints(correspondences) {
  const canvas = document.getElementById('sourceCanvas');
  const img = document.getElementById('sourceImg');
  if (!canvas || !img) return;

  canvas.width = img.clientWidth || 400;
  canvas.height = img.clientHeight || 380;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  correspondences.forEach(c => {
    const x = (c.srcX / 800) * canvas.width;
    const y = (c.srcY / 800) * canvas.height;

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#06b6d4';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  });
}

// Render Keypoints on Reference Image
function renderRefKeypoints(correspondences) {
  const canvas = document.getElementById('refCanvas');
  const img = document.getElementById('refImg');
  if (!canvas || !img) return;

  canvas.width = img.clientWidth || 400;
  canvas.height = img.clientHeight || 380;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  correspondences.forEach(c => {
    const x = (c.refX / 800) * canvas.width;
    const y = (c.refY / 800) * canvas.height;

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  });
}

// View 1: Render Dual Correspondence Connecting Lines
function renderCorrespondenceLines(correspondences) {
  const canvas = document.getElementById('correspondenceLinesCanvas');
  if (!canvas || !canvas.parentElement) return;
  const parent = canvas.parentElement;

  canvas.width = parent.clientWidth || 800;
  canvas.height = parent.clientHeight || 440;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const halfW = canvas.width / 2;

  correspondences.forEach(c => {
    const srcX = (c.srcX / 800) * (halfW - 20) + 10;
    const srcY = (c.srcY / 800) * (canvas.height - 40) + 20;

    const refX = halfW + (c.refX / 800) * (halfW - 20) + 10;
    const refY = (c.refY / 800) * (canvas.height - 40) + 20;

    const lineColor = c.residualError < 0.15 ? 'rgba(52, 211, 153, 0.45)' : 'rgba(6, 182, 212, 0.45)';

    ctx.beginPath();
    ctx.moveTo(srcX, srcY);
    ctx.lineTo(refX, refY);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(srcX, srcY, 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#06b6d4';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(refX, refY, 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#10b981';
    ctx.fill();
  });
}

// View 3: Render Checkerboard Overlay
function renderCheckerboardCanvas() {
  const canvas = document.getElementById('checkerboardCanvas');
  if (!canvas || !canvas.parentElement) return;
  const parent = canvas.parentElement;

  canvas.width = parent.clientWidth || 800;
  canvas.height = parent.clientHeight || 440;
  const ctx = canvas.getContext('2d');

  const srcImg = document.getElementById('sourceImg');
  const refImg = document.getElementById('refImg');

  const tileSize = 60;
  const cols = Math.ceil(canvas.width / tileSize);
  const rows = Math.ceil(canvas.height / tileSize);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isSource = (r + c) % 2 === 0;
      const targetImg = isSource ? srcImg : refImg;

      if (targetImg && targetImg.complete && targetImg.naturalWidth > 0) {
        ctx.drawImage(
          targetImg,
          (c * tileSize / canvas.width) * targetImg.naturalWidth,
          (r * tileSize / canvas.height) * targetImg.naturalHeight,
          (tileSize / canvas.width) * targetImg.naturalWidth,
          (tileSize / canvas.height) * targetImg.naturalHeight,
          c * tileSize, r * tileSize, tileSize, tileSize
        );
      } else {
        ctx.fillStyle = isSource ? '#0f172a' : '#1e293b';
        ctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
      }

      ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(c * tileSize, r * tileSize, tileSize, tileSize);
    }
  }
}

// View 4: Render Quiver Vector Map
function renderQuiverCanvas(correspondences) {
  const canvas = document.getElementById('quiverCanvas');
  if (!canvas || !canvas.parentElement) return;
  const parent = canvas.parentElement;

  canvas.width = parent.clientWidth || 800;
  canvas.height = parent.clientHeight || 440;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  correspondences.forEach(c => {
    const x = (c.srcX / 800) * canvas.width;
    const y = (c.srcY / 800) * canvas.height;

    const dx = c.subPixelDx * 80;
    const dy = c.subPixelDy * 80;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + dx, y + dy, 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#34d399';
    ctx.fill();
  });
}

// Switch Active View Mode
function switchViewMode(viewName) {
  document.querySelectorAll('.result-view').forEach(v => v.classList.add('hidden'));

  if (viewName === 'correspondence') {
    const el = document.getElementById('viewCorrespondence');
    if (el) el.classList.remove('hidden');
  } else if (viewName === 'wipe') {
    const el = document.getElementById('viewWipe');
    if (el) el.classList.remove('hidden');
  } else if (viewName === 'checkerboard') {
    const el = document.getElementById('viewCheckerboard');
    if (el) el.classList.remove('hidden');
    renderCheckerboardCanvas();
  } else if (viewName === 'quiver') {
    const el = document.getElementById('viewQuiver');
    if (el) el.classList.remove('hidden');
    if (currentResult) renderQuiverCanvas(currentResult.correspondences);
  }
}

// Initialize Chart.js Histogram
function initChart() {
  const chartEl = document.getElementById('errorChart');
  if (!chartEl) return;
  const ctx = chartEl.getContext('2d');
  errorChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['0.00-0.05px', '0.05-0.10px', '0.10-0.15px', '0.15-0.20px', '0.20-0.25px', '>0.25px'],
      datasets: [{
        label: 'Keypoint Frequency',
        data: [24, 48, 32, 12, 4, 0],
        backgroundColor: 'rgba(6, 182, 212, 0.65)',
        borderColor: '#06b6d4',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { display: false } },
        y: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(51, 65, 85, 0.3)' } }
      }
    }
  });
}

function updateChart(histogramData) {
  if (errorChartInstance && histogramData) {
    errorChartInstance.data.labels = histogramData.labels;
    errorChartInstance.data.datasets[0].data = histogramData.counts;
    errorChartInstance.update();
  }
}

// Handle Custom Image Upload
async function handleUpload(e) {
  const input = e.target;
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];
  const localUrl = URL.createObjectURL(file);

  const formData = new FormData();
  if (input.id === 'sourceUploadInput') {
    formData.append('sourceImage', file);

    const srcImg = document.getElementById('sourceImg');
    const wipeSrc = document.getElementById('wipeSourceImg');
    const srcSensor = document.getElementById('srcSensor');
    const srcContainer = document.getElementById('sourcePreviewContainer');

    if (srcImg) srcImg.src = localUrl;
    if (wipeSrc) wipeSrc.src = localUrl;
    if (srcSensor) srcSensor.textContent = file.name;
    if (srcContainer) srcContainer.classList.remove('hidden');
  } else {
    formData.append('referenceImage', file);

    const refImg = document.getElementById('refImg');
    const wipeRef = document.getElementById('wipeRefImg');
    const refSensor = document.getElementById('refSensor');
    const refContainer = document.getElementById('refPreviewContainer');

    if (refImg) refImg.src = localUrl;
    if (wipeRef) wipeRef.src = localUrl;
    if (refSensor) refSensor.textContent = file.name;
    if (refContainer) refContainer.classList.remove('hidden');
  }

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      if (data.uploadedSource) {
        if (currentPreset && currentPreset.source) {
          currentPreset.source.imagePath = data.uploadedSource.path;
        }
      }
      if (data.uploadedReference) {
        if (currentPreset && currentPreset.reference) {
          currentPreset.reference.imagePath = data.uploadedReference.path;
        }
      }
      runRegistration();
    }
  } catch (err) {
    console.error('Upload failed:', err);
  }
}

// --- Cinematic Sky Hero Animation Controller ---
function initCinematicSkyHero() {
  const heroSection = document.getElementById('heroSky');
  if (!heroSection) return;

  const starfieldContainer = document.getElementById('starfieldContainer');
  const moonImg = document.getElementById('heroMoon');
  const earthContainer = document.getElementById('heroEarthContainer');
  const startTitle = document.getElementById('heroStartTitle');
  const endTitle = document.getElementById('heroEndTitle');

  // Generate Multi-layer Starfield
  let starLayers = [];
  if (starfieldContainer) {
    starLayers = generateStarfield(starfieldContainer);
  }

  let targetP = 0;
  let currentP = 0;
  let globalP = 0;

  function measureScroll() {
    const rect = heroSection.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const scrolled = -rect.top;
    targetP = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;

    // Global scroll calculation across complete document for continuous star parallax
    const docScrollTotal = document.documentElement.scrollHeight - window.innerHeight;
    globalP = docScrollTotal > 0 ? Math.min(1, Math.max(0, window.scrollY / docScrollTotal)) : 0;
  }

  // Smoothstep ramp function
  function ramp(p, from, to) {
    const t = Math.min(1, Math.max(0, (p - from) / (to - from)));
    return t * t * (3 - 2 * t);
  }

  function loop() {
    // Low-pass filter for smooth momentum scroll
    currentP += (targetP - currentP) * 0.06;
    if (Math.abs(targetP - currentP) < 0.0001) {
      currentP = targetP;
    }
    const p = currentP;

    // Starfield parallax driven by global page scroll across the COMPLETE website
    if (starfieldContainer) {
      starfieldContainer.style.transform = `scale(${1 + globalP * 0.15})`;
    }
    if (starLayers.length >= 3) {
      starLayers[0].style.transform = `translate3d(0, ${globalP * 120}px, 0)`;
      starLayers[1].style.transform = `translate3d(0, ${globalP * 280}px, 0)`;
      starLayers[2].style.transform = `translate3d(0, ${globalP * 500}px, 0)`;
    }

    // Moon Orbital Revolution & Spiral Zoom equations
    const spin = Math.min(1, p / 0.50);
    const theta = spin * Math.PI * 3.5 - Math.PI / 2;

    const merge = ramp(p, 0.20, 0.50);
    const radius = 40 * (1 - merge); // vmin -> 0 at p=0.50 (Moon centers completely over screen!)
    const x = Math.cos(theta) * radius;
    const y = Math.sin(theta) * radius * 0.34;

    const depth = (Math.sin(theta) + 1) / 2; // 0 = far behind, 1 = near
    const orbitScale = 0.85 + depth * 0.15;
    const zoom = 0.20 + ramp(p, 0.20, 0.50) * 0.45; // crisp, elegant full moon scale (~0.65)

    // Moon stays at clean full moon scale while second title displays over it,
    // then gently expands to ~2.8x at the end (p = 0.80 -> 1.0) to smoothly exit frame
    const giantExpand = ramp(p, 0.80, 1.0) * 2.2;
    const currentScale = (zoom * orbitScale) + giantExpand;

    // Earth stays visible as Moon merges on top, then gently fades out
    const earthOut = ramp(p, 0.25, 0.50);

    if (earthContainer) {
      earthContainer.style.opacity = (1 - earthOut).toFixed(4);
    }

    if (moonImg) {
      // During merge phase, ensure Moon is always on top (zIndex = 3)
      moonImg.style.zIndex = (depth > 0.5 || merge > 0.4) ? '3' : '1';
      moonImg.style.opacity = '1';
      moonImg.style.transform = `translate3d(${x}vmin, ${y}vmin, 0) scale(${currentScale.toFixed(4)})`;
      moonImg.style.filter = `brightness(${0.60 + depth * 0.20 + merge * 0.25}) drop-shadow(0 0 ${25 + merge * 45}px rgba(56, 189, 248, 0.4))`;
    }

    // Start & End Typography Opacity & Translation Ramps
    // 1. Start Title stays visible over Earth, then fades out as Moon centers (p = 0.25 -> 0.48)
    if (startTitle) {
      const startOut = ramp(p, 0.25, 0.48);
      startTitle.style.opacity = (1 - startOut).toFixed(4);
      startTitle.style.transform = `translateY(${-startOut * 35}px)`;
    }
    // 2. End Title appears slowly OVER the Moon AFTER Moon appears completely (p >= 0.50),
    // and stays fully visible until the hero animation completes (p >= 0.95)
    if (endTitle) {
      const endIn = ramp(p, 0.50, 0.68);
      const endOut = ramp(p, 0.95, 1.0);
      const finalOpacity = endIn * (1 - endOut);
      endTitle.style.opacity = finalOpacity.toFixed(4);
      endTitle.style.transform = `translate(-50%, -50%) scale(${0.94 + endIn * 0.06})`;
    }

    requestAnimationFrame(loop);
  }

  measureScroll();
  currentP = targetP;
  window.addEventListener('scroll', measureScroll, { passive: true });
  window.addEventListener('resize', measureScroll);

  requestAnimationFrame(loop);
}

function generateStarfield(container) {
  container.innerHTML = '';

  const makeStars = (count, seed) => {
    let s = seed;
    const rand = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    return Array.from({ length: count }, () => ({
      left: rand() * 100,
      top: rand() * 100,
      size: 0.8 + rand() * 2.2,
      delay: rand() * 6,
      duration: 2.5 + rand() * 5,
      opacity: 0.35 + rand() * 0.65,
    }));
  };

  const layerSpecs = [
    { count: 90, seed: 7, speed: 200 },
    { count: 60, seed: 91, speed: 130 },
    { count: 35, seed: 523, speed: 85 },
  ];

  const layerDivs = [];

  layerSpecs.forEach((spec) => {
    // Outer layer wrapper for parallax scroll translation
    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'absolute inset-x-0 top-0 h-[250%] will-change-transform pointer-events-none';

    // Inner container for continuous linear star drift
    const driftDiv = document.createElement('div');
    driftDiv.className = 'absolute inset-0';
    driftDiv.style.animation = `star-drift ${spec.speed}s linear infinite`;

    const stars = makeStars(spec.count, spec.seed);

    // Top half stars
    stars.forEach((star) => {
      const starEl = document.createElement('span');
      starEl.className = 'absolute rounded-full bg-white';
      starEl.style.left = `${star.left}%`;
      starEl.style.top = `${star.top / 2}%`;
      starEl.style.width = `${star.size}px`;
      starEl.style.height = `${star.size}px`;
      starEl.style.opacity = star.opacity;
      starEl.style.boxShadow = `0 0 ${star.size * 4}px rgba(56, 189, 248, 0.8), 0 0 ${star.size * 8}px rgba(56, 189, 248, 0.4)`;
      starEl.style.animation = `twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`;
      driftDiv.appendChild(starEl);
    });

    // Bottom half stars (tiled for seamless looping animation)
    stars.forEach((star) => {
      const starEl = document.createElement('span');
      starEl.className = 'absolute rounded-full bg-white';
      starEl.style.left = `${star.left}%`;
      starEl.style.top = `${50 + star.top / 2}%`;
      starEl.style.width = `${star.size}px`;
      starEl.style.height = `${star.size}px`;
      starEl.style.opacity = star.opacity;
      starEl.style.boxShadow = `0 0 ${star.size * 4}px rgba(56, 189, 248, 0.8), 0 0 ${star.size * 8}px rgba(56, 189, 248, 0.4)`;
      starEl.style.animation = `twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`;
      driftDiv.appendChild(starEl);
    });

    wrapperDiv.appendChild(driftDiv);
    container.appendChild(wrapperDiv);
    layerDivs.push(wrapperDiv);
  });

  // Add shooting stars
  [0, 8, 16, 24].forEach((delay, i) => {
    const shooter = document.createElement('span');
    shooter.className = 'absolute h-px w-32 rounded-full bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none';
    shooter.style.left = `${-10 + i * 8}%`;
    shooter.style.top = `${8 + i * 14}%`;
    shooter.style.opacity = '0';
    shooter.style.animation = `shooting 12s linear ${delay}s infinite`;
    container.appendChild(shooter);
  });

  return layerDivs;
}
