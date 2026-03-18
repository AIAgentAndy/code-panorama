import { useCallback, useEffect, useRef, useState } from 'react';

type DiagnosticPayload = Record<string, unknown>;

export type DevDiagnosticEntry = {
  id: string;
  at: string;
  type: string;
  message: string;
  payload?: DiagnosticPayload;
};

type UseDevRefreshDiagnosticsOptions = {
  component: string;
  getSnapshot?: () => DiagnosticPayload;
};

const STORAGE_KEY = 'code-panorama-dev-diagnostics';
const MAX_ENTRIES = 40;

function isDevEnvironment() {
  return process.env.NODE_ENV !== 'production';
}

function readEntries(): DevDiagnosticEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: DevDiagnosticEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // ignore storage errors
  }
}

function getNavigationType() {
  if (typeof window === 'undefined') return 'unknown';
  try {
    const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return entry?.type || 'unknown';
  } catch {
    return 'unknown';
  }
}

function buildEntry(type: string, message: string, payload?: DiagnosticPayload): DevDiagnosticEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    type,
    message,
    payload,
  };
}

function persistEntry(entry: DevDiagnosticEntry) {
  const next = [...readEntries(), entry].slice(-MAX_ENTRIES);
  writeEntries(next);
  console.debug('[dev-diagnostics]', entry);
  return next;
}

export function useDevRefreshDiagnostics(options: UseDevRefreshDiagnosticsOptions) {
  const [entries, setEntries] = useState<DevDiagnosticEntry[]>([]);
  const enabled = isDevEnvironment();
  const mountedRef = useRef(false);
  const componentRef = useRef(options.component);
  const getSnapshotRef = useRef(options.getSnapshot);

  componentRef.current = options.component;
  getSnapshotRef.current = options.getSnapshot;

  const append = useCallback((type: string, message: string, payload?: DiagnosticPayload) => {
    if (!enabled || typeof window === 'undefined') return;
    const next = persistEntry(buildEntry(type, message, payload));
    if (mountedRef.current) {
      setEntries(next);
    }
  }, [enabled]);

  const clear = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    setEntries([]);
    console.debug('[dev-diagnostics] cleared');
  }, [enabled]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    mountedRef.current = true;
    const existing = readEntries();
    setEntries(existing);

    append('mount', `${componentRef.current} mounted`, {
      navigationType: getNavigationType(),
      referrer: document.referrer || '',
      ...getSnapshotRef.current?.(),
    });

    const handleVisibilityChange = () => {
      append('visibilitychange', `document visibility=${document.visibilityState}`, getSnapshotRef.current?.());
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      append('pageshow', `pageshow persisted=${event.persisted ? 'true' : 'false'}`, {
        navigationType: getNavigationType(),
        persisted: event.persisted,
        ...getSnapshotRef.current?.(),
      });
    };

    const handlePageHide = (event: PageTransitionEvent) => {
      append('pagehide', `pagehide persisted=${event.persisted ? 'true' : 'false'}`, {
        persisted: event.persisted,
        ...getSnapshotRef.current?.(),
      });
    };

    const handleBeforeUnload = () => {
      append('beforeunload', 'beforeunload fired', getSnapshotRef.current?.());
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      mountedRef.current = false;
      persistEntry(buildEntry('unmount', `${componentRef.current} unmounted`, getSnapshotRef.current?.()));
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [append, enabled]);

  return {
    enabled,
    entries,
    append,
    clear,
  };
}
