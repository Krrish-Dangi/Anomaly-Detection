import { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { QRCodeSVG } from 'qrcode.react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import '../pages/Dashboard.css';

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
    const { user } = useAuth();
    const [connectedCameras, setConnectedCameras] = useState([]);
    const [liveFeedData, setLiveFeedData] = useState({}); // camera_id -> base64 frame

    const [footTraffic, setFootTraffic] = useState({ labels: [], values: [] });
    const [networkInfo, setNetworkInfo] = useState(null);
    const [networkError, setNetworkError] = useState('');
    const [cameraConnectTime, setCameraConnectTime] = useState(null);
    const [uptimeString, setUptimeString] = useState('0s');

    // ─── Live Crime Detection State ───
    const [liveThreatCount, setLiveThreatCount] = useState(0);
    const [liveAlerts, setLiveAlerts] = useState([]); // [{ucf_class, confidence, camera_id, timestamp, message}]
    const [showAlertToast, setShowAlertToast] = useState(false);
    const [latestCrimeAlert, setLatestCrimeAlert] = useState(null);
    const alertTimeoutRef = useRef(null);

    // ─── Live Person Count & Activity Log State ───
    const [livePersonCount, setLivePersonCount] = useState(0);
    const [liveTotalUnique, setLiveTotalUnique] = useState(0);
    const [liveActivityLog, setLiveActivityLog] = useState([]); // [{timestamp, person_count, camera_id, alerts}]
    const personCountChartRef = useRef([]); // rolling array of {time, count} for foot traffic chart

    // ─── LSTM Prediction State ───
    const [lstmPredictions, setLstmPredictions] = useState([]); // [{lstm_class, lstm_conf, final_class, final_conf, ...}]
    const [latestLstm, setLatestLstm] = useState(null);

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

        if (networkInfo && networkInfo.cloudflare_url) {
            const cameraUrl = `${networkInfo.cloudflare_url}/camera?camId=${camId}&token=demo`;
            setQrUrl(cameraUrl);
        } else {
            setQrUrl('');
        }
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

                    // Simultaneously connect to live viewer to receive YOLO alerts back from server
                    startLiveFeed(camId);

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

    // ─── Fetch dashboard data (removed backend fetching for strict live-only stats) ───
    const fetchDashboardData = useCallback(() => {
        // No-op: We only use live dynamic data now, no historical backend data.
    }, []);

    // ─── Start listening on live WS for a remote camera ───
    const startLiveFeed = (camId) => {
        let retryCount = 0;
        const maxRetries = 10;

        const connect = () => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/live/${camId}`;

            const ws = new WebSocket(wsUrl);

            ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    // Update live feed frame for any frame/alert/crime_alert
                    if ((data.type === 'frame' || data.type === 'alert' || data.type === 'crime_alert') && data.frame) {
                        setLiveFeedData(prev => ({
                            ...prev,
                            [camId]: `data:image/jpeg;base64,${data.frame}`,
                        }));
                    }

                    // ─── Handle per-frame tracker metadata (person count, etc.) ───
                    if (data.type === 'frame' && typeof data.person_count === 'number') {
                        const count = data.person_count;
                        setLivePersonCount(count);
                        setLiveTotalUnique(data.total_unique || 0);

                        // Update foot traffic chart with live person count
                        setFootTraffic(prev => {
                            const now = new Date();
                            const currentHour = now.getHours();
                            const newValues = prev.values && prev.values.length === 24
                                ? [...prev.values]
                                : Array(24).fill(0);
                            // Use max person count seen in this hour bucket
                            newValues[currentHour] = Math.max(newValues[currentHour], count);
                            const maxVal = Math.max(...newValues, 1);
                            const normalized = newValues.map(v => v / maxVal);
                            return {
                                labels: Array(24).fill('').map((_, i) => `${i.toString().padStart(2, '0')}:00`),
                                values: normalized,
                            };
                        });

                        // Add to activity log (throttle: only log every ~2 seconds)
                        setLiveActivityLog(prev => {
                            const last = prev[0];
                            const nowMs = Date.now();
                            if (last && nowMs - last._ts < 2000) return prev;
                            const entry = {
                                _ts: nowMs,
                                timestamp: data.timestamp || new Date().toISOString(),
                                person_count: count,
                                total_unique: data.total_unique || 0,
                                camera_id: data.camera_id || camId,
                                alerts: data.alerts || [],
                                pose_conf: data.pose_conf || 0,
                                interaction_score: data.interaction_score || 0,
                            };
                            return [entry, ...prev].slice(0, 100);
                        });
                    }

                    // ─── Handle LSTM inference updates from hybrid pipeline ───
                    if (data.type === 'lstm_update') {
                        console.log(`[LSTM] ${data.lstm_class} (${(data.lstm_conf * 100).toFixed(0)}%) → Fusion: ${data.final_class} (${(data.final_conf * 100).toFixed(0)}%)`);
                        setLatestLstm(data);
                        setLstmPredictions(prev => [data, ...prev].slice(0, 50));
                    }

                    // Handle YOLO-based alerts (loitering, zone breach)
                    if (data.type === 'alert' && data.alert) {
                        console.log("YOLO Alert received:", data.alert);
                        if (user) {
                            await supabase.from('incidents').insert({
                                user_id: user.id,
                                camera_id: data.camera_id || camId,
                                event_type: data.alert.type,
                                confidence: 99,
                                detected_at: new Date().toISOString(),
                                metadata: {
                                    duration_sec: data.alert.duration || 0,
                                    message: data.alert.message || ""
                                }
                            });
                        }
                    }

                    // Handle LSTM UCF Crime alerts (the new pipeline)
                    if (data.type === 'crime_alert' && data.alert) {
                        console.log("🚨 CRIME ALERT:", data.alert);

                        // Increment local threat counter
                        setLiveThreatCount(prev => prev + 1);

                        // Add to live alerts list
                        setLiveAlerts(prev => [data.alert, ...prev].slice(0, 50));

                        // Show toast notification
                        setLatestCrimeAlert(data.alert);
                        setShowAlertToast(true);
                        if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
                        alertTimeoutRef.current = setTimeout(() => setShowAlertToast(false), 6000);

                        // Animate the toast in
                        setTimeout(() => {
                            gsap.fromTo('.dash-crime-toast',
                                { x: 80, opacity: 0 },
                                { x: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.4)' }
                            );
                        }, 10);

                        // Save to Supabase with hybrid metadata
                        if (user) {
                            await supabase.from('incidents').insert({
                                user_id: user.id,
                                camera_id: data.alert.camera_id || camId,
                                event_type: data.alert.ucf_class || data.alert.type,
                                confidence: data.alert.confidence || 0,
                                detected_at: data.alert.timestamp || new Date().toISOString(),
                                metadata: {
                                    message: data.alert.message || "",
                                    ucf_class: data.alert.ucf_class || "",
                                    source: 'live_stream',
                                    severity_level: data.alert.severity_level || "",
                                    decision_mode: data.alert.decision_mode || "",
                                    reason_tags: data.alert.reason_tags || [],
                                    clip_url: data.alert.clip_url || "",
                                }
                            });
                        }

                        // Update chart dynamically
                        setFootTraffic(prev => {
                            const newValues = prev.values && prev.values.length > 0 ? [...prev.values] : Array(24).fill(0);
                            const currentHour = new Date().getHours();
                            newValues[currentHour] = (newValues[currentHour] || 0) + 1;
                            
                            // Normalize if needed, though for dynamic we can just show counts directly or scaled
                            const maxVal = Math.max(...newValues, 1);
                            const normalized = newValues.map(v => v / maxVal);
                            
                            return {
                                labels: Array(24).fill('').map((_, i) => `${i.toString().padStart(2, '0')}:00`),
                                values: normalized
                            };
                        });
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

    // ─── Uptime Logic ───
    useEffect(() => {
        let interval;
        if (connectedCameras.length > 0) {
            if (!cameraConnectTime) setCameraConnectTime(Date.now());
            
            interval = setInterval(() => {
                const start = cameraConnectTime || Date.now();
                const diff = Date.now() - start;
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                if (minutes > 0) {
                    setUptimeString(`${minutes}m ${seconds}s`);
                } else {
                    setUptimeString(`${seconds}s`);
                }
            }, 1000);
        } else {
            setCameraConnectTime(null);
            setUptimeString('0s');
        }

        return () => clearInterval(interval);
    }, [connectedCameras.length, cameraConnectTime]);

    // ─── Fetch on mount + cleanup ───
    useEffect(() => {
        fetchDashboardData();

        // Fetch network info for Cloudflare tunnel
        fetch('/api/system/network')
            .then(res => {
                if (!res.ok) throw new Error("Network response was not ok");
                return res.json();
            })
            .then(data => {
                if (data.cloudflare_url) {
                    setNetworkInfo(data);
                } else {
                    setNetworkError("Cloudflare Tunnel not ready. Please check backend logs.");
                }
            })
            .catch(err => setNetworkError("Error reaching backend network API: " + err.message));

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
            if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
        };
    }, [fetchDashboardData]);

    // ─── Chart drawing ───
    useEffect(() => {
        const canvas = chartRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const drawChart = () => {
            const parent = canvas.parentElement;
            if (!parent) return;
            const rect = parent.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            ctx.scale(dpr, dpr);

            const w = rect.width;
            const h = rect.height;

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

            let points = footTraffic.values && footTraffic.values.length > 0 ? footTraffic.values : Array(24).fill(0);
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

            const xLabels = footTraffic.labels && footTraffic.labels.length > 0 ? footTraffic.labels : ['00:00', '08:00', '16:00', '23:50'];
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '12px Inter, sans-serif'; ctx.textAlign = 'center';
            xLabels.forEach((l, i) => ctx.fillText(l, padL + (i / (xLabels.length - 1)) * cw, h - 12));
        };

        const observer = new ResizeObserver(drawChart);
        if (canvas.parentElement) observer.observe(canvas.parentElement);
        
        drawChart();

        return () => observer.disconnect();
    }, [footTraffic]);

    // ─── Entrance animations ───
    useEffect(() => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.fromTo('.dash-stat-card', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.1 })
            .fromTo('.dash-chart-card', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, '-=0.1')
            .fromTo('.dash-feeds-card', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, '-=0.2');
    }, []);

    const hasConnectedCameras = connectedCameras.length > 0;

    const totalThreats = liveThreatCount;

    const liveStatsData = [
        { label: 'ACTIVE CAMERAS', value: connectedCameras.length, change: 'LIVE', positive: true },
        { label: 'PEOPLE DETECTED', value: livePersonCount, change: liveTotalUnique > 0 ? `${liveTotalUnique} unique` : 'SCANNING', positive: true },
        { label: 'THREATS DETECTED', value: totalThreats, change: liveThreatCount > 0 ? `+${liveThreatCount} live` : `0%`, positive: liveThreatCount === 0 },
        { label: 'SYSTEM UPTIME', value: uptimeString, change: 'ACTIVE', positive: true },
    ];

    return (
        <DashboardLayout title="Dashboard" subtitle="Real-time monitoring and threat detection active.">
            <div className="dash-stats-row">
                {liveStatsData.map((stat, idx) => (
                    <div className="dash-stat-card" key={stat.label}>
                        <div className="dash-stat-label">
                            {stat.label}
                        </div>
                        <div className="dash-stat-bottom">
                            <div className="dash-stat-value">
                                {stat.value}
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
                            {qrUrl ? (
                                <>
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
                                </>
                            ) : (
                                <div className="qr-modal-waiting" style={{ padding: '20px', textAlign: 'center' }}>
                                    {networkError ? (
                                        <div style={{ color: '#fca5a5' }}>
                                            <strong>⚠️ Network Error:</strong> <br/>{networkError}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="dash-feed-spinner" style={{ margin: '0 auto 10px' }} />
                                            <div>Waiting for Cloudflare Tunnel URL...</div>
                                            <div style={{fontSize: 12, opacity: 0.7, marginTop: 8}}>Fetching secure HTTPS link.</div>
                                        </>
                                    )}
                                </div>
                            )}

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
                                <span>Powered by Cloudflare Tunnel for secure remote camera streaming.</span>
                            </div>

                            <button className="qr-modal-confirm" onClick={handleQrScanned}>
                                I've Scanned the QR Code
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Live Crime Alert Toast (Hybrid) ─── */}
            {showAlertToast && latestCrimeAlert && (
                <div className="dash-crime-toast">
                    <div className="dash-crime-toast-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <div className="dash-crime-toast-body">
                        <div className="dash-crime-toast-title">
                            {latestCrimeAlert.severity_level === 'HIGH' ? '🔴' : latestCrimeAlert.severity_level === 'MEDIUM' ? '🟡' : '🟢'}{' '}
                            {latestCrimeAlert.severity_level || 'ALERT'} THREAT: {latestCrimeAlert.ucf_class || latestCrimeAlert.type}
                        </div>
                        <div className="dash-crime-toast-meta">
                            Camera: <strong>{latestCrimeAlert.camera_id}</strong> · Confidence: <strong>{latestCrimeAlert.confidence}%</strong>
                            {latestCrimeAlert.decision_mode && (
                                <span style={{ marginLeft: 8, padding: '2px 6px', background: 'rgba(0,200,255,0.15)', borderRadius: 4, fontSize: 11, color: '#00c8ff' }}>
                                    {latestCrimeAlert.decision_mode}
                                </span>
                            )}
                        </div>
                        {latestCrimeAlert.reason_tags && latestCrimeAlert.reason_tags.length > 0 && (
                            <div className="dash-crime-toast-msg" style={{ fontSize: 12, opacity: 0.85 }}>
                                {latestCrimeAlert.reason_tags.join(' · ')}
                            </div>
                        )}
                        {latestCrimeAlert.message && (
                            <div className="dash-crime-toast-msg">{latestCrimeAlert.message}</div>
                        )}
                    </div>
                    <button className="dash-crime-toast-close" onClick={() => setShowAlertToast(false)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            )}

            {/* ─── Live Alerts Log Panel (Hybrid) ─── */}
            {/* ─── LSTM Model Predictions Panel ─── */}
            {lstmPredictions.length > 0 && (
                <div className="dash-alerts-log" style={{ borderLeft: '3px solid #a855f7' }}>
                    <div className="dash-alerts-log-header">
                        <h3>🧠 LSTM Model Predictions</h3>
                        <span className="dash-alerts-log-count">{lstmPredictions.length}</span>
                    </div>
                    {latestLstm && (
                        <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, color: '#aaa' }}>LSTM Raw:</span>
                                <span style={{
                                    fontWeight: 700, fontSize: 14,
                                    color: latestLstm.lstm_class === 'Normal' ? '#4ade80' : '#ff6b6b',
                                }}>{latestLstm.lstm_class}</span>
                                <span style={{ fontSize: 12, color: '#888' }}>({(latestLstm.lstm_conf * 100).toFixed(0)}%)</span>
                            </div>
                            <span style={{ color: '#555' }}>→</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, color: '#aaa' }}>Fused:</span>
                                <span style={{
                                    fontWeight: 700, fontSize: 14,
                                    color: latestLstm.final_class === 'Normal' ? '#4ade80' : '#ff6b6b',
                                }}>{latestLstm.final_class}</span>
                                <span style={{ fontSize: 12, color: '#888' }}>({(latestLstm.final_conf * 100).toFixed(0)}%)</span>
                            </div>
                            <span style={{
                                fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                background: 'rgba(168,85,247,0.15)', color: '#a855f7', fontWeight: 600,
                            }}>{latestLstm.decision_mode}</span>
                        </div>
                    )}
                    <div className="dash-alerts-log-list">
                        {lstmPredictions.slice(0, 12).map((pred, i) => (
                            <div className="dash-alerts-log-item" key={i}>
                                <span className="dash-alerts-log-dot" style={
                                    pred.final_class === 'Normal' ? { background: '#4ade80' } :
                                    pred.final_conf > 0.55 ? { background: '#ff4d4d' } :
                                    { background: '#fbbf24' }
                                } />
                                <span className="dash-alerts-log-class" style={{
                                    color: pred.lstm_class === 'Normal' ? '#4ade80' : '#ff6b6b',
                                }}>{pred.lstm_class}</span>
                                <span style={{ fontSize: 11, color: '#888' }}>({(pred.lstm_conf * 100).toFixed(0)}%)</span>
                                {pred.final_class !== pred.lstm_class && (
                                    <>
                                        <span style={{ color: '#555', fontSize: 11 }}>→</span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#ff6b6b' }}>{pred.final_class}</span>
                                    </>
                                )}
                                <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>
                                    {pred.decision_mode}
                                </span>
                                {pred.reason_tags && pred.reason_tags.length > 0 && (
                                    <span style={{ fontSize: 10, color: '#777', marginLeft: 4 }}>
                                        [{pred.reason_tags.join(', ')}]
                                    </span>
                                )}
                                <span className="dash-alerts-log-time">
                                    {new Date(pred.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Live Activity Log (person count per frame) ─── */}
            {liveActivityLog.length > 0 && (
                <div className="dash-alerts-log">
                    <div className="dash-alerts-log-header">
                        <h3>Live Activity Feed</h3>
                        <span className="dash-alerts-log-count">{liveActivityLog.length}</span>
                    </div>
                    <div className="dash-alerts-log-list">
                        {liveActivityLog.slice(0, 15).map((entry, i) => (
                            <div className="dash-alerts-log-item" key={i}>
                                <span className="dash-alerts-log-dot" style={
                                    entry.person_count === 0 ? { background: '#4ade80' } :
                                    entry.person_count <= 3 ? { background: '#00d4ff' } :
                                    { background: '#fbbf24' }
                                } />
                                <span className="dash-alerts-log-class">
                                    {entry.person_count === 0 ? 'No Activity' : `${entry.person_count} ${entry.person_count === 1 ? 'Person' : 'People'}`}
                                </span>
                                <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>
                                    {entry.total_unique > 0 && `(${entry.total_unique} unique)`}
                                </span>
                                {entry.interaction_score > 0 && (
                                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, fontWeight: 600, background: 'rgba(251,191,36,0.2)', color: '#fbbf24', marginLeft: 4 }}>
                                        {entry.interaction_score} interaction{entry.interaction_score > 1 ? 's' : ''}
                                    </span>
                                )}
                                {entry.alerts && entry.alerts.length > 0 && (
                                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, fontWeight: 600, background: 'rgba(255,77,77,0.2)', color: '#ff4d4d', marginLeft: 4 }}>
                                        {entry.alerts.map(a => a.type).join(', ')}
                                    </span>
                                )}
                                <span className="dash-alerts-log-cam">{entry.camera_id}</span>
                                <span className="dash-alerts-log-time">
                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Live Crime Detections Log ─── */}
            {liveAlerts.length > 0 && (
                <div className="dash-alerts-log">
                    <div className="dash-alerts-log-header">
                        <h3>Live Crime Detections</h3>
                        <span className="dash-alerts-log-count">{liveAlerts.length}</span>
                    </div>
                    <div className="dash-alerts-log-list">
                        {liveAlerts.slice(0, 10).map((alert, i) => (
                            <div className="dash-alerts-log-item" key={alert.event_id || i}>
                                <span className="dash-alerts-log-dot" style={
                                    alert.severity_level === 'HIGH' ? { background: '#ff4d4d' } :
                                    alert.severity_level === 'MEDIUM' ? { background: '#fbbf24' } :
                                    { background: '#4ade80' }
                                } />
                                <span className="dash-alerts-log-class">{alert.ucf_class || alert.type}</span>
                                {alert.severity_level && (
                                    <span style={{
                                        fontSize: 10, padding: '1px 5px', borderRadius: 3, fontWeight: 600,
                                        background: alert.severity_level === 'HIGH' ? 'rgba(255,77,77,0.2)' : alert.severity_level === 'MEDIUM' ? 'rgba(251,191,36,0.2)' : 'rgba(74,222,128,0.2)',
                                        color: alert.severity_level === 'HIGH' ? '#ff4d4d' : alert.severity_level === 'MEDIUM' ? '#fbbf24' : '#4ade80',
                                    }}>{alert.severity_level}</span>
                                )}
                                <span className="dash-alerts-log-cam">{alert.camera_id}</span>
                                <span className="dash-alerts-log-conf">{alert.confidence}%</span>
                                {alert.decision_mode && (
                                    <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>{alert.decision_mode}</span>
                                )}
                                <span className="dash-alerts-log-time">
                                    {new Date(alert.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default Dashboard;
