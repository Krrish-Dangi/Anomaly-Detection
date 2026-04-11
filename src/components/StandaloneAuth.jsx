import { useTheme } from '../context/ThemeContext';
import './StandaloneAuth.css';

const StandaloneAuth = ({ onSignIn, onSignUp }) => {
    const { isDark, toggleTheme } = useTheme();

    return (
        <div className="standalone-auth">
            <button 
                className={`theme-icon-btn ${isDark ? 'is-dark' : 'is-light'}`} 
                onClick={toggleTheme}
                aria-label="Toggle Theme"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
                {isDark ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="theme-svg">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="theme-svg">
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                )}
            </button>
            <button className="standalone-btn-signin" onClick={onSignIn}>Sign In</button>
            <button className="standalone-btn-signup" onClick={onSignUp}>Sign Up</button>
        </div>
    );
};

export default StandaloneAuth;
