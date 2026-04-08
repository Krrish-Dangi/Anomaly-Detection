import { useState, useEffect, useRef } from 'react';
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
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const linksRef = useRef(null);
    const indicatorRef = useRef(null);

    // Scroll spy — detect which section is in view
    useEffect(() => {
        const handleScroll = () => {
            // Only show dark navbar bg once the pull-out content covers the hero
            const pullout = document.querySelector('.content-pullout');
            if (pullout) {
                const pulloutRect = pullout.getBoundingClientRect();
                setScrolled(pulloutRect.top <= 80);
            } else {
                setScrolled(window.scrollY > 50);
            }

            const sectionIds = navItems.map(item => item.href.replace('#', ''));
            let currentIndex = 0;

            // If scrolled to the bottom of the page, activate the last nav item
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
                        <img src={logoImg} alt="SentinelAI Logo" className="navbar-logo-img" />
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
