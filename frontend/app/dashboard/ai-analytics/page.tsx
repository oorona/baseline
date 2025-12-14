"use client";

import { useEffect, useState } from 'react';
import { apiClient } from '@/app/api-client';

interface LLMStats {
    total_cost: number;
    total_tokens: number;
    by_provider: { provider: string; cost: number; requests: number }[];
    recent_logs: any[];
}

export default function AIAnalyticsPage() {
    const [stats, setStats] = useState<LLMStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setLoading(true);
            const data = await apiClient.getLLMStats();
            setStats(data);
        } catch (err) {
            console.error("Failed to load stats", err);
            setError("Failed to load analytics data. Ensure you have developer permissions.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-white">Loading analytics...</div>;
    if (error) return <div className="p-8 text-red-500">{error}</div>;
    if (!stats) return <div className="p-8 text-white">No data available.</div>;

    const totalRequests = stats.by_provider.reduce((acc, curr) => acc + curr.requests, 0);

    return (
        <div className="container mx-auto p-6 space-y-6 text-white">
            <h1 className="text-3xl font-bold mb-6">AI Analytics</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-md">
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Total Tokens</h3>
                    <div className="text-2xl font-bold">{stats.total_tokens.toLocaleString()}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-md">
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Estimated Cost</h3>
                    <div className="text-2xl font-bold">${stats.total_cost.toFixed(4)}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-md">
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Total Requests</h3>
                    <div className="text-2xl font-bold">{totalRequests}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-md overflow-hidden">
                    <div className="p-6 border-b border-gray-700">
                        <h3 className="text-lg font-medium">Usage by Provider</h3>
                    </div>
                    <div className="p-0">
                        <table className="w-full">
                            <thead className="bg-gray-900/50">
                                <tr>
                                    <th className="text-left p-4 text-sm font-medium text-gray-400">Provider</th>
                                    <th className="text-left p-4 text-sm font-medium text-gray-400">Requests</th>
                                    <th className="text-right p-4 text-sm font-medium text-gray-400">Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.by_provider.map((p) => (
                                    <tr key={p.provider} className="border-t border-gray-700 hover:bg-gray-700/50 transition-colors">
                                        <td className="p-4 font-medium capitalize">{p.provider}</td>
                                        <td className="p-4">{p.requests}</td>
                                        <td className="p-4 text-right">${p.cost.toFixed(4)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-md overflow-hidden">
                <div className="p-6 border-b border-gray-700">
                    <h3 className="text-lg font-medium">Recent Logs</h3>
                </div>
                <div className="p-0 overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-900/50">
                            <tr>
                                <th className="text-left p-4 text-sm font-medium text-gray-400">Time</th>
                                <th className="text-left p-4 text-sm font-medium text-gray-400">User</th>
                                <th className="text-left p-4 text-sm font-medium text-gray-400">Provider</th>
                                <th className="text-left p-4 text-sm font-medium text-gray-400">Model</th>
                                <th className="text-left p-4 text-sm font-medium text-gray-400">Tokens</th>
                                <th className="text-left p-4 text-sm font-medium text-gray-400">Type</th>
                                <th className="text-right p-4 text-sm font-medium text-gray-400">Latency</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.recent_logs.map((log) => (
                                <tr key={log.id} className="border-t border-gray-700 hover:bg-gray-700/50 transition-colors">
                                    <td className="p-4 text-sm whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                    <td className="p-4 text-sm">{log.user_id}</td>
                                    <td className="p-4 text-sm capitalize">{log.provider}</td>
                                    <td className="p-4 text-sm">{log.model}</td>
                                    <td className="p-4 text-sm">{log.tokens}</td>
                                    <td className="p-4 text-sm">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-900 text-indigo-100 border border-indigo-700">
                                            {log.request_type}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-right">{(log.latency || 0).toFixed(2)}s</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
