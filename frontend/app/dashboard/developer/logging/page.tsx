'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/app/api-client';
import { Search, Save, AlertTriangle } from 'lucide-react';

export default function DeveloperLoggingPage() {
    const [guilds, setGuilds] = useState<any[]>([]);
    const [selectedGuild, setSelectedGuild] = useState<any>(null);
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Logging Levels
    const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

    useEffect(() => {
        const fetchGuilds = async () => {
            try {
                const data = await apiClient.getGuilds();
                setGuilds(data);
            } catch (err) {
                console.error('Failed to fetch guilds:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchGuilds();
    }, []);

    const handleSelectGuild = async (guild: any) => {
        setSelectedGuild(guild);
        setSettings(null);
        setLoadingSettings(true);
        setMessage(null);
        try {
            const data = await apiClient.getGuildSettings(guild.id);
            setSettings(data.settings || {});
        } catch (err) {
            console.error('Failed to load settings:', err);
            setMessage({ type: 'error', text: 'Failed to load guild settings' });
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleSave = async () => {
        if (!selectedGuild || !settings) return;
        setSaving(true);
        setMessage(null);
        try {
            await apiClient.updateGuildSettings(selectedGuild.id, settings);
            setMessage({ type: 'success', text: `Log level updated for ${selectedGuild.name}` });
        } catch (err) {
            console.error('Failed to save settings:', err);
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    const filteredGuilds = guilds.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.id.includes(searchQuery)
    );

    if (loading) return <div className="p-8 text-gray-400">Loading guilds...</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2 text-white">Developer Logging Control</h1>
                <p className="text-gray-400">Configure logging levels for specific guilds to troubleshoot issues.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Guild Selector */}
                <div className="md:col-span-1 bg-gray-900 border border-gray-800 rounded-lg p-4 h-[600px] flex flex-col">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search guilds..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-md pl-9 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {filteredGuilds.map(guild => (
                            <button
                                key={guild.id}
                                onClick={() => handleSelectGuild(guild)}
                                className={`w-full text-left p-3 rounded-md flex items-center gap-3 transition-colors ${selectedGuild?.id === guild.id
                                    ? 'bg-indigo-600/20 border border-indigo-500/50 text-white'
                                    : 'bg-gray-800/50 hover:bg-gray-800 text-gray-300'
                                    }`}
                            >
                                {guild.icon_url ? (
                                    <img src={guild.icon_url} alt="" className="w-8 h-8 rounded-full" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                                        {guild.name.substring(0, 2)}
                                    </div>
                                )}
                                <div className="truncate">
                                    <div className="font-medium truncate">{guild.name}</div>
                                    <div className="text-xs text-gray-500 truncate">{guild.id}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Configuration Panel */}
                <div className="md:col-span-2">
                    {selectedGuild ? (
                        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-800">
                                {selectedGuild.icon_url && <img src={selectedGuild.icon_url} alt="" className="w-16 h-16 rounded-full" />}
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{selectedGuild.name}</h2>
                                    <p className="text-gray-400 text-sm">ID: {selectedGuild.id}</p>
                                </div>
                            </div>

                            {loadingSettings ? (
                                <div className="text-center py-12 text-gray-500">Loading settings...</div>
                            ) : (
                                <div className="space-y-8">
                                    {message && (
                                        <div className={`p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                            }`}>
                                            {message.text}
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium mb-3 text-gray-300">Log Level</label>
                                        <div className="grid grid-cols-1 gap-3">
                                            {LOG_LEVELS.map(level => {
                                                const currentLevel = settings?.log_level || 'INFO';
                                                const isSelected = currentLevel === level;
                                                return (
                                                    <div
                                                        key={level}
                                                        onClick={() => setSettings({ ...settings, log_level: level })}
                                                        className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${isSelected
                                                                ? 'bg-indigo-600/10 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                                                                : 'bg-gray-800/30 border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-indigo-500' : 'border-gray-500'
                                                                }`}>
                                                                {isSelected && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                                                            </div>
                                                            <span className={`font-medium ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                                                                {level}
                                                            </span>
                                                        </div>
                                                        {level === 'DEBUG' && (
                                                            <span className="text-xs px-2 py-1 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                                                Verbose
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-3">
                                            * DEBUG level will produce high volume logs in the bot console.
                                        </p>
                                    </div>

                                    <div className="flex justify-end pt-4 border-t border-gray-800">
                                        <button
                                            onClick={async () => {
                                                // Update state properly
                                                const level = (document.querySelector('input[name="logLevel"]:checked') as HTMLInputElement)?.value;
                                            }}
                                            className="hidden" // Helper hidden
                                        ></button>

                                        {/* Custom Click Handlers on Labels handle state, this is just Save */}
                                        {/* Wait, I map labels but didn't attach onClick handlers to update state */}
                                    </div>

                                    {/* Fix: Radio Button Logic */}
                                    <div className="hidden">
                                        {/* The logic above was display-only, let me rewrite the map to work */}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 border border-dashed border-gray-800 rounded-lg bg-gray-900/50 p-12">
                            <Search className="w-12 h-12 mb-4 opacity-50" />
                            <p className="text-lg">Select a guild to configure logging</p>
                        </div>
                    )}
                </div>
            </div>

            {selectedGuild && !loadingSettings && (
                <div className="fixed bottom-8 right-8">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-full shadow-lg font-medium flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                    >
                        {saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Save Configuration
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
