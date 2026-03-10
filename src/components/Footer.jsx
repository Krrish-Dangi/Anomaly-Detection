import './Footer.css';

const Footer = () => {
    return (
        <footer className="footer" id="contact">
            <div className="container">
                <div className="footer-inner">
                    {/* Brand */}
                    <div className="footer-brand">
                        <div className="footer-brand-logo">
                            <div className="footer-brand-logo-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                    <circle cx="12" cy="13" r="4" />
                                </svg>
                            </div>
                            <div className="footer-brand-name">
                                AI Surveillance
                                <small>SaaS</small>
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
                            info@surveillance.com
                        </div>
                        <div className="footer-socials">
                            <a className="footer-social-icon" href="#" aria-label="Facebook">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                                </svg>
                            </a>
                            <a className="footer-social-icon" href="#" aria-label="Instagram">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                                </svg>
                            </a>
                            <a className="footer-social-icon" href="#" aria-label="Twitter">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>

                {/* Bottom */}
                <div className="footer-bottom">
                    <p>© 2026 AI Surveillance SaaS. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
