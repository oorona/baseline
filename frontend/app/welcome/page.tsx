'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/app/api-client';
import { Bot, ExternalLink, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const [clientId, setClientId] = useState<string | null>(null);

    useEffect(() => {
        apiClient.getDiscordConfig().then((config: { client_id: string }) => {
            setClientId(config.client_id);
        }).catch(console.error);

        // If user actually has guilds now, redirect to home
        if (user) {
            apiClient.getGuilds().then(guilds => {
                if (guilds.length > 0) {
                    router.push('/');
                }
            }).catch(() => { });
        }
    }, [user, router]);

    const inviteUrl = clientId
        ? `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot`
        : '#';

    if (loading) return null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md w-full bg-card rounded-2xl p-8 border border-border shadow-2xl text-center">
                <div className="bg-primary/10 w-fit mx-auto p-4 rounded-full mb-6 relative">
                    <Bot className="w-12 h-12 text-primary" />
                    <ShieldAlert className="w-6 h-6 text-yellow-500 absolute -bottom-1 -right-1 bg-card rounded-full" />
                </div>

                <h1 className="text-2xl font-bold mb-4 text-foreground">Setup Required</h1>
                <p className="text-muted-foreground mb-8">
                    Welcome, {user?.username}! It looks like you don't have access to any configured servers yet.
                    To use the dashboard, you must invite the bot to a server you own, or be authorized by a server owner.
                </p>

                <div className="space-y-4">
                    <a
                        href={inviteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2
                            ${clientId
                                ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg'
                                : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                    >
                        <span>Add Bot to Server</span>
                        <ExternalLink size={18} />
                    </a>

                    <button
                        onClick={logout}
                        className="block w-full py-3 px-4 rounded-lg font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
}
