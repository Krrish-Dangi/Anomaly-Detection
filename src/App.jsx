import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import VideoAnalysis from './pages/VideoAnalysis';
import EventHistory from './pages/EventHistory';
import Settings from './pages/Settings';
import MobileCamera from './pages/MobileCamera';
import ClickSpark from './components/ClickSpark';

function AppContent() {
  const location = useLocation();
  const isDashboardView = location.pathname.startsWith('/dashboard');

  return (
    <AuthProvider>
      <ClickSpark sparkColor="#fff" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
        
        {/* Render standard routes that don't need keep-alive */}
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/camera" element={<MobileCamera />} />
        </Routes>
        
        {/* Render Dashboard Pages continuously to preserve state (Live WebSockets, File Progress) */}
        {isDashboardView && (
          <div style={{ width: '100%', height: '100%' }}>
            <div style={{ display: location.pathname === '/dashboard' ? 'block' : 'none', height: '100%' }}>
              <Dashboard />
            </div>
            <div style={{ display: location.pathname === '/dashboard/video-analysis' ? 'block' : 'none', height: '100%' }}>
              <VideoAnalysis />
            </div>
            <div style={{ display: location.pathname === '/dashboard/event-history' ? 'block' : 'none', height: '100%' }}>
              <EventHistory />
            </div>
            <div style={{ display: location.pathname === '/dashboard/settings' ? 'block' : 'none', height: '100%' }}>
              <Settings />
            </div>
          </div>
        )}

      </ClickSpark>
    </AuthProvider>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
