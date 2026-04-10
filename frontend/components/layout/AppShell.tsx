'use client';

import { useState } from 'react';
import { ChatPanel } from '../ChatPanel';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 'calc(100vh - 56px)' }}>
      <main className="app-main" style={{ flex: 1 }}>
        {children}
      </main>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      {/* Floating chat toggle button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          aria-label="Open Policy Assistant"
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 50,
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--accent)', color: 'white',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '4px 4px 12px var(--shadow-dark), -2px -2px 8px var(--shadow-light)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </button>
      )}
    </div>
  );
}
