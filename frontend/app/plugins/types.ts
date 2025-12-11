
import React from 'react';

export interface Plugin {
    id: string;
    name: string;
    routes: PluginRoute[];
    navItems?: NavItem[];
    settingsComponent?: React.ComponentType<{
        guildId: string;
        settings: Record<string, any>;
        onUpdate: (key: string, value: any) => void;
        isReadOnly: boolean;
    }>;
    pageComponent?: React.ComponentType<{
        guildId: string;
    }>;
}

export interface PluginRoute {
    path: string;
    component: React.ComponentType<any>;
    title?: string;
    // adminOnly?: boolean; // potential future field
}

export interface NavItem {
    name: string;
    href: string;
    icon?: React.ComponentType<{ size?: number }>;
    adminOnly?: boolean;
}
