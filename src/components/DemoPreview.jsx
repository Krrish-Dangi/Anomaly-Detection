import demoImg from '../assets/demo-preview.png';
import './DemoPreview.css';

const DemoPreview = () => {
    return (
        <section className="demo-preview section" id="demo">
            <div className="container">
                <h2 className="section-title">Demo Preview</h2>
                <div className="demo-preview-content">
                    {/* Image with overlay */}
                    <div className="demo-image-container">
                        {/* Window bar */}
                        <div className="demo-window-bar">
                            <span className="demo-window-dot red"></span>
                            <span className="demo-window-dot yellow"></span>
                            <span className="demo-window-dot green"></span>
                            <span className="demo-window-title">AI Surveillance — Live Preview</span>
                        </div>

                        <div style={{ position: 'relative' }}>
                            <img src={demoImg} alt="Demo surveillance view" />

                            {/* Alert Overlay */}
                            <div className="demo-alert-overlay">
                                <div className="demo-alert-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" />
                                        <line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                </div>
                                <span className="demo-alert-badge">⚠ Escalated Response</span>
                                <h3 className="demo-alert-title">High Priority Alert</h3>
                                <p className="demo-alert-desc">
                                    ALERT: Potential Theft Detected — Aisle 4. Response Required.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* CTA Button */}
                    <button className="demo-cta">
                        Request Full Demo
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
        </section>
    );
};

export default DemoPreview;
