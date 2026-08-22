import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/layout/Navbar';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Predict from './pages/Predict';
import History from './pages/History';
import CropRecommendation from './pages/CropRecommendation';
import PredictionDetail from './pages/PredictionDetail';
import SoilDetail from './pages/SoilDetail';
import FertilizerRecommendation from './pages/FertilizerRecommendation';
import FertilizerDetail from './pages/FertilizerDetail';
import YieldPrediction from './pages/YieldPrediction';
import IrrigationAdvisory from './pages/IrrigationAdvisory';
import CropCalendar from './pages/CropCalendar';
import MandiPrices from './pages/MandiPrices';
import SchemeEligibility from './pages/SchemeEligibility';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <div className="app-container">
            <Navbar />
            <main className="main-content">
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Home />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/predict"
                  element={
                    <ProtectedRoute>
                      <Predict />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/history"
                  element={
                    <ProtectedRoute>
                      <History />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/history/prediction/:id"
                  element={
                    <ProtectedRoute>
                      <PredictionDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/history/soil/:id"
                  element={
                    <ProtectedRoute>
                      <SoilDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recommend"
                  element={
                    <ProtectedRoute>
                      <CropRecommendation />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/fertilizer-recommendation"
                  element={
                    <ProtectedRoute>
                      <FertilizerRecommendation />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/history/fertilizer/:id"
                  element={
                    <ProtectedRoute>
                      <FertilizerDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/yield-prediction"
                  element={
                    <ProtectedRoute>
                      <YieldPrediction />
                    </ProtectedRoute>
                  }
                />

                {/* ── Tools Routes ── */}
                <Route
                  path="/tools/irrigation"
                  element={
                    <ProtectedRoute>
                      <IrrigationAdvisory />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tools/crop-calendar"
                  element={
                    <ProtectedRoute>
                      <CropCalendar />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tools/mandi"
                  element={
                    <ProtectedRoute>
                      <MandiPrices />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tools/schemes"
                  element={
                    <ProtectedRoute>
                      <SchemeEligibility />
                    </ProtectedRoute>
                  }
                />

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
