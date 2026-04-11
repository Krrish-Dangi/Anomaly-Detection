import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);       // Supabase auth user
    const [profile, setProfile] = useState(null);  // profiles table row
    const [loading, setLoading] = useState(true);
    const [recoveryMode, setRecoveryMode] = useState(false);

    // Fetch the user's profile from the profiles table
    const fetchProfile = async (userId) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching profile:', error.message);
            return null;
        }
        return data;
    };

    // Initialize auth state + listen for changes
    useEffect(() => {
        // Get current session
        const initAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
                setUser(session.user);
                const prof = await fetchProfile(session.user.id);
                setProfile(prof);
            }
            setLoading(false);
        };

        initAuth();

        // Listen for auth state changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === 'SIGNED_IN' && session?.user) {
                    setUser(session.user);
                    // Small delay to let the database trigger finish creating the profile
                    setTimeout(async () => {
                        const prof = await fetchProfile(session.user.id);
                        setProfile(prof);
                    }, 500);
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setProfile(null);
                } else if (event === 'PASSWORD_RECOVERY') {
                    setRecoveryMode(true);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // ===== Auth methods =====

    // Sign in with Google OAuth
    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/dashboard',
            },
        });
        if (error) throw error;
    };

    // Sign in with email/password
    const signInWithEmail = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    };

    // Sign up with email/password + extra profile fields
    const signUpWithEmail = async (email, password, metadata = {}) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: metadata.fullName || '',
                    phone: metadata.phone || '',
                    store_name: metadata.storeName || '',
                },
            },
        });
        if (error) throw error;
        return data;
    };

    // Sign out
    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setUser(null);
        setProfile(null);
    };

    // Update profile in the database
    const updateProfile = async (updates) => {
        if (!user) return;
        const { data, error } = await supabase
            .from('profiles')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', user.id)
            .select()
            .single();

        if (error) throw error;
        setProfile(data);
        return data;
    };

    // Password recovery
    const resetPasswordForEmail = async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/?auth=reset',
        });
        if (error) throw error;
    };

    const updateUserPassword = async (newPassword) => {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });
        if (error) throw error;
        setRecoveryMode(false);
    };

    const value = {
        user,
        profile,
        loading,
        recoveryMode,
        setRecoveryMode,
        isAuthenticated: !!user,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        updateProfile,
        resetPasswordForEmail,
        updateUserPassword,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
