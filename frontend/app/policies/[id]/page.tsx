'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { fetchPolicies, fetchPolicyVersions, createPolicyVersion } from '@/lib/api';
import type { PolicyResponse, PolicyVersionResponse } from '@/lib/api';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Shield, Code } from '@/components/Icons';
import { CedarEditor } from '@/components/editor/CedarEditor';
import { StructuredBuilder } from '@/components/builder/StructuredBuilder';

export default function PolicyDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [policy, setPolicy] = useState<PolicyResponse | null>(null);
  const [versions, setVersions] = useState<PolicyVersionResponse[]>([]);
  const [tab, setTab] = useState<'constraints' | 'code' | 'history'>('constraints');
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editSource, setEditSource] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchPolicies().then(policies => policies.find(p => p.id === id) || null),
      fetchPolicyVersions(id),
    ])
      .then(([p, v]) => {
        setPolicy(p);
        setVersions([...v].sort((a, b) => b.versionNumber - a.versionNumber));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="loading-spinner" /></div>;
  }

  if (!policy) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Policy not found</div>;
  }

  const activeVersion = versions[0];

  return (
    <div>
      <Breadcrumb crumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Policies', href: '/policies' },
        { label: policy.name },
      ]} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
          <Shield />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{policy.name}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span className={`badge badge-${policy.domain}`}>{policy.domain}</span>
            <span className={`badge badge-${policy.effect === 'deny' ? 'deny' : 'permit'}`}>{policy.effect}</span>
            {activeVersion && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                v{activeVersion.versionNumber} #{activeVersion.cedarHash?.slice(0, 8)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="detail-tabs">
        <button className={`detail-tab ${tab === 'constraints' ? 'active' : ''}`} onClick={() => setTab('constraints')}>Constraints</button>
        <button className={`detail-tab ${tab === 'code' ? 'active' : ''}`} onClick={() => setTab('code')}>
          <Code /> Cedar
        </button>
        <button className={`detail-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History ({versions.length})</button>
      </div>

      {tab === 'constraints' && (
        <StructuredBuilder
          policyId={id}
          domain={policy.domain}
          effect={policy.effect}
          activeVersion={activeVersion || null}
          onVersionCreated={async () => {
            const updated = await fetchPolicyVersions(id);
            setVersions([...updated].sort((a, b) => b.versionNumber - a.versionNumber));
          }}
        />
      )}

      {tab === 'code' && activeVersion && (
        <div className="neu-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
              v{activeVersion.versionNumber}
              {activeVersion.cedarHash ? ` #${activeVersion.cedarHash.slice(0, 8)}` : ''}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {!editMode ? (
                <button
                  className="neu-btn neu-btn-ghost"
                  style={{ padding: '6px 14px', fontSize: 12 }}
                  onClick={() => { setEditMode(true); setEditSource(activeVersion.cedarSource); }}
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    className="neu-btn neu-btn-primary"
                    style={{ padding: '6px 14px', fontSize: 12 }}
                    disabled={saving}
                    onClick={async () => {
                      if (!editSource.trim()) return;
                      setSaving(true);
                      try {
                        await createPolicyVersion(id, editSource);
                        const updated = await fetchPolicyVersions(id);
                        setVersions([...updated].sort((a, b) => b.versionNumber - a.versionNumber));
                        setEditMode(false);
                      } catch (e) {
                        alert('Failed to save: ' + (e as Error).message);
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    className="neu-btn neu-btn-ghost"
                    style={{ padding: '6px 14px', fontSize: 12 }}
                    onClick={() => setEditMode(false)}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
          <CedarEditor
            value={editMode ? editSource : activeVersion.cedarSource}
            onChange={(v) => setEditSource(v)}
            readOnly={!editMode}
            height="400px"
          />
        </div>
      )}

      {tab === 'history' && (
        <div className="timeline">
          <div className="timeline-line" />
          {versions.map((v, i) => (
            <div key={v.id} className="timeline-item">
              <div className={`timeline-dot ${i === 0 ? 'active' : 'inactive'}`} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Version {v.versionNumber}</span>
                  {i === 0 && <span className="badge badge-accent" style={{ marginLeft: 8 }}>active</span>}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                  {v.cedarHash?.slice(0, 12)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {new Date(v.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

