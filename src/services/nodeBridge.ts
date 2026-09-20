/**
 * Safe Node.js bridge for Adobe CEP (Common Extensibility Platform)
 * Ensures compatibility across CEP versions (10, 11, 12, 13, 14+)
 * whether Node is exposed via window.require, window.cep_node.require, or global require.
 */

export function getNodeRequire(): any {
  if (typeof window !== 'undefined') {
    const w = window as any;
    if (typeof w.require === 'function') return w.require;
    if (w.cep_node && typeof w.cep_node.require === 'function') return w.cep_node.require;
  }
  try {
    if (typeof require === 'function') return require;
  } catch {}
  try {
    const r = (globalThis as any).require;
    if (typeof r === 'function') return r;
  } catch {}
  try {
    // Indirect eval to access global require without Vite/Rollup rewriting
    const req = (0, eval)('require');
    if (typeof req === 'function') return req;
  } catch {}
  return null;
}

export function getNodeModule<T = any>(moduleName: string): T | null {
  const req = getNodeRequire();
  if (req) {
    try {
      return req(moduleName) as T;
    } catch (e) {
      console.warn(`Failed to require('${moduleName}'):`, e);
    }
  }
  return null;
}

export function getNodeFs(): any {
  return getNodeModule('fs');
}

export function getNodePath(): any {
  return getNodeModule('path');
}

export function getNodeChildProcess(): any {
  return getNodeModule('child_process');
}

export function isNodeAvailable(): boolean {
  return !!(getNodeFs() && getNodePath());
}
