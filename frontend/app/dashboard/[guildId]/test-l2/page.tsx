'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/app/api-client';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';

// Disposable Test Page for Level 2 Access
function TestLevel2Page() {
    const params = useParams();
    const guildId = params.guildId as string;
    const [guildInfo, setGuildInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInfo = async () => {
            try {
                // Fetch basic guild info which Level 2 users can access
                const data = await apiClient.getGuild(guildId);
                setGuildInfo(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchInfo();
    }, [guildId]);

    if (loading) return <div className="p-8 text-gray-400">Loading L2 Data...</div>;

    return (
        <div className="p-8 max-w-4xl">
            <h1 className="text-2xl font-bold mb-4 text-blue-400">Level 2 Access Test (User)</h1>
            <p className="mb-4 text-gray-400">
                This page requires <strong>Level 2 (User)</strong> access.
                By default, everyone in the guild has this.
                If the owner toggles "Allow Everyone" to OFF, only users with allowed roles can see this.
            </p>

            <div className="bg-gray-900 rounded-lg p-6 font-mono text-sm border border-gray-800">
                {guildInfo ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            {guildInfo.icon && <img src={guildInfo.icon} alt={guildInfo.name} className="w-16 h-16 rounded-full" />}
                            <div>
                                <h2 className="text-xl font-bold text-white">{guildInfo.name}</h2>
                                <p className="text-gray-400">ID: {guildInfo.id}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="bg-gray-800 p-3 rounded">
                                <span className="block text-gray-500 text-xs">Permission Level</span>
                                <span className="text-green-400 font-bold">{guildInfo.permission_level}</span>
                            </div>
                            <div className="bg-gray-800 p-3 rounded">
                                <span className="block text-gray-500 text-xs">Access Status</span>
                                <span className="text-blue-400 font-bold">GRANTED</span>
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="text-gray-400 text-xs mb-2">Raw Data:</p>
                            <pre className="bg-black p-4 rounded overflow-x-auto text-xs text-green-500">
                                {JSON.stringify(guildInfo, null, 2)}
                            </pre>
                        </div>
                    </div>
                ) : (
                    <div className="text-red-400">Failed to load guild info.</div>
                )}
            </div>
        </div>
    );
}

// Level 2: User (Login Required)
export default withPermission(TestLevel2Page, PermissionLevel.USER);
