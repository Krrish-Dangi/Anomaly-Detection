import './HowItWorks.css';

const steps = [
    {
        /* Cloud upload icon — matches reference design */
        icon: (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                <polyline points="15 13 12 10 9 13" />
                <line x1="12" y1="10" x2="12" y2="16" />
            </svg>
        ),
        title: 'Upload Footage',
        desc: 'Instantly identify and track potential threats with 99.5% accuracy in the feeds.'
    },
    {
        /* AI brain / chip icon — matches reference design */
        icon: (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="2" x2="9" y2="4" />
                <line x1="15" y1="2" x2="15" y2="4" />
                <line x1="9" y1="20" x2="9" y2="22" />
                <line x1="15" y1="20" x2="15" y2="22" />
                <line x1="20" y1="9" x2="22" y2="9" />
                <line x1="20" y1="15" x2="22" y2="15" />
                <line x1="2" y1="9" x2="4" y2="9" />
                <line x1="2" y1="15" x2="4" y2="15" />
            </svg>
        ),
        title: 'AI Detection',
        desc: 'Receive immediate notifications for high-priority events directly to device.'
    },
    {
        /* Search/magnifier with person — behavior analysis icon from reference */
        icon: (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <circle cx="11" cy="8" r="2" />
                <path d="M7 14c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" />
            </svg>
        ),
        title: 'Behavior Analysis',
        desc: 'Analyze customer and staff behavior to predict incidents and optimize.'
    },
    {
        /* Shield with checkmark — alert generation icon from reference */
        icon: (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
            </svg>
        ),
        title: 'Alert Generation',
        desc: 'Analyze customer and staff behavior to predict incidents and optimize store operations.'
    }
];

const HowItWorks = () => {
    return (
        <section className="how-it-works section" id="how-it-works">
            <div className="container">
                <h2 className="section-title">How It Works</h2>
                <div className="how-it-works-grid">
                    {steps.map((step, index) => (
                        <div className="how-step" key={index}>
                            <div className="how-step-icon">{step.icon}</div>
                            {index < steps.length - 1 && (
                                <div className="how-step-connector"></div>
                            )}
                            <span className="how-step-number">Step {index + 1}</span>
                            <h3 className="how-step-title">{step.title}</h3>
                            <p className="how-step-desc">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;
