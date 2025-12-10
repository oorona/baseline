'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/app/api-client';
import { Clock, User, Activity } from 'lucide-react';

interface AuditLog {
    id: number;
    guild_id: number;
    user_id: number;
    action: string;
    details: Record<string, any>;
    created_at: string;
}

export default function AuditLogsPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const data = await apiClient.getAuditLogs(guildId);
                setLogs(data);
            } catch (err: any) {
                setError(err.response?.data?.detail || 'Failed to load audit logs');
            } finally {
                setLoading(false);
            }
        };

        if (guildId) {
            fetchLogs();
        }
    }, [guildId]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const formatDetails = (details: Record<string, any>) => {
        return JSON.stringify(details, null, 2);
    };

    if (loading) {
        return <div className="p-8 text-gray-400">Loading audit logs...</div>;
    }

    if (error) {
        return <div className="p-8 text-red-400">{error}</div>;
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Audit Logs</h1>
                <p className="text-gray-400">Track changes and actions within this server.</p>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-900/50 border-b border-gray-700">
                                <th className="p-4 font-medium text-gray-400">Action</th>
                                <th className="p-4 font-medium text-gray-400">User ID</th>
                                <th className="p-4 font-medium text-gray-400">Details</th>
                                <th className="p-4 font-medium text-gray-400">Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-500">
                                        No audit logs found.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-700/50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <Activity className="w-4 h-4 text-indigo-400" />
                                                <span className="font-medium text-white">{log.action}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-gray-300">
                                                <User className="w-4 h-4" />
                                                <span className="font-mono text-sm">{log.user_id}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <pre className="text-xs text-gray-400 font-mono bg-gray-900/50 p-2 rounded max-w-md overflow-x-auto">
                                                {formatDetails(log.details)}
                                            </pre>
                                        </td>
                                        <td className="p-4 text-gray-400 text-sm whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4" />
                                                {formatDate(log.created_at)}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
