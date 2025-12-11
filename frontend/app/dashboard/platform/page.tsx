'use client';

import { useEffect, useState } from 'react';
import { Save, Shield } from 'lucide-react';
import { apiClient } from '@/app/api-client';

export default function PlatformSettingsPage() {
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const settingsData = await apiClient.getPlatformSettings();
                setSettings(settingsData.settings || {});
            } catch (err) {
                console.error('Failed to load platform settings:', err);
                setMessage({ type: 'error', text: 'Failed to load settings or Access Denied' });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

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
            await apiClient.updatePlatformSettings(settings);
            setMessage({ type: 'success', text: 'Settings saved successfully' });
        } catch (err) {
            console.error('Failed to save settings:', err);
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-gray-400">Loading settings...</div>;
    }

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Platform Settings</h1>
                <p className="text-gray-400">Global configuration for all bots (Level 3).</p>
            </div>

            {message && (
                <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-8">
                <div className="space-y-6 border-b border-gray-700 pb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="text-yellow-500" size={20} />
                        <h2 className="text-xl font-semibold text-yellow-500">Global Configuration</h2>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">
                        These settings are applied globally and managed by the Platform Owner.
                    </p>

                    <div>
                        <label className="block text-sm font-medium mb-2">System Prompt</label>
                        <textarea
                            value={settings?.system_prompt || ''}
                            onChange={(e) => handleSettingChange('system_prompt', e.target.value)}
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 h-32 text-white"
                            placeholder="You are a helpful assistant..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">LLM Model</label>
                        <select
                            value={settings?.model || 'openai'}
                            onChange={(e) => handleSettingChange('model', e.target.value)}
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-white"
                        >
                            <option value="openai">OpenAI (GPT-4)</option>
                            <option value="anthropic">Anthropic (Claude 3)</option>
                            <option value="google">Google (Gemini Pro)</option>
                            <option value="xai">xAI (Grok)</option>
                        </select>
                    </div>
                </div>

                <div className="pt-6">
                    <button
                        type="submit"
                        disabled={saving}
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
                                <span className="text-white">Save Settings</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
