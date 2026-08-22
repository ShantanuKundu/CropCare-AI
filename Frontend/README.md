# CropCareAI Frontend

Modern React frontend for AI-powered crop disease detection and soil health analysis.

## Features

- 🔐 **JWT Authentication** - Secure login/register with token-based auth
- 🌿 **Disease Prediction** - Upload crop images for AI disease detection
- 🧪 **Soil Health OCR** - Extract soil data from health certificates
- 📊 **History Tracking** - View past predictions and soil analyses
- 🎨 **Modern UI** - Dark theme with glassmorphism effects
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile

## Tech Stack

- React 18 with Vite
- React Router v6
- Axios for API calls
- Context API for state management
- Vanilla CSS with modern design

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   
   Update `.env` if needed:
   ```
   VITE_API_BASE_URL=http://localhost:8000
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

   App runs at `http://localhost:5173`

4. **Build for production:**
   ```bash
   npm run build
   ```

## Usage

1. **Register/Login** - Create account or login
2. **Predict Disease** - Upload crop images for analysis
3. **Soil Health** - Upload soil certificates for OCR extraction
4. **View History** - Check past predictions and soil data

## API Integration

Backend must be running on `http://localhost:8000`

Ensure backend has CORS enabled for frontend origin.

## License

MIT
