'use client';

import { LogIn } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get('error');
    const details = searchParams.get('details');

    const handleLogin = () => {
        window.location.href = 'http://localhost:8000/api/v1/auth/discord/login';
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20 max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">Baseline Bot</h1>
                    <p className="text-white/80">Discord Bot Management Platform</p>
                </div>

                {error && (
                    <div className="bg-red-500/20 border border-red-400 text-red-200 px-4 py-3 rounded-lg relative mb-4" role="alert">
                        <strong className="font-bold">Login Failed! </strong>
                        <span className="block sm:inline">
                            {error === 'discord_error'
                                ? 'Discord Login Failed. You may be rate limited. Please try again later.'
                                : 'An unexpected error occurred during login.'}
                        </span>
                        {details && (
                            <div className="mt-2 text-xs bg-red-600/30 p-2 rounded overflow-auto max-h-20 text-red-100">
                                Details: {decodeURIComponent(details)}
                            </div>
                        )}
                    </div>
                )}

                <button
                    onClick={handleLogin}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:scale-105"
                >
                    <LogIn className="w-5 h-5" />
                    Login with Discord
                </button>

                <button
                    onClick={() => window.location.href = 'http://localhost:8000/api/v1/auth/discord/login?prompt=consent'}
                    className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 border border-white/20"
                >
                    Switch Account
                </button>

                <p className="text-white/60 text-sm text-center mt-6">
                    Sign in with your Discord account to manage your bots
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LoginContent />
        </Suspense>
    );
}
