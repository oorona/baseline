'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/app/api-client';
import { Save, RotateCcw } from 'lucide-react';

interface Settings {
    [key: string]: any;
}

export default function SettingsPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    const [settings, setSettings] = useState<Settings>({});
    const [originalSettings, setOriginalSettings] = useState<Settings>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const data = await apiClient.getGuildSettings(guildId);
                setSettings(data.settings || {});
                setOriginalSettings(data.settings || {});
            } catch (err: any) {
                setError(err.response?.data?.detail || 'Failed to load settings');
            } finally {
                setLoading(false);
            }
        };

        if (guildId) {
            fetchSettings();
        }
    }, [guildId]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);

        try {
            await apiClient.updateGuildSettings(guildId, settings);
            setOriginalSettings(settings);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setSettings(originalSettings);
        setError(null);
        setSuccess(false);
    };

    const handleChange = (key: string, value: any) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-gray-400">Loading settings...</div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Guild Settings</h1>
                <p className="text-gray-400">Configure your server settings</p>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-4 p-4 bg-green-500/10 border border-green-500 rounded-lg text-green-500">
                    Settings saved successfully!
                </div>
            )}

            <div className="space-y-6">
                {/* Example settings - this would be dynamic based on schema */}
                <div className="bg-gray-800 rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">General Settings</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Command Prefix
                            </label>
                            <input
                                type="text"
                                value={settings.command_prefix || '!'}
                                onChange={(e) => handleChange('command_prefix', e.target.value)}
                                className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Auto Moderation
                            </label>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={settings.auto_moderation || false}
                                    onChange={(e) => handleChange('auto_moderation', e.target.checked)}
                                    className="w-4 h-4 text-blue-600 bg-gray-700 rounded focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-400">
                                    Enable automatic moderation
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Welcome Channel
                            </label>
                            <input
                                type="text"
                                value={settings.welcome_channel || ''}
                                onChange={(e) => handleChange('welcome_channel', e.target.value)}
                                placeholder="Channel ID"
                                className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex justify-end space-x-4">
                    <button
                        onClick={handleReset}
                        disabled={!hasChanges || saving}
                        className="flex items-center space-x-2 px-6 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RotateCcw size={16} />
                        <span>Reset</span>
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        className="flex items-center space-x-2 px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={16} />
                        <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
