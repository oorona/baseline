'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/app/api-client';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';

// Disposable Test Page for Level 1 Access
function TestLevel1Page() {
    const params = useParams();
    const guildId = params.guildId as string;
    const [guildData, setGuildData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch REAL data from public endpoint
                const data = await apiClient.getGuildPublicInfo(guildId);
                setGuildData(data);
            } catch (e) {
                console.error("Failed to fetch public data", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [guildId]);

    if (loading) return <div className="p-8 text-gray-400">Loading L1 Data...</div>;

    return (
        <div className="p-8 max-w-4xl">
            <h1 className="text-2xl font-bold mb-4 text-green-400">Level 1 Access Test (Public Data)</h1>
            <p className="mb-4 text-gray-400">This page is accessible to everyone (if Level 1 is truly public). Simulating public read-only data.</p>

            <div className="bg-gray-900 rounded-lg p-6 font-mono text-sm border border-gray-800">
                {!guildData ? (
                    <div className="text-gray-500">No public data found.</div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            {guildData.icon && <img src={`https://cdn.discordapp.com/icons/${guildData.id}/${guildData.icon}.png`} alt="Guild Icon" className="w-16 h-16 rounded-full" />}
                            <div>
                                <h2 className="text-xl font-bold text-white">{guildData.name}</h2>
                                <p className="text-gray-400">ID: {guildData.id}</p>
                            </div>
                        </div>
                        <div className="pt-4 border-t border-gray-800">
                            <h3 className="text-blue-400 font-bold mb-2">Public Features</h3>
                            <ul className="list-disc list-inside text-gray-300">
                                {guildData.features?.map((f: string, i: number) => (
                                    <li key={i}>{f}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="p-4 bg-gray-800 rounded text-xs text-gray-400">
                            This data was fetched from <code>/guilds/{guildId}/public</code> without any authentication token.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Level 1: Public Data
export default withPermission(TestLevel1Page, PermissionLevel.PUBLIC_DATA);
