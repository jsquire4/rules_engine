'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchActionTypes, generateCedarFromConstraints, fetchPolicyVersions } from '@/lib/api';
import type { ActionTypeWithDimensionsResponse, DimensionDefResponse, PolicyVersionResponse } from '@/lib/api';
import { Lock, Check, Shield } from '../Icons';

interface StructuredBuilderProps {
  policyId: string;
  domain: string;
  effect: string;
  activeVersion: PolicyVersionResponse | null;
  /** Called after a new version is created from the builder */
  onVersionCreated: () => void;
}

interface ConstraintEntry {
  action: string;
  dimension: string;
  kind: string;
  max?: number;
  members?: string[];
  value?: boolean;
  start?: string;
  end?: string;
  expiry?: string;
  window?: string;
}

export function StructuredBuilder({ policyId, domain, effect, activeVersion, onVersionCreated }: StructuredBuilderProps) {
  const [actionTypes, setActionTypes] = useState<ActionTypeWithDimensionsResponse[]>([]);
  const [selectedAction, setSelectedAction] = useState('');
  const [constraints, setConstraints] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Parse existing constraints from active version
  const existingConstraints: ConstraintEntry[] = useMemo(() => {
    if (!activeVersion?.constraints) return [];
    try { return JSON.parse(activeVersion.constraints); } catch { return []; }
  }, [activeVersion]);

  useEffect(() => {
    fetchActionTypes()
      .then(at => {
        setActionTypes(at);
        // Pre-select action from existing constraints
        if (existingConstraints.length > 0 && !selectedAction) {
          setSelectedAction(existingConstraints[0].action);
        }
      })
      .catch(() => {});
  }, []);

  // Pre-fill constraints from existing version when action changes
  useEffect(() => {
    if (!selectedAction || existingConstraints.length === 0) return;
    const prefill: Record<string, string> = {};
    for (const c of existingConstraints) {
      if (c.action !== selectedAction) continue;
      switch (c.kind) {
        case 'numeric': prefill[c.dimension] = String(c.max ?? ''); break;
        case 'set': prefill[c.dimension] = (c.members ?? []).join(', '); break;
        case 'boolean': prefill[c.dimension] = String(c.value ?? ''); break;
        case 'temporal': prefill[c.dimension] = `${c.start ?? ''}–${c.end ?? ''}`; break;
        case 'rate': prefill[c.dimension] = `${c.max ?? ''}/${c.window ?? ''}`; break;
      }
    }
    setConstraints(prefill);
  }, [selectedAction, existingConstraints]);

  const filteredActions = domain
    ? actionTypes.filter(at => at.domain === domain)
    : actionTypes;
  const selectedActionType = actionTypes.find(at => at.name === selectedAction);

  const buildConstraintsJson = (): string => {
    if (!selectedActionType) return '[]';
    const entries = selectedActionType.dimensions
      .filter(dim => constraints[dim.dimensionName])
      .map(dim => {
        const val = constraints[dim.dimensionName];
        const base: Record<string, unknown> = {
          action: selectedAction,
          dimension: dim.dimensionName,
          kind: dim.kind,
        };
        switch (dim.kind) {
          case 'numeric': base.max = Number(val); break;
          case 'set': base.members = val.split(',').map(s => s.trim()); break;
          case 'boolean': base.value = val === 'true'; break;
          case 'temporal': {
            const sep = val.includes('–') ? '–' : '-';
            const [start, end] = val.split(sep).map(s => s.trim());
            if (start) base.start = start;
            if (end) base.end = end;
            break;
          }
          case 'rate': {
            const parts = val.split('/').map(s => s.trim());
            base.max = Number(parts[0]);
            if (parts[1]) base.window = parts[1];
            break;
          }
        }
        return base;
      });
    return JSON.stringify(entries);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const constraintsJson = buildConstraintsJson();
      await generateCedarFromConstraints(policyId, constraintsJson);
      onVersionCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.values(constraints).some(v => v !== '');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {/* Left panel: existing constraints (read-only) */}
      <div className="neu-panel">
        <div className="panel-header">
          <Lock />
          <span className="panel-title">Current Constraints</span>
          <span className="badge badge-muted">read-only</span>
        </div>
        {existingConstraints.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
            <Shield />
            <p style={{ marginTop: 8 }}>No constraints defined yet.</p>
            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              Use the builder on the right to add constraints.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {existingConstraints.map((c, i) => (
              <div key={i} style={{
                padding: '12px 14px',
                background: 'var(--surface-high)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--neu-surface-raised-sm)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                    {c.action}
                  </span>
                  <span className={`badge badge-${effect === 'deny' ? 'deny' : 'permit'}`} style={{ fontSize: 9 }}>
                    {effect}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {c.dimension}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                    {formatConstraintDisplay(c)}
                  </span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <span className="badge badge-accent" style={{ fontSize: 9 }}>{c.kind}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right panel: editable builder */}
      <div className="neu-panel" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="panel-title">Edit Constraints</span>
            <span className={`badge badge-${domain}`}>{domain}</span>
          </div>
          <button
            className="neu-btn neu-btn-primary"
            style={{ padding: '8px 16px', fontSize: 12 }}
            disabled={saving || !hasChanges}
            onClick={handleSave}
          >
            {saving ? 'Saving...' : 'Generate & Save'}
          </button>
        </div>

        {error && (
          <div style={{
            marginBottom: 12, padding: '10px 12px', fontSize: 12,
            background: 'var(--deny-surface)', color: 'var(--deny)',
            borderRadius: 'var(--radius-md)',
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <span className="field-label">Action Type</span>
          <select
            className="neu-select"
            style={{ width: '100%' }}
            value={selectedAction}
            onChange={e => { setSelectedAction(e.target.value); setConstraints({}); }}
          >
            <option value="">Select action...</option>
            {filteredActions.map(at => (
              <option key={at.id} value={at.name}>{at.name}</option>
            ))}
          </select>
        </div>

        {selectedActionType && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
            {selectedActionType.dimensions.map(dim => (
              <DimensionControl
                key={dim.id}
                dim={dim}
                value={constraints[dim.dimensionName] || ''}
                onChange={val => setConstraints(prev => ({ ...prev, [dim.dimensionName]: val }))}
              />
            ))}
          </div>
        )}

        {!selectedActionType && selectedAction === '' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Select an action type to configure constraints.
          </div>
        )}
      </div>
    </div>
  );
}

function DimensionControl({ dim, value, onChange }: {
  dim: DimensionDefResponse;
  value: string;
  onChange: (val: string) => void;
}) {
  switch (dim.kind) {
    case 'numeric':
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="field-label" style={{ marginBottom: 0 }}>{dim.dimensionName}</span>
            {dim.numericMax && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                ceiling: {dim.numericMax.toLocaleString()}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range"
              min="0"
              max={dim.numericMax || 100000}
              value={Number(value) || 0}
              onChange={e => onChange(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              className="neu-input"
              type="number"
              style={{ width: 120, textAlign: 'right' }}
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder="0"
            />
          </div>
          {dim.numericMax && Number(value) > dim.numericMax && (
            <div style={{ fontSize: 11, color: 'var(--deny)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              Exceeds ceiling of {dim.numericMax.toLocaleString()}
            </div>
          )}
        </div>
      );

    case 'set':
      const allMembers = dim.setMembers || [];
      const selected = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
      const toggleMember = (m: string) => {
        const next = selected.includes(m)
          ? selected.filter(x => x !== m)
          : [...selected, m];
        onChange(next.join(', '));
      };
      return (
        <div>
          <span className="field-label">{dim.dimensionName}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {allMembers.map(m => {
              const sel = selected.includes(m);
              return (
                <button
                  key={m}
                  className={`neu-chip ${sel ? 'selected' : 'unselected'}`}
                  onClick={() => toggleMember(m)}
                  style={{ padding: '5px 12px', fontSize: 12 }}
                >
                  {sel && <Check />} {m}
                </button>
              );
            })}
          </div>
          {allMembers.length === 0 && (
            <input
              className="neu-input"
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder="Comma-separated values"
              style={{ marginTop: 4 }}
            />
          )}
        </div>
      );

    case 'boolean':
      return (
        <div>
          <span className="field-label">{dim.dimensionName}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <button
              className={`neu-chip ${value === 'true' ? 'selected' : 'unselected'}`}
              onClick={() => onChange(value === 'true' ? '' : 'true')}
              style={{ padding: '6px 14px', fontSize: 12 }}
            >
              {value === 'true' && <Check />} true
            </button>
            <button
              className={`neu-chip ${value === 'false' ? 'selected' : 'unselected'}`}
              onClick={() => onChange(value === 'false' ? '' : 'false')}
              style={{ padding: '6px 14px', fontSize: 12 }}
            >
              {value === 'false' && <Check />} false
            </button>
            {dim.boolDefault !== null && dim.boolDefault !== undefined && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                default: {String(dim.boolDefault)}
              </span>
            )}
          </div>
        </div>
      );

    case 'temporal':
      const timeParts = value.includes('–') ? value.split('–') : value.split('-');
      const timeStart = timeParts[0]?.trim() || '';
      const timeEnd = timeParts[1]?.trim() || '';
      return (
        <div>
          <span className="field-label">{dim.dimensionName}</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <input
              className="neu-input"
              type="time"
              value={timeStart}
              onChange={e => onChange(`${e.target.value}–${timeEnd}`)}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>to</span>
            <input
              className="neu-input"
              type="time"
              value={timeEnd}
              onChange={e => onChange(`${timeStart}–${e.target.value}`)}
            />
          </div>
          {dim.temporalStart && dim.temporalEnd && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4, display: 'block' }}>
              parent window: {dim.temporalStart}–{dim.temporalEnd}
            </span>
          )}
        </div>
      );

    case 'rate':
      const rateParts = value.split('/');
      const rateCount = rateParts[0]?.trim() || '';
      const rateWindow = rateParts[1]?.trim() || '';
      return (
        <div>
          <span className="field-label">{dim.dimensionName}</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <input
              className="neu-input"
              type="number"
              value={rateCount}
              onChange={e => onChange(`${e.target.value}/${rateWindow}`)}
              placeholder="count"
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>per</span>
            <input
              className="neu-input"
              value={rateWindow}
              onChange={e => onChange(`${rateCount}/${e.target.value}`)}
              placeholder="e.g. 1 day"
            />
          </div>
          {dim.rateWindow && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4, display: 'block' }}>
              default window: {dim.rateWindow}
            </span>
          )}
        </div>
      );

    default:
      return (
        <div>
          <span className="field-label">{dim.dimensionName} ({dim.kind})</span>
          <input
            className="neu-input"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={`${dim.kind} value`}
          />
        </div>
      );
  }
}

function formatConstraintDisplay(c: ConstraintEntry): string {
  switch (c.kind) {
    case 'numeric': return `max ${(c.max ?? 0).toLocaleString()}`;
    case 'set': return (c.members ?? []).join(', ');
    case 'boolean': return String(c.value ?? '–');
    case 'temporal': return `${c.start ?? '?'} – ${c.end ?? '?'}`;
    case 'rate': return `${c.max ?? '?'} per ${c.window ?? '?'}`;
    default: return '–';
  }
}
