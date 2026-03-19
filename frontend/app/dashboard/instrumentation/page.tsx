"use client";

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/app/api-client';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';
import { RefreshCw, TrendingUp, MousePointer, Zap, Terminal, Filter } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GuildGrowthPoint { date: string; joins: number; leaves: number; net: number; }
interface CardUsageStat    { card_id: string; count: number; unique_users: number; }
interface CommandStat      { command: string; cog: string | null; count: number; avg_ms: number; p95_ms: number; success_rate: number; }
interface EndpointStat     { path: string; method: string; count: number; p50_ms: number; p95_ms: number; p99_ms: number; }

interface Stats {
  range: string;
  guild_id_filter: number | null;
  guild_growth: GuildGrowthPoint[];
  card_usage: CardUsageStat[];
  top_commands: CommandStat[];
  endpoint_perf: EndpointStat[];
}

type Range = '24h' | '7d' | '30d';

// ── Helpers ───────────────────────────────────────────────────────────────────

function latencyColor(ms: number): string {
  if (ms < 100) return 'text-green-400';
  if (ms < 500) return 'text-amber-400';
  return 'text-red-400';
}

function latencyBg(ms: number): string {
  if (ms < 100) return 'bg-green-500/10';
  if (ms < 500) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

// Simple SVG bar chart — no external dependency
function BarChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const { t } = useTranslation();
  if (!data.length) return <p className="text-sm text-muted-foreground py-4">{t('instrumentation.noData')}</p>;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <div className="w-40 truncate text-muted-foreground text-xs" title={d.label}>{d.label}</div>
          <div className="flex-1 bg-muted/30 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className="w-10 text-right font-mono text-xs text-foreground">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// Simple SVG line chart for guild growth
function LineChart({ data }: { data: GuildGrowthPoint[] }) {
  const { t } = useTranslation();
  if (!data.length) return <p className="text-sm text-muted-foreground py-4">{t('instrumentation.noDataPeriod')}</p>;

  const W = 600, H = 140, PAD = 20;
  const maxVal = Math.max(...data.map(d => Math.max(d.joins, d.leaves)), 1);
  const xStep = data.length > 1 ? (W - PAD * 2) / (data.length - 1) : W - PAD * 2;

  const toX = (i: number) => PAD + i * xStep;
  const toY = (v: number) => H - PAD - (v / maxVal) * (H - PAD * 2);

  const joinPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.joins)}`).join(' ');
  const leavePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.leaves)}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
        <path d={joinPath} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" />
        <path d={leavePath} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={i} cx={toX(i)} cy={toY(d.joins)} r="3" fill="#22c55e" />
        ))}
      </svg>
      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-green-500 inline-block" /> {t('instrumentation.chartJoins')}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-500 inline-block" /> {t('instrumentation.chartLeaves')}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-2">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function InstrumentationPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('7d');
  const [guildFilter, setGuildFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getInstrumentationStats(range, guildFilter || null);
      setStats(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || t('instrumentation.noData'));
    } finally {
      setLoading(false);
    }
  }, [range, guildFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Summary counts ──────────────────────────────────────────────────────────
  const totalGuildJoins  = stats?.guild_growth.reduce((s, d) => s + d.joins, 0) ?? 0;
  const totalGuildLeaves = stats?.guild_growth.reduce((s, d) => s + d.leaves, 0) ?? 0;
  const totalCardClicks  = stats?.card_usage.reduce((s, d) => s + d.count, 0) ?? 0;
  const totalCmds        = stats?.top_commands.reduce((s, d) => s + d.count, 0) ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('instrumentation.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('instrumentation.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Range selector */}
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            {(['24h', '7d', '30d'] as Range[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 transition-colors ${range === r ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/40 text-muted-foreground'}`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Guild filter */}
          <div className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-1.5 text-sm">
            <Filter size={13} className="text-muted-foreground" />
            <input
              type="text"
              value={guildFilter}
              onChange={e => setGuildFilter(e.target.value)}
              placeholder={t('instrumentation.filterByGuild')}
              className="bg-transparent outline-none text-foreground placeholder:text-muted-foreground w-36"
            />
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? t('instrumentation.loading') : t('instrumentation.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('instrumentation.statGuildJoins'),  value: totalGuildJoins,  icon: TrendingUp, color: 'text-green-400' },
          { label: t('instrumentation.statGuildLeaves'), value: totalGuildLeaves, icon: TrendingUp, color: 'text-red-400' },
          { label: t('instrumentation.statCardClicks'),  value: totalCardClicks,  icon: MousePointer, color: 'text-blue-400' },
          { label: t('instrumentation.statCommandsRun'), value: totalCmds,         icon: Terminal,  color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</span>
              <s.icon size={16} className={s.color} />
            </div>
            <div className="text-2xl font-bold">{loading ? '—' : s.value.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">{t('instrumentation.lastRange', { range })}</div>
          </div>
        ))}
      </div>

      {/* Guild Growth */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center gap-2">
          <TrendingUp size={18} className="text-green-400" />
          <h2 className="text-lg font-semibold">{t('instrumentation.sectionGuildGrowth')}</h2>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="h-36 bg-muted/20 rounded-lg animate-pulse" />
          ) : (
            <LineChart data={stats?.guild_growth ?? []} />
          )}
        </div>
      </div>

      {/* Card Usage */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center gap-2">
          <MousePointer size={18} className="text-blue-400" />
          <h2 className="text-lg font-semibold">{t('instrumentation.sectionCardUsage')}</h2>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-5 bg-muted/20 rounded animate-pulse" />)}
            </div>
          ) : (
            <BarChart
              data={(stats?.card_usage ?? []).map(c => ({ label: c.card_id, value: c.count }))}
              label="clicks"
            />
          )}
          {!loading && (stats?.card_usage?.length ?? 0) > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 text-muted-foreground font-medium">{t('instrumentation.colCard')}</th>
                    <th className="pb-2 text-muted-foreground font-medium text-right">{t('instrumentation.colClicks')}</th>
                    <th className="pb-2 text-muted-foreground font-medium text-right">{t('instrumentation.colUniqueUsers')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats!.card_usage.map(c => (
                    <tr key={c.card_id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                      <td className="py-2 font-mono text-xs">{c.card_id}</td>
                      <td className="py-2 text-right">{c.count.toLocaleString()}</td>
                      <td className="py-2 text-right">{c.unique_users.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* API Endpoint Performance */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center gap-2">
          <Zap size={18} className="text-amber-400" />
          <h2 className="text-lg font-semibold">{t('instrumentation.sectionApiPerf')}</h2>
          <span className="text-xs text-muted-foreground ml-auto">{t('instrumentation.apiPerfLegend')}</span>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-8 bg-muted/20 rounded animate-pulse" />)}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/20 border-b border-border">
                <tr>
                  <th className="text-left p-4 text-muted-foreground font-medium">{t('instrumentation.colEndpoint')}</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">{t('instrumentation.colMethod')}</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">{t('instrumentation.colRequests')}</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">p50</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">p95</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">p99</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.endpoint_perf ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t('instrumentation.noDataPeriod')}</td></tr>
                ) : stats!.endpoint_perf.map((e, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-mono text-xs">{e.path}</td>
                    <td className="p-4">
                      <span className={`text-xs font-bold ${e.method === 'GET' ? 'text-green-400' : e.method === 'POST' ? 'text-blue-400' : 'text-amber-400'}`}>
                        {e.method}
                      </span>
                    </td>
                    <td className="p-4 text-right">{e.count.toLocaleString()}</td>
                    <td className={`p-4 text-right font-mono text-xs ${latencyColor(e.p50_ms)}`}>{e.p50_ms}ms</td>
                    <td className={`p-4 text-right font-mono text-xs ${latencyColor(e.p95_ms)}`}>{e.p95_ms}ms</td>
                    <td className={`p-4 text-right font-mono text-xs ${latencyColor(e.p99_ms)}`}>{e.p99_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bot Commands */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center gap-2">
          <Terminal size={18} className="text-purple-400" />
          <h2 className="text-lg font-semibold">{t('instrumentation.sectionBotCommands')}</h2>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-8 bg-muted/20 rounded animate-pulse" />)}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/20 border-b border-border">
                <tr>
                  <th className="text-left p-4 text-muted-foreground font-medium">{t('instrumentation.colCommand')}</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">{t('instrumentation.colCog')}</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">{t('instrumentation.colInvocations')}</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">{t('instrumentation.colSuccess')}</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">{t('instrumentation.colAvg')}</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">p95</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.top_commands ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t('instrumentation.noCommandData')}</td></tr>
                ) : stats!.top_commands.map((c, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-mono text-xs font-medium">/{c.command}</td>
                    <td className="p-4 text-muted-foreground text-xs">{c.cog ?? '—'}</td>
                    <td className="p-4 text-right">{c.count.toLocaleString()}</td>
                    <td className="p-4 text-right">
                      <span className={`font-medium ${c.success_rate >= 95 ? 'text-green-400' : c.success_rate >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
                        {c.success_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className={`p-4 text-right font-mono text-xs ${latencyColor(c.avg_ms)}`}>{c.avg_ms}ms</td>
                    <td className={`p-4 text-right font-mono text-xs ${latencyColor(c.p95_ms)}`}>{c.p95_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default withPermission(InstrumentationPage, PermissionLevel.DEVELOPER);
