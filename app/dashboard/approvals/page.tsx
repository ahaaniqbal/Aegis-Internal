'use client';

import { useState, useCallback, useEffect } from 'react';
import { Bell, Clock, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import { MCPApproval } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import DecisionBadge from '@/components/ui/DecisionBadge';
import AgentAvatar from '@/components/ui/AgentAvatar';
import JsonViewer from '@/components/ui/JsonViewer';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

type ApprovalFilter = 'all' | 'pending' | 'approved' | 'rejected';

function normalizeStatus(status: string): 'pending' | 'approved' | 'rejected' {
  const value = status?.toLowerCase();
  if (value === 'approved' || value === 'rejected') return value;
  return 'pending';
}

export default function ApprovalsPage() {
  const { user, isLoading: userLoading } = useUser();
  const [approvals, setApprovals] = useState<MCPApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ApprovalFilter>('all');
  const [actioningIds, setActioningIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      if (!userLoading) {
        setApprovals([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const data = await api.getMcpApprovals(user.id);
      setApprovals(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [user?.id, userLoading]);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    } else if (!userLoading) {
      setApprovals([]);
      setLoading(false);
    }
  }, [user?.id, userLoading, fetchData]);

  const { lastUpdated } = useAutoRefresh(fetchData, 30000);

  const handleAction = async (id: string, reject: boolean) => {
    setActioningIds((prev) => new Set(prev).add(id));
    try {
      await api.executeMcpApproval(id, reject);
      setError(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update approval status');
    } finally {
      setActioningIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const counts = approvals.reduce(
    (acc, approval) => {
      const normalized = normalizeStatus(approval.status);
      acc[normalized] += 1;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0 }
  );

  const filteredApprovals = approvals.filter((approval) => {
    if (statusFilter === 'all') return true;
    return normalizeStatus(approval.status) === statusFilter;
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
      <Topbar title="Approvals" subtitle="Actions requiring review" lastUpdated={lastUpdated} onRefresh={fetchData} />
      <div className="p-6">
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-md border px-3 py-1.5 transition-colors ${
              statusFilter === 'all'
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            All ({approvals.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`rounded-md border px-3 py-1.5 transition-colors ${
              statusFilter === 'pending'
                ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Pending ({counts.pending})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`rounded-md border px-3 py-1.5 transition-colors ${
              statusFilter === 'approved'
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Approved ({counts.approved})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`rounded-md border px-3 py-1.5 transition-colors ${
              statusFilter === 'rejected'
                ? 'border-destructive bg-destructive/10 text-destructive'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Rejected ({counts.rejected})
          </button>
        </div>

        {counts.pending > 0 && (
          <div className="mb-4 text-sm text-muted-foreground">
            {counts.pending} pending approval{counts.pending !== 1 ? 's' : ''}
          </div>
        )}

        {filteredApprovals.length === 0 ? (
          <div className="rounded-md border border-border bg-card">
            <EmptyState
              icon={<Bell className="h-6 w-6" />}
              title="No approvals found"
              description="No approval requests match the selected status filter."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredApprovals.map((approval) => {
              const approvalStatus = normalizeStatus(approval.status);
              const isPending = approvalStatus === 'pending';
              const isActioning = actioningIds.has(approval.id);
              const contextUser =
                typeof approval.context?.user === 'string' ? approval.context.user : 'Agent';
              const repo =
                typeof approval.arguments?.repo === 'string' ? approval.arguments.repo : 'N/A';
              const summary =
                typeof approval.arguments?.message === 'string'
                  ? approval.arguments.message
                  : `Requested tool: ${approval.tool_name}`;

              return (
              <div key={approval.id} className="rounded-md border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <AgentAvatar name={contextUser} size="sm" />
                    <div>
                      <span className="text-sm font-medium text-foreground">{contextUser}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(approval.created_at)}
                      </div>
                    </div>
                  </div>
                  <DecisionBadge decision={approval.status} />
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Tool</p>
                      <code className="text-foreground">{approval.tool_name}</code>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Repository</p>
                      <p className="text-foreground">{repo}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Summary</p>
                      <p className="text-foreground">{summary}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Conversation</p>
                      <p className="text-foreground">{approval.context?.conversation_id || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Model</p>
                      <p className="text-foreground">{approval.context?.model || 'N/A'}</p>
                    </div>
                  </div>

                  {approval.arguments && (
                    <div className="mt-4">
                      <JsonViewer data={approval.arguments} />
                    </div>
                  )}

                  {approval.approved_at && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      Actioned {formatRelativeTime(approval.approved_at)}
                    </p>
                  )}

                  {isPending && (
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={() => handleAction(approval.id, false)}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(approval.id, true)}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
