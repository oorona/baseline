'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/app/api-client';
import { Terminal, Radio, Shield, Clock } from 'lucide-react';

interface BotReport {
    commands: Array<{
        name: string;
        description: string;
        type: string;
    }>;
    listeners: Array<{
        event: string;
        cog: string;
    }>;
    permissions: {
        guild_permissions_example: Record<string, boolean>;
        intents: Record<string, boolean>;
    };
    timestamp: number;
}

export default function BotReportPage() {
    const [report, setReport] = useState<BotReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dbStatus, setDbStatus] = useState<any>(null);

    useEffect(() => {
        loadReport();
    }, []);

    const loadReport = async () => {
        try {
            setLoading(true);
            const [botData, dbData] = await Promise.all([
                apiClient.getBotReport(),
                apiClient.getDbStatus()
            ]);
            setReport(botData);
            setDbStatus(dbData);
        } catch (err) {
            console.error(err);
            setError('Failed to load report data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-400">Loading report...</div>;
    }

    if (error) {
        return <div className="p-8 text-center text-red-500">{error}</div>;
    }

    if (!report) {
        return <div className="p-8 text-center text-gray-400">No report available</div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between border-b border-gray-800 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Developer Report</h1>
                    <p className="text-gray-400">Bot internal introspection data</p>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <Clock size={16} />
                    <span>Last Updated: {new Date(report.timestamp * 1000).toLocaleString()}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Commands Column */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">

                    <div className="flex items-center space-x-2 mb-4">
                        <Terminal className="text-blue-400" size={24} />
                        <h2 className="text-xl font-semibold text-white">Slash Commands</h2>
                    </div>
                    <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                        {report.commands.map((cmd) => (
                            <div key={cmd.name} className="p-3 bg-gray-900 rounded-md border border-gray-800">
                                <div className="font-mono text-blue-400 font-bold">/{cmd.name}</div>
                                <div className="text-sm text-gray-400 mt-1">{cmd.description || 'No description'}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Events Column */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="flex items-center space-x-2 mb-4">
                        <Radio className="text-green-400" size={24} />
                        <h2 className="text-xl font-semibold text-white">Event Listeners</h2>
                    </div>
                    <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                        {report.listeners.map((listener, idx) => (
                            <div key={idx} className="p-3 bg-gray-900 rounded-md border border-gray-800 flex justify-between items-center">
                                <div className="font-mono text-green-400">{listener.event}</div>
                                <div className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-500">{listener.cog}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Permissions Column */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="flex items-center space-x-2 mb-4">
                        <Shield className="text-purple-400" size={24} />
                        <h2 className="text-xl font-semibold text-white">Permissions</h2>
                    </div>

                    <div className="space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Intents</h3>
                            <div className="grid grid-cols-1 gap-2">
                                {Object.entries(report.permissions.intents || {}).map(([intent, enabled]) => (
                                    <div key={intent} className="flex justify-between items-center px-3 py-2 bg-gray-900 rounded border border-gray-800">
                                        <span className="font-mono text-sm text-gray-300">{intent}</span>
                                        <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Bot Permissions (Example)</h3>
                            <div className="grid grid-cols-1 gap-2">
                                {Object.entries(report.permissions.guild_permissions_example || {}).map(([perm, enabled]) => (
                                    <div key={perm} className="flex justify-between items-center px-3 py-2 bg-gray-900 rounded border border-gray-800">
                                        <span className="font-mono text-sm text-gray-300">{perm}</span>
                                        <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
