'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../utils';
import { apiClient } from '../api-client';

interface Guild {
    id: string;
    name: string;
}

export function GuildSwitcher({ currentGuildId }: { currentGuildId?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGuilds = async () => {
            try {
                const data = await apiClient.getGuilds();
                setGuilds(data);
            } catch (error) {
                console.error('Failed to fetch guilds:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchGuilds();
    }, []);

    const currentGuild = guilds.find((g) => g.id === currentGuildId);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full px-4 py-2 text-sm bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                disabled={loading}
            >
                <span className="truncate">
                    {loading ? 'Loading...' : currentGuild ? currentGuild.name : 'Select a server'}
                </span>
                <ChevronsUpDown size={16} className="ml-2 opacity-50" />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute z-20 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {guilds.length === 0 && !loading && (
                            <p className="p-4 text-sm text-gray-400">No servers found</p>
                        )}
                        {guilds.map((guild) => (
                            <a
                                key={guild.id}
                                href={`/dashboard/${guild.id}/settings`}
                                className={cn(
                                    'flex items-center justify-between px-4 py-3 hover:bg-gray-700 transition-colors',
                                    guild.id === currentGuildId && 'bg-gray-700'
                                )}
                                onClick={() => setIsOpen(false)}
                            >
                                <span className="text-sm truncate">{guild.name}</span>
                                {guild.id === currentGuildId && (
                                    <Check size={16} className="text-green-500" />
                                )}
                            </a>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
