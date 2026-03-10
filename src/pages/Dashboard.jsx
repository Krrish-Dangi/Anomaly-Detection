import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import DashboardLayout from '../components/DashboardLayout';
import '../pages/Dashboard.css';
import cam01 from '../assets/cam-01.png';
import cam02 from '../assets/cam-02.png';
import cam03 from '../assets/cam-03.png';
import cam04 from '../assets/cam-04.png';

const statsData = [
    { label: 'ACTIVE CAMERAS', value: '124', change: '+5%', positive: true },
    { label: 'THREATS DETECTED', value: '02', change: '-12%', positive: false },
    { label: 'SYSTEM UPTIME', value: '99.9%', change: '+0.1%', positive: true },
];

const cameraFeeds = [
    { id: 'CAM_01', img: cam01 },
    { id: 'CAM_02', img: cam02 },
    { id: 'CAM_03', img: cam03 },
    { id: 'CAM_04', img: cam04 },
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

        const points = [0.3, 0.25, 0.2, 0.22, 0.28, 0.35, 0.45, 0.55, 0.65, 0.72, 0.78, 0.82, 0.88, 0.85, 0.78, 0.72, 0.68, 0.7, 0.75, 0.72, 0.65, 0.55, 0.42, 0.35];
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

        [8, 13, 20].forEach(i => {
            ctx.beginPath(); ctx.arc(getX(i), getY(points[i]), 5, 0, Math.PI * 2); ctx.fillStyle = '#00d4ff'; ctx.fill();
            ctx.beginPath(); ctx.arc(getX(i), getY(points[i]), 8, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0,212,255,0.3)'; ctx.lineWidth = 2; ctx.stroke();
        });

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
                    <h3>Live Feed Selection</h3>
                    <a href="#" className="dash-feeds-view-all">VIEW ALL</a>
                </div>
                <div className="dash-feeds-grid">
                    {cameraFeeds.map((cam) => (
                        <div className="dash-feed-item" key={cam.id}>
                            <img src={cam.img} alt={cam.id} />
                            <span className="dash-feed-label">{cam.id}</span>
                            <span className="dash-feed-live-dot"></span>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default Dashboard;
