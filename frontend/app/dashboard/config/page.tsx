'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Settings2, RefreshCw, Save, Trash2, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, Eye, EyeOff, Zap, Lock, Info
} from 'lucide-react';
import { apiClient } from '@/app/api-client';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';
import { APP_CATEGORIES, DYNAMIC_KEYS } from '@/config/settings-definitions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SettingEntry {
  key: string;
  friendly_name: string;
  description: string;
  category: string;
  type: 'string' | 'boolean' | 'integer' | 'select';
  is_dynamic: boolean;
  is_secret: boolean;
  possible_values?: [string, string][] | null;
  default?: string | null;
  effective_value?: string | null;
  db_override?: string | null;
  env_value?: string | null;
  source?: string;
  requires_restart_note?: string | null;
}

interface SettingsResponse {
  categories: Record<string, string>;
  settings: Record<string, SettingEntry[]>;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Badge({ label, variant }: { label: string; variant: 'dynamic' | 'static' | 'secret' | 'source' }) {
  const cls: Record<string, string> = {
    dynamic: 'bg-green-500/10 text-green-400 border-green-500/30',
    static:  'bg-amber-500/10 text-amber-400 border-amber-500/30',
    secret:  'bg-red-500/10 text-red-400 border-red-500/30',
    source:  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cls[variant]}`}>
      {variant === 'dynamic' && <Zap size={10} className="mr-1" />}
      {variant === 'static'  && <Lock size={10} className="mr-1" />}
      {label}
    </span>
  );
}

function SettingInput({
  setting,
  value,
  onChange,
  showSecret,
  onToggleSecret,
}: {
  setting: SettingEntry;
  value: string;
  onChange: (v: string) => void;
  showSecret: boolean;
  onToggleSecret: () => void;
}) {
  const base = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors';

  if (setting.type === 'boolean') {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(value === 'true' ? 'false' : 'true')}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            value === 'true' ? 'bg-green-500' : 'bg-muted-foreground/30'
          }`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            value === 'true' ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
        <span className="text-sm text-muted-foreground">{value === 'true' ? 'Enabled' : 'Disabled'}</span>
      </div>
    );
  }

  if (setting.type === 'select' && setting.possible_values) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={base}>
        {setting.possible_values.map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
    );
  }

  if (setting.is_secret) {
    return (
      <div className="relative">
        <input
          type={showSecret ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`${base} pr-10`}
          placeholder="(secret)"
        />
        <button
          type="button"
          onClick={onToggleSecret}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    );
  }

  return (
    <input
      type={setting.type === 'integer' ? 'number' : 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={base}
    />
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function SystemConfigPage() {
  const [data, setData]             = useState<SettingsResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage]       = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [edits, setEdits]           = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed]   = useState<Record<string, boolean>>({});
  const [activeTab]                 = useState<'settings'>('settings');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getConfigSettings();
      setData(res);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load configuration. Access denied or backend unavailable.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEdit = (key: string, value: string) => {
    setEdits(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const updates = Object.entries(edits).map(([key, value]) => ({ key, value }));
    if (updates.length === 0) {
      setMessage({ type: 'warning', text: 'No changes to save.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiClient.updateConfigSettings(updates);
      setMessage({
        type: res.restart_required ? 'warning' : 'success',
        text: res.message || 'Settings saved.',
      });
      setEdits({});
      await load();
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const res = await apiClient.refreshDynamicSettings();
      setMessage({ type: 'success', text: `Dynamic settings refreshed. ${res.count} setting(s) pushed to runtime.` });
    } catch {
      setMessage({ type: 'error', text: 'Failed to refresh settings.' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleRevert = async (key: string) => {
    try {
      await apiClient.deleteConfigOverride(key);
      setMessage({ type: 'success', text: `${key} reverted to environment default.` });
      await load();
    } catch {
      setMessage({ type: 'error', text: `Failed to revert ${key}.` });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading configuration...</p>
        </div>
      </div>
    );
  }

  const categoriesInOrder = Object.keys(APP_CATEGORIES);
  const settingsByCategory = data?.settings ?? {};
  const hasEdits = Object.keys(edits).length > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6 md:p-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Settings2 className="text-red-500" size={22} />
            </div>
            <h1 className="text-3xl font-bold text-foreground">System Configuration</h1>
          </div>
          <p className="text-muted-foreground">
            Manage all framework settings. Dynamic settings apply immediately; static settings require a server restart.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted/40 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh Dynamic
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasEdits}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving…' : `Save Changes${hasEdits ? ` (${Object.keys(edits).length})` : ''}`}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><Zap size={12} className="text-green-400" /> Dynamic — applied at runtime without restart</span>
        <span className="flex items-center gap-1"><Lock size={12} className="text-amber-400" /> Static — requires server restart</span>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-start gap-3 p-4 rounded-lg border text-sm ${
          message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
          message.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
          'bg-destructive/10 border-destructive/30 text-destructive'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> :
           <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Settings categories */}
      {categoriesInOrder.map(catKey => {
        const catLabel    = APP_CATEGORIES[catKey];
        const catSettings = settingsByCategory[catKey] ?? [];
        if (catSettings.length === 0) return null;
        const isCollapsed = collapsed[catKey] ?? false;

        return (
          <div key={catKey} className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Category header */}
            <button
              type="button"
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors"
              onClick={() => setCollapsed(prev => ({ ...prev, [catKey]: !prev[catKey] }))}
            >
              <h2 className="text-lg font-semibold text-foreground">{catLabel}</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{catSettings.length} setting{catSettings.length !== 1 ? 's' : ''}</span>
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {!isCollapsed && (
              <div className="border-t border-border divide-y divide-border/50">
                {catSettings.map((s: SettingEntry) => {
                  const currentVal = edits[s.key] ?? s.effective_value ?? s.default ?? '';
                  const isEdited   = edits[s.key] !== undefined;
                  const hasOverride = s.source === 'database';

                  return (
                    <div key={s.key} className={`px-6 py-5 ${isEdited ? 'bg-primary/5' : ''}`}>
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Title row */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-foreground text-sm">{s.friendly_name}</span>
                            <code className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded font-mono">{s.key}</code>
                            {s.is_dynamic
                              ? <Badge label="Dynamic" variant="dynamic" />
                              : <Badge label="Requires restart" variant="static" />
                            }
                            {s.is_secret && <Badge label="Secret" variant="secret" />}
                            {hasOverride && <Badge label={`Override (${s.source})`} variant="source" />}
                          </div>

                          {/* Description */}
                          <p className="text-xs text-muted-foreground leading-relaxed mb-3">{s.description}</p>

                          {/* Input */}
                          {catKey !== 'frontend' ? (
                            <SettingInput
                              setting={s}
                              value={currentVal}
                              onChange={v => handleEdit(s.key, v)}
                              showSecret={showSecrets[s.key] ?? false}
                              onToggleSecret={() => setShowSecrets(prev => ({ ...prev, [s.key]: !prev[s.key] }))}
                            />
                          ) : (
                            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border/50">
                              <Info size={12} className="text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground">
                                This is a frontend build-time variable. Current value:{' '}
                                <code className="font-mono">{s.effective_value ?? s.default ?? '(not set)'}</code>
                              </span>
                            </div>
                          )}

                          {/* Source info */}
                          {s.source && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Source: <span className="font-medium capitalize">{s.source}</span>
                              {s.default && ` · Default: ${s.is_secret ? '****' : s.default}`}
                            </p>
                          )}

                          {/* Restart note */}
                          {!s.is_dynamic && s.requires_restart_note && (
                            <p className="text-xs text-amber-400/80 mt-1 flex items-center gap-1">
                              <Lock size={10} />
                              {s.requires_restart_note}
                            </p>
                          )}
                        </div>

                        {/* Revert button */}
                        {hasOverride && (
                          <button
                            type="button"
                            onClick={() => handleRevert(s.key)}
                            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
                            title="Revert to environment default"
                          >
                            <Trash2 size={12} />
                            Revert
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Sticky save bar when there are pending edits */}
      {hasEdits && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-card border border-border rounded-xl shadow-xl px-5 py-3">
          <span className="text-sm text-muted-foreground">{Object.keys(edits).length} unsaved change{Object.keys(edits).length !== 1 ? 's' : ''}</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

export default withPermission(SystemConfigPage, PermissionLevel.DEVELOPER);
