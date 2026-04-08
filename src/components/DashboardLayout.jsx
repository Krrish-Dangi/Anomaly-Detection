import { useNavigate, useLocation } from 'react-router-dom';
import './DashboardLayout.css';
import logoImg from '../assets/logo.png';

const navItems = [
    {
        label: 'Dashboard', path: '/dashboard', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
        )
    },
    {
        label: 'Video Analysis', path: '/dashboard/video-analysis', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
        )
    },
    {
        label: 'Event History', path: '/dashboard/event-history', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
        )
    },
    {
        label: 'System Settings', path: '/dashboard/settings', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
        )
    },
];

const DashboardLayout = ({ children, title, subtitle }) => {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="dash-layout">
            {/* Sidebar */}
            <aside className="dash-sidebar">
                <div className="dash-sidebar-top">
                    <div className="dash-sidebar-logo">
                        <div className="dash-sidebar-logo-icon">
                            <img src={logoImg} alt="SentinelAI Logo" className="dash-sidebar-logo-img" />
                        </div>
                        <div>
                            <div className="dash-sidebar-brand">SENTINEL</div>
                            <div className="dash-sidebar-sub">AI</div>
                        </div>
                    </div>

                    <div className="dash-sidebar-section">MAIN CONSOLE</div>
                    <nav className="dash-sidebar-nav">
                        {navItems.map((item) => (
                            <a
                                key={item.label}
                                href="#"
                                className={`dash-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                                onClick={(e) => { e.preventDefault(); navigate(item.path); }}
                            >
                                {item.icon}
                                {item.label}
                            </a>
                        ))}
                    </nav>
                </div>

                <div className="dash-sidebar-bottom">
                    <div className="dash-sidebar-user">
                        <div className="dash-sidebar-avatar">G</div>
                        <div>
                            <div className="dash-sidebar-username">Guest</div>
                            <div className="dash-sidebar-email">guest@gmail.com</div>
                        </div>
                    </div>
                    <button className="dash-sidebar-logout" onClick={() => navigate('/')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Terminate Session
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="dash-main">
                <header className="dash-header">
                    <div>
                        <h1 className="dash-title">{title || 'Dashboard'}</h1>
                        <p className="dash-subtitle">{subtitle || 'Real-time monitoring and threat detection active.'}</p>
                    </div>
                    <div className="dash-header-actions">
                        <div className="dash-live-badge">
                            <span className="dash-live-dot"></span>
                            SYSTEM LIVE
                        </div>
                        <button className="dash-notif-btn" aria-label="Notifications">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                            <span className="dash-notif-dot"></span>
                        </button>
                    </div>
                </header>
                {children}
            </main>
        </div>
    );
};

export default DashboardLayout;
