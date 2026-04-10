'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreateModal } from './CreateModal';
import {
  fetchActionTypes, fetchGroups, fetchAgents,
  createPolicy, generateCedarFromConstraints, createAssignment,
  createPolicyVersion, fetchPolicyVersions,
} from '@/lib/api';
import type { ActionTypeWithDimensionsResponse, GroupResponse, AgentResponse } from '@/lib/api';
import { CedarEditor } from '../editor/CedarEditor';

interface CreatePolicyFlowProps {
  onClose: () => void;
}

const ORG_ID = '00000000-0000-0000-0000-000000000001';

export function CreatePolicyFlow({ onClose }: CreatePolicyFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Authoring mode: 'structured' or 'code'
  const [mode, setMode] = useState<'structured' | 'code'>('structured');

  // Step 1: basic info
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [effect, setEffect] = useState('allow');
  const [actionTypes, setActionTypes] = useState<ActionTypeWithDimensionsResponse[]>([]);
  const [selectedAction, setSelectedAction] = useState('');

  // Code mode
  const [cedarSource, setCedarSource] = useState('');

  // Step 2: constraints
  const [constraints, setConstraints] = useState<Record<string, string>>({});

  // Step 3: assignment
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [agents, setAgents] = useState<AgentResponse[]>([]);
  const [assignTarget, setAssignTarget] = useState<'group' | 'agent'>('group');
  const [assignId, setAssignId] = useState('');

  useEffect(() => {
    Promise.all([fetchActionTypes(), fetchGroups(), fetchAgents()])
      .then(([at, g, a]) => { setActionTypes(at); setGroups(g); setAgents(a); })
      .catch(() => {});
  }, []);

  const selectedActionType = actionTypes.find(at => at.name === selectedAction);
  const filteredActions = domain ? actionTypes.filter(at => at.domain === domain) : actionTypes;

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
            const [start, end] = val.split('-').map(s => s.trim());
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
      // 1. Create policy
      const policy = await createPolicy({ name, domain, effect, orgId: ORG_ID });

      if (mode === 'code') {
        // Code mode: save raw Cedar directly
        await createPolicyVersion(policy.id, cedarSource);
      } else {
        // Structured mode: generate Cedar from constraints
        const constraintsJson = buildConstraintsJson();
        const assignName = assignTarget === 'group'
          ? groups.find(g => g.id === assignId)?.name
          : agents.find(a => a.id === assignId)?.name;

        await generateCedarFromConstraints(
          policy.id, constraintsJson, assignName || undefined, assignTarget
        );
      }

      // Create assignment if target selected
      if (assignId) {
        const versions = await fetchPolicyVersions(policy.id);
        const latestVersion = versions.sort((a, b) => b.versionNumber - a.versionNumber)[0];
        if (latestVersion) {
          await createAssignment({
            policyId: policy.id,
            policyVersionId: latestVersion.id,
            ...(assignTarget === 'group' ? { groupId: assignId } : { agentId: assignId }),
          });
        }
      }

      onClose();
      router.push(`/policies/${policy.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CreateModal title="New Policy" onClose={onClose} wide={mode === 'code'}>
      {/* Step indicators */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: s <= step ? 'var(--accent)' : 'var(--shadow-dark)',
          }} />
        ))}
      </div>

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <span className="field-label">Policy Name</span>
            <input className="neu-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. ap-team-purchase-limit" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <span className="field-label">Domain</span>
              <select className="neu-select" style={{ width: '100%' }} value={domain} onChange={e => { setDomain(e.target.value); setSelectedAction(''); }}>
                <option value="">Select...</option>
                <option value="finance">finance</option>
                <option value="communication">communication</option>
                <option value="agent_delegation">agent_delegation</option>
              </select>
            </div>
            <div>
              <span className="field-label">Effect</span>
              <select className="neu-select" style={{ width: '100%' }} value={effect} onChange={e => setEffect(e.target.value)}>
                <option value="allow">allow</option>
                <option value="deny">deny</option>
              </select>
            </div>
          </div>
          <div>
            <span className="field-label">Authoring Mode</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`neu-chip ${mode === 'structured' ? 'selected' : 'unselected'}`} onClick={() => setMode('structured')}>Structured</button>
              <button className={`neu-chip ${mode === 'code' ? 'selected' : 'unselected'}`} onClick={() => setMode('code')}>Code</button>
            </div>
          </div>
          {mode === 'structured' && (
            <div>
              <span className="field-label">Action Type</span>
              <select className="neu-select" style={{ width: '100%' }} value={selectedAction} onChange={e => setSelectedAction(e.target.value)}>
                <option value="">Select action...</option>
                {filteredActions.map(at => (
                  <option key={at.id} value={at.name}>{at.name}</option>
                ))}
              </select>
            </div>
          )}
          <button
            className="neu-btn neu-btn-primary"
            disabled={!name || !domain || (mode === 'structured' && !selectedAction)}
            onClick={() => setStep(2)}
          >
            {mode === 'code' ? 'Next: Write Cedar' : 'Next: Set Constraints'}
          </button>
        </div>
      )}

      {step === 2 && mode === 'code' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Write Cedar policy source. The editor validates syntax in real time.
          </p>
          <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--neu-surface-inset)' }}>
            <CedarEditor
              value={cedarSource}
              onChange={setCedarSource}
              height="240px"
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="neu-btn neu-btn-ghost" onClick={() => setStep(1)}>Back</button>
            <button className="neu-btn neu-btn-primary" disabled={!cedarSource.trim()} onClick={() => setStep(3)}>Next: Assign</button>
          </div>
        </div>
      )}

      {step === 2 && mode === 'structured' && selectedActionType && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Set dimension values for <strong>{selectedAction}</strong>. Leave blank to skip.
          </p>
          {selectedActionType.dimensions.map(dim => (
            <div key={dim.id}>
              <span className="field-label">
                {dim.dimensionName}
                <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 6 }}>({dim.kind})</span>
              </span>
              {dim.kind === 'boolean' ? (
                <select className="neu-select" style={{ width: '100%' }}
                  value={constraints[dim.dimensionName] || ''}
                  onChange={e => setConstraints(p => ({ ...p, [dim.dimensionName]: e.target.value }))}
                >
                  <option value="">Not set</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input className="neu-input"
                  value={constraints[dim.dimensionName] || ''}
                  onChange={e => setConstraints(p => ({ ...p, [dim.dimensionName]: e.target.value }))}
                  placeholder={
                    dim.kind === 'numeric' ? `max value (e.g. ${dim.numericMax || 1000})`
                    : dim.kind === 'set' ? `comma-separated (e.g. ${dim.setMembers?.join(', ') || 'A, B'})`
                    : dim.kind === 'temporal' ? 'start-end (e.g. 09:00-17:00)'
                    : dim.kind === 'rate' ? 'count/window (e.g. 100/1 day)'
                    : ''
                  }
                />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="neu-btn neu-btn-ghost" onClick={() => setStep(1)}>Back</button>
            <button className="neu-btn neu-btn-primary" onClick={() => setStep(3)}>Next: Assign</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Assign this policy to a group or agent (optional).
          </p>
          <div>
            <span className="field-label">Assign To</span>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button className={`neu-chip ${assignTarget === 'group' ? 'selected' : 'unselected'}`} onClick={() => { setAssignTarget('group'); setAssignId(''); }}>Group</button>
              <button className={`neu-chip ${assignTarget === 'agent' ? 'selected' : 'unselected'}`} onClick={() => { setAssignTarget('agent'); setAssignId(''); }}>Agent</button>
            </div>
            <select className="neu-select" style={{ width: '100%' }} value={assignId} onChange={e => setAssignId(e.target.value)}>
              <option value="">None (assign later)</option>
              {assignTarget === 'group'
                ? groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.path})</option>)
                : agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)
              }
            </select>
          </div>

          {error && <p style={{ color: 'var(--deny)', fontSize: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="neu-btn neu-btn-ghost" onClick={() => setStep(2)}>Back</button>
            <button className="neu-btn neu-btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Creating...' : 'Create Policy'}
            </button>
          </div>
        </div>
      )}
    </CreateModal>
  );
}
