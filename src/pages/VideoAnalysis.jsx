import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import DashboardLayout from '../components/DashboardLayout';
import videoFeed from '../assets/video-analysis-feed.png';
import '../pages/Dashboard.css';
import './VideoAnalysis.css';

const detectionLogs = [
    { time: '14:32:10', text: 'Person Detected (98%)', type: 'info' },
    { time: '14:32:15', text: 'Object Detected - Shelf A (91%)', type: 'info' },
    { time: '14:32:30', text: 'Suspicious Behavior - Frame 401 - Shelf Interaction (91%)', type: 'warning' },
    { time: '14:32:45', text: 'Shelf Tampering Alert!', type: 'danger' },
];

const VideoAnalysis = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(35);
    const [showAlert, setShowAlert] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const uploadSectionRef = useRef(null);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setUploadSuccess(true);

            // Green glow animation via GSAP
            if (uploadSectionRef.current) {
                const el = uploadSectionRef.current;
                gsap.timeline()
                    .to(el, {
                        boxShadow: '0 0 20px rgba(34, 197, 94, 0.6), 0 0 40px rgba(34, 197, 94, 0.3), inset 0 0 20px rgba(34, 197, 94, 0.08)',
                        borderColor: 'rgba(34, 197, 94, 0.7)',
                        duration: 0.4,
                        ease: 'power2.out',
                    })
                    .to(el, {
                        boxShadow: 'none',
                        borderColor: 'rgba(255,255,255,0.06)',
                        duration: 1.2,
                        ease: 'power2.inOut',
                        delay: 1.2,
                    });
            }

            // Reset success state after animation
            setTimeout(() => setUploadSuccess(false), 2500);
        }
    };

    const handleUploadClick = () => {
        document.getElementById('va-file-input').click();
    };

    useEffect(() => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.fromTo('.va-upload-section', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 })
            .fromTo('.va-player-area', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, '-=0.2')
            .fromTo('.va-logs-panel', { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5 }, '-=0.3')
            .fromTo('.va-stat-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.1 }, '-=0.2');

        if (showAlert) {
            gsap.fromTo('.va-alert-toast', { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, delay: 1.2, ease: 'back.out(1.4)' });
        }
    }, []);

    return (
        <DashboardLayout title="Video Analysis" subtitle="Real-time monitoring and threat detection active.">
            {/* Hidden File Input */}
            <input
                type="file"
                id="va-file-input"
                style={{ display: 'none' }}
                accept="video/*,.mp4,.avi,.mov,.mkv,.wmv"
                onChange={handleFileSelect}
            />

            {/* Upload Section */}
            <div className={`va-upload-section ${uploadSuccess ? 'va-upload-success' : ''}`} ref={uploadSectionRef}>
                <div className="va-upload-left">
                    <h3>Upload Footage</h3>
                </div>
                <div className="va-upload-right">
                    <button className={`va-upload-btn ${uploadSuccess ? 'va-btn-success' : ''}`} onClick={handleUploadClick}>
                        {uploadSuccess ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                        )}
                    </button>
                    <span className={`va-upload-text ${uploadSuccess ? 'va-text-success' : ''}`}>
                        {selectedFile ? selectedFile.name : 'Click to upload a file from your PC'}
                    </span>
                </div>
            </div>

            {/* Video + Logs Area */}
            <div className="va-content-row">
                {/* Video Player */}
                <div className="va-player-area">
                    <div className="va-video-container">
                        <img src={videoFeed} alt="Video Analysis Feed" className="va-video-img" />

                        {/* Detection Overlays */}
                        <div className="va-detection-box va-box-1">
                            <span className="va-det-label va-det-warning">Suspicious Behavior</span>
                        </div>
                        <div className="va-detection-box va-box-2">
                            <span className="va-det-label va-det-danger">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                                Shelf Tampering
                            </span>
                        </div>
                    </div>

                    {/* Video Controls */}
                    <div className="va-controls">
                        <button className="va-control-btn" onClick={() => setIsPlaying(!isPlaying)}>
                            {isPlaying ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                            )}
                        </button>
                        <div className="va-progress-bar">
                            <div className="va-progress-fill" style={{ width: `${progress}%` }}></div>
                            <div className="va-progress-thumb" style={{ left: `${progress}%` }}></div>
                        </div>
                        <button className="va-control-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                            </svg>
                        </button>
                        <button className="va-control-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Detection Logs */}
                <div className="va-logs-panel">
                    <h3 className="va-logs-title">Live Detection Logs</h3>
                    <div className="va-logs-list">
                        {detectionLogs.map((log, i) => (
                            <div className={`va-log-item va-log-${log.type}`} key={i}>
                                <span className="va-log-dot"></span>
                                <span className="va-log-text">
                                    <strong>{log.time}</strong> – {log.text}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="va-stats-row">
                <div className="va-stat-card">
                    <div className="va-stat-label">People Detected:</div>
                    <div className="va-stat-value">214</div>
                </div>
                <div className="va-stat-card">
                    <div className="va-stat-label">Objects Detected:</div>
                    <div className="va-stat-value">1,520</div>
                </div>
                <div className="va-stat-card">
                    <div className="va-stat-label">Suspicious Events:</div>
                    <div className="va-stat-value">1</div>
                </div>
            </div>

            {/* AI Alert Toast */}
            {showAlert && (
                <div className="va-alert-toast">
                    <div className="va-alert-header">
                        <div className="va-alert-title">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                            AI Alert
                        </div>
                        <button className="va-alert-close" onClick={() => setShowAlert(false)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                    <p className="va-alert-text">
                        ALERT: Shelf Tampering Detected at Aisle 3! Immediate attention required.
                    </p>
                </div>
            )}
        </DashboardLayout>
    );
};

export default VideoAnalysis;
