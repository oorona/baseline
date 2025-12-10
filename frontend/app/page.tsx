'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/app/api-client';
import { LogOut, Bot, Settings, Activity } from 'lucide-react';

export default function Home() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
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
      apiClient.getGuilds().then(setGuilds).catch(console.error);
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <nav className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8 text-white" />
              <h1 className="text-xl font-bold text-white">Baseline Bot Platform</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-white/80">{user.username}</span>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          <h2 className="text-3xl font-bold text-white mb-4">Welcome back!</h2>
          <p className="text-white/80 mb-8">
            Your bot platform is ready. Configure your bots and manage your Discord servers.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              onClick={() => {
                if (guilds.length > 0) {
                  router.push(`/dashboard/${guilds[0].id}/settings`);
                }
              }}
              className="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
            >
              <Bot className="w-12 h-12 text-white mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Manage Servers</h3>
              <p className="text-white/70">Select a server from the sidebar to configure settings</p>
            </div>

            <div
              onClick={() => router.push('/dashboard/status')}
              className="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
            >
              <Activity className="w-12 h-12 text-white mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">System Status</h3>
              <p className="text-white/70">Monitor bot shards, latency, and uptime</p>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all cursor-pointer opacity-50">
              <Settings className="w-12 h-12 text-white mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Platform Settings</h3>
              <p className="text-white/70">Global platform configuration (Coming Soon)</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
