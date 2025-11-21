'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/app/api-client';
import { Activity, Server, Wifi, Clock } from 'lucide-react';
import { cn } from '@/app/utils';

interface Shard {
    shard_id: number;
    status: string;
    latency: number;
    guild_count: number;
    last_heartbeat: string;
}

export default function ShardsPage() {
    const [shards, setShards] = useState<Shard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchShards = async () => {
        try {
            const data = await apiClient.getShards();
            setShards(data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load shards');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShards();

        // Auto-refresh every 10 seconds
        const interval = setInterval(fetchShards, 10000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        switch (status.toUpperCase()) {
            case 'READY':
                return 'text-green-500 bg-green-500/10 border-green-500';
            case 'CONNECTING':
                return 'text-yellow-500 bg-yellow-500/10 border-yellow-500';
            case 'DISCONNECTED':
                return 'text-red-500 bg-red-500/10 border-red-500';
            default:
                return 'text-gray-500 bg-gray-500/10 border-gray-500';
        }
    };

    const getLatencyColor = (latency: number) => {
        if (latency < 100) return 'text-green-500';
        if (latency < 200) return 'text-yellow-500';
        return 'text-red-500';
    };

    const getTimeSinceHeartbeat = (heartbeat: string) => {
        const now = new Date();
        const last = new Date(heartbeat);
        const diff = Math.floor((now.getTime() - last.getTime()) / 1000);

        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return `${Math.floor(diff / 3600)}h ago`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-gray-400">Loading shard status...</div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Shard Monitor</h1>
                <p className="text-gray-400">Real-time shard health and performance</p>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500">
                    {error}
                </div>
            )}

            {/* Overview stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-800 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400">Total Shards</span>
                        <Activity size={20} className="text-blue-500" />
                    </div>
                    <div className="text-3xl font-bold">{shards.length}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400">Healthy</span>
                        <Wifi size={20} className="text-green-500" />
                    </div>
                    <div className="text-3xl font-bold text-green-500">
                        {shards.filter(s => s.status.toUpperCase() === 'READY').length}
                    </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400">Total Guilds</span>
                        <Server size={20} className="text-purple-500" />
                    </div>
                    <div className="text-3xl font-bold">
                        {shards.reduce((sum, s) => sum + s.guild_count, 0)}
                    </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400">Avg Latency</span>
                        <Clock size={20} className="text-yellow-500" />
                    </div>
                    <div className="text-3xl font-bold">
                        {Math.round(shards.reduce((sum, s) => sum + s.latency, 0) / shards.length || 0)}ms
                    </div>
                </div>
            </div>

            {/* Shard cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shards.length === 0 ? (
                    <div className="col-span-full p-6 text-center text-gray-400 bg-gray-800 rounded-lg">
                        No shards found
                    </div>
                ) : (
                    shards.map((shard) => (
                        <div key={shard.shard_id} className="bg-gray-800 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Shard {shard.shard_id}</h3>
                                <span className={cn(
                                    'px-3 py-1 rounded-full text-xs font-medium border',
                                    getStatusColor(shard.status)
                                )}>
                                    {shard.status.toUpperCase()}
                                </span>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Latency</span>
                                    <span className={cn('font-medium', getLatencyColor(shard.latency))}>
                                        {shard.latency}ms
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Guilds</span>
                                    <span className="font-medium">{shard.guild_count}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Last Heartbeat</span>
                                    <span className="text-sm font-medium">
                                        {getTimeSinceHeartbeat(shard.last_heartbeat)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
