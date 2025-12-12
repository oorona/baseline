'use client';

import { LogIn } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { siteConfig } from '../config';

function LoginContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get('error');
    const details = searchParams.get('details');

    const handleLogin = () => {
        window.location.href = 'http://localhost:8000/api/v1/auth/discord/login';
    };

    // ...

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="bg-card rounded-2xl p-8 shadow-xl border border-border max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-foreground mb-2">{siteConfig.name}</h1>
                    <p className="text-muted-foreground">{siteConfig.description}</p>
                </div>

                {error && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg relative mb-4" role="alert">
                        <strong className="font-bold">Login Failed! </strong>
                        <span className="block sm:inline">
                            {error === 'discord_error'
                                ? 'Discord Login Failed. You may be rate limited. Please try again later.'
                                : 'An unexpected error occurred during login.'}
                        </span>
                        {details && (
                            <div className="mt-2 text-xs bg-black/10 p-2 rounded overflow-auto max-h-20 text-destructive font-mono">
                                Details: {decodeURIComponent(details)}
                            </div>
                        )}
                    </div>
                )}

                <button
                    onClick={handleLogin}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-md hover:shadow-lg hover:scale-[1.02]"
                >
                    <LogIn className="w-5 h-5" />
                    Login with Discord
                </button>

                <button
                    onClick={() => window.location.href = 'http://localhost:8000/api/v1/auth/discord/login?prompt=consent'}
                    className="w-full mt-4 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 border border-border"
                >
                    Switch Account
                </button>

                <p className="text-muted-foreground text-sm text-center mt-6">
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
