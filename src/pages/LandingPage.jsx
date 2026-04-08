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
import ParticlesBg from '../components/ParticlesBg';

gsap.registerPlugin(ScrollTrigger);

function LandingPage() {
    const [authOpen, setAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState('signin');

    const openSignIn = () => { setAuthMode('signin'); setAuthOpen(true); };
    const openSignUp = () => { setAuthMode('signup'); setAuthOpen(true); };
    const closeAuth = () => setAuthOpen(false);

    useEffect(() => {
        // Entrance animation
        gsap.fromTo('.hero-content',
            { opacity: 0, y: 60 },
            {
                opacity: 1, y: 0, duration: 1, ease: 'power3.out',
                onComplete: () => {
                    // Drawer effect: hero drifts up to navbar and fades out
                    gsap.fromTo('.hero-content',
                        { y: 0, opacity: 1 },
                        {
                            y: -300,
                            opacity: 0,
                            ease: 'none',
                            scrollTrigger: {
                                trigger: '.content-pullout',
                                start: 'top 95%',
                                end: 'top 35%',
                                scrub: true,
                                invalidateOnRefresh: true,
                            }
                        }
                    );
                }
            }
        );



        // Pull-out sections entrance
        gsap.fromTo('.content-pullout', { y: 80 }, {
            y: 0, duration: 1, ease: 'power3.out',
            scrollTrigger: { trigger: '.content-pullout', start: 'top 95%', toggleActions: 'play none none none' }
        });

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

            {/* Hero stays sticky so the content below pulls out over it */}
            <div className="hero-sticky-wrapper">
                <Hero />
            </div>

            {/* Content sections that pull out from under the hero */}
            <div className="content-pullout">
                <ParticlesBg quantity={60} ease={80} color="#00d4ff" staticity={30} />
                <Features />
                <HowItWorks />
                <DemoPreview />
                <Footer />
            </div>

            <AuthModal isOpen={authOpen} onClose={closeAuth} initialMode={authMode} />
        </>
    );
}

export default LandingPage;
