import { useNavigate } from 'react-router-dom';
import Aurora from './Aurora';
import './Hero.css';

const Hero = () => {
    const navigate = useNavigate();

    const scrollToDemo = () => {
        const demoSection = document.getElementById('demo');
        if (demoSection) {
            demoSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <section className="hero" id="home">
            {/* Aurora Background */}
            <div className="hero-aurora">
                <Aurora
                    colorStops={['#00d4ff', '#00f5d4', '#0077ff']}
                    amplitude={1.2}
                    blend={0.6}
                    speed={0.8}
                />
            </div>

            <div className="hero-inner">
                <div className="hero-content">
                    <h1 className="hero-title">
                        Sentinel<span>AI</span>
                    </h1>
                    <p className="hero-tagline">Anomaly Detector</p>
                    <p className="hero-subtitle">
                        Intelligent real-time surveillance powered by AI. Detect anomalies and threats before they happen.
                    </p>
                    <div className="hero-buttons">
                        <button className="btn-primary" onClick={() => navigate('/dashboard')}>
                            Launch Dashboard
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7 17l9.2-9.2M17 17V7H7" />
                            </svg>
                        </button>
                        <button className="btn-secondary" onClick={scrollToDemo}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            View Demo
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
