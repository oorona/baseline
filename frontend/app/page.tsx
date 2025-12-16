'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/app/api-client';
import { usePlugins } from '@/app/plugins';
import { LogOut, Bot, Settings, Activity, Terminal } from 'lucide-react';
import { siteConfig } from './config';

export default function Home() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { navItems } = usePlugins();
  const [guilds, setGuilds] = useState<any[]>([]);

  useEffect(() => {
    // Check for token in URL (from OAuth callback)
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('access_token', token);
      // Clean up URL
      window.history.replaceState({}, '', '/');
      // Force reload to pick up new token in AuthContext
      window.location.reload();
      return;
    }

    if (!loading && !user) {
      router.push('/login');
    }

    if (user) {
      // Add loading state for guilds? It's fine for now, main loading handles auth.
      apiClient.getGuilds().then(data => {
        setGuilds(data);
        // If user has no guilds (owned or authorized), redirect to welcome page
        if (data.length === 0) {
          router.push('/welcome');
        }
      }).catch(err => {
        console.error("Failed to fetch guilds:", err);
        // Don't redirect on error, let them see a possibly empty dashboard or error state
        // instead of looping to welcome.
      });
    }
  }, [user, loading, router]);

  // Check for welcome redirect logic is already here

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
        <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
          Welcome back, {user.username}!
        </h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-2xl">
          Your bot platform is ready. Select a server from the sidebar or use the quick actions below to manage your bots.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            onClick={() => {
              const defaultGuildId = user?.preferences?.default_guild_id;
              const lastActiveGuildId = localStorage.getItem('lastGuildId');
              const targetGuildId = lastActiveGuildId || defaultGuildId || (guilds.length > 0 ? guilds[0].id : null);

              if (targetGuildId) {
                const targetGuild = guilds.find(g => g.id === targetGuildId);
                // Check exact permission strings from backend
                const isOwner = targetGuild?.permission_level === 'owner';
                const isAuthorized = targetGuild?.permission_level === 'admin' || targetGuild?.permission_level === 'user'; // 'user' in backend = L3 if authorized_users table? No, logic in usePermissions is more complex. Relies on backend response.

                // If isOwner -> Permissions Page (L4)
                if (isOwner) {
                  router.push(`/dashboard/${targetGuildId}/permissions`);
                }
                // If Authorized (L3) -> Settings Page
                else if (isAuthorized) {
                  router.push(`/dashboard/${targetGuildId}/settings`);
                }
                // Else -> Status Page (L2)
                else {
                  router.push(`/dashboard/status`);
                }
              }
            }}
            className="group relative bg-muted/30 hover:bg-muted/50 border border-border rounded-xl p-6 cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
          >
            <div className="absolute top-6 right-6 p-2 bg-primary/10 rounded-full text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2 pr-12">Manage Servers</h3>
            <p className="text-muted-foreground text-sm">Configure settings and permissions for your connected guilds.</p>
          </div>

          <div
            onClick={() => router.push('/dashboard/status')}
            className="group relative bg-muted/30 hover:bg-muted/50 border border-border rounded-xl p-6 cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
          >
            <div className="absolute top-6 right-6 p-2 bg-green-500/10 rounded-full text-green-500 group-hover:bg-green-500 group-hover:text-white transition-colors">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2 pr-12">System Status</h3>
            <p className="text-muted-foreground text-sm">Monitor shards, database health, and API latency.</p>
          </div>

          {user.is_admin && (
            <div
              onClick={() => router.push('/dashboard/platform')}
              className="group relative bg-muted/30 hover:bg-muted/50 border border-border rounded-xl p-6 cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
            >
              <div className="absolute top-6 right-6 p-2 bg-purple-500/10 rounded-full text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                <Settings className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2 pr-12">Platform Settings</h3>
              <p className="text-muted-foreground text-sm">Global configuration and platform-wide controls.</p>
            </div>
          )}

          {/* Developer Tools Row */}
          {user.is_admin && (
            <>
              <div
                onClick={() => router.push('/dashboard/platform/bot-report')}
                className="group relative bg-muted/30 hover:bg-muted/50 border border-border rounded-xl p-6 cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
              >
                <div className="absolute top-6 right-6 p-2 bg-blue-500/10 rounded-full text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <Bot className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2 pr-12">Developer Report</h3>
                <p className="text-muted-foreground text-sm">Inspect active commands, listeners, and bot internals.</p>
              </div>

              <div
                onClick={() => {
                  const defaultGuildId = user?.preferences?.default_guild_id;
                  const targetGuildId = defaultGuildId || (guilds.length > 0 ? guilds[0].id : null);
                  if (targetGuildId) {
                    router.push(`/dashboard/${targetGuildId}/logging`);
                  } else {
                    // No guilds, maybe show alert or just go to status
                    router.push('/dashboard/status');
                  }
                }}
                className="group relative bg-muted/30 hover:bg-muted/50 border border-border rounded-xl p-6 cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
              >
                <div className="absolute top-6 right-6 p-2 bg-yellow-500/10 rounded-full text-yellow-500 group-hover:bg-yellow-500 group-hover:text-white transition-colors">
                  <Terminal className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2 pr-12">Debug Logging</h3>
                <p className="text-muted-foreground text-sm">Configure real-time log levels per guild.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
