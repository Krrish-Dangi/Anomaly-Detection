import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import DashboardLayout from '../components/DashboardLayout';
import '../pages/Dashboard.css';
import './EventHistory.css';



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
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [localIp, setLocalIp] = useState(null);
    const [networkError, setNetworkError] = useState('');
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

        const fetchNetwork = async () => {
            try {
                const res = await fetch('/api/system/network');
                if (res.ok) {
                    const data = await res.json();
                    if (data.local_ip) setLocalIp(data.local_ip);
                } else {
                    setNetworkError("Failed to fetch local network config.");
                }
            } catch (e) {
                setNetworkError("Error reaching API.");
            }
        };

        fetchIncidents();
        fetchNetwork();
    }, [isAuthenticated, user]);

    // Build chartData dynamically from real incidents
    const chartData = useMemo(() => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const now = new Date();
        // Show last 8 months
        const labels = [];
        const counts = [];
        for (let i = 7; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            labels.push(monthNames[d.getMonth()]);
            counts.push(0);
        }
        // Count incidents per month
        for (const inc of incidents) {
            const det = new Date(inc.detected_at);
            for (let i = 7; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                if (det.getMonth() === d.getMonth() && det.getFullYear() === d.getFullYear()) {
                    counts[7 - i]++;
                    break;
                }
            }
        }
        return { labels, values: counts };
    }, [incidents]);

    // Draw chart
    useEffect(() => {
        const canvas = canvasRef.current;
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

            const W = rect.width;
            const H = rect.height;
            const padL = 40, padR = 20, padT = 10, padB = 30;
            const chartW = W - padL - padR;
            const chartH = H - padT - padB;
            const rawMax = Math.max(...chartData.values, 1);
            const maxVal = Math.ceil(rawMax * 1.2) || 5; // 20% headroom, min 5

            ctx.clearRect(0, 0, W, H);

            // Y-axis labels + grid lines (auto-scale)
            const yStepCount = 5;
            const ySteps = Array.from({ length: yStepCount + 1 }, (_, i) => Math.round((maxVal / yStepCount) * i));
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
        };

        const observer = new ResizeObserver(drawChart);
        if (canvas.parentElement) observer.observe(canvas.parentElement);
        
        drawChart();

        return () => observer.disconnect();
    }, [incidents, chartData]);

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
    
    // Get unique cameras for filter dropdown
    const cameraIds = [...new Set(incidents.map(i => i.camera_id).filter(Boolean))];

    const handleClearHistory = async () => {
        if (!window.confirm('Are you sure you want to permanently delete all your event history?')) return;
        
        // Use .select() to verify rows were actually deleted (returns deleted rows)
        const { data, error } = await supabase
            .from('incidents')
            .delete()
            .eq('user_id', user.id)
            .select();
            
        if (error) {
            alert('Failed to clear history: ' + error.message);
            return;
        }

        // If no error but also 0 rows deleted (when incidents existed), it's likely a missing RLS policy
        if ((!data || data.length === 0) && incidents.length > 0) {
            alert('Your history appears to have cleared locally, but the database rejected the deletion.\n\nTo fix this: Go to your Supabase Dashboard -> Authentication -> Policies (or Table Editor -> incidents -> RLS) and add a "Enable delete for users based on user_id" policy for the incidents table.');
        }

        setIncidents([]); // Clear local state anyway so UI is responsive
    };

    return (
        <DashboardLayout title="AI History & Incident Analysis" subtitle="Real-time monitoring and threat detection active.">
            <div className={`eh-content-wrapper${isLocked ? ' eh-locked' : ''}`}>

                {/* === Filters === */}
                <div className="eh-filters">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 className="eh-filters-title" style={{ margin: 0 }}>Event Filters</h3>
                        {!isLocked && (
                            <button 
                                onClick={handleClearHistory}
                                style={{ background: 'rgba(255, 60, 60, 0.1)', color: '#ff4d4d', border: '1px solid rgba(255, 60, 60, 0.2)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s' }}
                                onMouseEnter={e => e.target.style.background = 'rgba(255, 60, 60, 0.2)'}
                                onMouseLeave={e => e.target.style.background = 'rgba(255, 60, 60, 0.1)'}
                            >
                                Clear History
                            </button>
                        )}
                    </div>
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
                                {cameraIds.map(cam => (
                                    <option key={cam} value={cam}>{cam}</option>
                                ))}
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
                                {item.metadata?.clip_url && (
                                    <button
                                        className="eh-view-clip-btn"
                                        onClick={() => {
                                            if (localIp) {
                                                setSelectedVideo(`http://${localIp}:8000${item.metadata.clip_url}`);
                                            } else {
                                                alert("Local IP is unreachable for secure LAN video streaming. " + networkError);
                                            }
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', marginTop: '10px', background: 'rgba(0, 212, 255, 0.1)', color: '#00d4ff', border: '1px solid rgba(0, 212, 255, 0.2)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', fontWeight: 600 }}
                                        onMouseEnter={e => e.target.style.background = 'rgba(0, 212, 255, 0.2)'}
                                        onMouseLeave={e => e.target.style.background = 'rgba(0, 212, 255, 0.1)'}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
                                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                        </svg>
                                        View Clip
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
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

            {/* === Video Player Modal === */}
            {selectedVideo && (
                <div onClick={() => setSelectedVideo(null)} style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 7, 10, 0.9)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(8px)'}}>
                    <div onClick={e => e.stopPropagation()} style={{position: 'relative', width: '90%', maxWidth: '800px', backgroundColor: '#0a0e17', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'}}>
                        <button onClick={() => setSelectedVideo(null)} style={{position: 'absolute', top: '-40px', right: '0', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7, padding: '8px'}} onMouseEnter={e => e.target.style.opacity=1} onMouseLeave={e => e.target.style.opacity=0.7}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                        <div style={{fontWeight: 600, color: 'white', marginBottom: '12px', fontSize: '15px'}}>Anomaly Playback</div>
                        <video 
                            src={selectedVideo} 
                            controls 
                            autoPlay 
                            style={{width: '100%', borderRadius: '8px', backgroundColor: '#000'}}
                        />
                    </div>
                </div>
            )}

        </DashboardLayout>
    );
};

export default EventHistory;
