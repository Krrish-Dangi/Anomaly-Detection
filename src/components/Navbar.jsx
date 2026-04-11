import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import './Navbar.css';
import logoImg from '../assets/logo.png';

const navItems = [
    { label: 'Home', href: '#home' },
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Demo', href: '#demo' },
    { label: 'Contact', href: '#contact' },
];

const Navbar = ({ onSignIn, onSignUp }) => {
    const { isDark, toggleTheme } = useTheme();
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const linksRef = useRef(null);
    const indicatorRef = useRef(null);

    useEffect(() => {
        const handleScroll = () => {
            const pullout = document.querySelector('.content-pullout');
            if (pullout) {
                const pulloutRect = pullout.getBoundingClientRect();
                setScrolled(pulloutRect.top <= 80);
            } else {
                setScrolled(window.scrollY > 50);
            }

            const sectionIds = navItems.map(item => item.href.replace('#', ''));
            let currentIndex = 0;

            const isAtBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 50);
            if (isAtBottom) {
                currentIndex = navItems.length - 1;
            } else {
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
            }
            setActiveIndex(currentIndex);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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
                {/* Left Block - Logo */}
                <div className="navbar-left">
                    <a href="#" className="navbar-logo">
                        <div className="navbar-logo-icon">
                            <img src={logoImg} alt="SentinelAI Logo" className="navbar-logo-img" />
                        </div>
                    </a>
                </div>

                {/* Center Block - Nav Links (The pill) */}
                <div className="navbar-center">
                    <div className={`navbar-links ${mobileOpen ? 'mobile-open' : ''}`} ref={linksRef}>
                        <div className="navbar-indicator" ref={indicatorRef}></div>
                        {navItems.map((item, idx) => (
                            <a
                                key={item.href}
                                href={item.href}
                                className={`navbar-link ${idx === activeIndex ? 'active' : ''}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    setMobileOpen(false);
                                    const targetId = item.href.replace('#', '');
                                    if (targetId === 'home') {
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    } else {
                                        const el = document.getElementById(targetId);
                                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                                    }
                                }}
                            >
                                {item.label}
                            </a>
                        ))}
                    </div>
                </div>

                {/* Right Block - Actions */}
                <div className="navbar-right">
                    <div className="navbar-auth">
                        <button 
                            className={`nav-theme-btn ${isDark ? 'is-dark' : 'is-light'}`} 
                            onClick={toggleTheme}
                            aria-label="Toggle Theme"
                        >
                            {isDark ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
                                    <circle cx="12" cy="12" r="5" />
                                    <line x1="12" y1="1" x2="12" y2="3" />
                                    <line x1="12" y1="21" x2="12" y2="23" />
                                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                    <line x1="1" y1="12" x2="3" y2="12" />
                                    <line x1="21" y1="12" x2="23" y2="12" />
                                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                                </svg>
                            )}
                        </button>
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
            </div>
        </nav>
    );
};

export default Navbar;
