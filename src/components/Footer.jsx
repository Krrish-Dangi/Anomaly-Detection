import './Footer.css';
import logoImg from '../assets/logo.png';

const Footer = () => {
    return (
        <footer className="footer" id="contact">
            <div className="container">
                <div className="footer-inner">
                    {/* Brand */}
                    <div className="footer-brand">
                        <div className="footer-brand-logo">
                            <div className="footer-brand-logo-icon">
                                <img src={logoImg} alt="SentinelAI Logo" className="footer-logo-img" />
                            </div>
                            <div className="footer-brand-name">
                                SentinelAI
                            </div>
                        </div>
                        <p className="footer-brand-desc">
                            Next-generation AI surveillance for modern retail security and analytics.
                        </p>
                    </div>

                    {/* Product */}
                    <div className="footer-column">
                        <h4>Product</h4>
                        <ul>
                            <li><a href="#home">Home</a></li>
                            <li><a href="#features">About Us</a></li>
                        </ul>
                    </div>

                    {/* Solutions */}
                    <div className="footer-column">
                        <h4>Solutions</h4>
                        <ul>
                            <li><a href="#">Solutions</a></li>
                            <li><a href="#">Pricing</a></li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div className="footer-column">
                        <h4>Resources</h4>
                        <ul>
                            <li><a href="#">FAQ</a></li>
                            <li><a href="#">Resources</a></li>
                        </ul>
                    </div>

                    {/* Company */}
                    <div className="footer-column">
                        <h4>Company</h4>
                        <ul>
                            <li><a href="#">About</a></li>
                            <li><a href="#">Legal</a></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div className="footer-column">
                        <h4>Contact Info</h4>
                        <div className="footer-contact-item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                            krrishdangi2005@gmail.com
                        </div>
                        <div className="footer-socials">
                            <a className="footer-social-icon" href="https://github.com/Krrish-Dangi/SentinelAI" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>

                {/* Bottom */}
                <div className="footer-bottom">
                    <p>© 2026 SentinelAI. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
