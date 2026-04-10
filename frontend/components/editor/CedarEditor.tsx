'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import { validatePolicy } from '@/lib/cedar-wasm';

// Cedar language ID for Monaco registration
const CEDAR_LANG_ID = 'cedar';

interface CedarEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  height?: string;
}

interface ValidationStatus {
  valid: boolean;
  errors: string[];
  checking: boolean;
}

/**
 * Register the Cedar language with Monaco's tokenizer.
 *
 * Token colors are mapped to match the app's existing highlightCedar()
 * color scheme via a custom theme defined alongside the language.
 */
const registerCedarLanguage: BeforeMount = (monaco) => {
  // Only register once
  if (monaco.languages.getLanguages().some((l: { id: string }) => l.id === CEDAR_LANG_ID)) return;

  monaco.languages.register({ id: CEDAR_LANG_ID });

  monaco.languages.setMonarchTokensProvider(CEDAR_LANG_ID, {
    keywords: [
      'permit', 'forbid', 'when', 'unless', 'in',
      'true', 'false', 'if', 'then', 'else', 'like', 'has', 'is',
    ],
    builtins: [
      'principal', 'action', 'resource', 'context',
    ],
    operators: [
      '&&', '||', '==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '.',
    ],
    tokenizer: {
      root: [
        // Comments
        [/\/\/.*$/, 'comment'],

        // Entity references: Type::"id"
        [/[A-Z][A-Za-z0-9_]*::"[^"]*"/, 'entity'],

        // Strings
        [/"(?:[^"\\]|\\.)*"/, 'string'],

        // Numbers
        [/\b\d+\b/, 'number'],

        // Keywords and builtins
        [/[a-zA-Z_]\w*/, {
          cases: {
            '@keywords': 'keyword',
            '@builtins': 'builtin',
            '@default': 'identifier',
          },
        }],

        // Operators
        [/[{}()[\]]/, 'delimiter.bracket'],
        [/[;,]/, 'delimiter'],
        [/&&|\|\||==|!=|<=|>=|<|>|\+|-|\*|\./, 'operator'],
      ],
    },
  });

  // Custom theme matching the app's neumorphic design
  // Colors extracted from globals.css cedar-* classes
  monaco.editor.defineTheme('cedar-neumorphic', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '1b4f8a', fontStyle: 'bold' },     // .cedar-keyword
      { token: 'builtin', foreground: '2563eb' },                         // .cedar-entity (var(--info))
      { token: 'entity', foreground: '2563eb' },                          // .cedar-entity
      { token: 'string', foreground: '6d28d9' },                          // .cedar-string (var(--purple))
      { token: 'number', foreground: 'c2410c' },                          // .cedar-number (var(--orange))
      { token: 'operator', foreground: '808d9f' },                        // .cedar-operator (var(--text-muted))
      { token: 'comment', foreground: '808d9f', fontStyle: 'italic' },    // .cedar-comment
      { token: 'delimiter.bracket', foreground: '3d4a5c' },
      { token: 'delimiter', foreground: '3d4a5c' },
      { token: 'identifier', foreground: '1e2734' },                      // var(--text-primary)
    ],
    colors: {
      'editor.background': '#eaeef3',                          // var(--surface-high)
      'editor.foreground': '#1e2734',                          // var(--text-primary)
      'editor.lineHighlightBackground': '#e2e6ec',            // var(--surface)
      'editor.selectionBackground': '#1b365d30',               // var(--accent) with alpha
      'editorLineNumber.foreground': '#808d9f',                // var(--text-muted)
      'editorLineNumber.activeForeground': '#3d4a5c',          // var(--text-secondary)
      'editorCursor.foreground': '#1b365d',                    // var(--accent)
      'editor.inactiveSelectionBackground': '#1b365d15',
      'editorIndentGuide.background': '#a8aeb840',             // var(--shadow-dark) with alpha
      'editorWidget.background': '#e2e6ec',
      'editorWidget.border': '#a8aeb8',
      'editorSuggestWidget.background': '#e2e6ec',
      'editorSuggestWidget.border': '#a8aeb8',
      'editorSuggestWidget.selectedBackground': '#d0d5dc',
      'input.background': '#d0d5dc',
      'input.border': '#a8aeb8',
      'scrollbarSlider.background': '#a8aeb860',
      'scrollbarSlider.hoverBackground': '#a8aeb8a0',
    },
  });
};

export function CedarEditor({ value, onChange, readOnly = false, height = '400px' }: CedarEditorProps) {
  const [validation, setValidation] = useState<ValidationStatus>({
    valid: true,
    errors: [],
    checking: false,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  // Debounced validation via Cedar WASM worker
  const runValidation = useCallback((source: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValidation((prev) => ({ ...prev, checking: true }));

    debounceRef.current = setTimeout(async () => {
      if (!source.trim()) {
        setValidation({ valid: true, errors: [], checking: false });
        return;
      }
      try {
        const result = await validatePolicy(source);
        setValidation({ valid: result.valid, errors: result.errors, checking: false });
      } catch {
        setValidation({ valid: true, errors: [], checking: false });
      }
    }, 300);
  }, []);

  // Validate on initial load and value changes
  useEffect(() => {
    runValidation(value);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, runValidation]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleChange = (newValue: string | undefined) => {
    const v = newValue ?? '';
    onChange(v);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height={height}
          language={CEDAR_LANG_ID}
          theme="cedar-neumorphic"
          value={value}
          onChange={handleChange}
          onMount={handleEditorMount}
          beforeMount={registerCedarLanguage}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'IBM Plex Mono', 'SF Mono', monospace",
            lineHeight: 24, // ~1.8 line-height at 13px
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            renderLineHighlight: 'line',
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: false,
            wordWrap: 'on',
            automaticLayout: true,
            contextmenu: !readOnly,
            domReadOnly: readOnly,
          }}
        />
      </div>

      {/* Validation status bar */}
      <div
        style={{
          padding: '6px 16px',
          borderTop: '1px solid rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          background: 'var(--surface)',
        }}
      >
        {validation.checking ? (
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Validating...</span>
        ) : validation.valid ? (
          <span
            style={{
              color: 'var(--permit)',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--permit)',
              }}
            />
            Valid
          </span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            <span
              style={{
                color: 'var(--deny)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--deny)',
                }}
              />
              Invalid
            </span>
            {validation.errors.length > 0 && (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--deny)',
                  maxHeight: 60,
                  overflow: 'auto',
                }}
              >
                {validation.errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
