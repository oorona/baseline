'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/app/api-client';
import { Activity, Server, Wifi, Clock, RefreshCw, Database, Laptop, Info } from 'lucide-react';
import { cn } from '@/app/utils';

interface Shard {
    shard_id: number;
    status: string;
    latency: number;
    guild_count: number;
    guilds: string[];
    last_heartbeat: string;
}

interface DbStatus {
    postgres: {
        status: string;
        version?: string;
        size?: string;
        cache_hit_ratio?: string;
        connections?: { active: number; idle: number };
        error?: string;
    };
    redis: {
        status: string;
        info?: any;
        error?: string;
    };
}

interface FrontendInstance {
    id: string;
    uptime: number;
    timestamp: number;
}

interface BackendInstance {
    id: string;
    uptime: number;
    timestamp: number;
}

export default function SystemStatusPage() {
    const [shards, setShards] = useState<Shard[]>([]);
    const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
    const [frontendInstances, setFrontendInstances] = useState<FrontendInstance[]>([]);
    const [backendInstances, setBackendInstances] = useState<BackendInstance[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const [shardsData, dbData, frontendData, backendData] = await Promise.all([
                apiClient.getShards(),
                apiClient.getDbStatus(),
                apiClient.getFrontendStatus(),
                apiClient.getBackendStatus()
            ]);

            setShards(shardsData);
            setDbStatus(dbData);
            setFrontendInstances(frontendData);
            setBackendInstances(backendData);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching status:', err);
            setError(err.response?.data?.detail || 'Failed to load system status');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchData]);

    const getStatusColor = (status: string) => {
        const s = status.toUpperCase();
        if (s === 'READY' || s === 'CONNECTED') return 'text-green-500 bg-green-500/10 border-green-500';
        if (s === 'CONNECTING') return 'text-yellow-500 bg-yellow-500/10 border-yellow-500';
        return 'text-red-500 bg-red-500/10 border-red-500';
    };

    const getLatencyColor = (latency: number) => {
        if (latency < 100) return 'text-green-500';
        if (latency < 200) return 'text-yellow-500';
        return 'text-red-500';
    };

    const formatUptime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    const getTimeSinceHeartbeat = (heartbeat: string) => {
        const now = new Date();
        const last = new Date(heartbeat);
        const diff = Math.floor((now.getTime() - last.getTime()) / 1000);

        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return `${Math.floor(diff / 3600)}h ago`;
    };

    if (loading) return <div className="p-8 text-center text-gray-400">Loading system status...</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-2">System Status</h1>
                    <p className="text-gray-400">Real-time infrastructure monitoring</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => fetchData()}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                        disabled={isRefreshing}
                    >
                        <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        <span className="text-sm font-medium text-gray-300">Auto-refresh</span>
                    </label>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500">
                    {error}
                </div>
            )}

            {/* Backend Instances */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Server className="text-indigo-400" />
                    <h2>Backend Instances (API Replicas)</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {backendInstances.length === 0 ? (
                        <div className="col-span-full p-4 bg-gray-800 rounded-lg text-gray-400 text-sm">
                            No active backend heartbeats detected.
                        </div>
                    ) : (
                        backendInstances.map((inst) => (
                            <div key={inst.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-mono text-sm text-indigo-300">ID: {inst.id}</span>
                                    <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Active</span>
                                </div>
                                <div className="text-sm text-gray-400">
                                    <div>Uptime: <span className="text-white">{formatUptime(inst.uptime)}</span></div>
                                    <div className="text-xs mt-1 text-gray-500">Last heartbeat: {new Date(inst.timestamp * 1000).toLocaleTimeString()}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* Frontend Instances */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Laptop className="text-blue-400" />
                    <h2>Frontend Instances (Load Balancer)</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {frontendInstances.length === 0 ? (
                        <div className="col-span-full p-4 bg-gray-800 rounded-lg text-gray-400 text-sm">
                            No active frontend heartbeats detected.
                        </div>
                    ) : (
                        frontendInstances.map((inst) => (
                            <div key={inst.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-mono text-sm text-blue-300">ID: {inst.id}</span>
                                    <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Active</span>
                                </div>
                                <div className="text-sm text-gray-400">
                                    <div>Uptime: <span className="text-white">{formatUptime(inst.uptime)}</span></div>
                                    <div className="text-xs mt-1 text-gray-500">Last heartbeat: {new Date(inst.timestamp * 1000).toLocaleTimeString()}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* Database Status */}
            {dbStatus && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-xl font-semibold text-white">
                        <Database className="text-purple-400" />
                        <h2>Database Status</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* PostgreSQL */}
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                                <span className={`w-3 h-3 rounded-full mr-2 ${dbStatus.postgres.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                PostgreSQL
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Version</span>
                                    <span className="text-white truncate max-w-[150px]" title={dbStatus.postgres.version}>{dbStatus.postgres.version || 'Unknown'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Size</span>
                                    <span className="text-white">{dbStatus.postgres.size || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Cache Ratio</span>
                                    <span className="text-white">{dbStatus.postgres.cache_hit_ratio || 'N/A'}</span>
                                </div>
                                {dbStatus.postgres.connections && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Connections</span>
                                        <span className="text-white">{dbStatus.postgres.connections.active} Active / {dbStatus.postgres.connections.idle} Idle</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Redis */}
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                                <span className={`w-3 h-3 rounded-full mr-2 ${dbStatus.redis.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                Redis
                            </h3>
                            <div className="space-y-2 text-sm">
                                {dbStatus.redis.info ? (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Version</span>
                                            <span className="text-white">{dbStatus.redis.info.redis_version}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Memory</span>
                                            <span className="text-white">{dbStatus.redis.info.used_memory_human}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Clients</span>
                                            <span className="text-white">{dbStatus.redis.info.connected_clients}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Uptime</span>
                                            <span className="text-white">{dbStatus.redis.info.uptime_in_days}d</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-red-400">{dbStatus.redis.error || 'Unknown Error'}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Shard Status */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Server className="text-green-400" />
                    <h2>Bot Shards</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400 text-sm">Total Shards</span>
                            <Activity size={16} className="text-blue-500" />
                        </div>
                        <div className="text-2xl font-bold text-white">{shards.length}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400 text-sm">Healthy</span>
                            <Wifi size={16} className="text-green-500" />
                        </div>
                        <div className="text-2xl font-bold text-green-500">
                            {shards.filter(s => s.status.toUpperCase() === 'READY').length}
                        </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400 text-sm">Total Guilds</span>
                            <Server size={16} className="text-purple-500" />
                        </div>
                        <div className="text-2xl font-bold text-white">
                            {shards.reduce((sum, s) => sum + s.guild_count, 0)}
                        </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400 text-sm">Avg Latency</span>
                            <Clock size={16} className="text-yellow-500" />
                        </div>
                        <div className="text-2xl font-bold text-white">
                            {Math.round(shards.reduce((sum, s) => sum + s.latency, 0) / shards.length || 0)}ms
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {shards.length === 0 ? (
                        <div className="col-span-full p-4 bg-gray-800 rounded-lg text-gray-400 text-sm">
                            No shards detected. Bot may be starting up.
                        </div>
                    ) : (
                        shards.map((shard) => (
                            <div key={shard.shard_id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold">Shard {shard.shard_id}</h3>
                                    <span className={cn(
                                        'px-2 py-0.5 rounded text-xs font-medium border',
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
                                        <span className="font-medium text-white">{shard.guild_count}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400">Last Heartbeat</span>
                                        <span className="text-sm font-medium text-white">
                                            {getTimeSinceHeartbeat(shard.last_heartbeat)}
                                        </span>
                                    </div>
                                    {shard.guilds && shard.guilds.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-gray-700">
                                            <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Active Guilds</div>
                                            <div className="flex flex-wrap gap-2">
                                                {shard.guilds.map((guild, i) => (
                                                    <span key={i} className="px-2 py-1 bg-gray-900 rounded text-xs text-gray-300 border border-gray-800">
                                                        {guild}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}
