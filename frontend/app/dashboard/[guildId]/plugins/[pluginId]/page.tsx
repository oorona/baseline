'use client';

import { useParams } from 'next/navigation';
import { usePlugins } from '@/app/plugins';

export default function PluginPage() {
    const params = useParams();
    const guildId = params.guildId as string;
    const pluginId = params.pluginId as string;
    const { plugins } = usePlugins();

    const plugin = plugins.find(p => p.id === pluginId);

    if (!plugin) {
        return (
            <div className="p-8 text-center text-gray-400">
                <h1 className="text-xl font-bold mb-2">Plugin Not Found</h1>
                <p>The plugin "{pluginId}" is not registered or does not exist.</p>
            </div>
        );
    }

    if (!plugin.pageComponent) {
        return (
            <div className="p-8 text-center text-gray-400">
                <h1 className="text-xl font-bold mb-2">No Settings Page</h1>
                <p>The plugin "{plugin.name}" does not have a dedicated page.</p>
            </div>
        );
    }

    const PageComponent = plugin.pageComponent;

    return <PageComponent guildId={guildId} />;
}
