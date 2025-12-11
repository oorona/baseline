'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Save, Shield } from 'lucide-react';
import { apiClient } from '@/app/api-client';
import { usePlugins } from '@/app/plugins';

export default function GuildSettingsPage() {
    const params = useParams();
    const guildId = params.guildId as string;
    const { plugins } = usePlugins();

    // Unified settings state
    const [settings, setSettings] = useState<any>(null);
    const [permissionLevel, setPermissionLevel] = useState<string | null>(null);
    const [canModifyLevel3, setCanModifyLevel3] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!guildId) return;
            try {
                const [settingsData, guildData] = await Promise.all([
                    apiClient.getGuildSettings(guildId),
                    apiClient.getGuild(guildId)
                ]);

                // Initialize settings with defaults if empty
                setSettings(settingsData.settings || {});
                setPermissionLevel(guildData.permission_level || null);
                setCanModifyLevel3(settingsData.can_modify_level_3 || false);
            } catch (err) {
                console.error('Failed to load settings:', err);
                setMessage({ type: 'error', text: 'Failed to load settings' });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [guildId]);

    const handleSettingChange = (key: string, value: any) => {
        setSettings((prev: any) => ({
            ...prev,
            [key]: value
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            await apiClient.updateGuildSettings(guildId as string, {
                settings: settings
            });
            setMessage({ type: 'success', text: 'Settings saved successfully' });
        } catch (err) {
            console.error('Failed to save settings:', err);
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    const isRestrictedReadOnly = !canModifyLevel3 && permissionLevel !== 'owner';
    const isReadOnly = permissionLevel === 'user';

    if (loading) {
        return <div className="p-8 text-center text-gray-400">Loading settings...</div>;
    }

    if (permissionLevel === 'user') {
        return <div className="p-8 text-center text-red-400">You do not have permission to view these settings.</div>;
    }

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Bot Settings</h1>
                <p className="text-gray-400">Configure how the bot behaves in your server.</p>
            </div>

            {isReadOnly && (
                <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-200 text-sm">
                    You have read-only access to these settings. Contact an admin to make changes.
                </div>
            )}

            {message && (
                <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-8">
                <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 text-center text-gray-400">
                    <p>No specific settings available for this bot configuration.</p>
                </div>
                <button
                    type="submit"
                    disabled={saving || isReadOnly}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {saving ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-5 h-5" />
                            Save Settings
                        </>
                    )}
                </button>
            </form>
        </div >
    );
}
