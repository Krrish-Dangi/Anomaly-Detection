import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import DashboardLayout from '../components/DashboardLayout';
import '../pages/Dashboard.css';
import './EventHistory.css';

import cam01 from '../assets/cam-01.png';
import cam02 from '../assets/cam-02.png';
import cam03 from '../assets/cam-03.png';
import cam04 from '../assets/cam-04.png';

const thumbs = [cam01, cam02, cam03, cam04];

const incidentData = [
    { type: 'Shelf Tampering', camera: 'CAM-01', date: 'Oct 25, 14:32:30', confidence: 94, thumb: 0, daysAgo: 1 },
    { type: 'Loitering', camera: 'CAM-02', date: 'Oct 25, 14:32:30', confidence: 88, thumb: 1, daysAgo: 2 },
    { type: 'Shelf Tampering', camera: 'CAM-03', date: 'Oct 25, 14:32:30', confidence: 91, thumb: 2, daysAgo: 3 },
    { type: 'Shelf Tampering', camera: 'CAM-01', date: 'Oct 24, 11:15:22', confidence: 96, thumb: 3, daysAgo: 5 },
    { type: 'Loitering', camera: 'CAM-02', date: 'Oct 24, 09:44:10', confidence: 82, thumb: 0, daysAgo: 15 },
    { type: 'Loitering', camera: 'CAM-04', date: 'Oct 23, 18:20:55', confidence: 87, thumb: 1, daysAgo: 45 },
];

const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
    values: [20, 28, 45, 60, 52, 68, 55, 92],
};

const EventHistory = () => {
    const canvasRef = useRef(null);
    const [dateRange, setDateRange] = useState('last7');
    const [eventType, setEventType] = useState('all');
    const [camera, setCamera] = useState('all');
    const [confidence, setConfidence] = useState(80);

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
    const filtered = incidentData.filter(item => {
        if (item.daysAgo > dateLimit) return false;
        if (eventType !== 'all' && item.type !== eventType) return false;
        if (camera !== 'all' && item.camera !== camera) return false;
        if (item.confidence < confidence) return false;
        return true;
    });

    // Dynamic stats from filtered data
    const totalFiltered = filtered.length;
    const avgConf = totalFiltered > 0
        ? Math.round(filtered.reduce((sum, i) => sum + i.confidence, 0) / totalFiltered)
        : 0;
    const typeCounts = {};
    filtered.forEach(i => { typeCounts[i.type] = (typeCounts[i.type] || 0) + 1; });
    const mostFrequent = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    const mostFrequentEvent = mostFrequent ? mostFrequent[0] : '—';

    return (
        <DashboardLayout title="AI History & Incident Analysis" subtitle="Real-time monitoring and threat detection active.">

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
                            <option value="Shelf Tampering">Shelf Tampering</option>
                            <option value="Loitering">Loitering</option>
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
                {filtered.map((item, i) => (
                    <div className="eh-incident-card" key={i}>
                        <div className="eh-incident-thumb">
                            <img src={thumbs[item.thumb]} alt={item.type} />
                        </div>
                        <div className="eh-incident-info">
                            <h4>{item.type}</h4>
                            <p>Camera ID: <strong>{item.camera}</strong></p>
                            <p>{item.date}</p>
                        </div>
                        <div className="eh-incident-actions">
                            <span className="eh-incident-confidence">Confidence: {item.confidence}%</span>
                            <button className="eh-view-clip-btn">View Clip</button>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="eh-no-results">No incidents match your filters.</div>
                )}
            </div>

        </DashboardLayout>
    );
};

export default EventHistory;
