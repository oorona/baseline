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
    // const isReadOnly = permissionLevel === 'user'; // Removed to allow Authorized Users (Level 1) to edit
    const isReadOnly = false;

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-muted-foreground animate-pulse">Loading settings...</div>
            </div>
        );
    }

    // Permission block removed (fixed earlier)

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Bot Settings</h1>
                    <p className="text-muted-foreground mt-2">Configure how the bot behaves in your server.</p>
                </div>
            </div>

            {isReadOnly && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-600 dark:text-yellow-400 text-sm flex items-center gap-2">
                    <Shield size={16} />
                    You have read-only access to these settings. Contact an admin to make changes.
                </div>
            )}

            {message && (
                <div className={`p-4 rounded-lg flex items-center gap-2 text-sm font-medium ${message.type === 'success'
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                    }`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-8">
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                        <h2 className="text-xl font-semibold">Logging Configuration</h2>
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="loggingEnabled"
                                checked={settings?.logging_enabled || false}
                                onChange={(e) => handleSettingChange('logging_enabled', e.target.checked)}
                                disabled={isRestrictedReadOnly}
                                className="w-5 h-5 rounded border-input bg-background checked:bg-primary text-primary focus:ring-ring transition-colors"
                            />
                            <label htmlFor="loggingEnabled" className="text-sm font-medium cursor-pointer">Enable Logging</label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Log Channel</label>
                                <select
                                    value={settings?.logging_channel_id || ''}
                                    onChange={(e) => handleSettingChange('logging_channel_id', e.target.value)}
                                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-input outline-none transition-shadow disabled:opacity-50"
                                    disabled={isRestrictedReadOnly || !settings?.logging_enabled}
                                >
                                    <option value="">Select a channel...</option>
                                    {channels.map((channel) => (
                                        <option key={channel.id} value={channel.id}>
                                            #{channel.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground mt-1">Channel where logs will be posted.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium mb-2">Logged Events</label>
                            <div className="space-y-3 bg-muted/50 p-4 rounded-lg border border-border">
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
                                                className="w-4 h-4 rounded border-gray-400 dark:border-gray-600 bg-background text-primary focus:ring-ring"
                                            />
                                            <label htmlFor={`event_${event.key}`} className="text-sm cursor-pointer select-none">{event.label}</label>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={saving || isReadOnly}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-8 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
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
