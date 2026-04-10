/**
 * Cedar WASM Web Worker
 *
 * Loads @cedar-policy/cedar-wasm in a Web Worker context and exposes
 * policy validation and evaluation functions via Comlink.
 *
 * The worker uses the "web" build of cedar-wasm which is designed for
 * browser environments with manual WASM initialization.
 *
 * If WASM fails to load, the worker falls back to the HTTP /engine/check
 * endpoint for evaluation (validation returns a parse-only check).
 */
import * as Comlink from 'comlink';

// Dynamic import types — we load cedar-wasm at runtime
type CedarModule = typeof import('@cedar-policy/cedar-wasm/web');

let cedar: CedarModule | null = null;
let initPromise: Promise<void> | null = null;
let wasmAvailable = false;

async function ensureInit(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      // Import the web build which exposes an init() default export
      const mod = await import('@cedar-policy/cedar-wasm/web');
      // Initialize the WASM module. The web build requires calling the
      // default export (init) before any other function.
      await mod.default();
      cedar = mod;
      wasmAvailable = true;
    } catch (err) {
      console.warn('[cedar-worker] WASM init failed, using HTTP fallback:', err);
      wasmAvailable = false;
    }
  })();
  return initPromise;
}

export interface ValidateResult {
  valid: boolean;
  errors: string[];
}

export interface EvaluateResult {
  decision: string;
  diagnostics: string[];
}

const api = {
  async validatePolicy(source: string): Promise<ValidateResult> {
    await ensureInit();

    if (wasmAvailable && cedar) {
      // Use checkParsePolicySet for syntax validation (no schema needed)
      const result = cedar.checkParsePolicySet({
        staticPolicies: source,
      });

      if (result.type === 'success') {
        return { valid: true, errors: [] };
      } else {
        return {
          valid: false,
          errors: result.errors.map((e) => e.message),
        };
      }
    }

    // Fallback: basic syntax heuristic (the HTTP endpoint requires
    // full authorization context, so we can't use it for parse-only checks)
    const hasEffect = /\b(permit|forbid)\b/.test(source);
    const balanced =
      (source.match(/\(/g) || []).length === (source.match(/\)/g) || []).length &&
      (source.match(/\{/g) || []).length === (source.match(/\}/g) || []).length;
    if (!hasEffect) {
      return { valid: false, errors: ['Policy must contain "permit" or "forbid"'] };
    }
    if (!balanced) {
      return { valid: false, errors: ['Unbalanced brackets or parentheses'] };
    }
    return { valid: true, errors: [] };
  },

  async evaluatePolicy(
    policySource: string,
    principal: string,
    action: string,
    resource: string,
    context: object,
    entities: object[],
  ): Promise<EvaluateResult> {
    await ensureInit();

    if (wasmAvailable && cedar) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = cedar.isAuthorized({
        principal: parseEntityUid(principal),
        action: parseEntityUid(action),
        resource: parseEntityUid(resource),
        context: context as any,
        policies: { staticPolicies: policySource },
        entities: entities as any,
      });

      if (result.type === 'success') {
        return {
          decision: result.response.decision,
          diagnostics: [
            ...result.response.diagnostics.reason.map((r) => `satisfied: ${r}`),
            ...result.response.diagnostics.errors.map((e) => `error in ${e.policyId}: ${e.error.message}`),
          ],
        };
      } else {
        return {
          decision: 'error',
          diagnostics: result.errors.map((e) => e.message),
        };
      }
    }

    // Fallback: use the HTTP /engine/check endpoint
    try {
      const res = await fetch('/engine/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principal, action, resource, context }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        decision: data.decision || 'error',
        diagnostics: data.diagnostics || [],
      };
    } catch (err) {
      return {
        decision: 'error',
        diagnostics: [`HTTP fallback failed: ${(err as Error).message}`],
      };
    }
  },
};

/**
 * Parse a Cedar entity UID string like `Type::"id"` into the
 * { type, id } object expected by cedar-wasm.
 */
function parseEntityUid(uid: string): { type: string; id: string } {
  const match = uid.match(/^(.+)::"(.+)"$/);
  if (match) {
    return { type: match[1], id: match[2] };
  }
  // If it doesn't match the pattern, treat the whole string as the id
  // with a default type
  return { type: 'Unknown', id: uid };
}

export type CedarWorkerAPI = typeof api;

Comlink.expose(api);
