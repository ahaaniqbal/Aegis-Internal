'use client';

import { useState, useCallback, useEffect } from 'react';
import { Activity, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useUser, useAutoRefresh } from '@/lib/hooks';
import { SessionAction, Metrics } from '@/lib/types';
import { formatRelativeTime, formatFullTimestamp, truncate } from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import MetricCard from '@/components/ui/MetricCard';
import DecisionBadge from '@/components/ui/DecisionBadge';
import AgentAvatar from '@/components/ui/AgentAvatar';
import JsonViewer from '@/components/ui/JsonViewer';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, isLoading: userLoading } = useUser();
  const [runs, setRuns] = useState<SessionAction[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ total: 0, allows: 0, denies: 0, rewrites: 0, approvals: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const [runsData, metricsData] = await Promise.all([
        api.getRuns(user.id),
        api.getMetrics(user.id),
      ]);
      setRuns(runsData);
      setMetrics(metricsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to backend');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [user?.id, userLoading]);

  const { lastUpdated } = useAutoRefresh(fetchData, 30000);

  const filteredRuns = runs.filter((run) => {
    const matchesSearch =
      !search ||
      run.agent_name?.toLowerCase().includes(search.toLowerCase()) ||
      run.tool_name?.toLowerCase().includes(search.toLowerCase()) ||
      run.target_repo?.toLowerCase().includes(search.toLowerCase()) ||
      run.action_summary?.toLowerCase().includes(search.toLowerCase());

    const matchesDecision =
      decisionFilter === 'all' ||
      (decisionFilter === 'approval'
        ? run.decision?.toUpperCase().includes('APPROVAL')
        : run.decision?.toUpperCase() === decisionFilter.toUpperCase());

    return matchesSearch && matchesDecision;
  });

  if (userLoading || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Topbar
        title="Runs"
        subtitle="Real-time agent activity"
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
      />

      <div className="p-6">
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
          </div>
        )}

        {/* Metrics */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard label="Total Runs" value={metrics.total} />
          <MetricCard label="Allowed" value={metrics.allows} variant="allow" />
          <MetricCard label="Denied" value={metrics.denies} variant="deny" />
          <MetricCard label="Rewritten" value={metrics.rewrites} variant="rewrite" />
          <MetricCard label="Approvals" value={metrics.approvals} variant="approval" />
        </div>

        {runs.length === 0 ? (
          <div className="rounded-md border border-border bg-card">
            <EmptyState
              icon={<Activity className="h-6 w-6" />}
              title="No agent actions yet"
              description="Connect your agent to start monitoring actions."
              action={
                <Link
                  href="/onboarding"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:bg-foreground/90"
                >
                  Set up agent
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border bg-card">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search runs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-background py-1.5 pl-9 pr-3 text-sm placeholder:text-muted-foreground"
                />
              </div>
              <select
                value={decisionFilter}
                onChange={(e) => setDecisionFilter(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="all">All decisions</option>
                <option value="ALLOW">Allow</option>
                <option value="DENY">Deny</option>
                <option value="REWRITE">Rewrite</option>
                <option value="approval">Approval</option>
              </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Agent</th>
                    <th className="px-4 py-3 font-medium">Tool</th>
                    <th className="px-4 py-3 font-medium">Summary</th>
                    <th className="px-4 py-3 font-medium">Repository</th>
                    <th className="px-4 py-3 font-medium">Branch</th>
                    <th className="px-4 py-3 font-medium">Decision</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((run) => (
                    <RunRow
                      key={run.id}
                      run={run}
                      isExpanded={expandedRow === run.id}
                      onToggle={() => setExpandedRow(expandedRow === run.id ? null : run.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {filteredRuns.length === 0 && search && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No runs match your search.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RunRow({
  run,
  isExpanded,
  onToggle,
}: {
  run: SessionAction;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-border transition-colors hover:bg-muted/30"
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <AgentAvatar name={run.agent_name || ''} size="sm" />
            <span className="font-medium text-foreground">{run.agent_name}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {run.tool_name}
          </code>
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {truncate(run.action_summary, 40)}
        </td>
        <td className="px-4 py-3 text-muted-foreground">{run.target_repo}</td>
        <td className="px-4 py-3">
          {run.target_branch && (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {run.target_branch}
            </code>
          )}
        </td>
        <td className="px-4 py-3">
          <DecisionBadge decision={run.decision} size="sm" />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-xs">{formatRelativeTime(run.timestamp)}</span>
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="border-b border-border bg-muted/20 px-4 py-4">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Full Summary</p>
                <p className="text-sm text-foreground">{run.action_summary}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Sequence</p>
                  <p className="font-mono text-foreground">#{run.sequence_order}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Session</p>
                  <Link
                    href={`/dashboard/sessions?id=${run.session_id}`}
                    className="font-mono text-accent hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {run.session_id?.substring(0, 8)}...
                  </Link>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Timestamp</p>
                  <p className="text-foreground">{formatFullTimestamp(run.timestamp)}</p>
                </div>
              </div>
            </div>
            {run.arguments && (
              <div className="mt-4">
                <p className="mb-2 text-xs text-muted-foreground">Arguments</p>
                <JsonViewer data={run.arguments} collapsed={false} />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
