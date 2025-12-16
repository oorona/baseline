'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { GuildSwitcher } from './GuildSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { siteConfig } from '../config';
import { LogOut } from 'lucide-react';
import Link from 'next/link';

export function Header() {
    const { user, logout } = useAuth();

    return (
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <Link href="/" className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
                        {siteConfig.name}
                    </Link>

                    {/* Guild Switcher - Only shows if user is logged in (handled inside, but we can wrap) */}
                    {user && (
                        <div className="hidden md:block w-64">
                            <GuildSwitcher />
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {user && (
                        <>
                            {/* Mobile Guild Switcher Placeholder? Or just hide on mobile? 
                                 For now, let's keep it simple. If we need mobile responsive guild switching, 
                                 we might need a different UI approach or keep it in the main content for mobile. 
                             */}

                            <div className="flex items-center gap-3 pl-4 border-l border-border">
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.username} className="w-8 h-8 rounded-full" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                                        {user.username.substring(0, 2).toUpperCase()}
                                    </div>
                                )}
                                <div className="hidden sm:flex flex-col">
                                    <span className="text-sm font-medium leading-none">{user.username}</span>
                                    <span className="text-xs text-muted-foreground">Level: {user.is_admin ? 'Admin' : 'User'}</span>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        {user && (
                            <button
                                onClick={logout}
                                className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10"
                                title="Logout"
                            >
                                <LogOut size={20} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
