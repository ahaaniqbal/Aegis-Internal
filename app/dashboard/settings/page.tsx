'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Shield, GitBranch, RefreshCw, Check, ExternalLink } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { api } from '@/lib/api';
import { useUser, useOnboardingStep } from '@/lib/hooks';
import { Repo } from '@/lib/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorBanner from '@/components/ui/ErrorBanner';

export default function SettingsPage() {
  const { user, setUser } = useUser();
  const { setStep } = useOnboardingStep();
  const [activeTab, setActiveTab] = useState('profile');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [originalRepos, setOriginalRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [token, setToken] = useState(user?.access_token || '');

  const fetchRepos = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await api.getRepos(user.id);
      const reposList = response?.repos || [];
      setRepos(reposList);
      setOriginalRepos(JSON.parse(JSON.stringify(reposList)));
    } catch { /* ignore */ }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
      setToken(user.access_token || '');
      fetchRepos();
    }
  }, [user, fetchRepos]);

  const handleSaveProfile = async () => {
    if (!user?.github_user_id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.saveUser({ github_user_id: user.github_user_id, username, email, github_pat: token });
      setUser(updated);
      setSuccess('Profile updated');
    } catch {
      setError('Failed to update profile');
    }
    setSaving(false);
  };

  const handleSyncRepos = async () => {
    if (!user?.github_user_id || !user?.access_token) return;
    setSyncing(true);
    setError(null);
    try {
      await api.syncRepos(user.github_user_id, user.access_token);
      await fetchRepos();
      setSuccess('Repositories synced');
    } catch {
      setError('Failed to sync');
    }
    setSyncing(false);
  };

  const handleSetPermission = (index: number, permission: 'read' | 'write') => {
    setRepos((prev) =>
      prev.map((r, i) => {
        if (i === index) {
          if (permission === 'read') {
            const newCanRead = !r.can_read;
            // If disabling read, also disable write
            if (!newCanRead) {
              return { ...r, can_read: newCanRead, can_write: false };
            }
            return { ...r, can_read: newCanRead };
          } else {
            return { ...r, can_write: !r.can_write };
          }
        }
        return r;
      })
    );
  };

  const handleSavePermissions = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    const userId = user.id;
    try {
      // Find changed permissions
      const changedPerms = repos.filter((repo, i) => {
        const original = originalRepos[i];
        return original && (original.can_read !== repo.can_read || original.can_write !== repo.can_write);
      });

      // Call individual endpoint for each changed permission
      const results = await Promise.all(
        changedPerms.map((repo) =>
          api.setPermission(userId, repo.github_repo_id, repo.can_read || false, repo.can_write || false)
        )
      );

      // Check if all succeeded
      if (results.every((r) => r.success)) {
        setOriginalRepos(JSON.parse(JSON.stringify(repos)));
        setSuccess('Permissions saved');
      } else {
        setError('Some permissions failed to save');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions');
    }
    setSaving(false);
  };

  const getPermissionLabel = (repo: Repo): { canRead: boolean; canWrite: boolean } => {
    return {
      canRead: repo.can_read || false,
      canWrite: repo.can_write || false,
    };
  };

  const permOptions: Array<{ value: 'read' | 'write'; label: string }> = [
    { value: 'read', label: 'Read' },
    { value: 'write', label: 'Write' },
  ];

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'repos', label: 'Repositories', icon: GitBranch },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="min-h-screen">
      <Topbar title="Settings" subtitle="Manage your account" />
      <div className="p-6">
        {error && <div className="mb-4"><ErrorBanner message={error} onDismiss={() => setError(null)} /></div>}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-success/20 bg-success/10 px-3 py-2 text-sm text-success">
            <Check className="h-4 w-4" />
            {success}
          </div>
        )}

        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="w-full shrink-0 sm:w-48">
            <div className="flex gap-1 sm:flex-col sm:space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm ${
                      activeTab === tab.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1">
            {activeTab === 'profile' && (
              <div className="rounded-md border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-medium text-foreground">Profile Settings</h2>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">GitHub Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-foreground/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-foreground/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">GitHub User ID</label>
                    <input type="text" value={String(user?.github_user_id || '')} disabled className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Personal Access Token</label>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-foreground/40 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
                    >
                      {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'repos' && (
              <div className="rounded-md border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h2 className="text-sm font-medium text-foreground">Repository Permissions</h2>
                  <button
                    onClick={handleSyncRepos}
                    disabled={syncing}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    Sync
                  </button>
                </div>
                <div className="p-4">
                  {loading ? (
                    <div className="flex justify-center py-8"><LoadingSpinner /></div>
                  ) : repos.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No repositories synced.</p>
                  ) : (
                    <>
                      <div className="max-h-80 space-y-2 overflow-y-auto">
                        {repos.map((repo, i) => (
                          <div key={repo.full_name} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                            <span className="text-sm text-foreground">{repo.full_name}</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSetPermission(i, 'read')}
                                className={`px-2 py-1 text-xs font-medium rounded ${
                                  repos[i].can_read
                                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                                    : 'bg-card text-muted-foreground hover:bg-muted border border-border'
                                }`}
                              >
                                Read
                              </button>
                              <button
                                onClick={() => handleSetPermission(i, 'write')}
                                disabled={!repos[i].can_read}
                                className={`px-2 py-1 text-xs font-medium rounded ${
                                  repos[i].can_write
                                    ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                                    : repos[i].can_read
                                    ? 'bg-card text-muted-foreground hover:bg-muted border border-border'
                                    : 'bg-muted/50 text-muted-foreground cursor-not-allowed border border-muted'
                                }`}
                              >
                                Write
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={handleSavePermissions}
                          disabled={saving}
                        className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
                        >
                          {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                          Save
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-4">
                <div className="rounded-md border border-border bg-card">
                  <div className="border-b border-border px-4 py-3">
                    <h2 className="text-sm font-medium text-foreground">Active Policies</h2>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {['Protected Branch Denial', 'Freeze Window Enforcement', 'Mandatory PR Flow', 'Secret Detection'].map((policy) => (
                        <div key={policy} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                          <Check className="h-4 w-4 text-success" />
                          {policy}
                        </div>
                      ))}
                    </div>
                    <a href="/dashboard/policies" className="mt-3 inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground transition-colors">
                      Manage policies <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="rounded-md border border-destructive/20 bg-destructive/5">
                  <div className="border-b border-destructive/20 px-4 py-3">
                    <h2 className="text-sm font-medium text-destructive">Danger Zone</h2>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Reset Onboarding</p>
                        <p className="text-xs text-muted-foreground">Start setup again from scratch</p>
                      </div>
                      <button
                        onClick={() => { setStep(1); window.location.href = '/onboarding'; }}
                        className="rounded-md border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
