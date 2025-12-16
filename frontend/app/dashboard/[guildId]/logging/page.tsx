'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Save, Search, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/app/api-client';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';

function LoggingPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    // State
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Logging Levels
    const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

    useEffect(() => {
        const fetchSettings = async () => {
            if (!guildId) return;

            // Validate Numeric Guild ID (Fix for legacy 'developer' link)
            if (!/^\d+$/.test(guildId)) {
                // Redirect to dashboard root to cleanse the URL
                window.location.href = '/dashboard';
                return;
            }

            try {
                const data = await apiClient.getGuildSettings(guildId);
                setSettings(data.settings || {});
            } catch (err) {
                console.error('Failed to load settings:', err);
                setMessage({ type: 'error', text: 'Failed to load guild settings' });
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [guildId]);

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        setMessage(null);
        try {
            await apiClient.updateGuildSettings(guildId, settings);
            setMessage({ type: 'success', text: `Log level updated successfully.` });
        } catch (err) {
            console.error('Failed to save settings:', err);
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-muted-foreground">Loading settings...</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2 text-foreground">Logging Control</h1>
                <p className="text-muted-foreground">Configure logging levels for this server to troubleshoot issues.</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
                {message && (
                    <div className={`p-4 mb-6 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'
                        }`}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-8">
                    <div>
                        <label className="block text-sm font-medium mb-3 text-foreground">Log Level</label>
                        <div className="grid grid-cols-1 gap-3">
                            {LOG_LEVELS.map(level => {
                                const currentLevel = settings?.log_level || 'INFO';
                                const isSelected = currentLevel === level;
                                return (
                                    <div
                                        key={level}
                                        onClick={() => setSettings({ ...settings, log_level: level })}
                                        className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${isSelected
                                            ? 'bg-primary/10 border-primary shadow-sm'
                                            : 'bg-background border-border hover:border-primary/50 hover:bg-muted/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-primary' : 'border-muted-foreground'
                                                }`}>
                                                {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                                            </div>
                                            <span className={`font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
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
                        <p className="text-xs text-muted-foreground mt-3">
                            * DEBUG level will produce high volume logs.
                        </p>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-border">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-full shadow-lg font-medium flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    <span className="text-primary-foreground">Save Configuration</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Level 3: Authorized
// Users must be Authorized Users or have Authorized Roles to access this page
export default withPermission(LoggingPage, PermissionLevel.AUTHORIZED);
