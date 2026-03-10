import { useState, useEffect, useRef } from 'react';
import './Navbar.css';

const navItems = [
    { label: 'Home', href: '#home' },
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Demo', href: '#demo' },
    { label: 'Contact', href: '#contact' },
];

const Navbar = ({ onSignIn, onSignUp }) => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const linksRef = useRef(null);
    const indicatorRef = useRef(null);

    // Scroll spy — detect which section is in view
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);

            const sectionIds = navItems.map(item => item.href.replace('#', ''));
            let currentIndex = 0;

            for (let i = sectionIds.length - 1; i >= 0; i--) {
                const section = document.getElementById(sectionIds[i]);
                if (section) {
                    const rect = section.getBoundingClientRect();
                    if (rect.top <= 150) {
                        currentIndex = i;
                        break;
                    }
                }
            }
            setActiveIndex(currentIndex);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // initial check
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Move the sliding indicator to the active link
    useEffect(() => {
        const linksEl = linksRef.current;
        const indicatorEl = indicatorRef.current;
        if (!linksEl || !indicatorEl) return;

        const links = linksEl.querySelectorAll('.navbar-link');
        const activeLink = links[activeIndex];
        if (!activeLink) return;

        const containerRect = linksEl.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();

        indicatorEl.style.width = `${linkRect.width}px`;
        indicatorEl.style.left = `${linkRect.left - containerRect.left}px`;
    }, [activeIndex]);

    return (
        <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
            <div className="navbar-inner">
                {/* Logo */}
                <a href="#" className="navbar-logo">
                    <div className="navbar-logo-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                        </svg>
                    </div>
                </a>

                {/* Nav Links */}
                <div className={`navbar-links ${mobileOpen ? 'mobile-open' : ''}`} ref={linksRef}>
                    {/* Sliding indicator */}
                    <div className="navbar-indicator" ref={indicatorRef}></div>
                    {navItems.map((item, idx) => (
                        <a
                            key={item.href}
                            href={item.href}
                            className={`navbar-link ${idx === activeIndex ? 'active' : ''}`}
                            onClick={() => setMobileOpen(false)}
                        >
                            {item.label}
                        </a>
                    ))}
                </div>

                {/* Auth Buttons */}
                <div className="navbar-auth">
                    <button className="btn-signin" onClick={onSignIn}>Sign In</button>
                    <button className="btn-signup" onClick={onSignUp}>Sign Up</button>
                </div>

                {/* Mobile Toggle */}
                <button
                    className="navbar-toggle"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label="Toggle navigation"
                >
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>
        </nav>
    );
};

export default Navbar;
