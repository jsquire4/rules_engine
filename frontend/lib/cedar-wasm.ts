/**
 * Cedar WASM Comlink wrapper
 *
 * Creates a Web Worker running cedar-worker.ts and exposes typed async
 * functions for React components to call. The worker is created lazily
 * on first use and shared across all callers.
 */
import { wrap, type Remote } from 'comlink';
import type { CedarWorkerAPI } from './cedar-worker';

let worker: Remote<CedarWorkerAPI> | null = null;

function getWorker(): Remote<CedarWorkerAPI> {
  if (!worker) {
    const raw = new Worker(new URL('./cedar-worker.ts', import.meta.url), {
      type: 'module',
    });
    worker = wrap<CedarWorkerAPI>(raw);
  }
  return worker;
}

/**
 * Validate Cedar policy source for syntax errors.
 * Uses WASM when available, falls back to heuristic checks.
 */
export async function validatePolicy(
  source: string,
): Promise<{ valid: boolean; errors: string[] }> {
  return getWorker().validatePolicy(source);
}

/**
 * Evaluate a Cedar policy against a request.
 * Uses WASM when available, falls back to HTTP /engine/check.
 */
export async function evaluatePolicy(
  policySource: string,
  principal: string,
  action: string,
  resource: string,
  context: object = {},
  entities: object[] = [],
): Promise<{ decision: string; diagnostics: string[] }> {
  return getWorker().evaluatePolicy(
    policySource,
    principal,
    action,
    resource,
    context,
    entities,
  );
}
