'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/app/api-client';
import { usePlugins } from '@/app/plugins';
import { Bot, Settings, Activity, Terminal, Shield, Lock, ExternalLink, User, FileText, Database, BarChart2, Settings2, Wrench, Gauge, Sparkles, BrainCircuit, Globe, BookOpen } from 'lucide-react';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { PermissionLevel } from '@/lib/permissions';

function DashboardContent() {
  const { user, loading: authLoading } = useAuth();
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
          <p className="text-muted-foreground animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
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

  // Friendly level labels shown on each card
  const levelLabel = (level: PermissionLevel): string => {
    switch (level) {
      case PermissionLevel.PUBLIC:      return 'Public';
      case PermissionLevel.PUBLIC_DATA: return 'Public';
      case PermissionLevel.USER:        return 'Level 2 — Logged in';
      case PermissionLevel.AUTHORIZED:  return 'Level 3 — Authorized';
      case PermissionLevel.OWNER:       return 'Level 4 — Owner';
      case PermissionLevel.DEVELOPER:   return 'Level 5 — Developer';
      default:                          return `Level ${level}`;
    }
  };

  const cards: DashboardCard[] = [
    {
      id: 'bot-overview',
      title: 'Bot Overview',
      description: 'Learn what this bot can do — features, commands, and how to get started.',
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
      title: 'Command Reference',
      description: 'Browse all available bot commands, their usage, parameters, and examples.',
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
      title: 'Bot Settings',
      description: 'Configure general bot behavior, command prefix, and language settings.',
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
      title: 'Permissions',
      description: 'Manage access levels, authorize users and roles for this server.',
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
      title: 'Bot Health',
      description: 'Check if the bot is online — backend, database, and Discord gateway status.',
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
      title: 'Account Settings',
      description: 'Manage your personal preferences, theme, and profile details.',
      icon: User,
      href: `/dashboard/account`,
      level: PermissionLevel.USER,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'group-hover:border-indigo-500/50',
      isAdminOnly: false
    },
    {
      id: 'audit-logs',
      title: 'Audit Logs',
      description: 'Track all configuration changes and administrative actions in this server.',
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
      title: 'AI Analytics',
      description: 'View LLM usage statistics, token consumption, and cost breakdowns.',
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
      title: 'System Configuration',
      description: 'Manage all framework settings. Apply dynamic changes at runtime or configure static parameters.',
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
      title: 'Database Management',
      description: 'Monitor connections, apply schema migrations, and validate database integrity.',
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
      title: 'Instrumentation',
      description: 'Performance metrics, guild growth, card usage stats, and bot command analytics across all servers.',
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
      title: 'Gemini Capabilities',
      description: 'Demo suite for Gemini API: text generation, image generation, vision, TTS, embeddings, and more.',
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
      title: 'LLM Configs',
      description: 'Manage output schemas and function sets for Gemini API calls. View call logs with token stats and cost.',
      icon: BrainCircuit,
      href: `/dashboard/llm-configs`,
      level: PermissionLevel.DEVELOPER,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
      borderColor: 'group-hover:border-violet-500/50',
      isAdminOnly: true
    },
    // Plugins
    ...pluginNavItems.map((plugin: any) => ({
      id: `plugin-${plugin.id || plugin.name}`,
      title: plugin.name,
      description: 'Plugin module',
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
          {activeGuild ? `Manage ${activeGuild.name}` : 'Welcome, ' + user.username}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Select a tool below to manage your server or view platform status.
        </p>
        {activeGuild && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border border-border text-sm text-muted-foreground">
            <span>Current Permission:</span>
            <span className="font-semibold text-foreground">
              {user.is_admin ? 'Developer' :
                permissionLevel === PermissionLevel.OWNER ? 'Owner' :
                  permissionLevel === PermissionLevel.AUTHORIZED ? 'Authorized' :
                    permissionLevel === PermissionLevel.USER ? 'User' : 'Guest'
              }
            </span>
          </div>
        )}
      </div>

      {/* Grouped Card Sections */}
      {(() => {
        const levelMeta: Record<number, { label: string; description: string; accentText: string; borderAccent: string; sectionBg: string; badge: string }> = {
          0: { label: 'Public',      description: 'Available to everyone, no account needed',        accentText: 'text-slate-400',   borderAccent: 'border-slate-500/50',   sectionBg: 'bg-slate-500/5',   badge: 'bg-slate-500/20 text-slate-300' },
          1: { label: 'Public Data', description: 'Public information — no login required',          accentText: 'text-sky-400',     borderAccent: 'border-sky-500/50',     sectionBg: 'bg-sky-500/5',     badge: 'bg-sky-500/20 text-sky-300' },
          2: { label: 'User',        description: 'Available to logged-in server members',           accentText: 'text-emerald-400', borderAccent: 'border-emerald-500/50', sectionBg: 'bg-emerald-500/5', badge: 'bg-emerald-500/20 text-emerald-300' },
          3: { label: 'Authorized',  description: 'Requires explicit server authorization',          accentText: 'text-blue-400',    borderAccent: 'border-blue-500/50',    sectionBg: 'bg-blue-500/5',    badge: 'bg-blue-500/20 text-blue-300' },
          4: { label: 'Owner',       description: 'Server owner only',                               accentText: 'text-amber-400',   borderAccent: 'border-amber-500/50',   sectionBg: 'bg-amber-500/5',   badge: 'bg-amber-500/20 text-amber-300' },
          5: { label: 'Developer',   description: 'Platform administrator — full system access',     accentText: 'text-red-400',     borderAccent: 'border-red-500/50',     sectionBg: 'bg-red-500/5',     badge: 'bg-red-500/20 text-red-300' },
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
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.badge}`}>Level {level}</span>
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
                            Demo
                          </span>
                        )}

                        <div className="mt-4 mb-auto">
                          <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">{card.title}</h3>
                          <p className="text-muted-foreground leading-relaxed">{card.description}</p>
                        </div>

                        <div className="mt-8 pt-6 border-t border-border/50 flex items-center justify-between text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                          <span>{levelLabel(card.level)}</span>
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
          <h3 className="text-xl font-medium mb-2">Access Restricted</h3>
          <p className="text-muted-foreground">
            You do not have access to any tools for this server.<br />
            Current Access Level: {permissionLevel}
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
          <p className="text-muted-foreground animate-pulse">Loading...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
