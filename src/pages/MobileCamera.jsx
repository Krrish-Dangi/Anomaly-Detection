import { useEffect, useRef, useState, useCallback } from 'react';
import './MobileCamera.css';

const MobileCamera = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const wsRef = useRef(null);
    const intervalRef = useRef(null);

    const [status, setStatus] = useState('initializing'); // initializing | connecting | streaming | error | disconnected
    const [error, setError] = useState('');
    const [facingMode, setFacingMode] = useState('environment'); // environment (back) | user (front)
    const [fps, setFps] = useState(0);
    const [framesSent, setFramesSent] = useState(0);
    const [streamDuration, setStreamDuration] = useState(0);
    const durationRef = useRef(null);

    // Extract params from URL
    const params = new URLSearchParams(window.location.search);
    const cameraId = params.get('camId') || 'unknown';
    const token = params.get('token') || '';

    // ─── Start camera ───
    const startCamera = useCallback(async (facing) => {
        try {
            // Stop existing streams
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facing,
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
                audio: false,
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            return true;
        } catch (err) {
            console.error('Camera access denied:', err);
            setError(
                err.name === 'NotAllowedError'
                    ? 'Camera permission denied. Please allow camera access and reload.'
                    : `Camera error: ${err.message}`
            );
            setStatus('error');
            return false;
        }
    }, []);

    // ─── Connect WebSocket & begin streaming ───
    const connectAndStream = useCallback(() => {
        setStatus('connecting');

        // Determine WebSocket URL (same host, different protocol)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/ingest/${cameraId}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('[WS] Connected to ingest endpoint');
            setStatus('streaming');

            // Start duration timer
            const startTime = Date.now();
            durationRef.current = setInterval(() => {
                setStreamDuration(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);

            // Begin frame extraction loop
            let frameCount = 0;
            let lastFpsTime = Date.now();
            let fpsCount = 0;

            intervalRef.current = setInterval(() => {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                if (!video || !canvas || video.readyState < 2) return;
                if (ws.readyState !== WebSocket.OPEN) return;

                const ctx = canvas.getContext('2d');
                canvas.width = 640;
                canvas.height = 480;
                ctx.drawImage(video, 0, 0, 640, 480);

                // Compress to JPEG blob and send as binary
                canvas.toBlob(
                    (blob) => {
                        if (blob && ws.readyState === WebSocket.OPEN) {
                            ws.send(blob);
                            frameCount++;
                            fpsCount++;
                            setFramesSent(frameCount);

                            // Calculate FPS every second
                            const now = Date.now();
                            if (now - lastFpsTime >= 1000) {
                                setFps(fpsCount);
                                fpsCount = 0;
                                lastFpsTime = now;
                            }
                        }
                    },
                    'image/jpeg',
                    0.6 // quality (0.6 = good compression for streaming)
                );
            }, 133); // ~7.5 FPS
        };

        ws.onclose = () => {
            console.log('[WS] Disconnected');
            setStatus('disconnected');
            clearInterval(intervalRef.current);
            clearInterval(durationRef.current);
        };

        ws.onerror = (e) => {
            console.error('[WS] Error:', e);
            setError('WebSocket connection failed. Is the server running?');
            setStatus('error');
        };
    }, [cameraId]);

    // ─── Initialize on mount ───
    useEffect(() => {
        let mounted = true;

        (async () => {
            const ok = await startCamera(facingMode);
            if (ok && mounted) {
                // Small delay to let the video element attach
                setTimeout(() => connectAndStream(), 500);
            }
        })();

        return () => {
            mounted = false;
            // Cleanup
            if (wsRef.current) wsRef.current.close();
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (durationRef.current) clearInterval(durationRef.current);
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Toggle camera facing ───
    const toggleCamera = async () => {
        const newFacing = facingMode === 'environment' ? 'user' : 'environment';
        setFacingMode(newFacing);
        await startCamera(newFacing);
    };

    // ─── Format seconds to MM:SS ───
    const formatDuration = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div className="mobile-cam-page">
            {/* Hidden canvas for frame extraction */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Video preview */}
            <div className="mobile-cam-preview">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="mobile-cam-video"
                />

                {/* Status overlay */}
                <div className="mobile-cam-overlay-top">
                    <div className={`mobile-cam-status-badge ${status}`}>
                        <span className="mobile-cam-status-dot" />
                        {status === 'streaming' && 'LIVE'}
                        {status === 'connecting' && 'CONNECTING...'}
                        {status === 'initializing' && 'STARTING...'}
                        {status === 'error' && 'ERROR'}
                        {status === 'disconnected' && 'DISCONNECTED'}
                    </div>
                    <div className="mobile-cam-id">
                        {cameraId}
                    </div>
                </div>

                {/* Stats overlay at bottom */}
                {status === 'streaming' && (
                    <div className="mobile-cam-overlay-bottom">
                        <div className="mobile-cam-stat">
                            <span className="mobile-cam-stat-label">FPS</span>
                            <span className="mobile-cam-stat-value">{fps}</span>
                        </div>
                        <div className="mobile-cam-stat">
                            <span className="mobile-cam-stat-label">FRAMES</span>
                            <span className="mobile-cam-stat-value">{framesSent}</span>
                        </div>
                        <div className="mobile-cam-stat">
                            <span className="mobile-cam-stat-label">DURATION</span>
                            <span className="mobile-cam-stat-value">{formatDuration(streamDuration)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="mobile-cam-controls">
                <div className="mobile-cam-info">
                    <h2>SentinelAI Camera Node</h2>
                    <p>
                        {status === 'streaming'
                            ? 'Your device is actively streaming to the surveillance server.'
                            : status === 'error'
                                ? error
                                : 'Establishing connection to the server...'}
                    </p>
                </div>

                <div className="mobile-cam-actions">
                    <button className="mobile-cam-btn flip" onClick={toggleCamera}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                        Flip Camera
                    </button>

                    {status === 'disconnected' || status === 'error' ? (
                        <button className="mobile-cam-btn reconnect" onClick={connectAndStream}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                            Reconnect
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default MobileCamera;
