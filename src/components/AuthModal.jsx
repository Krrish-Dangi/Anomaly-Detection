import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './AuthModal.css';
import logoImg from '../assets/logo.png';
import authBg from '../assets/auth-bg.png';

// Password strength checker
const checkPasswordStrength = (password) => {
  if (!password) return 0;
  
  let strength = 0;
  
  // Length check
  if (password.length >= 8) strength += 1;
  if (password.length >= 12) strength += 1;
  
  // Character variety checks
  if (/[a-z]/.test(password)) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^A-Za-z0-9]/.test(password)) strength += 1;
  
  return Math.min(strength, 5);
};

const getPasswordStrengthPercentage = (password) => {
  const strength = checkPasswordStrength(password);
  return (strength / 5) * 100;
};

const getStrengthClass = (password) => {
  const strength = checkPasswordStrength(password);
  if (strength <= 1) return 'strength-weak';
  if (strength <= 2) return 'strength-fair';
  if (strength <= 3) return 'strength-good';
  if (strength <= 4) return 'strength-strong';
  return 'strength-excellent';
};

const getStrengthText = (password) => {
  const strength = checkPasswordStrength(password);
  switch (strength) {
    case 0: return 'Too weak';
    case 1: return 'Weak';
    case 2: return 'Fair';
    case 3: return 'Good';
    case 4: return 'Strong';
    case 5: return 'Excellent';
    default: return '';
  }
};

const EyeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const EyeOffIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);

