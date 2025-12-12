'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Settings, Shield, Activity, Menu, X, User, Terminal, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '../utils';
import { useAuth } from '@/lib/auth-context';
import { GuildSwitcher } from './GuildSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { usePlugins } from '../plugins';
import { siteConfig } from '../config';

// Define Guild interface with permission level
interface Guild {
    id: string;
    name: string;
    permission_level?: 'owner' | 'admin' | 'user';
}

const defaultNavigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Permissions', href: '/dashboard/[guildId]/permissions', icon: Shield, requiredPermission: 'admin' },
    { name: 'Bot Settings', href: '/dashboard/[guildId]/settings', icon: Settings },
    { name: 'Developer Tools', href: '/dashboard/developer/logging', icon: Terminal, adminOnly: true },
    { name: 'Account Settings', href: '/dashboard/account', icon: User },
];

export function Sidebar({ guildId }: { guildId?: string }) {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const { user, loading, logout } = useAuth();
    const { navItems: pluginNavItems } = usePlugins();

    // Guild data for permissions
    const [guilds, setGuilds] = useState<Guild[]>([]);
    useEffect(() => {
        const fetchGuilds = async () => {
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

    if (pathname === '/login' || pathname === '/access-denied' || pathname === '/welcome') {
        return null;
    }

    if (!user) {
        return null;
    }

    const navigation = [...defaultNavigation, ...pluginNavItems];
    const filteredNav = navigation.filter((item: any) => !item.adminOnly || isPlatformAdmin);

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
                className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-md bg-card border border-border text-foreground shadow-sm"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <div
                className={cn(
                    'fixed inset-y-0 left-0 z-40 w-72 bg-card border-r border-border text-foreground transform transition-transform duration-300 ease-in-out flex flex-col',
                    'lg:translate-x-0 lg:static lg:inset-0',
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="h-16 flex items-center px-6 border-b border-border">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                        {siteConfig.name}
                    </h1>
                </div>

                <div className="p-4">
                    <GuildSwitcher currentGuildId={activeGuildId} />
                </div>

                <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
                    {filteredNav.map((item: any) => {
                        const href = getHref(item.href);
                        const isActive = pathname === href;

                        const requiresGuild = item.href.includes('[guildId]');
                        let isDisabled = requiresGuild && !activeGuildId;

                        if (!isDisabled && requiresGuild && item.requiredPermission === 'admin') {
                            if (!isGuildAdmin) {
                                isDisabled = true;
                            }
                        }

                        if (isDisabled) {
                            return (
                                <div
                                    key={item.name}
                                    className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-muted-foreground opacity-50 cursor-not-allowed text-sm font-medium"
                                    title="You do not have permission to access this section"
                                >
                                    {item.icon && <item.icon size={18} />}
                                    <span>{item.name}</span>
                                </div>
                            );
                        }

                        return (
                            <Link
                                key={item.name}
                                href={href}
                                className={cn(
                                    'flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium',
                                    isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                )}
                                onClick={() => setIsOpen(false)}
                            >
                                {item.icon && <item.icon size={18} />}
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-border bg-card/50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt={user.username} className="w-8 h-8 rounded-full" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                                    {user.username.substring(0, 2).toUpperCase()}
                                </div>
                            )}
                            <div className="flex flex-col">
                                <span className="text-sm font-medium leading-none">{user.username}</span>
                                <span className="text-xs text-muted-foreground">Level: {isPlatformAdmin ? 'Admin' : 'User'}</span>
                            </div>
                        </div>
                        <ThemeToggle />
                    </div>

                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                    >
                        <LogOut size={16} />
                        Logout
                    </button>

                    <div className="mt-4 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">v1.0.0 Alpha</p>
                    </div>
                </div>
            </div>

            {isOpen && (
                <div
                    className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
