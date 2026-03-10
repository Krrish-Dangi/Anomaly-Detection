import { useState, useEffect } from 'react';
import { gsap } from 'gsap';
import DashboardLayout from '../components/DashboardLayout';
import { useTheme } from '../context/ThemeContext';
import '../pages/Dashboard.css';
import './Settings.css';

const defaultCameras = [
    { id: 'CAM-01', location: 'Entrance', active: true },
    { id: 'CAM-02', location: 'Aisle 3', active: true },
    { id: 'CAM-03', location: 'Checkout', active: true },
    { id: 'CAM-04', location: 'Stockroom', active: true },
    { id: 'CAM-05', location: 'Aisle 2', active: true },
    { id: 'CAM-06', location: 'Checkout', active: true },
    { id: 'CAM-07', location: 'Aisle 5', active: true },
    { id: 'CAM-08', location: 'Entrance', active: true },
];

const Settings = () => {
    const { isDark, toggleTheme } = useTheme();

    // User profile
    const [userName, setUserName] = useState('Guest');
    const [userEmail, setUserEmail] = useState('guest@gmail.com');
    const [editingProfile, setEditingProfile] = useState(false);

    // AI Detection
    const [suspicious, setSuspicious] = useState(true);
    const [loitering, setLoitering] = useState(true);
    const [shelfInteraction, setShelfInteraction] = useState(true);
    const [aiThreshold, setAiThreshold] = useState(80);

    // Alert Notifications
    const [desktopAlerts, setDesktopAlerts] = useState(true);
    const [emailAlerts, setEmailAlerts] = useState(true);
    const [soundAlerts, setSoundAlerts] = useState(true);

    // Camera config
    const [cameras, setCameras] = useState(defaultCameras);

    // System Preferences
    const [dataRetention, setDataRetention] = useState(false);
    const [autoExport, setAutoExport] = useState(false);

    // Save feedback
    const [saved, setSaved] = useState(false);

    const toggleCamera = (idx) => {
        setCameras(prev => prev.map((c, i) => i === idx ? { ...c, active: !c.active } : c));
    };

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    // GSAP entrance
    useEffect(() => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.fromTo('.st-card', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.08 });
    }, []);

    const Toggle = ({ on, onToggle }) => (
        <button className={`st-toggle ${on ? 'st-toggle-on' : ''}`} onClick={onToggle} type="button">
            <span className="st-toggle-thumb" />
        </button>
    );

    return (
        <DashboardLayout title="AI System Settings Panel" subtitle="Real-time monitoring and threat detection active.">

            {/* Row 1: Profile + AI Detection */}
            <div className="st-row st-row-2">
                {/* User Profile */}
                <div className="st-card st-profile-card">
                    <h3>User Profile</h3>
                    <div className="st-profile-body">
                        <div className="st-profile-avatar">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                            </svg>
                        </div>
                        <div className="st-profile-info">
                            {editingProfile ? (
                                <>
                                    <input
                                        className="st-input"
                                        value={userName}
                                        onChange={(e) => setUserName(e.target.value)}
                                        placeholder="Name"
                                    />
                                    <input
                                        className="st-input"
                                        value={userEmail}
                                        onChange={(e) => setUserEmail(e.target.value)}
                                        placeholder="Email"
                                    />
                                </>
                            ) : (
                                <>
                                    <strong>{userName}</strong>
                                    <span>{userEmail}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <button
                        className="st-btn-accent"
                        onClick={() => setEditingProfile(!editingProfile)}
                    >
                        {editingProfile ? 'Save Profile' : 'Edit Profile'}
                    </button>
                </div>

                {/* AI Detection Settings */}
                <div className="st-card">
                    <h3>AI Detection Settings</h3>
                    <div className="st-setting-row">
                        <span>Suspicious Behavior</span>
                        <Toggle on={suspicious} onToggle={() => setSuspicious(!suspicious)} />
                    </div>
                    <div className="st-setting-row">
                        <span>Loitering</span>
                        <Toggle on={loitering} onToggle={() => setLoitering(!loitering)} />
                    </div>
                    <div className="st-setting-row">
                        <span>Shelf Interaction</span>
                        <Toggle on={shelfInteraction} onToggle={() => setShelfInteraction(!shelfInteraction)} />
                    </div>
                    <div className="st-setting-row st-slider-row">
                        <span>Confidence Threshold</span>
                        <span className="st-slider-value">{aiThreshold}%</span>
                    </div>
                    <input
                        type="range" min="50" max="100"
                        value={aiThreshold}
                        onChange={e => setAiThreshold(Number(e.target.value))}
                        className="st-slider"
                    />
                </div>
            </div>

            {/* Row 2: Alert Notifications */}
            <div className="st-row st-row-1">
                <div className="st-card">
                    <h3>Alert Notifications</h3>
                    <div className="st-setting-row">
                        <span>Desktop Alerts</span>
                        <Toggle on={desktopAlerts} onToggle={() => setDesktopAlerts(!desktopAlerts)} />
                    </div>
                    <div className="st-setting-row">
                        <span>Email Alerts</span>
                        <Toggle on={emailAlerts} onToggle={() => setEmailAlerts(!emailAlerts)} />
                    </div>
                    <div className="st-setting-row">
                        <span>Sound Alerts</span>
                        <Toggle on={soundAlerts} onToggle={() => setSoundAlerts(!soundAlerts)} />
                    </div>
                </div>
            </div>

            {/* Row 3: Camera Config + System Prefs */}
            <div className="st-row st-row-2-uneven">
                {/* Camera Configuration */}
                <div className="st-card st-camera-card">
                    <h3>Camera Configuration</h3>
                    <div className="st-camera-grid">
                        {cameras.map((cam, i) => (
                            <div
                                className={`st-cam-item ${cam.active ? '' : 'st-cam-inactive'}`}
                                key={cam.id}
                                onClick={() => toggleCamera(i)}
                            >
                                <strong>{cam.id}</strong>
                                <span>{cam.location}</span>
                                <div className="st-cam-status">
                                    <span className={`st-cam-dot ${cam.active ? 'st-cam-active' : 'st-cam-off'}`} />
                                    {cam.active ? 'Active' : 'Inactive'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* System Preferences */}
                <div className="st-card st-prefs-card">
                    <h3>System Preferences</h3>
                    <div className="st-setting-row">
                        <span>Dark Mode</span>
                        <Toggle on={isDark} onToggle={toggleTheme} />
                    </div>
                    <div className="st-setting-row">
                        <span>Data Retention</span>
                        <Toggle on={dataRetention} onToggle={() => setDataRetention(!dataRetention)} />
                    </div>
                    <div className="st-setting-row">
                        <span>Auto Export</span>
                        <Toggle on={autoExport} onToggle={() => setAutoExport(!autoExport)} />
                    </div>

                    <button
                        className={`st-save-btn ${saved ? 'st-save-saved' : ''}`}
                        onClick={handleSave}
                    >
                        {saved ? '✓ Settings Saved!' : 'Save Settings'}
                    </button>
                </div>
            </div>

        </DashboardLayout>
    );
};

export default Settings;
