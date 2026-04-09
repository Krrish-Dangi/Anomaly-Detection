import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import DashboardLayout from '../components/DashboardLayout';
import '../pages/Dashboard.css';
import './EventHistory.css';

const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
    values: [0, 0, 0, 0, 0, 0, 0, 0],
};

const LockIcon = () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const EventHistory = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const canvasRef = useRef(null);
    const [dateRange, setDateRange] = useState('last7');
    const [eventType, setEventType] = useState('all');
    const [camera, setCamera] = useState('all');
    const [confidence, setConfidence] = useState(80);
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const isLocked = !isAuthenticated;

    // Fetch incidents from Supabase
    useEffect(() => {
        if (!isAuthenticated || !user) {
            setLoading(false);
            return;
        }

        const fetchIncidents = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('incidents')
                .select('*')
                .eq('user_id', user.id)
                .order('detected_at', { ascending: false });

            if (error) {
                console.error('Error fetching incidents:', error.message);
            } else {
                setIncidents(data || []);
            }
            setLoading(false);
        };

        fetchIncidents();
    }, [isAuthenticated, user]);

    // Draw chart
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const W = rect.width;
        const H = rect.height;
        const padL = 40, padR = 20, padT = 10, padB = 30;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;
        const maxVal = 100;

        ctx.clearRect(0, 0, W, H);

        // Y-axis labels + grid lines
        const ySteps = [0, 20, 40, 60, 80, 100];
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ySteps.forEach(v => {
            const y = padT + chartH - (v / maxVal) * chartH;
            ctx.fillStyle = '#5a6478';
            ctx.fillText(v, padL - 8, y);
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.moveTo(padL, y);
            ctx.lineTo(padL + chartW, y);
            ctx.stroke();
        });

        // X-axis labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        chartData.labels.forEach((label, i) => {
            const x = padL + (i / (chartData.labels.length - 1)) * chartW;
            ctx.fillStyle = '#5a6478';
            ctx.fillText(label, x, padT + chartH + 10);
        });

        // Gradient fill
        const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
        grad.addColorStop(0, 'rgba(0, 212, 255, 0.25)');
        grad.addColorStop(1, 'rgba(0, 212, 255, 0.01)');

        const points = chartData.values.map((v, i) => ({
            x: padL + (i / (chartData.values.length - 1)) * chartW,
            y: padT + chartH - (v / maxVal) * chartH,
        }));

        // Fill area
        ctx.beginPath();
        ctx.moveTo(points[0].x, padT + chartH);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, padT + chartH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Line
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        // Dots
        points.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#00d4ff';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#0a0e17';
            ctx.fill();
        });
    }, []);

    // GSAP entrance
    useEffect(() => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.fromTo('.eh-filters', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 })
            .fromTo('.eh-chart-section', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55 }, '-=0.25')
            .fromTo('.eh-stats-panel', { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5 }, '-=0.3')
            .fromTo('.eh-grid-title', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, '-=0.2')
            .fromTo('.eh-incident-card', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.08 }, '-=0.15');
    }, []);

    // Filter incidents
    const dateLimit = dateRange === 'last7' ? 7 : dateRange === 'last30' ? 30 : 90;
    const now = new Date();
    const filtered = incidents.filter(item => {
        // Date filter
        const detectedAt = new Date(item.detected_at);
        const daysAgo = (now - detectedAt) / (1000 * 60 * 60 * 24);
        if (daysAgo > dateLimit) return false;
        // Event type filter
        if (eventType !== 'all' && item.event_type !== eventType) return false;
        // Camera filter
        if (camera !== 'all' && item.camera_id !== camera) return false;
        // Confidence filter
        if (item.confidence < confidence) return false;
        return true;
    });

    // Dynamic stats from filtered data
    const totalFiltered = filtered.length;
    const avgConf = totalFiltered > 0
        ? Math.round(filtered.reduce((sum, i) => sum + i.confidence, 0) / totalFiltered)
        : 0;
    const typeCounts = {};
    filtered.forEach(i => { typeCounts[i.event_type] = (typeCounts[i.event_type] || 0) + 1; });
    const mostFrequent = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    const mostFrequentEvent = mostFrequent ? mostFrequent[0] : '—';

    // Get unique event types for filter dropdown
    const eventTypes = [...new Set(incidents.map(i => i.event_type))];

    return (
        <DashboardLayout title="AI History & Incident Analysis" subtitle="Real-time monitoring and threat detection active.">
            <div className={`eh-content-wrapper${isLocked ? ' eh-locked' : ''}`}>

                {/* === Filters === */}
                <div className="eh-filters">
                    <h3 className="eh-filters-title">Event Filters</h3>
                    <div className="eh-filters-row">
                        <div className="eh-filter-group">
                            <label>Date Range</label>
                            <select value={dateRange} onChange={e => setDateRange(e.target.value)}>
                                <option value="last7">Last 7 Days</option>
                                <option value="last30">Last 30 Days</option>
                                <option value="last90">Last 90 Days</option>
                            </select>
                        </div>
                        <div className="eh-filter-group">
                            <label>Event Type</label>
                            <select value={eventType} onChange={e => setEventType(e.target.value)}>
                                <option value="all">All Events</option>
                                {eventTypes.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div className="eh-filter-group">
                            <label>Camera</label>
                            <select value={camera} onChange={e => setCamera(e.target.value)}>
                                <option value="all">All Cameras</option>
                                <option value="CAM-01">CAM-01</option>
                                <option value="CAM-02">CAM-02</option>
                                <option value="CAM-03">CAM-03</option>
                                <option value="CAM-04">CAM-04</option>
                            </select>
                        </div>
                        <div className="eh-filter-group eh-filter-slider">
                            <label>Confidence Level: {confidence}%+</label>
                            <input
                                type="range" min="0" max="100"
                                value={confidence}
                                onChange={e => setConfidence(Number(e.target.value))}
                            />
                        </div>
                    </div>
                </div>

                {/* === Chart + Stats Row === */}
                <div className="eh-analytics-row">
                    <div className="eh-chart-section">
                        <h3>Suspicious Events Over Time</h3>
                        <div className="eh-chart-container">
                            <canvas ref={canvasRef} />
                        </div>
                    </div>

                    <div className="eh-stats-panel">
                        <h3>Incident Statistics</h3>
                        <div className="eh-stat-card">
                            <span className="eh-stat-label">Total Incidents (Filtered)</span>
                            <span className="eh-stat-value">{totalFiltered}</span>
                        </div>
                        <div className="eh-stat-card">
                            <span className="eh-stat-label">Most Frequent Event</span>
                            <span className="eh-stat-value eh-stat-text">{mostFrequentEvent}</span>
                        </div>
                        <div className="eh-stat-card">
                            <span className="eh-stat-label">Avg Confidence</span>
                            <span className="eh-stat-value">{avgConf}%</span>
                        </div>
                    </div>
                </div>

                {/* === Incident Grid === */}
                <h3 className="eh-grid-title">Incident Event Grid</h3>
                <div className="eh-incidents-grid">
                    {loading && (
                        <div className="eh-no-results">Loading incidents...</div>
                    )}
                    {!loading && filtered.map((item) => (
                        <div className="eh-incident-card" key={item.id}>
                            <div className="eh-incident-info">
                                <h4>{item.event_type}</h4>
                                <p>Source: <strong>{item.camera_id}</strong></p>
                                <p>{new Date(item.detected_at).toLocaleString()}</p>
                                {item.metadata?.duration_sec && (
                                    <p className="eh-incident-duration">
                                        Duration: {item.metadata.duration_sec}s &middot; {item.metadata.start_time} → {item.metadata.end_time}
                                    </p>
                                )}
                                {item.metadata?.file_name && (
                                    <p className="eh-incident-source">File: {item.metadata.file_name}</p>
                                )}
                            </div>
                            <div className="eh-incident-actions">
                                <span className="eh-incident-confidence">Confidence: {item.confidence}%</span>
                            </div>
                        </div>
                    ))}}
                    {filtered.length === 0 && (
                        <div className="eh-no-results">No incidents match your filters.</div>
                    )}
                </div>
            </div>

            {/* === Lock Overlay === */}
            {isLocked && (
                <div className="eh-lock-overlay">
                    <div className="eh-lock-card">
                        <div className="eh-lock-icon-ring">
                            <LockIcon />
                        </div>
                        <h2 className="eh-lock-title">Event History is Locked</h2>
                        <p className="eh-lock-subtitle">
                            Access detailed incident logs, analytics, and video clips by creating an account.
                        </p>
                        <div className="eh-lock-actions">
                            <button
                                className="eh-lock-btn eh-lock-btn-primary"
                                onClick={() => navigate('/?auth=signin')}
                            >
                                Sign In
                            </button>
                            <button
                                className="eh-lock-btn eh-lock-btn-secondary"
                                onClick={() => navigate('/?auth=signup')}
                            >
                                Create Account
                            </button>
                        </div>
                        <p className="eh-lock-footer-text">
                            Unlock full surveillance insights in seconds.
                        </p>
                    </div>
                </div>
            )}

        </DashboardLayout>
    );
};

export default EventHistory;
