'use client';

import { useEffect, useState, Suspense } from 'react';
import { Bot, ExternalLink, LayoutDashboard, LogIn, Users, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';

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

function WelcomeContent() {
  const { user, loading: authLoading } = useAuth();
  const { t, setLanguage } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const noRedirect = searchParams.get('noRedirect') === '1';
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [botLoading, setBotLoading] = useState(true);
  const [userGuilds, setUserGuilds] = useState<number | null>(null);

  // Apply ?lang= query param on first render so shareable URLs work.
  useEffect(() => {
    const lang = searchParams.get('lang');
    if (lang === 'en' || lang === 'es') {
      setLanguage(lang);
    }
  // Only run once on mount — intentionally omitting setLanguage / searchParams
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!noRedirect && userGuilds !== null && userGuilds > 0) {
      router.push('/');
    }
  }, [userGuilds, router, noRedirect]);

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
            <span>{t('welcome.addToServer', { botName })}</span>
            {hasInviteUrl && !botLoading && (
              <ExternalLink className="w-4 h-4 opacity-70" />
            )}
          </button>
        </div>

        {/* Feature highlights strip */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground mb-12">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {t('welcome.freeToUse')}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            {t('welcome.easySetup')}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            {t('welcome.powerfulFeatures')}
          </div>
        </div>

        {/* Divider */}
        <div className="w-full max-w-sm border-t border-border mb-8" />

        {/* Auth section — context-aware */}
        {authLoading ? null : !user ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">{t('welcome.operatorPrompt')}</p>
            <a
              href="/login"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              {t('welcome.loginWithDiscord')}
            </a>
          </div>
        ) : userGuilds === 0 ? (
          <div className="flex flex-col items-center gap-3 max-w-sm">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm text-left">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {t('welcome.noServersMessage', { username: user.username })}
              </span>
            </div>
            <a
              href="/"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              {t('welcome.goToDashboard')}
            </a>
          </div>
        ) : (
          <a
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            {t('welcome.openDashboard')}
          </a>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border">
        <p className="flex items-center justify-center gap-2 mb-3">
          <Users className="w-3 h-3" />
          {botName}
        </p>
        {/* Shareable language links — share /welcome?lang=en or /welcome?lang=es */}
        <div className="flex items-center justify-center gap-3">
          <a
            href="/welcome?lang=en"
            onClick={(e) => { e.preventDefault(); setLanguage('en'); router.replace('/welcome?lang=en'); }}
            className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            EN
          </a>
          <span className="opacity-30">|</span>
          <a
            href="/welcome?lang=es"
            onClick={(e) => { e.preventDefault(); setLanguage('es'); router.replace('/welcome?lang=es'); }}
            className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            ES
          </a>
        </div>
      </footer>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <WelcomeContent />
    </Suspense>
  );
}
