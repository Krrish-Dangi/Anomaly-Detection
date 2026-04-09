import { useState, useEffect } from 'react';
import { gsap } from 'gsap';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import '../pages/Dashboard.css';
import './Settings.css';

const defaultCameras = [];

const Settings = () => {
    const { isDark, toggleTheme } = useTheme();
    const { user, profile, updateProfile, isAuthenticated } = useAuth();

    // User profile
    const [userName, setUserName] = useState('Guest');
    const [userEmail, setUserEmail] = useState('guest@gmail.com');
    const [userAvatar, setUserAvatar] = useState(null);
    const [uploading, setUploading] = useState(false);
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

    // Load profile info from auth context
    useEffect(() => {
        if (profile) {
            setUserName(profile.full_name || 'Guest');
            setUserEmail(profile.email || 'guest@gmail.com');
            setUserAvatar(profile.avatar_url || null);
        }
    }, [profile]);

    const handleAvatarUpload = async (event) => {
        try {
            setUploading(true);
            if (!event.target.files || event.target.files.length === 0) {
                return;
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setUserAvatar(publicUrl);
            if (isAuthenticated) {
                await updateProfile({ avatar_url: publicUrl });
            }
        } catch (error) {
            console.error('Error uploading avatar:', error.message);
            alert('Error uploading avatar! Please ensure the "avatars" bucket is created and set to public in Supabase.');
        } finally {
            setUploading(false);
        }
    };

    // Load settings from Supabase
    useEffect(() => {
        if (!user) return;
        const loadSettings = async () => {
            const { data } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (data) {
                setSuspicious(data.detect_suspicious ?? true);
                setLoitering(data.detect_loitering ?? true);
                setShelfInteraction(data.detect_shelf_interaction ?? true);
                setAiThreshold(data.confidence_threshold ?? 80);
                setDesktopAlerts(data.desktop_alerts ?? true);
                setEmailAlerts(data.email_alerts ?? true);
                setSoundAlerts(data.sound_alerts ?? true);
                setDataRetention(data.data_retention ?? false);
                setAutoExport(data.auto_export ?? false);
            }
        };
        loadSettings();
    }, [user]);

    // Load cameras from Supabase
    useEffect(() => {
        if (!user) return;
        const loadCameras = async () => {
            const { data } = await supabase
                .from('cameras')
                .select('*')
                .eq('user_id', user.id)
                .order('camera_id');

            if (data && data.length > 0) {
                setCameras(data.map(c => ({
                    id: c.camera_id,
                    location: c.location,
                    active: c.is_active,
                    dbId: c.id,
                })));
            }
        };
        loadCameras();
    }, [user]);

    const toggleCamera = async (idx) => {
        const cam = cameras[idx];
        const newActive = !cam.active;
        setCameras(prev => prev.map((c, i) => i === idx ? { ...c, active: newActive } : c));

        // Persist to Supabase if authenticated
        if (isAuthenticated && cam.dbId) {
            await supabase
                .from('cameras')
                .update({ is_active: newActive, updated_at: new Date().toISOString() })
                .eq('id', cam.dbId);
        }
    };

    const handleSave = async () => {
        // Save settings to Supabase
        if (isAuthenticated && user) {
            await supabase
                .from('user_settings')
                .update({
                    detect_suspicious: suspicious,
                    detect_loitering: loitering,
                    detect_shelf_interaction: shelfInteraction,
                    confidence_threshold: aiThreshold,
                    desktop_alerts: desktopAlerts,
                    email_alerts: emailAlerts,
                    sound_alerts: soundAlerts,
                    data_retention: dataRetention,
                    auto_export: autoExport,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.id);
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleProfileSave = async () => {
        if (editingProfile && isAuthenticated) {
            await updateProfile({ full_name: userName, email: userEmail });
        }
        setEditingProfile(!editingProfile);
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
                            {userAvatar ? (
                                <img src={userAvatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                </svg>
                            )}
                            {editingProfile && (
                                <label className="st-profile-avatar-upload" title="Upload Profile Picture">
                                    {uploading ? (
                                        <span style={{ fontSize: '10px' }}>Wait...</span>
                                    ) : (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="17 8 12 3 7 8" />
                                            <line x1="12" y1="3" x2="12" y2="15" />
                                        </svg>
                                    )}
                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} disabled={uploading} />
                                </label>
                            )}
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
                        onClick={handleProfileSave}
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
