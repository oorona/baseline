'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/app/api-client';
import { Activity, Database, Server, CheckCircle, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';

function SystemStatusPage() {
    const { user, loading: authLoading } = useAuth();
    const [status, setStatus] = useState<any>({ backend: 'unknown', database: 'unknown', discord: 'unknown' });
    const [adminData, setAdminData] = useState<any>({ shards: [], db: null, frontend: [], backend: [] });
    const [loadingData, setLoadingData] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const isAdmin = user?.is_admin;

    const fetchData = async () => {
        setRefreshing(true);
        try {
            // Fetch detailed data for admins, or derive simple status for users
            // Ideally we have a public status endpoint for regular users, but the req says derive it.
            // Using existing client methods.

            // Parallel fetch to speed up
            const promises: Promise<any>[] = [];

            // Admin Data
            if (isAdmin) {
                promises.push(apiClient.getShards().catch(e => []));
                promises.push(apiClient.getDbStatus().catch(e => null));
                promises.push(apiClient.getFrontendStatus().catch(e => []));
                promises.push(apiClient.getBackendStatus().catch(e => []));
            } else {
                // For regular users, we might just check "health" endpoint or infer status
                // But let's check basic health for everyone to update the "user view"
                promises.push(apiClient.healthCheck().catch(e => null));
            }

            const results = await Promise.all(promises);

            if (isAdmin) {
                const [shards, db, frontend, backend] = results;
                setAdminData({ shards, db, frontend, backend });

                // Infer overall status from detailed data for the top cards
                const backendStatus = backend && backend.length > 0 ? 'healthy' : 'degraded';
                const dbStatus = db && db.postgres?.status === 'connected' && db.redis?.status === 'connected' ? 'healthy' : 'issues';
                // If any shard is not ready (assuming we want all ready), or if list empty
                const discordStatus = shards && shards.length > 0 && shards.every((s: any) => s.status === 'READY') ? 'healthy' : 'degraded';

                setStatus({ backend: backendStatus, database: dbStatus, discord: discordStatus });
            } else {
                // Regular user view - simple health check
                const health = results[0];
                if (health && health.status === 'ok') {
                    setStatus({ backend: 'healthy', database: 'healthy', discord: 'healthy' });
                } else {
                    setStatus({ backend: 'degraded', database: 'unknown', discord: 'unknown' });
                }
            }

            setLastUpdated(new Date());
        } catch (e) {
            console.error("Failed to fetch system status", e);
        } finally {
            setLoadingData(false);
            setRefreshing(false);
        }
    };

    // Initial fetch
    useEffect(() => {
        if (!authLoading && user) {
            fetchData();
        }
    }, [authLoading, user]);

    // Polling interval (30s)
    useEffect(() => {
        if (!authLoading && user) {
            const intervalId = setInterval(fetchData, 30000);
            return () => clearInterval(intervalId);
        }
    }, [authLoading, user]);


    if (authLoading || (loadingData && !lastUpdated)) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-pulse flex flex-col items-center">
                    <Activity className="h-8 w-8 text-primary mb-4 animate-bounce" />
                    <span className="text-muted-foreground">Analyzing system metrics...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        System Status
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {isAdmin ? "Real-time infrastructure telemetry & diagnostics" : "Current service availability and performance"}
                    </p>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground bg-card p-2 rounded-lg border border-border shadow-sm">
                    {lastUpdated && (
                        <div className="flex items-center gap-2">
                            <Clock size={14} />
                            <span>Updated {lastUpdated.toLocaleTimeString()}</span>
                        </div>
                    )}
                    <button
                        onClick={fetchData}
                        disabled={refreshing}
                        className={`p-2 hover:bg-muted rounded-full transition-all ${refreshing ? 'animate-spin text-primary' : 'hover:text-primary'}`}
                        title="Refresh Status"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* Overall Status Cards - Visible to everyone */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatusCard
                    title="Backend API"
                    status={status?.backend}
                    icon={Server}
                    description="Core API Services"
                />
                <StatusCard
                    title="Database"
                    status={status?.database}
                    icon={Database}
                    description="Data Persistence"
                />
                <StatusCard
                    title="Discord Gateway"
                    status={status?.discord}
                    icon={Activity}
                    description="Real-time Events"
                />
            </div>

            {/* Admin Detailed Views */}
            {isAdmin && adminData && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* Shards Section */}
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
                            <div>
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <Activity className="text-blue-500" size={20} />
                                    Shard Status
                                </h2>
                                <p className="text-sm text-muted-foreground">Discord gateway connection health</p>
                            </div>
                            <div className="text-xs font-mono bg-background px-2 py-1 rounded border border-border">
                                Total Shards: {adminData.shards.length}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground font-medium">
                                    <tr>
                                        <th className="px-6 py-3 text-left">ID</th>
                                        <th className="px-6 py-3 text-left">Status</th>
                                        <th className="px-6 py-3 text-left">Latency</th>
                                        <th className="px-6 py-3 text-left">Guilds</th>
                                        <th className="px-6 py-3 text-left">Last Heartbeat</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {adminData.shards.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                                                No active shards detected.
                                            </td>
                                        </tr>
                                    ) : (
                                        adminData.shards.map((shard: any) => (
                                            <tr key={shard.shard_id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-6 py-4 font-mono font-medium">#{shard.shard_id}</td>
                                                <td className="px-6 py-4">
                                                    <Badge status={shard.status === 'READY' ? 'success' : 'error'}>
                                                        {shard.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 font-mono">
                                                    {(shard.latency * 1000).toFixed(0)} ms
                                                </td>
                                                <td className="px-6 py-4">{shard.guild_count}</td>
                                                <td className="px-6 py-4 text-muted-foreground text-xs">
                                                    {new Date(shard.last_heartbeat).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Database Health */}
                        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-border bg-muted/20">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <Database className="text-purple-500" size={20} />
                                    Data Store Health
                                </h2>
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Postgres */}
                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">PostgreSQL</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <MetricBox label="Status" value={adminData.db?.postgres?.status} status={adminData.db?.postgres?.status === 'connected' ? 'success' : 'error'} />
                                        <MetricBox label="Version" value={adminData.db?.postgres?.version?.split(' ')[0]} />
                                        <MetricBox label="Connections" value={`${adminData.db?.postgres?.connections?.active || 0} active / ${adminData.db?.postgres?.connections?.idle || 0} idle`} />
                                        <MetricBox label="Cache Hit Ratio" value={adminData.db?.postgres?.cache_hit_ratio} />
                                    </div>
                                </div>
                                <div className="h-px bg-border my-4" />
                                {/* Redis */}
                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Redis</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <MetricBox label="Status" value={adminData.db?.redis?.status} status={adminData.db?.redis?.status === 'connected' ? 'success' : 'error'} />
                                        <MetricBox label="Memory Used" value={adminData.db?.redis?.info?.used_memory_human} />
                                        <MetricBox label="Clients" value={adminData.db?.redis?.info?.connected_clients} />
                                        <MetricBox label="Uptime" value={`${adminData.db?.redis?.info?.uptime_in_days} days`} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Infrastructure Nodes */}
                        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-border bg-muted/20">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <Server className="text-orange-500" size={20} />
                                    Infrastructure Nodes
                                </h2>
                            </div>
                            <div className="p-6 flex-1 overflow-y-auto max-h-[500px]">
                                <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Backend Instances</h3>
                                <div className="space-y-3 mb-6">
                                    {adminData.backend.length === 0 ? <span className="text-muted-foreground text-sm italic">No active backends</span> :
                                        adminData.backend.map((node: any) => (
                                            <NodeItem key={node.id} node={node} type="Backend" />
                                        ))
                                    }
                                </div>

                                <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Frontend Instances</h3>
                                <div className="space-y-3">
                                    {adminData.frontend.length === 0 ? <span className="text-muted-foreground text-sm italic">No active frontends</span> :
                                        adminData.frontend.map((node: any) => (
                                            <NodeItem key={node.id} node={node} type="Frontend" />
                                        ))
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}

function StatusCard({ title, status, icon: Icon, description }: any) {
    const isHealthy = status === 'healthy';
    const isDegraded = status === 'degraded';
    // 'unknown' or 'issues' -> error color

    let colorClass = 'text-destructive';
    let bgClass = 'bg-destructive/10 border-destructive/30';
    let iconBgClass = 'bg-destructive/20';
    let statusText = 'Issues Detected';

    if (isHealthy) {
        colorClass = 'text-green-500';
        bgClass = 'bg-green-500/10 border-green-500/30';
        iconBgClass = 'bg-green-500/20';
        statusText = 'Operational';
    } else if (isDegraded) {
        colorClass = 'text-yellow-500';
        bgClass = 'bg-yellow-500/10 border-yellow-500/30';
        iconBgClass = 'bg-yellow-500/20';
        statusText = 'Degraded';
    }

    return (
        <div className={`p-6 rounded-xl border ${bgClass} flex flex-col items-center text-center transition-all hover:scale-[1.02]`}>
            <div className={`p-3 rounded-full mb-4 ${iconBgClass} ${colorClass}`}>
                <Icon size={32} />
            </div>
            <h3 className="text-lg font-bold mb-1 text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{description}</p>
            <div className={`flex items-center gap-2 font-medium ${colorClass}`}>
                {isHealthy ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                {statusText}
            </div>
        </div>
    );
}

function Badge({ children, status }: { children: React.ReactNode, status: 'success' | 'error' | 'warning' }) {
    const colors = {
        success: 'bg-green-500/10 text-green-500 border-green-500/20',
        error: 'bg-destructive/10 text-destructive border-destructive/20',
        warning: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    };

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[status]}`}>
            {children}
        </span>
    );
}

function MetricBox({ label, value, status }: { label: string, value: string | number, status?: 'success' | 'error' }) {
    const statusColor = status === 'success' ? 'text-green-500' : status === 'error' ? 'text-destructive' : 'text-foreground';
    return (
        <div className="bg-background border border-border p-3 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={`font-mono font-medium truncate ${statusColor}`} title={String(value)}>
                {value || 'N/A'}
            </div>
        </div>
    )
}

function NodeItem({ node, type }: any) {
    return (
        <div className="flex items-center justify-between p-3 bg-background border border-border rounded-lg">
            <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <div>
                    <div className="text-sm font-medium">{type} Node</div>
                    <div className="text-xs text-muted-foreground font-mono">{node.id}</div>
                </div>
            </div>
            <div className="text-right">
                <div className="text-xs font-mono text-muted-foreground">Uptime</div>
                <div className="text-sm font-medium">{node.uptime?.toFixed(0)}s</div>
            </div>
        </div>
    )
}

export default withPermission(SystemStatusPage, PermissionLevel.USER);
