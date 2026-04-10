'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchGroups, fetchGroupMembers, fetchEffectivePolicies } from '@/lib/api';
import type { GroupResponse, GroupMemberResponse, EffectivePolicyResponse } from '@/lib/api';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Users } from '@/components/Icons';

export default function GroupDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [group, setGroup] = useState<GroupResponse | null>(null);
  const [members, setMembers] = useState<GroupMemberResponse[]>([]);
  const [policies, setPolicies] = useState<EffectivePolicyResponse[]>([]);
  const [tab, setTab] = useState<'members' | 'policies'>('members');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchGroups().then(groups => groups.find(g => g.id === id) || null),
      fetchGroupMembers(id),
    ])
      .then(([g, m]) => {
        setGroup(g);
        setMembers(m);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policiesLoaded, setPoliciesLoaded] = useState(false);

  // Load policies lazily when tab switches — use first member agent to resolve group hierarchy
  useEffect(() => {
    if (tab === 'policies' && !policiesLoaded && members.length > 0) {
      setPoliciesLoading(true);
      fetchEffectivePolicies(members[0].agentId)
        .then(setPolicies)
        .catch(() => setPolicies([]))
        .finally(() => {
          setPoliciesLoading(false);
          setPoliciesLoaded(true);
        });
    }
  }, [tab, policiesLoaded, members]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="loading-spinner" /></div>;
  }

  if (!group) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Group not found</div>;
  }

  return (
    <div>
      <Breadcrumb crumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Groups', href: '/groups' },
        { label: group.name },
      ]} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
          <Users />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{group.name}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span className={`badge badge-${group.nodeType}`}>{group.nodeType}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{group.path}</span>
          </div>
        </div>
      </div>

      <div className="detail-tabs">
        <button className={`detail-tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>
          Members ({members.length})
        </button>
        <button className={`detail-tab ${tab === 'policies' ? 'active' : ''}`} onClick={() => setTab('policies')}>
          Policies{policiesLoaded ? ` (${policies.length})` : ''}
        </button>
      </div>

      {tab === 'members' && (
        <div className="neu-panel">
          {members.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No members in this group.</p>
          ) : (
            <table className="rsop-table">
              <thead>
                <tr><th>Agent</th><th>Domain</th><th>Email</th><th>Status</th></tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.agentId}>
                    <td>
                      <Link href={`/agents/${m.agentId}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                        {m.agentName}
                      </Link>
                    </td>
                    <td><span className={`badge badge-${m.domain}`}>{m.domain}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.email || '—'}</td>
                    <td><span className={`badge ${m.isActive ? 'badge-permit' : 'badge-muted'}`}>{m.isActive ? 'active' : 'inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'policies' && (
        <div className="neu-panel">
          {policiesLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="loading-spinner" /></div>
          ) : members.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>
              Add members to this group to see effective policies.
            </p>
          ) : policies.length === 0 && policiesLoaded ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>
              No policies assigned to this group or its ancestors.
            </p>
          ) : (
            <table className="rsop-table">
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Effect</th>
                  <th>Domain</th>
                  <th>Group Path</th>
                  <th>Version</th>
                  <th>Constraints</th>
                </tr>
              </thead>
              <tbody>
                {policies.map(p => (
                  <tr key={p.policyId}>
                    <td>
                      <Link href={`/policies/${p.policyId}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                        {p.policyName}
                      </Link>
                    </td>
                    <td><span className={`badge badge-${p.effect}`}>{p.effect}</span></td>
                    <td><span className={`badge badge-${p.domain}`}>{p.domain}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {p.groupPath || '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>v{p.versionNumber}</td>
                    <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.constraints === '[]' ? '—' : p.constraints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
