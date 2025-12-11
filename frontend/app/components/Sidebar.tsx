'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Settings, Shield, Activity, Menu, X, User, Terminal } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '../utils';
import { useAuth } from '@/lib/auth-context';
import { GuildSwitcher } from './GuildSwitcher';

import { usePlugins } from '../plugins';

// Define Guild interface with permission level
interface Guild {
    id: string;
    name: string;
    permission_level?: 'owner' | 'admin' | 'user';
}

const defaultNavigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Permissions', href: '/dashboard/[guildId]/permissions', icon: Shield, requiredPermission: 'admin' },
    { name: 'Bot Settings', href: '/dashboard/[guildId]/settings', icon: Settings, requiredPermission: 'admin' },
    { name: 'Developer Tools', href: '/dashboard/developer/logging', icon: Terminal, adminOnly: true },
    { name: 'Account Settings', href: '/dashboard/account', icon: User },
];

export function Sidebar({ guildId }: { guildId?: string }) {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const { user, loading } = useAuth();
    const { navItems: pluginNavItems } = usePlugins();

    // Guild data for permissions
    const [guilds, setGuilds] = useState<Guild[]>([]);
    useEffect(() => {
        const fetchGuilds = async () => {
            // Avoid importing apiClient if possible to prevent circular deps, but here it's fine
            const { apiClient } = await import('../api-client');
            try {
                const data = await apiClient.getGuilds();
                setGuilds(data);
            } catch (e) {
                console.error("Failed to load guilds for sidebar permissions", e);
            }
        };
        fetchGuilds();
    }, []);

    // Extract guildId from pathname if not provided
    const match = pathname?.match(/\/dashboard\/(\d+)/);
    const urlGuildId = guildId || (match ? match[1] : undefined);

    // Persistence Logic
    const [activeGuildId, setActiveGuildId] = useState<string | undefined>(urlGuildId);

    const defaultGuildId = user?.preferences?.default_guild_id;
    // Derive admin status from user object (injected by backend /me)
    const isPlatformAdmin = user?.is_admin || false;

    useEffect(() => {
        if (urlGuildId) {
            setActiveGuildId(urlGuildId);
            localStorage.setItem('lastGuildId', urlGuildId);
        } else {
            const last = localStorage.getItem('lastGuildId');
            if (last) {
                setActiveGuildId(last);
            } else if (defaultGuildId) {
                setActiveGuildId(defaultGuildId);
            }
        }
    }, [urlGuildId, defaultGuildId]);

    if (pathname === '/login' || pathname === '/access-denied') {
        return null;
    }

    if (!loading && !user) {
        return null;
    }

    const navigation = [...defaultNavigation, ...pluginNavItems];
    // Filter out platform-admin-only items
    const filteredNav = navigation.filter((item: any) => !item.adminOnly || isPlatformAdmin);

    // Find current guild permission
    const currentGuild = guilds.find(g => g.id === activeGuildId);
    const guildPermission = currentGuild?.permission_level;
    const isGuildAdmin = guildPermission === 'owner' || guildPermission === 'admin';

    const getHref = (href: string) => {
        if (activeGuildId && href.includes('[guildId]')) {
            return href.replace('[guildId]', activeGuildId);
        }
        return href;
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-md bg-gray-800 text-white"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <div
                className={cn(
                    'fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white transform transition-transform duration-300 ease-in-out',
                    'lg:translate-x-0 lg:static lg:inset-0',
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-center h-16 bg-gray-800">
                        <h1 className="text-xl font-bold">Baseline Bot</h1>
                    </div>

                    <div className="px-4 py-4">
                        <GuildSwitcher currentGuildId={activeGuildId} />
                    </div>

                    <nav className="flex-1 p-4 space-y-2">
                        {filteredNav.map((item: any) => {
                            const href = getHref(item.href);
                            const isActive = pathname === href;

                            // Disable links if no guild selected AND link requires guildId
                            // But since we use activeGuildId (persisted), this should rarely happen unless new user
                            const requiresGuild = item.href.includes('[guildId]');
                            let isDisabled = requiresGuild && !activeGuildId;

                            // Check guild-level permissions
                            if (!isDisabled && requiresGuild && item.requiredPermission === 'admin') {
                                if (!isGuildAdmin) {
                                    isDisabled = true;
                                }
                            }

                            if (isDisabled) {
                                return (
                                    <div
                                        key={item.name}
                                        className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-500 cursor-not-allowed opacity-50"
                                        title="You do not have permission to access this section"
                                    >
                                        {item.icon && <item.icon size={20} />}
                                        <span>{item.name}</span>
                                    </div>
                                );
                            }

                            return (
                                <Link
                                    key={item.name}
                                    href={href}
                                    className={cn(
                                        'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                                        isActive
                                            ? 'bg-gray-700 text-white'
                                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                    )}
                                    onClick={() => setIsOpen(false)}
                                >
                                    {item.icon && <item.icon size={20} />}
                                    <span>{item.name}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-gray-800">
                        <p className="text-sm text-gray-400">Baseline Platform v1.0</p>
                    </div>
                </div>
            </div>

            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
