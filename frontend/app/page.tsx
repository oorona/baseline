'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/app/api-client';
import { usePlugins } from '@/app/plugins';
import { Bot, Settings, Activity, Terminal, Shield, Lock, ExternalLink, User, FileText, Database, BarChart2, Settings2, Wrench, Gauge, Sparkles, BrainCircuit, Globe, BookOpen } from 'lucide-react';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { PermissionLevel } from '@/lib/permissions';
import { useTranslation } from '@/lib/i18n';

function DashboardContent() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { navItems: pluginNavItems } = usePlugins();

  const [guilds, setGuilds] = useState<any[]>([]);
  const [loadingGuilds, setLoadingGuilds] = useState(true);

  // Determine Guild ID
  // Priority: URL Param > LocalStorage > Default > First in List
  const paramGuildId = searchParams.get('guild_id');
  const [activeGuildId, setActiveGuildId] = useState<string | null>(null);

  // Permission Hook
  const { hasAccess, permissionLevel, loading: permLoading } = usePermissions(activeGuildId || undefined);

  // First-time login detection: redirect to Account Settings if no language
  // preference is saved.  The sessionStorage flag is set by the account page
  // when the user saves OR skips, preventing a redirect loop when navigating
  // back to the dashboard via the breadcrumb or after router.push('/').
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    const setupDone = typeof window !== 'undefined' &&
      sessionStorage.getItem('firstLoginSetupDone') === '1';
    if (!user.preferences?.language && !setupDone) {
      router.push('/dashboard/account?firstLogin=1');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) {
      setLoadingGuilds(false);
      return;
    }

    apiClient.getGuilds().then(data => {
      setGuilds(data);
      if (data.length === 0) {
        router.push('/welcome');
        return;
      }

      // Resolve Active Guild
      let resolvedId = null;
      if (paramGuildId && data.find((g: any) => g.id === paramGuildId)) {
        resolvedId = paramGuildId;
      } else {
        const stored = localStorage.getItem('lastGuildId');
        if (stored && data.find((g: any) => g.id === stored)) {
          resolvedId = stored;
        } else if (user.preferences?.default_guild_id && data.find((g: any) => g.id === user.preferences.default_guild_id)) {
          resolvedId = user.preferences.default_guild_id;
        } else {
          resolvedId = data[0].id;
        }
      }

      if (resolvedId) {
        setActiveGuildId(resolvedId);
      }
    }).catch(err => {
      console.error("Failed to fetch guilds:", err);
    }).finally(() => {
      setLoadingGuilds(false);
    });
  }, [user, paramGuildId]);

  if (authLoading || loadingGuilds || permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse">{t('common.loadingDashboard')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/welcome');
    return null;
  }

  // Define Cards
  interface DashboardCard {
    id: string;
    title: string;
    description: string;
    icon: any;
    href: string;
    level: PermissionLevel;
    color: string;
    bgColor: string;
    borderColor: string;
    isAdminOnly?: boolean;
    isDemo?: boolean;
  }

  const cards: DashboardCard[] = [
    {
      id: 'bot-overview',
      title: t('dashboard.cardBotOverviewTitle'),
      description: t('dashboard.cardBotOverviewDesc'),
      icon: Globe,
      href: '/welcome?noRedirect=1',
      level: PermissionLevel.PUBLIC,
      color: 'text-slate-400',
      bgColor: 'bg-slate-500/10',
      borderColor: 'group-hover:border-slate-500/50',
      isAdminOnly: false
    },
    {
      id: 'command-reference',
      title: t('dashboard.cardCommandRefTitle'),
      description: t('dashboard.cardCommandRefDesc'),
      icon: BookOpen,
      href: '/commands',
      level: PermissionLevel.PUBLIC_DATA,
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/10',
      borderColor: 'group-hover:border-sky-500/50',
      isAdminOnly: false,
      isDemo: true
    },
    {
      id: 'bot-settings',
      title: t('dashboard.cardBotSettingsTitle'),
      description: t('dashboard.cardBotSettingsDesc'),
      icon: Settings,
      href: `/dashboard/${activeGuildId}/settings`,
      level: PermissionLevel.AUTHORIZED,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'group-hover:border-blue-500/50',
      isAdminOnly: false,
      isDemo: true
    },
    {
      id: 'permissions',
      title: t('dashboard.cardPermissionsTitle'),
      description: t('dashboard.cardPermissionsDesc'),
      icon: Shield,
      href: `/dashboard/${activeGuildId}/permissions`,
      level: PermissionLevel.OWNER,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'group-hover:border-purple-500/50',
      isAdminOnly: false
    },
    {
      id: 'bot-health',
      title: t('dashboard.cardBotHealthTitle'),
      description: t('dashboard.cardBotHealthDesc'),
      icon: Activity,
      href: `/dashboard/bot-health`,
      level: PermissionLevel.AUTHORIZED,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'group-hover:border-green-500/50',
      isAdminOnly: false
    },
    {
      id: 'account-settings',
      title: t('dashboard.cardAccountSettingsTitle'),
      description: t('dashboard.cardAccountSettingsDesc'),
      icon: User,
      href: `/dashboard/account`,
      level: PermissionLevel.USER,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'group-hover:border-indigo-500/50',
      isAdminOnly: false
    },
    {
      id: 'card-visibility',
      title: t('dashboard.cardCardVisibilityTitle'),
      description: t('dashboard.cardCardVisibilityDesc'),
      icon: Settings2,
      href: `/dashboard/${activeGuildId}/card-visibility`,
      level: PermissionLevel.OWNER,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'group-hover:border-amber-500/50',
      isAdminOnly: false
    },
    {
      id: 'audit-logs',
      title: t('dashboard.cardAuditLogsTitle'),
      description: t('dashboard.cardAuditLogsDesc'),
      icon: FileText,
      href: `/dashboard/${activeGuildId}/audit-logs`,
      level: PermissionLevel.AUTHORIZED,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'group-hover:border-orange-500/50',
      isAdminOnly: false
    },
    {
      id: 'ai-analytics',
      title: t('dashboard.cardAiAnalyticsTitle'),
      description: t('dashboard.cardAiAnalyticsDesc'),
      icon: BarChart2,
      href: `/dashboard/ai-analytics`,
      level: PermissionLevel.DEVELOPER,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'group-hover:border-cyan-500/50',
      isAdminOnly: true
    },
    {
      id: 'system-config',
      title: t('dashboard.cardSystemConfigTitle'),
      description: t('dashboard.cardSystemConfigDesc'),
      icon: Settings2,
      href: `/dashboard/config`,
      level: PermissionLevel.DEVELOPER,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'group-hover:border-red-500/50',
      isAdminOnly: true
    },
    {
      id: 'database',
      title: t('dashboard.cardDatabaseTitle'),
      description: t('dashboard.cardDatabaseDesc'),
      icon: Database,
      href: `/dashboard/database`,
      level: PermissionLevel.DEVELOPER,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'group-hover:border-amber-500/50',
      isAdminOnly: true
    },
    {
      id: 'instrumentation',
      title: t('dashboard.cardInstrumentationTitle'),
      description: t('dashboard.cardInstrumentationDesc'),
      icon: Gauge,
      href: `/dashboard/instrumentation`,
      level: PermissionLevel.DEVELOPER,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'group-hover:border-orange-500/50',
      isAdminOnly: true
    },
    {
      id: 'gemini-demo',
      title: t('dashboard.cardGeminiTitle'),
      description: t('dashboard.cardGeminiDesc'),
      icon: Sparkles,
      href: `/dashboard/${activeGuildId}/gemini-demo`,
      level: PermissionLevel.DEVELOPER,
      color: 'text-sky-500',
      bgColor: 'bg-sky-500/10',
      borderColor: 'group-hover:border-sky-500/50',
      isAdminOnly: true,
      isDemo: true
    },
    {
      id: 'llm-configs',
      title: t('dashboard.cardLlmConfigsTitle'),
      description: t('dashboard.cardLlmConfigsDesc'),
      icon: BrainCircuit,
      href: `/dashboard/llm-configs`,
      level: PermissionLevel.DEVELOPER,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
      borderColor: 'group-hover:border-violet-500/50',
      isAdminOnly: true
    },
    // Plugins — titles come from plugin definitions; descriptions are translated
    ...pluginNavItems.map((plugin: any) => ({
      id: `plugin-${plugin.id || plugin.name}`,
      title: plugin.name,
      description: t('dashboard.cardPluginDesc'),
      icon: plugin.icon || Terminal,
      href: plugin.href.replace('[guildId]', activeGuildId || ''),
      level: plugin.level || PermissionLevel.USER,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'group-hover:border-orange-500/50',
      isAdminOnly: plugin.adminOnly
    }))
  ];

  // Filter Cards
  const visibleCards = cards.filter(card => {
    if (card.isAdminOnly && !user.is_admin) return false;
    return hasAccess(card.level);
  });

  const activeGuild = guilds.find(g => g.id === activeGuildId);

  return (
    <div className="max-w-7xl mx-auto space-y-12">

      {/* Hero / Welcome Section */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          {activeGuild
            ? t('dashboard.manageServer', { serverName: activeGuild.name })
            : t('dashboard.welcomeUser', { username: user.username })}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          {t('dashboard.selectTool')}
        </p>
        {activeGuild && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border border-border text-sm text-muted-foreground">
            <span>{t('dashboard.currentPermission')}</span>
            <span className="font-semibold text-foreground">
              {user.is_admin ? t('dashboard.permDeveloper') :
                permissionLevel === PermissionLevel.OWNER ? t('dashboard.permOwner') :
                  permissionLevel === PermissionLevel.AUTHORIZED ? t('dashboard.permAuthorized') :
                    permissionLevel === PermissionLevel.USER ? t('dashboard.permUser') : t('dashboard.permGuest')
              }
            </span>
          </div>
        )}
      </div>

      {/* Grouped Card Sections */}
      {(() => {
        interface LevelMeta { label: string; description: string; accentText: string; borderAccent: string; sectionBg: string; badge: string }
        const levelMeta: Record<number, LevelMeta> = {
          0: { label: t('dashboard.sectionPublicLabel'),     description: t('dashboard.sectionPublicDesc'),     accentText: 'text-slate-400',   borderAccent: 'border-slate-500/50',   sectionBg: 'bg-slate-500/5',   badge: 'bg-slate-500/20 text-slate-300' },
          1: { label: t('dashboard.sectionPublicDataLabel'), description: t('dashboard.sectionPublicDataDesc'), accentText: 'text-sky-400',     borderAccent: 'border-sky-500/50',     sectionBg: 'bg-sky-500/5',     badge: 'bg-sky-500/20 text-sky-300' },
          2: { label: t('dashboard.sectionUserLabel'),       description: t('dashboard.sectionUserDesc'),       accentText: 'text-emerald-400', borderAccent: 'border-emerald-500/50', sectionBg: 'bg-emerald-500/5', badge: 'bg-emerald-500/20 text-emerald-300' },
          3: { label: t('dashboard.sectionAuthorizedLabel'), description: t('dashboard.sectionAuthorizedDesc'), accentText: 'text-blue-400',    borderAccent: 'border-blue-500/50',    sectionBg: 'bg-blue-500/5',    badge: 'bg-blue-500/20 text-blue-300' },
          4: { label: t('dashboard.sectionOwnerLabel'),      description: t('dashboard.sectionOwnerDesc'),      accentText: 'text-amber-400',   borderAccent: 'border-amber-500/50',   sectionBg: 'bg-amber-500/5',   badge: 'bg-amber-500/20 text-amber-300' },
          5: { label: t('dashboard.sectionDeveloperLabel'),  description: t('dashboard.sectionDeveloperDesc'),  accentText: 'text-red-400',     borderAccent: 'border-red-500/50',     sectionBg: 'bg-red-500/5',     badge: 'bg-red-500/20 text-red-300' },
        };

        const cardsByLevel = visibleCards.reduce((acc, card) => {
          if (!acc[card.level]) acc[card.level] = [];
          acc[card.level].push(card);
          return acc;
        }, {} as Record<number, typeof visibleCards>);

        const sortedLevels = Object.keys(cardsByLevel).map(Number).sort((a, b) => b - a);
        const showSectionHeaders = sortedLevels.length > 1;

        return (
          <div className="space-y-10">
            {sortedLevels.map(level => {
              const meta = levelMeta[level] ?? { label: `Level ${level}`, description: '', accentText: 'text-muted-foreground', borderAccent: 'border-border', sectionBg: 'bg-muted/5', badge: 'bg-muted text-muted-foreground' };
              const levelCards = cardsByLevel[level];
              return (
                <div key={level} className="space-y-4">
                  {showSectionHeaders && (
                    <div className={`flex items-center gap-4 pl-4 border-l-4 ${meta.borderAccent}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className={`text-base font-semibold tracking-wide uppercase ${meta.accentText}`}>{meta.label}</h2>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{meta.description}</p>
                      </div>
                    </div>
                  )}
                  <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-5 rounded-2xl ${showSectionHeaders ? meta.sectionBg : ''}`}>
                    {levelCards.map((card, index) => (
                      <div
                        key={index}
                        onClick={() => {
                          apiClient.trackCardClick(card.id, activeGuildId);
                          router.push(card.href);
                        }}
                        className={`group relative bg-card border border-border ${card.borderColor} rounded-xl p-8 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 flex flex-col h-full`}
                      >
                        <div className={`absolute top-6 right-6 p-3 rounded-xl ${card.bgColor} ${card.color} transition-colors group-hover:scale-110 duration-300`}>
                          <card.icon size={28} />
                        </div>

                        {card.isDemo && (
                          <span className="absolute top-4 left-4 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            {t('common.demo')}
                          </span>
                        )}

                        <div className="mt-4 mb-auto">
                          <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">{card.title}</h3>
                          <p className="text-muted-foreground leading-relaxed">{card.description}</p>
                        </div>

                        <div className="mt-8 pt-6 border-t border-border/50 flex items-center justify-end text-muted-foreground">
                          <ExternalLink size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {visibleCards.length === 0 && (
        <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
          <Lock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">{t('dashboard.accessRestricted')}</h3>
          <p className="text-muted-foreground">
            {t('dashboard.noAccessBody')}<br />
            {t('dashboard.currentAccessLevel', { level: String(permissionLevel) })}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse">{/* loading */}</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
