'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../app/api-client';

interface AuthContextType {
    user: any;
    loading: boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [silentLoginAttempted, setSilentLoginAttempted] = useState(false);

    useEffect(() => {
        checkAuth();

        // Listen for silent login messages
        const handleMessage = async (event: MessageEvent) => {
            if (event.data.type === 'DISCORD_SILENT_LOGIN_SUCCESS' && event.data.token) {
                localStorage.setItem('access_token', event.data.token);
                // Re-check auth with new token
                await checkAuth();
            } else if (event.data.type === 'DISCORD_SILENT_LOGIN_REQUIRED') {
                console.log('Silent login failed, interaction required');
                setLoading(false);
            } else if (event.data.type === 'DISCORD_SILENT_LOGIN_FAILED') {
                console.error('Silent login failed with error:', event.data.error);
                setLoading(false);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const createSilentLoginIframe = () => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = 'http://localhost:8000/api/v1/auth/discord/login?prompt=none&state=silent';
        document.body.appendChild(iframe);

        // Cleanup iframe after some time to avoid leaks
        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
        }, 10000); // 10s timeout
    };

    const checkAuth = async () => {
        // Check for token in URL (from OAuth callback)
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');
            if (token) {
                // Save token to localStorage
                localStorage.setItem('access_token', token);

                // Remove token from URL for cleaner history
                const newUrl = window.location.pathname + window.location.hash;
                window.history.replaceState({}, '', newUrl);
            }
        }

        // If we are on the login page, skip auth check to avoid infinite loop
        if (typeof window !== 'undefined' && (window.location.pathname === '/login' || window.location.pathname === '/access-denied')) {
            setLoading(false);
            return;
        }

        try {
            const data = await apiClient.getCurrentUser();
            setUser(data);
            setLoading(false);
        } catch (error: any) {
            console.error('Auth check failed:', error);

            // If 401 and haven't tried silent login yet, try it
            if (error.response?.status === 401 && !silentLoginAttempted) {
                setSilentLoginAttempted(true);
                createSilentLoginIframe();
                // Don't set loading false yet, wait for iframe result or timeout
                // However, we need a safety fallback if iframe never responds (handled by timeout in createSilentLoginIframe?)
                // actually the timeout removes iframe, but doesn't update loading state.
                // Let's add a safety timeout for loading state too.
                setTimeout(() => {
                    setLoading((prev) => {
                        if (prev) return false; // Force stop loading if still loading
                        return prev;
                    });
                }, 11000);
            } else {
                setLoading(false);
            }
        }
    };

    const logout = async () => {
        try {
            await apiClient.logout();
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            setUser(null);
            setSilentLoginAttempted(true);
            if (typeof window !== 'undefined') {
                localStorage.removeItem('access_token');
                window.location.href = '/login';
            }
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
