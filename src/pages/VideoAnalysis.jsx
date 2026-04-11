import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import './VideoAnalysis.css';

// Scroll to top when page mounts
const useScrollToTop = () => {
    useLayoutEffect(() => {
        window.scrollTo(0, 0);
        const mainEl = document.querySelector('.dash-main');
        if (mainEl) mainEl.scrollTop = 0;
        // Fallback: some browsers restore scroll after layout
        requestAnimationFrame(() => {
            if (mainEl) mainEl.scrollTop = 0;
        });
    }, []);
};

const API_BASE = 'http://localhost:8000';

const STATUS_LABELS = {
    uploading: 'Uploading video...',
    queued: 'Queued for analysis...',
    processing: 'AI model analyzing...',
    done: 'Analysis complete',
    failed: 'Analysis failed',
};



const CONFIDENCE_THRESHOLD = 95;

const VideoAnalysis = () => {
    useScrollToTop();
    const { user, isAuthenticated } = useAuth();

    // Video playback
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    const [isSeeking, setIsSeeking] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const videoRef = useRef(null);
    const videoContainerRef = useRef(null);

    // Upload & Analysis state
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [jobId, setJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);
    const [videoUrl, setVideoUrl] = useState(null);
    const [error, setError] = useState(null);

    // Streaming results
    const [logs, setLogs] = useState([]);
    const [personSnapshots, setPersonSnapshots] = useState([]); // [{timestamp_sec, persons: [{id, bbox}]}]
    const [concludedEvents, setConcludedEvents] = useState([]); // consolidated anomaly events
    const [stats, setStats] = useState({
        people_detected: 0,
        objects_detected: 0,
        suspicious_events: 0,
    });
    const [progress, setProgress] = useState({ total_clips: 0, processed: 0, video_progress: 0 });
    const [videoMeta, setVideoMeta] = useState(null);

    // Alert toast
    const [showAlert, setShowAlert] = useState(false);
    const [alertEvent, setAlertEvent] = useState(null);

    const uploadSectionRef = useRef(null);
    const logsEndRef = useRef(null);
    const eventSourceRef = useRef(null);

    // Cleanup on unmount
    // Cleanup blob URLs when videoUrl changes (but NOT the EventSource)
    const prevVideoUrlRef = useRef(null);
    useEffect(() => {
        // Revoke the previous blob URL if it was one
        if (prevVideoUrlRef.current && prevVideoUrlRef.current.startsWith('blob:')) {
            URL.revokeObjectURL(prevVideoUrlRef.current);
        }
        prevVideoUrlRef.current = videoUrl;
    }, [videoUrl]);

    // Cleanup EventSource only on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    // Entrance animation
    useEffect(() => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.fromTo('.va-upload-section', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 })
            .fromTo('.va-player-area', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, '-=0.2')
            .fromTo('.va-logs-panel', { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5 }, '-=0.3')
            .fromTo('.va-stat-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.1 }, '-=0.2');
    }, []);

    // Animate alert toast
    useEffect(() => {
        if (showAlert) {
            gsap.fromTo('.va-alert-toast', { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.4)' });
        }
    }, [showAlert]);

    // Auto-scroll logs to bottom when new logs come in
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    // Animate new stat values
    useEffect(() => {
        if (jobStatus === 'processing' || jobStatus === 'done') {
            gsap.fromTo('.va-stat-value-num', { scale: 1.15 }, { scale: 1, duration: 0.3, ease: 'back.out(1.4)' });
        }
    }, [stats.people_detected, stats.objects_detected, stats.suspicious_events]);

    // Save concluded events to Supabase when analysis completes
    useEffect(() => {
        if (jobStatus !== 'done' || !isAuthenticated || !user || concludedEvents.length === 0) return;

        const saveIncidents = async () => {
            try {
                const incidents = concludedEvents.map(evt => ({
                    user_id: user.id,
                    event_type: evt.type || evt.ucf_class || 'Unknown',
                    camera_id: 'UPLOAD',
                    confidence: evt.peak_confidence || 0,
                    detected_at: new Date().toISOString(),
                    metadata: {
                        ucf_class: evt.ucf_class,
                        start_time: evt.start_time,
                        end_time: evt.end_time,
                        start_frame: evt.start_frame,
                        end_frame: evt.end_frame,
                        duration_sec: evt.duration_sec,
                        clip_count: evt.clip_count,
                        source: 'video_analysis',
                        file_name: selectedFile?.name || 'unknown',
                    },
                }));

                const { error } = await supabase
                    .from('incidents')
                    .insert(incidents);

                if (error) {
                    console.error('Failed to save incidents:', error.message);
                } else {
                    console.log(`✓ Saved ${incidents.length} incidents to history`);
                }
            } catch (err) {
                console.error('Error saving incidents:', err);
            }
        };

        saveIncidents();
    }, [jobStatus, concludedEvents, isAuthenticated, user]);

    // Connect to SSE stream when we get a job ID
    const connectStream = useCallback((id) => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        let streamDone = false;
        const es = new EventSource(`${API_BASE}/api/analyze/${id}/stream`);
        eventSourceRef.current = es;

        es.addEventListener('metadata', (e) => {
            const data = JSON.parse(e.data);
            setVideoMeta(data);
        });

        es.addEventListener('log', (e) => {
            const log = JSON.parse(e.data);
            // Only add high-confidence logs (>= threshold) or info type
            if (log.confidence >= CONFIDENCE_THRESHOLD || log.type === 'info') {
                setLogs(prev => [...prev, log]);
                // Animate new log entry
                setTimeout(() => {
                    const items = document.querySelectorAll('.va-log-item');
                    const last = items[items.length - 1];
                    if (last) {
                        gsap.fromTo(last, { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: 'power2.out' });
                    }
                }, 10);
            }
        });

        es.addEventListener('persons', (e) => {
            const data = JSON.parse(e.data);
            setPersonSnapshots(prev => [...prev, data]);
        });

        es.addEventListener('event_concluded', (e) => {
            const evt = JSON.parse(e.data);
            setConcludedEvents(prev => [...prev, evt]);
            // Show alert popup for the concluded event
            setAlertEvent(evt);
            setShowAlert(true);
        });

        es.addEventListener('stats', (e) => {
            const data = JSON.parse(e.data);
            setStats(data);
        });

        es.addEventListener('progress', (e) => {
            const data = JSON.parse(e.data);
            setProgress(data);
            setJobStatus('processing');
        });

        es.addEventListener('complete', (e) => {
            const data = JSON.parse(e.data);
            setStats(data);
            setJobStatus('done');
            streamDone = true;
            es.close();
        });

        // Custom 'error' event from our backend (not browser's native onerror)
        es.addEventListener('error', (e) => {
            if (e.data) {
                try {
                    const data = JSON.parse(e.data);
                    setError(data.message || 'Analysis failed');
                } catch {
                    setError('Analysis failed');
                }
                setJobStatus('failed');
                streamDone = true;
                es.close();
            }
            // If no e.data, this is the native EventSource error — ignore, it will reconnect
        });

        es.addEventListener('done', () => {
            setJobStatus('done');
            streamDone = true;
            es.close();
        });

        // Native EventSource error handler — DO NOT set failed here.
        // This fires during normal reconnection attempts.
        es.onerror = () => {
            if (streamDone) {
                es.close();
            }
        };
    }, []);

    const startAnalysis = async (file) => {
        if (eventSourceRef.current) eventSourceRef.current.close();

        setJobStatus('uploading');
        setLogs([]);
        setPersonSnapshots([]);
        setConcludedEvents([]);
        setStats({ people_detected: 0, objects_detected: 0, suspicious_events: 0 });
        setProgress({ total_clips: 0, processed: 0, video_progress: 0 });
        setVideoMeta(null);
        setError(null);
        setShowAlert(false);
        setAlertEvent(null);

        try {
            const formData = new FormData();
            formData.append('video', file);

            const res = await fetch(`${API_BASE}/api/analyze`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Server error ${res.status}: ${text}`);
            }

            const data = await res.json();
            const id = data.job_id;
            setJobId(id);
            setJobStatus('queued');

            // Set video URL for playback
            setVideoUrl(`${API_BASE}/api/uploads/${id}`);

            // Connect to SSE stream
            connectStream(id);
        } catch (err) {
            const msg = err.message.includes('fetch')
                ? 'Cannot reach backend. Make sure the server is running: cd backend && uvicorn main:app --reload --port 8000'
                : err.message;
            setError(msg);
            setJobStatus('failed');
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSelectedFile(file);
        setUploadSuccess(true);

        // Green glow animation
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

        // Create local URL for immediate preview
        const localUrl = URL.createObjectURL(file);
        setVideoUrl(localUrl);

        setTimeout(() => setUploadSuccess(false), 2500);
    };

    const handleAnalyzeClick = () => {
        if (!selectedFile || isLoading) return;
        startAnalysis(selectedFile);
    };

    const handleUploadClick = () => {
        if (isLoading) return;
        document.getElementById('va-file-input').click();
    };

    // ===== Video Controls =====
    const togglePlay = () => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeekFromEvent = (e, bar) => {
        if (!videoRef.current || !duration) return;
        const rect = bar.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        videoRef.current.currentTime = pct * duration;
        setCurrentTime(pct * duration);
    };

    const handleSeekClick = (e) => {
        handleSeekFromEvent(e, e.currentTarget);
    };

    const handleSeekMouseDown = (e) => {
        e.preventDefault();
        setIsSeeking(true);
        const bar = e.currentTarget;
        handleSeekFromEvent(e, bar);

        const onMouseMove = (ev) => {
            handleSeekFromEvent(ev, bar);
        };
        const onMouseUp = () => {
            setIsSeeking(false);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const toggleMute = () => {
        if (!videoRef.current) return;
        videoRef.current.muted = !videoRef.current.muted;
        setIsMuted(videoRef.current.muted);
    };

    const handleVolumeChange = (e) => {
        const newVol = parseFloat(e.target.value);
        setVolume(newVol);
        if (videoRef.current) {
            videoRef.current.volume = newVol;
            if (newVol === 0) {
                videoRef.current.muted = true;
                setIsMuted(true);
            } else if (videoRef.current.muted) {
                videoRef.current.muted = false;
                setIsMuted(false);
            }
        }
    };

    const toggleFullscreen = () => {
        if (!videoContainerRef.current) return;
        if (!document.fullscreenElement) {
            videoContainerRef.current.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const cycleSpeed = () => {
        const speeds = [0.5, 1, 1.5, 2];
        const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
        setPlaybackSpeed(next);
        if (videoRef.current) videoRef.current.playbackRate = next;
    };

    const formatTime = (secs) => {
        if (!secs || isNaN(secs)) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Determine which detection boxes to show based on current video time
    const getActiveDetections = () => {
        if (!videoRef.current || !videoMeta) return detections;
        const ct = videoRef.current.currentTime;
        const fps = videoMeta.fps || 30;
        // Show detections that are near the current time (within 3 seconds window)
        return detections.filter(d => {
            const detTime = (d.frame_number || 0) / fps;
            return Math.abs(ct - detTime) < 3;
        });
    };

    const isLoading = jobStatus === 'uploading' || jobStatus === 'queued' || jobStatus === 'processing';
    const isDone = jobStatus === 'done';
    const isFailed = jobStatus === 'failed';
    const isProcessing = jobStatus === 'processing';

    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const analysisProgressPct = progress.total_clips > 0
        ? (progress.processed / progress.total_clips) * 100
        : 0;

    // Only high-CI logs for display
    const highCILogs = logs.filter(l => l.confidence >= CONFIDENCE_THRESHOLD || l.type === 'info');

    // Determine upload button label
    let uploadText = 'Click to upload a file from your PC';
    if (isLoading) uploadText = `Analyzing: ${selectedFile?.name}`;
    else if (isDone) uploadText = `✓ Done: ${selectedFile?.name}`;
    else if (isFailed) uploadText = `✗ Failed — Click to retry`;
    else if (selectedFile) uploadText = selectedFile.name;

    // Get active persons for current video time
    const activePersons = (() => {
        if (!personSnapshots.length || !currentTime) return [];
        let best = personSnapshots[0];
        let bestDiff = Math.abs(personSnapshots[0].timestamp_sec - currentTime);
        for (const snap of personSnapshots) {
            const diff = Math.abs(snap.timestamp_sec - currentTime);
            if (diff < bestDiff) { best = snap; bestDiff = diff; }
            if (snap.timestamp_sec > currentTime + 1) break;
        }
        if (bestDiff > 1.5) return [];
        return best.persons || [];
    })();

    return (
        <DashboardLayout title="Video Analysis" subtitle="Upload footage for real-time AI anomaly detection.">
            {/* Hidden File Input */}
            <input
                type="file"
                id="va-file-input"
                style={{ display: 'none' }}
                accept="video/*,.mp4,.avi,.mov,.mkv,.wmv"
                onChange={handleFileSelect}
                disabled={isLoading}
            />

            {/* ── Upload Section ── */}
            <div
                className={`va-upload-section ${uploadSuccess ? 'va-upload-success' : ''}`}
                ref={uploadSectionRef}
            >
                <div className="va-upload-left">
                    <h3>Upload Footage</h3>
                    {jobStatus && (
                        <div className={`va-status-badge va-status-${isFailed ? 'failed' : isDone ? 'done' : 'processing'}`}>
                            {isLoading && <span className="va-status-pulse" />}
                            {STATUS_LABELS[jobStatus]}
                            {isProcessing && progress.total_clips > 0 && (
                                <span className="va-status-progress">
                                    {progress.processed}/{progress.total_clips} clips
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <div className="va-upload-center">
                    <button
                        className={`va-upload-btn ${uploadSuccess ? 'va-btn-success' : ''} ${isLoading ? 'va-btn-loading' : ''}`}
                        onClick={handleUploadClick}
                        disabled={isLoading}
                        title={isLoading ? 'Analyzing...' : 'Upload video'}
                    >
                        {uploadSuccess ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        ) : isLoading ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="va-spin-icon">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                        )}
                    </button>
                    <span className={`va-upload-text ${uploadSuccess ? 'va-text-success' : ''} ${isFailed ? 'va-text-failed' : ''}`}>
                        {uploadText}
                    </span>
                </div>
                <div className="va-upload-right">
                    <button
                        className={`va-analyze-btn ${!selectedFile || isLoading ? 'va-analyze-btn-disabled' : ''}`}
                        onClick={handleAnalyzeClick}
                        disabled={!selectedFile || isLoading}
                        title={!selectedFile ? 'Upload a file first' : isLoading ? 'Analyzing...' : 'Start AI Analysis'}
                    >
                        {isLoading ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="va-spin-icon">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                        )}
                        {isLoading ? 'Analyzing...' : 'Analyze'}
                    </button>
                </div>
            </div>

            {/* ── Analysis Progress Bar ── */}
            {isProcessing && progress.total_clips > 0 && (
                <div className="va-analysis-progress">
                    <div className="va-analysis-progress-bar">
                        <div
                            className="va-analysis-progress-fill"
                            style={{ width: `${analysisProgressPct}%` }}
                        />
                    </div>
                    <span className="va-analysis-progress-text">
                        {Math.round(analysisProgressPct)}% analyzed
                    </span>
                </div>
            )}

            {/* ── Error Banner ── */}
            {error && (
                <div className="va-error-banner">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                    </svg>
                    <span>{error}</span>
                    <button className="va-error-dismiss" onClick={() => setError(null)}>✕</button>
                </div>
            )}

            {/* ── Video + Logs Row ── */}
            <div className="va-content-row">
                {/* Video Player */}
                <div className="va-player-area">
                    <div className="va-video-container" ref={videoContainerRef}>
                        {/* Actual Video Element or Placeholder */}
                        {isProcessing ? (
                            <img
                                src={`/api/analyze/${jobId}/mjpeg`}
                                className="va-video-element"
                                alt="Live AI Processing stream"
                                style={{ objectFit: 'contain', backgroundColor: '#000' }}
                            />
                        ) : videoUrl ? (
                            <video
                                ref={videoRef}
                                src={videoUrl}
                                className="va-video-element"
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={handleLoadedMetadata}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onEnded={() => setIsPlaying(false)}
                                preload="metadata"
                                playsInline
                            />
                        ) : (
                            <div className="va-video-placeholder">
                                <div className="va-placeholder-inner">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="va-placeholder-icon">
                                        <polygon points="23 7 16 12 23 17 23 7" />
                                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                    </svg>
                                    <p className="va-placeholder-text">Upload a video to begin analysis</p>
                                    <p className="va-placeholder-hint">Supports MP4, AVI, MOV, MKV, WMV</p>
                                </div>
                            </div>
                        )}
                        
                        {/* Analyzing scan line overlay */}
                        {isProcessing && (
                            <div className="va-scan-overlay">
                                <div className="va-scan-line" />
                            </div>
                        )}

                        {/* Detection boxes removed — clean video playback */}

                        {/* Live monitoring indicator */}
                        {isProcessing && (
                            <div className="va-live-badge">
                                <span className="va-live-dot" />
                                MONITORING
                            </div>
                        )}

                        {isDone && (
                            <div className="va-done-badge">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                ANALYSIS COMPLETE
                            </div>
                        )}
                    </div>

                    {/* Video Controls */}
                    <div className="va-controls">
                        <button className="va-control-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                            {isPlaying ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                            )}
                        </button>

                        <div className="va-time-display">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </div>

                        <div className={`va-progress-bar ${isSeeking ? 'va-progress-seeking' : ''}`} onMouseDown={handleSeekMouseDown}>
                            <div className="va-progress-fill" style={{ width: `${progressPct}%` }} />
                            {/* Markers for concluded events on the timeline */}
                            {concludedEvents.map((evt, i) => {
                                const startSec = (evt.start_frame || 0) / (videoMeta?.fps || 30);
                                const endSec = (evt.end_frame || 0) / (videoMeta?.fps || 30);
                                const startPct = duration > 0 ? (startSec / duration) * 100 : 0;
                                const widthPct = duration > 0 ? ((endSec - startSec) / duration) * 100 : 1;
                                return (
                                    <div
                                        key={i}
                                        className={`va-timeline-event ${evt.peak_confidence > 85 ? 'va-marker-danger' : 'va-marker-warning'}`}
                                        style={{ left: `${startPct}%`, width: `${Math.max(widthPct, 0.5)}%` }}
                                        title={`${evt.ucf_class} (${evt.peak_confidence}%) ${evt.start_time} – ${evt.end_time}`}
                                    />
                                );
                            })}
                            <div className="va-progress-thumb" style={{ left: `${progressPct}%` }} />
                        </div>

                        <button className="va-control-btn va-speed-btn" onClick={cycleSpeed} title="Playback speed">
                            {playbackSpeed}x
                        </button>

                        <div
                            className="va-volume-wrapper"
                            onMouseEnter={() => setShowVolumeSlider(true)}
                            onMouseLeave={() => setShowVolumeSlider(false)}
                        >
                            <button className="va-control-btn" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                                {isMuted || volume === 0 ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                        <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
                                    </svg>
                                ) : volume < 0.5 ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    </svg>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    </svg>
                                )}
                            </button>
                            {showVolumeSlider && (
                                <div className="va-volume-popup">
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={isMuted ? 0 : volume}
                                        onChange={handleVolumeChange}
                                        className="va-volume-slider"
                                        orient="vertical"
                                    />
                                    <span className="va-volume-label">{isMuted ? 0 : Math.round(volume * 100)}%</span>
                                </div>
                            )}
                        </div>

                        <button className="va-control-btn" onClick={toggleFullscreen} title="Fullscreen">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                            </svg>
                        </button>

                        {isDone && (
                            <span className="va-controls-done-badge">
                                ✓ Analysis Done
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Detection Logs Panel ── */}
                <div className="va-logs-panel">
                    <div className="va-logs-header">
                        <h3 className="va-logs-title">Detection Logs</h3>
                        <div className="va-logs-header-right">
                            {highCILogs.length > 0 && (
                                <span className="va-logs-count">{highCILogs.length}</span>
                            )}
                            <span className="va-logs-ci-label">≥{CONFIDENCE_THRESHOLD}% CI</span>
                        </div>
                    </div>

                    <div className="va-logs-list">
                        {/* Loading state */}
                        {jobStatus === 'uploading' || jobStatus === 'queued' ? (
                            <div className="va-logs-waiting">
                                <div className="va-waiting-dots">
                                    <span /><span /><span />
                                </div>
                                <span>Waiting for AI results…</span>
                            </div>
                        ) : null}

                        {/* Consolidated event logs */}
                        {(isProcessing || isDone) && concludedEvents.map((evt, i) => (
                            <div className={`va-log-item va-log-${evt.peak_confidence > 85 ? 'danger' : 'warning'}`} key={`evt-${i}`}>
                                <span className="va-log-dot" />
                                <span className="va-log-text">
                                    <strong>{evt.start_time} – {evt.end_time}</strong> — {evt.ucf_class} detected
                                </span>
                                <span className={`va-log-badge va-badge-${evt.peak_confidence > 85 ? 'danger' : 'warning'}`}>{evt.peak_confidence}%</span>
                            </div>
                        ))}

                        {/* System logs (summary etc) */}
                        {(isProcessing || isDone) && highCILogs.filter(l => l.type === 'info').map((log, i) => (
                            <div className={`va-log-item va-log-info`} key={`sys-${i}`}>
                                <span className="va-log-dot" />
                                <span className="va-log-text">
                                    <strong>{log.time}</strong> — {log.text}
                                </span>
                            </div>
                        ))}

                        {/* Empty state */}
                        {isDone && highCILogs.length === 0 && (
                            <div className="va-logs-empty">No high-confidence events logged.</div>
                        )}

                        {/* Empty state before upload */}
                        {!selectedFile && (
                            <div className="va-logs-empty-state">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                    <polyline points="10 9 9 9 8 9" />
                                </svg>
                                <span>Logs will appear here during analysis</span>
                            </div>
                        )}

                        {/* Processing indicator at bottom of logs */}
                        {isProcessing && (
                            <div className="va-logs-processing">
                                <div className="va-processing-dots">
                                    <span /><span /><span />
                                </div>
                                <span>Processing clips...</span>
                            </div>
                        )}

                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>

            {/* ── Stats Row ── */}
            <div className="va-stats-row">
                <div className="va-stat-card">
                    <div className="va-stat-label">Person Counter</div>
                    <div className="va-stat-value">
                        <span className="va-stat-value-num">{stats.people_detected.toLocaleString()}</span>
                    </div>
                    {isProcessing && (
                        <div className="va-stat-live-indicator">
                            <span className="va-stat-live-dot" />
                            Live
                        </div>
                    )}
                </div>
                <div className="va-stat-card">
                    <div className="va-stat-label">Event Types</div>
                    <div className="va-stat-value">
                        <span className="va-stat-value-num">{stats.objects_detected.toLocaleString()}</span>
                    </div>
                    {isProcessing && (
                        <div className="va-stat-live-indicator">
                            <span className="va-stat-live-dot" />
                            Live
                        </div>
                    )}
                </div>
                <div className="va-stat-card">
                    <div className="va-stat-label">Suspicious Events</div>
                    <div className={`va-stat-value ${stats.suspicious_events > 0 ? 'va-stat-alert' : ''}`}>
                        <span className="va-stat-value-num">{stats.suspicious_events}</span>
                    </div>
                    {isProcessing && (
                        <div className="va-stat-live-indicator">
                            <span className="va-stat-live-dot" />
                            Live
                        </div>
                    )}
                </div>
            </div>

            {/* ── AI Alert Toast ── */}
            {showAlert && alertEvent && (
                <div className="va-alert-toast">
                    <div className="va-alert-header">
                        <div className="va-alert-title">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b">
                                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                            </svg>
                            AI Anomaly Alert
                        </div>
                        <button className="va-alert-close" onClick={() => setShowAlert(false)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                    <p className="va-alert-type">
                        ⚠️ {alertEvent.ucf_class || alertEvent.type || 'Suspicious Activity'}
                    </p>
                    <p className="va-alert-text">
                        {alertEvent.start_time && alertEvent.end_time && `${alertEvent.start_time} – ${alertEvent.end_time}`}
                        {alertEvent.peak_confidence && ` · ${alertEvent.peak_confidence}% confidence`}
                        {alertEvent.duration_sec != null && ` · ${alertEvent.duration_sec}s duration`}
                    </p>
                </div>
            )}
        </DashboardLayout>
    );
};

export default VideoAnalysis;
