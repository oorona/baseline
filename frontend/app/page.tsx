'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/app/api-client';
import { usePlugins } from '@/app/plugins';
import { Bot, Settings, Activity, Terminal, Shield, Lock, ExternalLink, User, FileText, ScrollText, Database, BarChart2 } from 'lucide-react';
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
    title: string;
    description: string;
    icon: any;
    href: string;
    level: PermissionLevel;
    color: string;
    bgColor: string;
    borderColor: string;
    isAdminOnly?: boolean;
  }

  const cards: DashboardCard[] = [
    {
      title: 'Bot Settings',
      description: 'Configure general bot behavior, prefix, and language.',
      icon: Settings,
      href: `/dashboard/${activeGuildId}/settings`,
      level: PermissionLevel.AUTHORIZED, // Level 3
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'group-hover:border-blue-500/50',
      isAdminOnly: false
    },
    {
      title: 'Permissions',
      description: 'Manage access levels, authorized users, and roles.',
      icon: Shield,
      href: `/dashboard/${activeGuildId}/permissions`,
      level: PermissionLevel.OWNER, // Level 4
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'group-hover:border-purple-500/50',
      isAdminOnly: false
    },
    {
      title: 'System Status',
      description: 'View shard status, uptime, and database metrics.',
      icon: Activity,
      href: `/dashboard/status`, // Global page, but potentially context aware later?
      level: PermissionLevel.USER, // Level 2
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'group-hover:border-green-500/50',
      isAdminOnly: false
    },
    {
      title: 'Account Settings',
      description: 'Manage your personal preferences and profile.',
      icon: User,
      href: `/dashboard/account`,
      level: PermissionLevel.USER, // Public in Sidebar, but User level is fine for logged in
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'group-hover:border-indigo-500/50',
      isAdminOnly: false
    },
    {
      title: 'Audit Logs',
      description: 'Track changes and actions within this server.',
      icon: FileText,
      href: `/dashboard/${activeGuildId}/audit-logs`,
      level: PermissionLevel.AUTHORIZED,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'group-hover:border-orange-500/50',
      isAdminOnly: false
    },
    {
      title: 'Logging Control',
      description: 'Configure logging levels for this server.',
      icon: ScrollText,
      href: `/dashboard/${activeGuildId}/logging`,
      level: PermissionLevel.AUTHORIZED,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
      borderColor: 'group-hover:border-pink-500/50',
      isAdminOnly: false
    },
    {
      title: 'Platform Settings',
      description: 'Global configuration for all bots.',
      icon: Database,
      href: `/dashboard/platform`,
      level: PermissionLevel.DEVELOPER,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'group-hover:border-red-500/50',
      isAdminOnly: true
    },
    {
      title: 'AI Analytics',
      description: 'View LLM usage stats and costs.',
      icon: BarChart2,
      href: `/dashboard/ai-analytics`,
      level: PermissionLevel.DEVELOPER,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'group-hover:border-cyan-500/50',
      isAdminOnly: true
    },
    // Plugins
    ...pluginNavItems.map((plugin: any) => ({
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

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleCards.map((card, index) => (
          <div
            key={index}
            onClick={() => router.push(card.href)}
            className={`group relative bg-card hover:bg-muted/40 border border-border ${card.borderColor} rounded-xl p-8 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 flex flex-col h-full`}
          >
            <div className={`absolute top-6 right-6 p-3 rounded-xl ${card.bgColor} ${card.color} transition-colors group-hover:scale-110 duration-300`}>
              <card.icon size={28} />
            </div>

            <div className="mt-4 mb-auto">
              <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">{card.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{card.description}</p>
            </div>

            <div className="mt-8 pt-6 border-t border-border/50 flex items-center justify-between text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              <span>Access Level: {card.level}</span>
              <ExternalLink size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>

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