const AuthModal = ({ isOpen, onClose, initialMode = 'signin' }) => {
    const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
    const navigate = useNavigate();

    const [mode, setMode] = useState(initialMode);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [authError, setAuthError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [authLoading, setAuthLoading] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        rememberMe: false,
    });

    // Sync mode with prop when modal opens
    useEffect(() => {
        if (isOpen) {
            setMode(initialMode);
            setShowPassword(false);
            setShowConfirmPassword(false);
            setAuthError('');
            setFieldErrors({});
            setAuthLoading(false);
            setFormData({
                fullName: '',
                email: '',
                password: '',
                confirmPassword: '',
                rememberMe: false,
            });
        }
    }, [isOpen, initialMode]);

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
        // Clear error when user types
        if (authError) setAuthError('');
        
        // Real-time validation for specific fields
        validateField(name, value);
    };

    // Field validation functions
    const validateField = (name, value) => {
        // Clear field-specific errors when user types
        setFieldErrors(prev => ({
            ...prev,
            [name]: ''
        }));
    };

    const validateForm = () => {
        const errors = {};
        
        // Email validation
        if (!formData.email) {
            errors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            errors.email = 'Email is invalid';
        }
        
        // Password validation
        if (!formData.password) {
            errors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            errors.password = 'Password must be at least 6 characters';
        }
        
        // Confirm password validation (for signup)
        if (mode === 'signup') {
            if (!formData.confirmPassword) {
                errors.confirmPassword = 'Please confirm your password';
            } else if (formData.password !== formData.confirmPassword) {
                errors.confirmPassword = 'Passwords do not match';
            }
        }
        
        // Full name validation (for signup)
        if (mode === 'signup' && !formData.fullName) {
            errors.fullName = 'Full name is required';
        }
        
        return errors;
    };

    const handleGoogleSignIn = async () => {
        setAuthLoading(true);
        setAuthError('');
        try {
            await signInWithGoogle();
            // Google OAuth redirects, so we won't reach here unless it fails
        } catch (err) {
            setAuthError(err.message || 'Google sign-in failed');
            setAuthLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setAuthError('');
        
        // Validate form
        const validationErrors = validateForm();
        if (Object.keys(validationErrors).length > 0) {
            setFieldErrors(validationErrors);
            // Show first error as general error for backward compatibility
            const firstError = Object.values(validationErrors)[0];
            setAuthError(firstError);
            setAuthLoading(false);
            return;
        }
        
        setAuthLoading(true);

        try {
            if (mode === 'signup') {
                const result = await signUpWithEmail(formData.email, formData.password, {
                    fullName: formData.fullName,
                });

                // Check if we got a session (email confirmation disabled)
                if (result?.session) {
                    onClose();
                    navigate('/dashboard');
                } else {
                    // Email confirmation is required — show success message
                    setAuthError('');
                    setAuthLoading(false);
                    setMode('confirm');
                    return;
                }
            } else {
                // Sign in
                await signInWithEmail(formData.email, formData.password);
                onClose();
                navigate('/dashboard');
            }
        } catch (err) {
            setAuthError(err.message || 'Authentication failed');
        } finally {
            setAuthLoading(false);
        }
    };

    const switchMode = () => {
        setMode(mode === 'signin' ? 'signup' : 'signin');
        setShowPassword(false);
        setShowConfirmPassword(false);
        setAuthError('');
    };

    if (!isOpen) return null;

    return (
        <div className="auth-overlay" onClick={onClose}>
            <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
                <div className="auth-left">
                    {/* Close button */}
                    <button className="auth-close" onClick={onClose} aria-label="Close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>

                    {/* Header */}
                    <div className="auth-header">
                        <div className="auth-logo-icon">
                            <img src={logoImg} alt="SentinelAI Logo" className="auth-logo-img" />
                        </div>
                        <h2 className="auth-title">
                            {mode === 'confirm' ? 'Check Your Email' : mode === 'signin' ? 'Welcome Back' : 'Create Account'}
                        </h2>
                        <p className="auth-subtitle">
                            {mode === 'confirm'
                                ? `We've sent a confirmation link to ${formData.email}`
                                : mode === 'signin'
                                    ? 'Sign in to access your surveillance dashboard'
                                    : 'Get started with AI-powered retail security'}
                        </p>
                    </div>

                    {/* Email Confirmation Screen */}
                    {mode === 'confirm' && (
                        <div className="auth-confirm-screen">
                            <div className="auth-confirm-icon">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                </svg>
                            </div>
                            <p className="auth-confirm-text">
                                Click the link in the email to verify your account, then come back and sign in.
                            </p>
                            <button
                                type="button"
                                className="auth-submit-btn"
                                onClick={() => { setMode('signin'); setAuthError(''); }}
                            >
                                Back to Sign In
                            </button>
                        </div>
                    )}

                    {/* Error Message */}
                    {authError && (
                        <div className="auth-error-msg">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                            </svg>
                            {authError}
                        </div>
                    )}

                    {mode !== 'confirm' && (
                        <>
                            {/* Google Button */}
                            <button
                                className="auth-google-btn"
                                type="button"
                                onClick={handleGoogleSignIn}
                                disabled={authLoading}
                            >
                                <svg width="18" height="18" viewBox="0 0 48 48">
                                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                                </svg>
                                {authLoading ? 'Connecting...' : 'Continue with Google'}
                            </button>

                            {/* Divider */}
                            <div className="auth-divider">
                                <span>OR SIGN IN WITH EMAIL</span>
                            </div>

                            {/* Form */}
                            <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
                                {mode === 'signup' && (
                                    <div className="auth-field">
                                        <label htmlFor="fullName">Full Name</label>
                                        <input
                                            id="fullName"
                                            name="fullName"
                                            type="text"
                                            placeholder="John Doe"
                                            value={formData.fullName}
                                            onChange={handleChange}
                                            required
                                            autoComplete="off"
                                            disabled={authLoading}
                                        />
                                        {fieldErrors.fullName && (
                                            <div className="auth-field-error">{fieldErrors.fullName}</div>
                                        )}
                                    </div>
                                )}

                                <div className="auth-field">
                                    <label htmlFor="email">Email</label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        autoComplete="off"
                                        disabled={authLoading}
                                    />
                                    {fieldErrors.email && (
                                        <div className="auth-field-error">{fieldErrors.email}</div>
                                    )}
                                </div>

                                <div className="auth-field">
                                    <label htmlFor="password">Password</label>
                                    <div className="auth-password-wrapper">
                                        <input
                                            id="password"
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={handleChange}
                                            required
                                            autoComplete="new-password"
                                            disabled={authLoading}
                                        />
                                        <button
                                            type="button"
                                            className="auth-eye-btn"
                                            onClick={() => setShowPassword(!showPassword)}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                        </button>
                                    </div>
                                    {fieldErrors.password && (
                                        <div className="auth-field-error">{fieldErrors.password}</div>
                                    )}
                                    {/* Password Strength Indicator */}
                                    {mode === 'signup' && (
                                        <div className="auth-password-strength">
                                            <div className="auth-strength-header">
                                                <div className="auth-strength-label">Password Strength</div>
                                                <div className="auth-strength-text">{getStrengthText(formData.password)}</div>
                                            </div>
                                            <div className="auth-strength-bar">
                                                <div
                                                    className={`auth-strength-fill ${getStrengthClass(formData.password)}`}
                                                    style={{ width: `${getPasswordStrengthPercentage(formData.password)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {mode === 'signup' && (
                                    <>
                                        <div className="auth-field">
                                            <label htmlFor="confirmPassword">Confirm Password</label>
                                            <div className="auth-password-wrapper">
                                                <input
                                                    id="confirmPassword"
                                                    name="confirmPassword"
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    placeholder="••••••••"
                                                    value={formData.confirmPassword}
                                                    onChange={handleChange}
                                                    required
                                                    autoComplete="new-password"
                                                    disabled={authLoading}
                                                />
                                                <button
                                                    type="button"
                                                    className="auth-eye-btn"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                                >
                                                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                                                </button>
                                            </div>
                                            {fieldErrors.confirmPassword && (
                                                <div className="auth-field-error">{fieldErrors.confirmPassword}</div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {mode === 'signin' && (
                                    <div className="auth-extras">
                                        <label className="auth-remember">
                                            <input
                                                type="checkbox"
                                                name="rememberMe"
                                                checked={formData.rememberMe}
                                                onChange={handleChange}
                                            />
                                            <span className="auth-checkbox"></span>
                                            Remember me
                                        </label>
                                        <a href="#" className="auth-forgot">Forgot password?</a>
                                    </div>
                                )}

                                <button type="submit" className="auth-submit-btn" disabled={authLoading}>
                                    {authLoading
                                        ? 'Please wait...'
                                        : mode === 'signin' ? 'Sign In' : 'Create Account'
                                    }
                                </button>
                            </form>

                            {/* Switch mode */}
                            <p className="auth-switch">
                                {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
                                <button type="button" className="auth-switch-btn" onClick={switchMode} disabled={authLoading}>
                                    {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                                </button>
                            </p>
                        </>
                    )}
                </div>

                <div className="auth-right">
                    <img src={authBg} alt="SentinelAI Surveillance" className="auth-side-img" />
                    <div className="auth-image-overlay">
                        <div className="auth-image-content">
                            <h3>Next-Gen AI Security</h3>
                            <p>Protecting your business with state-of-the-art vision models and real-time analytics.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
