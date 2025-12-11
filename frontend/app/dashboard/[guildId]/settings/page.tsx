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
    const [roles, setRoles] = useState<any[]>([]); // For Admin Role selector

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!guildId) return;
            try {
                const [settingsData, guildData, rolesData] = await Promise.all([
                    apiClient.getGuildSettings(guildId),
                    apiClient.getGuild(guildId),
                    apiClient.getGuildRoles(guildId)
                ]);

                // Initialize settings with defaults if empty
                setSettings(settingsData.settings || {});
                setPermissionLevel(guildData.permission_level || null);
                setCanModifyLevel3(settingsData.can_modify_level_3 || false);
                setRoles(rolesData);
            } catch (err) {
                console.error('Failed to load settings:', err);
                setMessage({ type: 'error', text: 'Failed to load settings' });
            } finally {
                setLoading(false);
            }
        };

        if (guildId) {
            fetchData();
        }
    }, [guildId]);

    const handleSettingChange = (key: string, value: any) => {
        setSettings((prev: Record<string, any>) => ({
            ...prev,
            [key]: value
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            await apiClient.updateGuildSettings(guildId, settings);
            setMessage({ type: 'success', text: 'Settings saved successfully' });
        } catch (err) {
            console.error('Failed to save settings:', err);
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    const isReadOnly = permissionLevel !== 'owner' && permissionLevel !== 'admin';
    const isRestrictedReadOnly = isReadOnly || !canModifyLevel3;

    // Helper for core settings to maintain backward compatibility with UI
    // Helper for core settings to maintain backward compatibility with UI
    const allowedChannels = settings && Array.isArray(settings.allowed_channels)
        ? settings.allowed_channels.join(', ')
        : (settings?.allowed_channels || '');

    const setAllowedChannels = (val: string) => {
        const channelsList = val.split(',').map(id => id.trim()).filter(id => id);
        handleSettingChange('allowed_channels', channelsList);
    };

    if (loading) {
        return <div className="p-8 text-gray-400">Loading settings...</div>;
    }

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Server Settings</h1>
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
                {/* Core/Restricted Settings */}
                <div className="space-y-6">
                    <div className="space-y-6 border-b border-gray-700 pb-8">
                        <h2 className="text-xl font-semibold">General Settings (Level 1)</h2>
                        <div>
                            <label className="block text-sm font-medium mb-2">Allowed Channels</label>
                            <input
                                type="text"
                                value={allowedChannels}
                                onChange={(e) => setAllowedChannels(e.target.value)}
                                placeholder="e.g. 123456789, 987654321"
                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                                disabled={isReadOnly}
                            />
                            <p className="text-xs text-gray-500 mt-1">Comma-separated list of channel IDs where the bot is active.</p>
                        </div>
                    </div>


                </div>

                <div className="pt-6">
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
                </div>
            </form>
        </div>
    );
}
