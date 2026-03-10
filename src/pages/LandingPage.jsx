import { useState, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Features from '../components/Features';
import HowItWorks from '../components/HowItWorks';
import DemoPreview from '../components/DemoPreview';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';

gsap.registerPlugin(ScrollTrigger);

function LandingPage() {
    const [authOpen, setAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState('signin');

    const openSignIn = () => { setAuthMode('signin'); setAuthOpen(true); };
    const openSignUp = () => { setAuthMode('signup'); setAuthOpen(true); };
    const closeAuth = () => setAuthOpen(false);

    useEffect(() => {
        gsap.fromTo('.hero-content', { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 1, ease: 'power3.out' });
        gsap.fromTo('.hero-visual', { opacity: 0, y: 40, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 1.1, delay: 0.3, ease: 'power3.out' });
        gsap.fromTo('.hero-stats', { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.8, delay: 0.8, ease: 'power2.out' });

        gsap.fromTo('.features .section-title', { opacity: 0, y: 40 }, {
            opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
            scrollTrigger: { trigger: '.features', start: 'top 80%', toggleActions: 'play none none none' }
        });
        gsap.fromTo('.feature-card', { opacity: 0, y: 50 }, {
            opacity: 1, y: 0, duration: 0.6, stagger: 0.15, ease: 'power2.out',
            scrollTrigger: { trigger: '.features-grid', start: 'top 80%', toggleActions: 'play none none none' }
        });

        gsap.fromTo('.how-it-works .section-title', { opacity: 0, y: 40 }, {
            opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
            scrollTrigger: { trigger: '.how-it-works', start: 'top 80%', toggleActions: 'play none none none' }
        });
        gsap.fromTo('.how-step', { opacity: 0, y: 40 }, {
            opacity: 1, y: 0, duration: 0.5, stagger: 0.2, ease: 'power2.out',
            scrollTrigger: { trigger: '.how-it-works-grid', start: 'top 80%', toggleActions: 'play none none none' }
        });

        gsap.fromTo('.demo-preview .section-title', { opacity: 0, y: 40 }, {
            opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
            scrollTrigger: { trigger: '.demo-preview', start: 'top 80%', toggleActions: 'play none none none' }
        });
        gsap.fromTo('.demo-image-container', { opacity: 0, y: 60, scale: 0.96 }, {
            opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'power3.out',
            scrollTrigger: { trigger: '.demo-image-container', start: 'top 85%', toggleActions: 'play none none none' }
        });
        gsap.fromTo('.demo-alert-overlay', { opacity: 0, x: 40 }, {
            opacity: 1, x: 0, duration: 0.7, delay: 0.3, ease: 'power2.out',
            scrollTrigger: { trigger: '.demo-image-container', start: 'top 70%', toggleActions: 'play none none none' }
        });
        gsap.fromTo('.demo-cta', { opacity: 0, y: 20 }, {
            opacity: 1, y: 0, duration: 0.6, ease: 'power2.out',
            scrollTrigger: { trigger: '.demo-cta', start: 'top 90%', toggleActions: 'play none none none' }
        });
        gsap.fromTo('.footer-inner', { opacity: 0, y: 30 }, {
            opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
            scrollTrigger: { trigger: '.footer', start: 'top 85%', toggleActions: 'play none none none' }
        });

        return () => { ScrollTrigger.getAll().forEach(t => t.kill()); };
    }, []);

    return (
        <>
            <Navbar onSignIn={openSignIn} onSignUp={openSignUp} />
            <Hero />
            <Features />
            <HowItWorks />
            <DemoPreview />
            <Footer />
            <AuthModal isOpen={authOpen} onClose={closeAuth} initialMode={authMode} />
        </>
    );
}

export default LandingPage;
