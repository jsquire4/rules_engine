'use client';

import { X } from '../Icons';

interface CreateModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

export function CreateModal({ title, onClose, children, wide }: CreateModalProps) {
  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="create-modal" style={wide ? { width: 680, maxHeight: 700 } : undefined} onClick={e => e.stopPropagation()}>
        <div className="create-modal-header">
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X />
          </button>
        </div>
        <div className="create-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
