import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import DashboardLayout from '../components/DashboardLayout';
import '../pages/Dashboard.css';

const statsData = [
    { label: 'ACTIVE CAMERAS', value: '0', change: '—', positive: true },
    { label: 'THREATS DETECTED', value: '0', change: '—', positive: true },
    { label: 'SYSTEM UPTIME', value: '—', change: '—', positive: true },
];

const Dashboard = () => {
    const chartRef = useRef(null);

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

    useEffect(() => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.fromTo('.dash-stat-card', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.1 })
            .fromTo('.dash-chart-card', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, '-=0.1')
            .fromTo('.dash-feeds-card', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, '-=0.2');
    }, []);

    return (
        <DashboardLayout title="Dashboard" subtitle="Real-time monitoring and threat detection active.">
            <div className="dash-stats-row">
                {statsData.map((stat) => (
                    <div className="dash-stat-card" key={stat.label}>
                        <div className="dash-stat-label">{stat.label}</div>
                        <div className="dash-stat-bottom">
                            <div className="dash-stat-value">{stat.value}</div>
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
                </div>
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
                    <button className="dash-connect-cam-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Connect Camera
                    </button>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default Dashboard;
