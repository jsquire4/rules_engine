'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Chat, X, Send } from './Icons';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Create a policy that limits purchase orders to $5,000 for the finance team',
  'Explain how forbid-overrides-permit works in Cedar',
  'Why would an agent in acme.finance.ap be denied a wire_transfer?',
  'Generate a temporal constraint for business hours only',
];

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setError('');
    setStreaming(true);

    const assistantMsg: Message = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMsg]);

    try {
      abortRef.current = new AbortController();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Request failed: ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              accumulated += parsed.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: accumulated };
                return updated;
              });
            }
            if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (e) {
            if ((e as Error).message && !(e as Error).message.includes('JSON')) {
              throw e;
            }
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message);
      // Remove the empty assistant message on error
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  if (!open) return null;

  return (
    <div className="chat-sidebar">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          <Chat /> Policy Assistant
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)', padding: '4px 8px' }}
            >
              Clear
            </button>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {messages.length === 0 ? (
          <div style={{ padding: '16px 4px' }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              Describe a rule in plain English to generate Cedar policy, analyze existing policies, or debug authorization decisions.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  style={{
                    textAlign: 'left', padding: '10px 12px', fontSize: 12, lineHeight: 1.5,
                    background: 'var(--surface)', borderRadius: 'var(--radius-md)',
                    border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                    boxShadow: 'var(--neu-surface-raised-sm)',
                    transition: 'box-shadow 0.12s, color 0.12s',
                    fontFamily: 'var(--font-sans)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.boxShadow = 'var(--neu-surface-raised)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.boxShadow = 'var(--neu-surface-raised-sm)'; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div
                  className="chat-msg-bubble"
                  style={{
                    maxWidth: '90%',
                    background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface-high)',
                    color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                    boxShadow: msg.role === 'user' ? 'none' : 'var(--neu-surface-raised-sm)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.role === 'assistant' ? (
                    <ChatContent content={msg.content} />
                  ) : (
                    msg.content
                  )}
                  {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
                    <span style={{ opacity: 0.5, animation: 'blink 1s infinite' }}>|</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 8, padding: '10px 12px', fontSize: 12,
            background: 'var(--deny-surface)', color: 'var(--deny)',
            borderRadius: 'var(--radius-md)', lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: 12, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface)',
          boxShadow: 'var(--neu-surface-inset)',
          borderRadius: 'var(--radius-lg)',
          padding: '10px 14px',
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={streaming ? 'Generating...' : 'Describe a policy...'}
            disabled={streaming}
            style={{
              flex: 1, background: 'none', border: 'none',
              fontSize: 13, color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'var(--font-sans)',
            }}
          />
          {streaming ? (
            <button
              onClick={handleStop}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--deny)', fontSize: 11, fontWeight: 600,
                fontFamily: 'var(--font-mono)',
              }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              style={{
                background: 'none', border: 'none',
                color: input.trim() ? 'var(--accent)' : 'var(--text-muted)',
                cursor: input.trim() ? 'pointer' : 'default',
                opacity: input.trim() ? 1 : 0.4,
              }}
            >
              <Send />
            </button>
          )}
        </div>
        <div style={{ marginTop: 6, textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Claude (Anthropic)
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
      `}</style>
    </div>
  );
}

/** Renders assistant messages with basic code block support */
function ChatContent({ content }: { content: string }) {
  if (!content) return null;

  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const lines = part.split('\n');
          const lang = lines[0].replace('```', '').trim();
          const code = lines.slice(1, -1).join('\n');
          return (
            <div key={i} style={{ margin: '8px 0' }}>
              {lang && (
                <div style={{
                  fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.8px',
                  marginBottom: 4,
                }}>
                  {lang}
                </div>
              )}
              <pre style={{
                background: 'var(--surface)',
                boxShadow: 'var(--neu-surface-inset-sm)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                overflowX: 'auto',
              }}>
                {code}
              </pre>
            </div>
          );
        }

        // Render inline `code` backticks
        const inlineParts = part.split(/(`[^`]+`)/g);
        return (
          <span key={i}>
            {inlineParts.map((ip, j) => {
              if (ip.startsWith('`') && ip.endsWith('`')) {
                return (
                  <code key={j} style={{
                    background: 'var(--surface)',
                    boxShadow: 'var(--neu-surface-inset-sm)',
                    padding: '1px 5px', borderRadius: 3,
                    fontSize: '0.9em', fontFamily: 'var(--font-mono)',
                  }}>
                    {ip.slice(1, -1)}
                  </code>
                );
              }

              // Bold text
              const boldParts = ip.split(/(\*\*[^*]+\*\*)/g);
              return (
                <span key={j}>
                  {boldParts.map((bp, k) => {
                    if (bp.startsWith('**') && bp.endsWith('**')) {
                      return <strong key={k}>{bp.slice(2, -2)}</strong>;
                    }
                    return bp;
                  })}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}
