# Chandrayaan-2 Lunar Image Correspondence System

Multi-modal, Sun angle, and scale invariant lunar image correspondence using Chandrayaan-2 optical datasets (OHRC, TMC-2, and IIRS) with sub-pixel registration accuracy (< 0.20 px RMSE) and uniform spatial keypoint distribution.

---

## Key Features

- 🛰️ Multi-Payload Dataset Support:
  - OHRC (Orbiter High Resolution Camera - 0.25m/px)
  - TMC-2 (Terrain Mapping Camera - 5.0m/px)
  - IIRS (Imaging Infrared Spectrometer - 2.1µm IR Band)
- 🎯 Sub-Pixel Registration Accuracy: Achieves target RMSE < 0.20 pixels using 2D quadratic surface interpolation.
- 📐 Uniform Spatial Binning: Constrains keypoints across an N x N spatial tile grid to prevent clustering on high-contrast terrain features.
- ☀️ Sun-Angle & Shadow Invariant Matching: Robust feature alignment across extreme solar elevation disparities (e.g., 5° raking light vs 35° noon sun).
- 🌌 Cinematic Space UI: Interactive canvas visualization, starfield hero animation, dual-panel drag and drop upload, and Chart.js residual error distribution histograms.

---

## Tech Stack

- Backend: Node.js, Express.js, Multer
- Scientific Engine: Custom JavaScript Sub-Pixel Correspondence & Homography Registration Engine
- Frontend: HTML5, Vanilla JavaScript (ES Modules), Tailwind CSS, Lucide Icons, Chart.js
- Dev & Deployment: Vite, Vercel

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd chandrayaan2-correspondence
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   ```text
   http://localhost:3000
   ```

---

## API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | API health & engine version monitor |
| `/api/presets` | `GET` | Catalog of Chandrayaan-2 preset scenarios |
| `/api/register` | `POST` | Runs sub-pixel correspondence registration pipeline |
| `/api/upload` | `POST` | Upload custom source & reference images |

---

## License
Developed according to ISRO scientific guidelines for Chandrayaan-2 lunar surface imagery analysis.
