import { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { QRCodeSVG } from 'qrcode.react';
import DashboardLayout from '../components/DashboardLayout';
import '../pages/Dashboard.css';

const statsData = [
    { label: 'ACTIVE CAMERAS', value: '0', change: '—', positive: true },
    { label: 'THREATS DETECTED', value: '0', change: '—', positive: true },
    { label: 'SYSTEM UPTIME', value: '—', change: '—', positive: true },
];

// Generate a random short camera ID
const generateCameraId = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return `CAM-${id}`;
};

const Dashboard = () => {
    const chartRef = useRef(null);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [qrCameraId, setQrCameraId] = useState('');
    const [qrUrl, setQrUrl] = useState('');
    const [connectedCameras, setConnectedCameras] = useState([]);
    const [liveFeedData, setLiveFeedData] = useState({}); // camera_id -> base64 frame

    // Refs for local camera streaming
    const localVideoRefs = useRef({}); // camera_id -> video element
    const localCanvasRefs = useRef({}); // camera_id -> canvas element
    const localStreamRefs = useRef({}); // camera_id -> MediaStream
    const localIntervalRefs = useRef({}); // camera_id -> interval ID
    const localWsRefs = useRef({}); // camera_id -> WebSocket

    // ─── Open Connect Modal ───
    const handleConnectCamera = () => {
        const camId = generateCameraId();
        setQrCameraId(camId);

        // Build the URL using the current host
        const baseUrl = `${window.location.protocol}//${window.location.host}`;
        const cameraUrl = `${baseUrl}/camera?camId=${camId}&token=demo`;
        setQrUrl(cameraUrl);
        setShowConnectModal(true);
    };

    // ─── Use This Device's Camera (local webcam, inline on dashboard) ───
    const handleUseLocalCamera = useCallback(async () => {
        const camId = qrCameraId || generateCameraId();
        setShowConnectModal(false);

        // Add the camera tile immediately (type: 'local')
        setConnectedCameras(prev => [...prev, { id: camId, type: 'local' }]);

        // Wait a tick for the video element to mount
        setTimeout(async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 640 }, height: { ideal: 480 } },
                    audio: false,
                });

                const videoEl = localVideoRefs.current[camId];
                if (videoEl) {
                    videoEl.srcObject = stream;
                }
                localStreamRefs.current[camId] = stream;

                // Connect WebSocket to ingest endpoint
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}/ws/ingest/${camId}`;
                const ws = new WebSocket(wsUrl);
                localWsRefs.current[camId] = ws;

                ws.onopen = () => {
                    console.log(`[LOCAL] Streaming ${camId} to server`);

                    // Start frame extraction loop
                    const canvas = document.createElement('canvas');
                    canvas.width = 640;
                    canvas.height = 480;
                    localCanvasRefs.current[camId] = canvas;

                    localIntervalRefs.current[camId] = setInterval(() => {
                        const vid = localVideoRefs.current[camId];
                        if (!vid || vid.readyState < 2) return;
                        if (ws.readyState !== WebSocket.OPEN) return;

                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(vid, 0, 0, 640, 480);

                        canvas.toBlob(
                            (blob) => {
                                if (blob && ws.readyState === WebSocket.OPEN) {
                                    ws.send(blob);
                                }
                            },
                            'image/jpeg',
                            0.6
                        );
                    }, 133); // ~7.5 FPS
                };

                ws.onerror = () => {
                    console.log(`[LOCAL] WS error for ${camId} — streaming locally without server`);
                };

            } catch (err) {
                console.error('Camera access denied:', err);
                alert(
                    err.name === 'NotAllowedError'
                        ? 'Camera permission was denied. Please allow camera access in your browser settings.'
                        : `Camera error: ${err.message}`
                );
                // Remove the tile since camera failed
                setConnectedCameras(prev => prev.filter(c => c.id !== camId));
            }
        }, 100);
    }, [qrCameraId]);

    // ─── Stop a local camera ───
    const stopLocalCamera = useCallback((camId) => {
        // Stop MediaStream tracks
        if (localStreamRefs.current[camId]) {
            localStreamRefs.current[camId].getTracks().forEach(t => t.stop());
            delete localStreamRefs.current[camId];
        }
        // Close WebSocket
        if (localWsRefs.current[camId]) {
            localWsRefs.current[camId].close();
            delete localWsRefs.current[camId];
        }
        // Clear interval
        if (localIntervalRefs.current[camId]) {
            clearInterval(localIntervalRefs.current[camId]);
            delete localIntervalRefs.current[camId];
        }
        // Remove tile
        setConnectedCameras(prev => prev.filter(c => c.id !== camId));
        setLiveFeedData(prev => {
            const copy = { ...prev };
            delete copy[camId];
            return copy;
        });
    }, []);

    // ─── Start listening on live WS for a remote camera ───
    const startLiveFeed = (camId) => {
        let retryCount = 0;
        const maxRetries = 10;

        const connect = () => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/live/${camId}`;

            const ws = new WebSocket(wsUrl);

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'frame' && data.frame) {
                        setLiveFeedData(prev => ({
                            ...prev,
                            [camId]: `data:image/jpeg;base64,${data.frame}`,
                        }));
                    }
                } catch (e) {
                    // Ignore non-JSON messages
                }
            };

            ws.onclose = () => {
                if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(connect, 2000 * retryCount);
                } else {
                    setConnectedCameras(prev => prev.filter(c => c.id !== camId));
                    setLiveFeedData(prev => {
                        const copy = { ...prev };
                        delete copy[camId];
                        return copy;
                    });
                }
            };

            ws.onerror = () => {};

            return ws;
        };

        return connect();
    };

    // ─── Confirm QR scan (remote device) ───
    const handleQrScanned = () => {
        const camId = qrCameraId;
        setConnectedCameras(prev => [...prev, { id: camId, type: 'remote', ws: startLiveFeed(camId) }]);
        setShowConnectModal(false);
    };

    // ─── Cleanup on unmount ───
    useEffect(() => {
        return () => {
            // Stop all local cameras
            Object.keys(localStreamRefs.current).forEach(camId => {
                if (localStreamRefs.current[camId]) {
                    localStreamRefs.current[camId].getTracks().forEach(t => t.stop());
                }
                if (localWsRefs.current[camId]) {
                    localWsRefs.current[camId].close();
                }
                if (localIntervalRefs.current[camId]) {
                    clearInterval(localIntervalRefs.current[camId]);
                }
            });
        };
    }, []);

    // ─── Chart drawing ───
    useEffect(() => {
        const canvas = chartRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const resize = () => {
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            ctx.scale(dpr, dpr);
            drawChart(ctx, rect.width, rect.height);
        };

        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    const drawChart = (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        const padL = 50, padR = 20, padT = 20, padB = 40;
        const cw = w - padL - padR;
        const ch = h - padT - padB;

        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padT + (ch / 4) * i;
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + cw, y); ctx.stroke();
        }

        const points = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        const getX = (i) => padL + (i / (points.length - 1)) * cw;
        const getY = (v) => padT + ch - v * ch;

        const grad = ctx.createLinearGradient(0, padT, 0, padT + ch);
        grad.addColorStop(0, 'rgba(0, 212, 255, 0.15)');
        grad.addColorStop(1, 'rgba(0, 212, 255, 0)');

        ctx.beginPath(); ctx.moveTo(getX(0), getY(points[0]));
        for (let i = 1; i < points.length; i++) {
            ctx.bezierCurveTo((getX(i - 1) + getX(i)) / 2, getY(points[i - 1]), (getX(i - 1) + getX(i)) / 2, getY(points[i]), getX(i), getY(points[i]));
        }
        ctx.lineTo(getX(points.length - 1), padT + ch); ctx.lineTo(getX(0), padT + ch); ctx.closePath();
        ctx.fillStyle = grad; ctx.fill();

        ctx.beginPath(); ctx.moveTo(getX(0), getY(points[0]));
        for (let i = 1; i < points.length; i++) {
            ctx.bezierCurveTo((getX(i - 1) + getX(i)) / 2, getY(points[i - 1]), (getX(i - 1) + getX(i)) / 2, getY(points[i]), getX(i), getY(points[i]));
        }
        ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 2.5; ctx.stroke();

        const xLabels = ['00:00', '08:00', '16:00', '23:50'];
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '12px Inter, sans-serif'; ctx.textAlign = 'center';
        xLabels.forEach((l, i) => ctx.fillText(l, padL + (i / (xLabels.length - 1)) * cw, h - 12));
    };

    // ─── Entrance animations ───
    useEffect(() => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.fromTo('.dash-stat-card', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.1 })
            .fromTo('.dash-chart-card', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, '-=0.1')
            .fromTo('.dash-feeds-card', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, '-=0.2');
    }, []);

    const hasConnectedCameras = connectedCameras.length > 0;

    return (
        <DashboardLayout title="Dashboard" subtitle="Real-time monitoring and threat detection active.">
            <div className="dash-stats-row">
                {statsData.map((stat, idx) => (
                    <div className="dash-stat-card" key={stat.label}>
                        <div className="dash-stat-label">
                            {idx === 0 ? 'ACTIVE CAMERAS' : stat.label}
                        </div>
                        <div className="dash-stat-bottom">
                            <div className="dash-stat-value">
                                {idx === 0 ? connectedCameras.length : stat.value}
                            </div>
                            <div className={`dash-stat-change ${stat.positive ? 'positive' : 'negative'}`}>{stat.change}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="dash-chart-card">
                <div className="dash-chart-header">
                    <h3>Foot Traffic Analysis</h3>
                    <span className="dash-chart-window">24H WINDOW</span>
                </div>
                <div className="dash-chart-container">
                    <canvas ref={chartRef}></canvas>
                </div>
            </div>

            <div className="dash-feeds-card">
                <div className="dash-feeds-header">
                    <h3>Live Camera Feeds</h3>
                    {hasConnectedCameras && (
                        <button className="dash-add-cam-btn" onClick={handleConnectCamera}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Camera
                        </button>
                    )}
                </div>

                {hasConnectedCameras ? (
                    <div className="dash-feeds-grid">
                        {connectedCameras.map(cam => (
                            <div className="dash-feed-tile" key={cam.id}>
                                <div className="dash-feed-tile-header">
                                    <span className="dash-feed-tile-id">
                                        {cam.id}
                                        {cam.type === 'local' && (
                                            <span className="dash-feed-tile-local-badge">LOCAL</span>
                                        )}
                                    </span>
                                    <div className="dash-feed-tile-actions">
                                        <span className="dash-feed-tile-live">
                                            <span className="dash-feed-live-dot" />
                                            LIVE
                                        </span>
                                        <button
                                            className="dash-feed-tile-stop"
                                            onClick={() => stopLocalCamera(cam.id)}
                                            title="Disconnect camera"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="dash-feed-tile-body">
                                    {cam.type === 'local' ? (
                                        /* Local camera — show live <video> directly */
                                        <video
                                            ref={(el) => { localVideoRefs.current[cam.id] = el; }}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="dash-feed-tile-video"
                                        />
                                    ) : liveFeedData[cam.id] ? (
                                        /* Remote camera — show base64 frame images */
                                        <img
                                            src={liveFeedData[cam.id]}
                                            alt={`Feed from ${cam.id}`}
                                            className="dash-feed-tile-img"
                                        />
                                    ) : (
                                        /* Remote camera — waiting for frames */
                                        <div className="dash-feed-tile-waiting">
                                            <div className="dash-feed-spinner" />
                                            <span>Waiting for frames...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="dash-feeds-empty">
                        <div className="dash-feeds-empty-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 7l-7 5 7 5V7z" />
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                        </div>
                        <h4 className="dash-feeds-empty-title">No Cameras Connected</h4>
                        <p className="dash-feeds-empty-text">
                            Connect a camera to start real-time surveillance and AI-powered anomaly detection.
                        </p>
                        <button className="dash-connect-cam-btn" onClick={handleConnectCamera}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Connect Camera
                        </button>
                    </div>
                )}
            </div>

            {/* ─── Connect Camera Modal (two options) ─── */}
            {showConnectModal && (
                <div className="qr-modal-backdrop" onClick={() => setShowConnectModal(false)}>
                    <div className="qr-modal" onClick={e => e.stopPropagation()}>
                        <button className="qr-modal-close" onClick={() => setShowConnectModal(false)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>

                        <div className="qr-modal-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 7l-7 5 7 5V7z" />
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                        </div>

                        <h3 className="qr-modal-title">Connect Camera</h3>
                        <p className="qr-modal-desc">
                            Choose how to connect a camera feed to the surveillance system.
                        </p>

                        {/* Option 1: Use This Device */}
                        <button className="connect-option-btn local" onClick={handleUseLocalCamera}>
                            <div className="connect-option-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                    <line x1="8" y1="21" x2="16" y2="21" />
                                    <line x1="12" y1="17" x2="12" y2="21" />
                                </svg>
                            </div>
                            <div className="connect-option-text">
                                <span className="connect-option-name">Use This Device's Camera</span>
                                <span className="connect-option-desc">Stream directly from your computer's webcam</span>
                            </div>
                            <svg className="connect-option-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>

                        {/* Divider */}
                        <div className="connect-divider">
                            <span>or connect another device</span>
                        </div>

                        {/* Option 2: QR Code for remote device */}
                        <div className="qr-section">
                            <div className="qr-modal-code-wrap">
                                <QRCodeSVG
                                    value={qrUrl}
                                    size={120}
                                    bgColor="#ffffff"
                                    fgColor="#0a0a0f"
                                    level="M"
                                    includeMargin={true}
                                />
                            </div>

                            <div className="qr-modal-cam-id">
                                Camera ID: <strong>{qrCameraId}</strong>
                            </div>

                            <div className="qr-modal-url-row">
                                <span className="qr-modal-url">{qrUrl}</span>
                                <button
                                    className="qr-modal-copy"
                                    onClick={() => navigator.clipboard.writeText(qrUrl)}
                                >
                                    Copy
                                </button>
                            </div>

                            <div className="qr-modal-steps">
                                <div className="qr-modal-step">
                                    <span className="qr-modal-step-num">1</span>
                                    <span>Scan QR with your phone</span>
                                </div>
                                <div className="qr-modal-step">
                                    <span className="qr-modal-step-num">2</span>
                                    <span>Allow camera access</span>
                                </div>
                                <div className="qr-modal-step">
                                    <span className="qr-modal-step-num">3</span>
                                    <span>Streaming begins automatically</span>
                                </div>
                            </div>

                            <div className="qr-note">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                {window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? (
                                    <span style={{ color: '#fca5a5' }}>
                                        <strong>⚠️ Localhost Detected:</strong> The QR code points to your laptop, but your phone will fail to connect. Close this tab and reopen the dashboard using your <strong>Network IP</strong> (check your Vite terminal) so the phone can connect to your PC.
                                    </span>
                                ) : (
                                    <span>Both devices must be on the same Wi-Fi network. Mobile requires HTTPS for camera access.</span>
                                )}
                            </div>

                            <button className="qr-modal-confirm" onClick={handleQrScanned}>
                                I've Scanned the QR Code
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default Dashboard;
