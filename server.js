import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { CorrespondenceEngine } from './lib/correspondence-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure upload storage
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Serve static assets & frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Instantiates scientific registration engine
const engine = new CorrespondenceEngine();

// Datasets catalog for Chandrayaan-2 payloads
const presetsCatalog = [
  {
    id: 'preset-tycho-scale',
    title: 'Tycho Crater Rim (OHRC vs TMC-2)',
    description: 'High resolution scale disparity matching between OHRC (0.25m/px) and TMC-2 (5.0m/px) stereo base map.',
    category: 'Scale-Invariant Disparity',
    source: {
      instrument: 'OHRC (Orbiter High Resolution Camera)',
      resolution: 0.25,
      sunElevation: 42.1,
      sunAzimuth: 118.5,
      imagePath: '/assets/ohrc_source.jpg',
      label: 'Source (Moving) - OHRC 0.25m'
    },
    reference: {
      instrument: 'TMC-2 (Terrain Mapping Camera)',
      resolution: 5.00,
      sunElevation: 40.8,
      sunAzimuth: 120.1,
      imagePath: '/assets/tmc_ref.jpg',
      label: 'Reference (Fixed) - TMC-2 5.0m'
    },
    recommendedAlg: 'scale-pyramid',
    scaleDisparity: '20:1 Ratio'
  },
  {
    id: 'preset-shackleton-sun',
    title: 'Shackleton Crater South Pole (Extreme Sun Disparity)',
    description: 'Sun-angle shadow-invariant matching across low elevation illumination (5° morning raking light vs 35° noon sun).',
    category: 'Sun-Angle Shadow Invariant',
    source: {
      instrument: 'OHRC (Low Elevation Sun 5°)',
      resolution: 0.25,
      sunElevation: 5.2,
      sunAzimuth: 84.3,
      imagePath: '/assets/shackleton_low_sun.jpg',
      label: 'Source (Moving) - Extreme Raking Shadow'
    },
    reference: {
      instrument: 'OHRC (High Elevation Sun 35°)',
      resolution: 0.25,
      sunElevation: 35.0,
      sunAzimuth: 142.8,
      imagePath: '/assets/ohrc_source.jpg',
      label: 'Reference (Fixed) - Moderate Illumination'
    },
    recommendedAlg: 'sun-angle-invariant',
    shadowDisparity: 'Severe (5° vs 35°)'
  },
  {
    id: 'preset-iirs-multimodal',
    title: 'Mare Infrared vs Optical (IIRS vs OHRC)',
    description: 'Multi-modal cross-spectral correspondence between IIRS (2.1µm Infrared Band) and OHRC Panchromatic optical imagery.',
    category: 'Multi-Modal Cross-Spectral',
    source: {
      instrument: 'IIRS (Imaging Infrared Spectrometer 2.1µm)',
      resolution: 0.80,
      spectralBand: '2.1 µm IR',
      imagePath: '/assets/iirs_ir.jpg',
      label: 'Source (Moving) - IIRS 2.1µm Band'
    },
    reference: {
      instrument: 'OHRC Panchromatic Optical',
      resolution: 0.25,
      spectralBand: '0.45 - 0.75 µm Pan',
      imagePath: '/assets/ohrc_source.jpg',
      label: 'Reference (Fixed) - OHRC Optical'
    },
    recommendedAlg: 'multi-modal-infrared',
    spectralMode: 'Infrared-to-Optical'
  }
];

// --- API Endpoints ---

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Chandrayaan-2 Image Correspondence API',
    engineVersion: '2.4.0-subpixel',
    accuracyTarget: '< 0.20 px RMSE'
  });
});

// Get Preset Datasets
app.get('/api/presets', (req, res) => {
  res.json({
    success: true,
    presets: presetsCatalog
  });
});

// Run Correspondence Registration API
app.post('/api/register', (req, res) => {
  try {
    const {
      algorithm = 'sun-angle-invariant',
      bins = 10,
      maxPoints = 120,
      sourceMeta = {},
      referenceMeta = {}
    } = req.body || {};

    const result = engine.processRegistration({
      sourceMeta,
      referenceMeta,
      algorithm,
      bins: parseInt(bins, 10) || 10,
      maxPoints: parseInt(maxPoints, 10) || 120
    });

    res.json(result);
  } catch (error) {
    console.error('Error executing correspondence engine:', error);
    res.status(500).json({
      success: false,
      error: 'Correspondence registration failed',
      details: error.message
    });
  }
});

// Handle custom image uploads (Source & Reference)
app.post('/api/upload', upload.fields([
  { name: 'sourceImage', maxCount: 1 },
  { name: 'referenceImage', maxCount: 1 }
]), (req, res) => {
  try {
    const files = req.files || {};
    const sourceFile = files.sourceImage ? files.sourceImage[0] : null;
    const refFile = files.referenceImage ? files.referenceImage[0] : null;

    res.json({
      success: true,
      message: 'Images uploaded successfully',
      uploadedSource: sourceFile ? {
        path: `/uploads/${sourceFile.filename}`,
        originalName: sourceFile.originalname,
        sizeBytes: sourceFile.size
      } : null,
      uploadedReference: refFile ? {
        path: `/uploads/${refFile.filename}`,
        originalName: refFile.originalname,
        sizeBytes: refFile.size
      } : null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Global JSON error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
  }
  next();
});

// Fallback serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server with dynamic fallback if port is occupied
function startServer(portToTry) {
  const server = app.listen(portToTry, () => {
    console.log(`🚀 Chandrayaan-2 Image Correspondence API listening on http://localhost:${portToTry}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${portToTry} is in use. Retrying on http://localhost:${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);
