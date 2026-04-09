import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import VideoAnalysis from './pages/VideoAnalysis';
import EventHistory from './pages/EventHistory';
import Settings from './pages/Settings';
import ClickSpark from './components/ClickSpark';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ClickSpark sparkColor="#fff" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/video-analysis" element={<VideoAnalysis />} />
            <Route path="/dashboard/event-history" element={<EventHistory />} />
            <Route path="/dashboard/settings" element={<Settings />} />
          </Routes>
        </ClickSpark>
      </AuthProvider>
    </Router>
  );
}

export default App;
