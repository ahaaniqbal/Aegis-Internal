'use client';

import { useState, useCallback, useEffect } from 'react';
import { Layers, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import { Session, SessionAction } from '@/lib/types';
import { formatRelativeTime, formatDuration } from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import DecisionBadge from '@/components/ui/DecisionBadge';
import AgentAvatar from '@/components/ui/AgentAvatar';
import JsonViewer from '@/components/ui/JsonViewer';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Link from 'next/link';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const { user, isLoading: userLoading } = useUser();

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      if (!userLoading) {
        setSessions([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const data = await api.getSessions(user?.id);
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [user?.id, userLoading]);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    } else if (!userLoading) {
      setSessions([]);
      setLoading(false);
    }
  }, [user?.id, userLoading, fetchData]);

  const { lastUpdated } = useAutoRefresh(fetchData, 30000);

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
        title="Sessions"
        subtitle="Agent working sessions"
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
      />
      <div className="p-6">
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="rounded-md border border-border bg-card">
            <EmptyState
              icon={<Layers className="h-6 w-6" />}
              title="No sessions yet"
              description="Sessions will appear here once your agent starts working."
            />
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <SessionCard
                key={session.session_id}
                session={session}
                userId={user?.id}
                isExpanded={expandedSession === session.session_id}
                onToggle={() =>
                  setExpandedSession(
                    expandedSession === session.session_id ? null : session.session_id
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionCard({
  session,
  userId,
  isExpanded,
  onToggle,
}: {
  session: Session;
  userId?: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [actions, setActions] = useState<SessionAction[] | null>(null);
  const [loadingActions, setLoadingActions] = useState(false);

  const handleToggle = async () => {
    onToggle();
    if (!isExpanded && !actions) {
      setLoadingActions(true);
      try {
        const data = await api.getSessionActions(session.session_id, userId);
        setActions(data);
      } catch {
        setActions([]);
      } finally {
        setLoadingActions(false);
      }
    }
  };

  const repos = Array.isArray(session.repos) ? session.repos.filter(Boolean) : [];

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <button onClick={handleToggle} className="w-full px-4 py-3 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AgentAvatar name={session.agent_name || ''} size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{session.agent_name}</span>
                <code className="text-xs text-muted-foreground">
                  {session.session_id?.substring(0, 8)}...
                </code>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(session.started_at)}
                </span>
                <span>{session.action_count} actions</span>
                {repos.length > 0 && <span>{repos.join(', ')}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs">
              {Number(session.allows) > 0 && (
                <span className="text-accent">{session.allows} allow</span>
              )}
              {Number(session.denies) > 0 && (
                <span className="text-destructive">{session.denies} deny</span>
              )}
              {Number(session.rewrites) > 0 && (
                <span className="text-amber-400">{session.rewrites} rewrite</span>
              )}
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border bg-muted/30 px-4 py-4">
          {loadingActions ? (
            <div className="flex justify-center py-6">
              <LoadingSpinner />
            </div>
          ) : actions && actions.length > 0 ? (
            <>
              <div className="space-y-3">
                {actions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-start justify-between rounded-md border border-border bg-card p-3"
                  >
                    <div>
                      <p className="text-sm text-foreground">{action.action_summary}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="text-xs text-muted-foreground">{action.tool_name}</code>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(action.timestamp)}
                        </span>
                      </div>
                      {action.arguments && Object.keys(action.arguments).length > 0 && (
                        <div className="mt-2">
                          <JsonViewer data={action.arguments} />
                        </div>
                      )}
                    </div>
                    <DecisionBadge decision={action.decision} size="sm" />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Duration: {formatDuration(session.started_at, session.last_action_at)}
                </span>
                <Link
                  href={`/dashboard?session=${session.session_id}`}
                  className="text-accent hover:underline"
                >
                  View all runs
                </Link>
              </div>
            </>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No actions found.</p>
          )}
        </div>
      )}
    </div>
  );
}
