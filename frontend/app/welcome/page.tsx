'use client';

import { useEffect, useState } from 'react';
import { Bot, ExternalLink, LayoutDashboard, LogIn, Users, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

interface BotInfo {
  name: string;
  tagline: string;
  description: string;
  logo_url: string;
  invite_url: string;
  configured: boolean;
}

async function fetchBotInfo(): Promise<BotInfo> {
  const res = await fetch('/api/v1/bot-info/public');
  if (!res.ok) throw new Error('Failed to load bot info');
  return res.json();
}

export default function WelcomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [botLoading, setBotLoading] = useState(true);
  const [userGuilds, setUserGuilds] = useState<number | null>(null);

  useEffect(() => {
    fetchBotInfo()
      .then(setBotInfo)
      .catch(() => setBotInfo({ name: 'My Discord Bot', tagline: '', description: '', logo_url: '', invite_url: '', configured: false }))
      .finally(() => setBotLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/v1/guilds/', { headers: { Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}` } })
      .then(r => r.ok ? r.json() : [])
      .then((guilds: unknown[]) => setUserGuilds(guilds.length))
      .catch(() => setUserGuilds(0));
  }, [user]);

  // Redirect authenticated users who have guilds to the dashboard
  useEffect(() => {
    if (userGuilds !== null && userGuilds > 0) {
      router.push('/');
    }
  }, [userGuilds, router]);

  const handleAddToServer = () => {
    if (botInfo?.invite_url) {
      window.open(botInfo.invite_url, '_blank', 'noopener,noreferrer');
    }
  };

  const botName = botInfo?.name || 'My Discord Bot';
  const hasInviteUrl = Boolean(botInfo?.invite_url);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        {/* Logo */}
        <div className="mb-8 relative">
          {botInfo?.logo_url ? (
            <img
              src={botInfo.logo_url}
              alt={`${botName} logo`}
              className="w-28 h-28 rounded-full object-cover shadow-2xl ring-4 ring-primary/20"
              onError={e => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.removeAttribute('style');
              }}
            />
          ) : null}
          <div
            className="w-28 h-28 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-2xl ring-4 ring-primary/20"
            style={botInfo?.logo_url ? { display: 'none' } : {}}
          >
            <Bot className="w-14 h-14 text-primary" />
          </div>
        </div>

        {/* Bot name */}
        {botLoading ? (
          <div className="h-12 w-64 bg-muted/40 rounded-xl animate-pulse mb-4" />
        ) : (
          <h1 className="text-5xl font-extrabold text-foreground mb-4 tracking-tight">
            {botName}
          </h1>
        )}

        {/* Tagline */}
        {botLoading ? (
          <div className="h-6 w-80 bg-muted/30 rounded-lg animate-pulse mb-6" />
        ) : botInfo?.tagline ? (
          <p className="text-xl text-muted-foreground mb-6 max-w-lg font-medium">
            {botInfo.tagline}
          </p>
        ) : null}

        {/* Description */}
        {botInfo?.description && !botLoading && (
          <p className="text-base text-muted-foreground mb-10 max-w-xl leading-relaxed">
            {botInfo.description}
          </p>
        )}

        {/* Primary CTA — Add to Server */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
          <button
            onClick={handleAddToServer}
            disabled={!hasInviteUrl || botLoading}
            className={`
              group flex items-center gap-3 px-8 py-4 rounded-2xl text-lg font-bold
              shadow-lg shadow-primary/20 transition-all duration-200
              ${hasInviteUrl && !botLoading
                ? 'bg-[#5865F2] hover:bg-[#4752C4] text-white hover:shadow-xl hover:shadow-[#5865F2]/30 hover:-translate-y-0.5 cursor-pointer'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'}
            `}
          >
            {botLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Bot className="w-5 h-5 transition-transform group-hover:scale-110" />
            )}
            <span>Add {botName} to Your Server</span>
            {hasInviteUrl && !botLoading && (
              <ExternalLink className="w-4 h-4 opacity-70" />
            )}
          </button>
        </div>

        {/* Feature highlights strip */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground mb-12">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Free to use
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Easy setup
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Powerful features
          </div>
        </div>

        {/* Divider */}
        <div className="w-full max-w-sm border-t border-border mb-8" />

        {/* Auth section — context-aware */}
        {authLoading ? null : !user ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">Bot operator? Access the dashboard</p>
            <a
              href="/login"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Login with Discord
            </a>
          </div>
        ) : userGuilds === 0 ? (
          <div className="flex flex-col items-center gap-3 max-w-sm">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm text-left">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Welcome, <strong>{user.username}</strong>! You don&apos;t have access to any configured servers yet.
                Add the bot to a server you own, or ask a server owner to authorize you.
              </span>
            </div>
            <a
              href="/"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              Go to Dashboard
            </a>
          </div>
        ) : (
          <a
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Open Dashboard
          </a>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border">
        <p className="flex items-center justify-center gap-2">
          <Users className="w-3 h-3" />
          Powered by the Discord Bot Baseline Framework
        </p>
      </footer>
    </div>
  );
}
