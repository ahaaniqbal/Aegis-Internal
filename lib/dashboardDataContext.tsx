'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, invalidateCache } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import type {
  AggregatedSessionAction,
  Metrics,
  PaginatedResponse,
  SessionAction,
} from '@/lib/types';

const PAGE_SIZE = 20;
/** Skip new network requests when re-opening a dashboard route shortly after the last fetch. */
const NAV_STALE_MS = 15_000;
const REFRESH_INTERVAL_MS = 30_000;

const EMPTY_AGG: PaginatedResponse<AggregatedSessionAction> = {
  items: [],
  total: 0,
  page: 1,
  page_size: PAGE_SIZE,
  pages: 0,
};

function sortActions(items: SessionAction[]): SessionAction[] {
  return [...items].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

function mergeById(prev: SessionAction[], incoming: SessionAction[]): SessionAction[] {
  const map = new Map<string, SessionAction>();
  for (const r of prev) map.set(r.id, r);
  for (const r of incoming) map.set(r.id, r);
  return sortActions(Array.from(map.values()));
}

type ActionsMeta = { total: number; pages: number; page_size: number };

export type DashboardDataContextValue = {
  sessionActions: SessionAction[];
  actionsMeta: ActionsMeta | null;
  runsLoading: boolean;
  runsLoadingMore: boolean;
  runsError: string | null;
  dismissRunsError: () => void;
  hasMoreRuns: boolean;
  loadMoreRuns: () => Promise<void>;
  /** Full refresh: reset runs to page 1, bust server cache, clear aggregated cache. */
  refreshRuns: () => Promise<void>;
  metrics: Metrics;
  lastUpdated: Date;
  /** Bumps when a timed refresh runs so /sessions can refetch. */
  globalDataEpoch: number;
  fetchAggregatedPage: (
    page: number,
    options?: { force?: boolean },
  ) => Promise<PaginatedResponse<AggregatedSessionAction>>;
};

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: userLoading } = useUser();

  const [sessionActions, setSessionActions] = useState<SessionAction[]>([]);
  const [actionsMeta, setActionsMeta] = useState<ActionsMeta | null>(null);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(() => new Set());
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsLoadingMore, setRunsLoadingMore] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [globalDataEpoch, setGlobalDataEpoch] = useState(0);

  const sessionActionsRef = useRef<SessionAction[]>([]);
  const loadedPagesRef = useRef<Set<number>>(new Set());
  const aggregatedCacheRef = useRef<
    Map<number, { at: number; data: PaginatedResponse<AggregatedSessionAction> }>
  >(new Map());
  const [metrics, setMetrics] = useState<Metrics>({
    total: 0,
    allows: 0,
    denies: 0,
    rewrites: 0,
    approvals: 0,
  });

  useEffect(() => {
    sessionActionsRef.current = sessionActions;
  }, [sessionActions]);

  useEffect(() => {
    loadedPagesRef.current = loadedPages;
  }, [loadedPages]);

  const resetForUserChange = useCallback(() => {
    invalidateCache();
    setSessionActions([]);
    setActionsMeta(null);
    setLoadedPages(new Set());
    loadedPagesRef.current = new Set();
    sessionActionsRef.current = [];
    aggregatedCacheRef.current.clear();
    setRunsError(null);
    setGlobalDataEpoch(0);
  }, []);

  const userIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const id = user?.id;
    if (id !== userIdRef.current) {
      const prev = userIdRef.current;
      userIdRef.current = id;
      if ((prev !== undefined && id !== prev) || id === undefined) {
        resetForUserChange();
      }
    }
  }, [user?.id, resetForUserChange]);

  const replaceRunsWithPage1 = useCallback(
    async (options: { bustHttpCache?: boolean } = {}) => {
      if (!user?.id) return;
      setRunsLoading(true);
      setRunsError(null);
      try {
        if (options.bustHttpCache) invalidateCache(user.id);
        const [res, metricsRes] = await Promise.all([
          api.getSessionActionsPage(user.id, 1, PAGE_SIZE),
          api.getMetrics(user.id),
        ]);

        setSessionActions(sortActions(res.items));
        setMetrics(metricsRes);
        setSessionActions(sortActions(res.items));
        const nextLoaded = new Set([1]);
        setLoadedPages(nextLoaded);
        loadedPagesRef.current = nextLoaded;
        setActionsMeta({
          total: res.total,
          pages: res.pages,
          page_size: res.page_size,
        });
        setLastUpdated(new Date());
      } catch (err) {
        setRunsError(err instanceof Error ? err.message : 'Failed to load runs');
      } finally {
        setRunsLoading(false);
      }
    },
    [user?.id],
  );

  const syncRunsFromServer = useCallback(async () => {
    if (!user?.id) return;
    invalidateCache(user.id);
    aggregatedCacheRef.current.clear();
    try {
      const [res, metricsRes] = await Promise.all([
        api.getSessionActionsPage(user.id, 1, PAGE_SIZE),
        api.getMetrics(user.id),
      ]);

      setSessionActions(sortActions(res.items));
      setMetrics(metricsRes);
      const nextLoaded = new Set([1]);
      setLoadedPages(nextLoaded);
      loadedPagesRef.current = nextLoaded;
      setActionsMeta({
        total: res.total,
        pages: res.pages,
        page_size: res.page_size,
      });
      setLastUpdated(new Date());
      setRunsError(null);
      setGlobalDataEpoch((e) => e + 1);
    } catch (err) {
      setRunsError(err instanceof Error ? err.message : 'Failed to refresh runs');
    }
  }, [user?.id]);

  const ensureRunsInitial = useCallback(async () => {
    if (!user?.id) return;
    if (sessionActionsRef.current.length > 0) return;
    await replaceRunsWithPage1({ bustHttpCache: false });
  }, [user?.id, replaceRunsWithPage1]);

  useEffect(() => {
    if (!user?.id || userLoading) return;
    void ensureRunsInitial();
  }, [user?.id, userLoading, ensureRunsInitial]);

  useEffect(() => {
    if (!user?.id) return;
    const tick = setInterval(() => {
      void syncRunsFromServer();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(tick);
  }, [user?.id, syncRunsFromServer]);

  const loadMoreRuns = useCallback(async () => {
    if (!user?.id || !actionsMeta) return;
    const pagesLoaded = loadedPagesRef.current;
    if (pagesLoaded.size === 0) return;
    const nextPage = Math.max(...pagesLoaded) + 1;
    if (nextPage > actionsMeta.pages) return;

    setRunsLoadingMore(true);
    setRunsError(null);
    try {
      const res = await api.getSessionActionsPage(user.id, nextPage, PAGE_SIZE);
      setSessionActions((prev) => mergeById(prev, res.items));
      setLoadedPages((p) => {
        const n = new Set(p);
        n.add(nextPage);
        loadedPagesRef.current = n;
        return n;
      });
    } catch (err) {
      setRunsError(err instanceof Error ? err.message : 'Failed to load more runs');
    } finally {
      setRunsLoadingMore(false);
    }
  }, [user?.id, actionsMeta]);

  const fetchAggregatedPage = useCallback(
    async (page: number, options?: { force?: boolean }) => {
      if (!user?.id) return EMPTY_AGG;
      const now = Date.now();
      const hit = aggregatedCacheRef.current.get(page);
      if (!options?.force && hit && now - hit.at < NAV_STALE_MS) {
        return hit.data;
      }
      const data = await api.getAggregatedSessions(user.id, page, PAGE_SIZE);
      aggregatedCacheRef.current.set(page, { at: Date.now(), data });
      return data;
    },
    [user?.id],
  );

  const hasMoreRuns =
    !!actionsMeta && sessionActions.length < actionsMeta.total;

  const dismissRunsError = useCallback(() => setRunsError(null), []);

  const value = useMemo(
    (): DashboardDataContextValue => ({
      sessionActions,
      actionsMeta,
      runsLoading,
      runsLoadingMore,
      runsError,
      dismissRunsError,
      hasMoreRuns,
      loadMoreRuns,
      refreshRuns: syncRunsFromServer,
      metrics,
      lastUpdated,
      globalDataEpoch,
      fetchAggregatedPage,
    }),
    [
      sessionActions,
      actionsMeta,
      runsLoading,
      runsLoadingMore,
      runsError,
      dismissRunsError,
      hasMoreRuns,
      loadMoreRuns,
      syncRunsFromServer,
      metrics,
      lastUpdated,
      globalDataEpoch,
      fetchAggregatedPage,
    ],
  );

  return (
    <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
  );
}

export function useDashboardData(): DashboardDataContextValue {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error('useDashboardData must be used within DashboardDataProvider');
  }
  return ctx;
}