'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Settings, Shield, Activity, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../utils';
import { useAuth } from '@/lib/auth-context';
import { GuildSwitcher } from './GuildSwitcher';

import { usePlugins } from '../plugins';

const defaultNavigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Settings', href: '/dashboard/[guildId]/settings', icon: Settings },
    { name: 'Permissions', href: '/dashboard/[guildId]/permissions', icon: Shield },
    { name: 'Shard Monitor', href: '/dashboard/status', icon: Activity, adminOnly: true },
];

export function Sidebar({ guildId, isAdmin }: { guildId?: string; isAdmin?: boolean }) {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const { user, loading } = useAuth();
    const { navItems: pluginNavItems } = usePlugins();

    // Extract guildId from pathname if not provided
    const match = pathname?.match(/\/dashboard\/(\d+)/);
    const currentGuildId = guildId || (match ? match[1] : undefined);

    if (pathname === '/login' || pathname === '/access-denied') {
        return null;
    }

    if (!loading && !user) {
        return null;
    }

    const navigation = [...defaultNavigation, ...pluginNavItems];
    const filteredNav = navigation.filter((item) => !item.adminOnly || isAdmin);

    const getHref = (href: string) => {
        if (currentGuildId && href.includes('[guildId]')) {
            return href.replace('[guildId]', currentGuildId);
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
                        <GuildSwitcher currentGuildId={currentGuildId} />
                    </div>

                    <nav className="flex-1 p-4 space-y-2">
                        {filteredNav.map((item) => {
                            const href = getHref(item.href);
                            const isActive = pathname === href;

                            // Disable links if no guild selected and link requires guildId
                            const isDisabled = item.href.includes('[guildId]') && !currentGuildId;

                            if (isDisabled) return null;

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
