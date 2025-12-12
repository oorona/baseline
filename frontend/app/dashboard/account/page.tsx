'use client';

import { useEffect, useState } from 'react';
import { User, Globe, Moon, Sun, Monitor, Save, Server } from 'lucide-react';
import { useTheme } from 'next-themes';
import { apiClient, UserSettings } from '@/app/api-client';
import { useAuth } from '@/lib/auth-context';

interface Guild {
    id: string;
    name: string;
}

export default function AccountPage() {
    const { user } = useAuth();
    const { theme, setTheme } = useTheme();
    const [settings, setSettings] = useState<UserSettings>({
        theme: 'system',
        language: 'en',
        default_guild_id: ''
    });
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [userData, guildsData] = await Promise.all([
                    apiClient.getUserSettings(),
                    apiClient.getGuilds()
                ]);

                if (userData.settings) {
                    setSettings(prev => ({ ...prev, ...userData.settings }));
                    // Sync backend theme preference
                    if (userData.settings.theme) {
                        setTheme(userData.settings.theme);
                    }
                }
                setGuilds(guildsData);
            } catch (err) {
                console.error('Failed to load data', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            await apiClient.updateUserSettings(settings);
            // Apply theme
            if (settings.theme) {
                setTheme(settings.theme);
            }
            setMessage({ type: 'success', text: 'Preferences saved successfully' });
        } catch (err) {
            console.error('Failed to save settings', err);
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-gray-400">Loading profile...</div>;

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2 text-foreground">Account Settings</h1>
                <p className="text-muted-foreground">Manage your personal preferences (Level 2).</p>
            </div>

            {message && (
                <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-8">
                {/* Profile Section */}
                <div className="bg-card rounded-xl p-6 border border-border">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-foreground">
                        <User className="text-primary" /> Profile
                    </h2>
                    <div className="flex items-center gap-4 mb-6">
                        {user?.avatar_url && (
                            <img
                                src={user.avatar_url}
                                alt="Avatar"
                                className="w-16 h-16 rounded-full border-2 border-border"
                            />
                        )}
                        <div>
                            <div className="text-foreground font-medium text-lg">{user?.username}</div>
                            <div className="text-muted-foreground">ID: {user?.id}</div>
                        </div>
                    </div>
                </div>

                {/* Default Server Section */}
                <div className="bg-card rounded-xl p-6 border border-border">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-foreground">
                        <Server className="text-primary" /> Default Server
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Startup Server</label>
                        <select
                            value={settings.default_guild_id || ''}
                            onChange={(e) => setSettings({ ...settings, default_guild_id: e.target.value })}
                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary text-foreground"
                        >
                            <option value="">No default server</option>
                            {guilds.map(guild => (
                                <option key={guild.id} value={guild.id}>
                                    {guild.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-sm text-muted-foreground mt-2">
                            This server will be selected automatically when you enter the dashboard.
                        </p>
                    </div>
                </div>

                {/* Appearance Section */}
                <div className="bg-card rounded-xl p-6 border border-border">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-foreground">
                        <Monitor className="text-primary" /> Appearance
                    </h2>

                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-foreground mb-2">Theme</label>
                        <div className="grid grid-cols-3 gap-4">
                            {['light', 'dark', 'system'].map((t) => {
                                const isActive = settings.theme === t;
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => {
                                            setSettings(prev => ({ ...prev, theme: t as 'light' | 'dark' | 'system' }));
                                            setTheme(t);
                                        }}
                                        className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all text-foreground ${isActive
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:border-primary/50 bg-secondary'
                                            }`}
                                    >
                                        {t === 'light' && <Sun className="w-6 h-6 mb-2" />}
                                        {t === 'dark' && <Moon className="w-6 h-6 mb-2" />}
                                        {t === 'system' && <Monitor className="w-6 h-6 mb-2" />}
                                        <span className="capitalize">{t}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Language Section */}
                <div className="bg-card rounded-xl p-6 border border-border">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-foreground">
                        <Globe className="text-primary" /> Language
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Interface Language</label>
                        <select
                            value={settings.language}
                            onChange={(e) => setSettings({ ...settings, language: e.target.value as 'en' | 'es' })}
                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary text-foreground"
                        >
                            <option value="en">English (US)</option>
                            <option value="es">Español (ES)</option>
                        </select>
                        <p className="text-sm text-muted-foreground mt-2">
                            {settings.language === 'es'
                                ? 'La interfaz cambiará a español (Implementation pending).'
                                : 'The interface will change to English.'}
                        </p>
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-primary hover:opacity-90 text-primary-foreground font-medium py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Save Preferences
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
