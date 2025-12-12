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

    const [channels, setChannels] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!guildId) return;
            try {
                const [settingsData, guildData, channelsData] = await Promise.all([
                    apiClient.getGuildSettings(guildId),
                    apiClient.getGuild(guildId),
                    apiClient.getGuildChannels(guildId)
                ]);

                // Initialize settings with defaults if empty
                setSettings(settingsData.settings || {});
                setPermissionLevel(guildData.permission_level || null);
                setCanModifyLevel3(settingsData.can_modify_level_3 || false);
                setChannels(channelsData.filter((c: any) => c.type === 0)); // Filter for text channels
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
                {/* Logging Settings */}
                <div className="space-y-6 border-b border-gray-700 pb-8">
                    <h2 className="text-xl font-semibold">Logging Configuration</h2>

                    <div className="flex items-center space-x-3">
                        <input
                            type="checkbox"
                            id="loggingEnabled"
                            checked={settings?.logging_enabled || false}
                            onChange={(e) => handleSettingChange('logging_enabled', e.target.checked)}
                            disabled={isRestrictedReadOnly}
                            className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="loggingEnabled" className="text-sm font-medium">Enable Logging</label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Log Channel</label>
                        <select
                            value={settings?.logging_channel_id || ''}
                            onChange={(e) => handleSettingChange('logging_channel_id', e.target.value)}
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                            disabled={isRestrictedReadOnly || !settings?.logging_enabled}
                        >
                            <option value="">Select a channel...</option>
                            {channels.map((channel) => (
                                <option key={channel.id} value={channel.id}>
                                    #{channel.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Channel where logs will be posted.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Logged Events</label>
                        <div className="space-y-2">
                            {[
                                { key: 'on_message_delete', label: 'Message Deletions' },
                                { key: 'on_message_edit', label: 'Message Edits' },
                                { key: 'on_member_join', label: 'Member Joins' },
                                { key: 'on_member_remove', label: 'Member Leaves' }
                            ].map((event) => {
                                const isIgnored = (settings?.logging_ignored_events || []).includes(event.key);
                                return (
                                    <div key={event.key} className="flex items-center space-x-3">
                                        <input
                                            type="checkbox"
                                            id={`event_${event.key}`}
                                            checked={!isIgnored}
                                            onChange={(e) => {
                                                const currentIgnored = settings?.logging_ignored_events || [];
                                                let newIgnored;
                                                if (e.target.checked) {
                                                    // Remove from ignored
                                                    newIgnored = currentIgnored.filter((ev: string) => ev !== event.key);
                                                } else {
                                                    // Add to ignored
                                                    newIgnored = [...currentIgnored, event.key];
                                                }
                                                handleSettingChange('logging_ignored_events', newIgnored);
                                            }}
                                            disabled={isRestrictedReadOnly || !settings?.logging_enabled}
                                            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor={`event_${event.key}`} className="text-sm text-gray-300">{event.label}</label>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
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
