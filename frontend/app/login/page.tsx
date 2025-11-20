'use client';

import { LogIn } from 'lucide-react';

export default function LoginPage() {
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

                <button
                    onClick={handleLogin}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:scale-105"
                >
                    <LogIn className="w-5 h-5" />
                    Login with Discord
                </button>

                <p className="text-white/60 text-sm text-center mt-6">
                    Sign in with your Discord account to manage your bots
                </p>
            </div>
        </div>
    );
}
