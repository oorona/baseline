"use client";

import { useEffect, useState } from 'react';
import { apiClient } from '@/app/api-client';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';
import { useTranslation } from '@/lib/i18n';

interface LLMStats {
    total_cost: number;
    total_tokens: number;
    by_provider: { provider: string; cost: number; requests: number }[];
    recent_logs: any[];
}

function AIAnalyticsPage() {
    const { t } = useTranslation();
    const [stats, setStats] = useState<LLMStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setLoading(true);
            const data = await apiClient.getLLMStats();
            setStats(data);
        } catch (err) {
            console.error("Failed to load stats", err);
            setError(t('aiAnalytics.loadError'));
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-foreground">{t('aiAnalytics.loading')}</div>;
    if (error) return <div className="p-8 text-red-500">{error}</div>;
    if (!stats) return <div className="p-8 text-foreground">{t('aiAnalytics.noData')}</div>;

    const totalRequests = stats.by_provider.reduce((acc, curr) => acc + curr.requests, 0);

    return (
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
            <h1 className="text-3xl font-bold mb-6">{t('aiAnalytics.title')}</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-card rounded-lg p-6 border border-border shadow-md">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('aiAnalytics.statTotalTokens')}</h3>
                    <div className="text-2xl font-bold text-foreground">{stats.total_tokens.toLocaleString()}</div>
                </div>
                <div className="bg-card rounded-lg p-6 border border-border shadow-md">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('aiAnalytics.statEstimatedCost')}</h3>
                    <div className="text-2xl font-bold text-foreground">${(stats.total_cost ?? 0).toFixed(4)}</div>
                </div>
                <div className="bg-card rounded-lg p-6 border border-border shadow-md">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('aiAnalytics.statTotalRequests')}</h3>
                    <div className="text-2xl font-bold text-foreground">{totalRequests}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="bg-card rounded-lg border border-border shadow-md overflow-hidden">
                    <div className="p-6 border-b border-border">
                        <h3 className="text-lg font-medium">{t('aiAnalytics.sectionByProvider')}</h3>
                    </div>
                    <div className="p-0">
                        <table className="w-full">
                            <thead className="bg-muted/30">
                                <tr>
                                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t('aiAnalytics.colProvider')}</th>
                                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t('aiAnalytics.colRequests')}</th>
                                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">{t('aiAnalytics.colCost')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.by_provider.map((p) => (
                                    <tr key={p.provider} className="border-t border-border hover:bg-muted/30 transition-colors">
                                        <td className="p-4 font-medium capitalize text-foreground">{p.provider}</td>
                                        <td className="p-4 text-foreground">{p.requests}</td>
                                        <td className="p-4 text-right text-foreground">${p.cost.toFixed(4)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="bg-card rounded-lg border border-border shadow-md overflow-hidden">
                <div className="p-6 border-b border-border">
                    <h3 className="text-lg font-medium">{t('aiAnalytics.sectionRecentLogs')}</h3>
                </div>
                <div className="p-0 overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/30">
                            <tr>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t('aiAnalytics.colTime')}</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t('aiAnalytics.colUser')}</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t('aiAnalytics.colProvider')}</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t('aiAnalytics.colModel')}</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t('aiAnalytics.colTokens')}</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">{t('aiAnalytics.colType')}</th>
                                <th className="text-right p-4 text-sm font-medium text-muted-foreground">{t('aiAnalytics.colLatency')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.recent_logs.map((log) => (
                                <tr key={log.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                                    <td className="p-4 text-sm whitespace-nowrap text-foreground">{new Date(log.timestamp).toLocaleString()}</td>
                                    <td className="p-4 text-sm text-foreground">{log.user_id}</td>
                                    <td className="p-4 text-sm capitalize text-foreground">{log.provider}</td>
                                    <td className="p-4 text-sm text-foreground">{log.model}</td>
                                    <td className="p-4 text-sm text-foreground">{log.tokens}</td>
                                    <td className="p-4 text-sm">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-900 text-indigo-100 border border-indigo-700">
                                            {log.request_type}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-right text-foreground">{(log.latency || 0).toFixed(2)}s</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default withPermission(AIAnalyticsPage, PermissionLevel.DEVELOPER);
