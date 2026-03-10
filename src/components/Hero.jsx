import { useNavigate } from 'react-router-dom';
import heroImg from '../assets/hero-camera.png';
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
            <div className="hero-inner">
                {/* Left Content */}
                <div className="hero-content">
                    <div className="hero-badge">
                        <span className="hero-badge-dot"></span>
                        AI-Powered Security
                    </div>
                    <h1 className="hero-title">
                        AI-Powered Smart<br />
                        <span>Retail Surveillance</span>
                    </h1>
                    <p className="hero-subtitle">
                        Real-time detection, behavioral analysis, and intelligent alerts for secure retail
                        environments. Unlock the power of advanced AI for asset defense.
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

                {/* Right Visual */}
                <div className="hero-visual">
                    <div className="hero-image-wrapper">
                        <div className="hero-image-glow"></div>
                        <img src={heroImg} alt="AI Surveillance Camera" />
                        <div className="hero-stats">
                            <div className="hero-stat">
                                <div className="hero-stat-value">99.5%</div>
                                <div className="hero-stat-label">Accuracy</div>
                            </div>
                            <div className="hero-stat">
                                <div className="hero-stat-value">&lt;0.3s</div>
                                <div className="hero-stat-label">Latency</div>
                            </div>
                            <div className="hero-stat">
                                <div className="hero-stat-value">24/7</div>
                                <div className="hero-stat-label">Monitoring</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
