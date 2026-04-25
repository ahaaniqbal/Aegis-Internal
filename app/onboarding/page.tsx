'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, RefreshCw, Check, ChevronRight, ChevronLeft, ExternalLink, Loader2, GitBranch, Key, Settings2, Plug, Rocket } from 'lucide-react';
import { api } from '@/lib/api';
import { useUser, useOnboardingStep } from '@/lib/hooks';
import { Repo } from '@/lib/types';
import CopyButton from '@/components/ui/CopyButton';
import { useEmail } from '@/lib/hooks';

// In any component:
const STEPS = [
  { number: 1, label: 'Connect', icon: GitBranch },
  { number: 2, label: 'Sync', icon: RefreshCw },
  { number: 3, label: 'Permissions', icon: Key },
  { number: 4, label: 'Agent', icon: Plug },
  { number: 5, label: 'Done', icon: Rocket },
];

function StepIndicator({ current }: { current: number }) {
  
  return (
    <div className="mb-10 flex items-center justify-center px-2">
      {STEPS.map((s, idx) => {
        const done = s.number < current;
        const active = s.number === current;
        const pending = s.number > current;
        const Icon = s.icon;

        return (
          <div key={s.number} className="flex items-center">
            {/* Node */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'relative flex h-9 w-9 items-center justify-center rounded-full border text-xs font-medium transition-all duration-300',
                  done ? 'border-foreground/30 bg-foreground text-background' : '',
                  active ? 'border-foreground/60 bg-foreground/10 text-foreground ring-4 ring-foreground/10' : '',
                  pending ? 'border-border bg-transparent text-muted-foreground' : '',
                ].join(' ')}
              >
                {done ? (
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <Icon className={`h-3.5 w-3.5 ${active ? 'opacity-100' : 'opacity-40'}`} />
                )}
              </div>
              <span
                className={[
                  'text-[10px] font-medium tracking-wide uppercase',
                  done ? 'text-muted-foreground' : '',
                  active ? 'text-foreground' : '',
                  pending ? 'text-muted-foreground/50' : '',
                ].join(' ')}
              >
                {s.label}
              </span>
            </div>

            {/* Connector */}
            {idx < STEPS.length - 1 && (
              <div className="relative mx-1 mb-5 h-px w-6 bg-border sm:mx-2 sm:w-12">
                <div
                  className="absolute inset-y-0 left-0 bg-foreground/40 transition-all duration-500"
                  style={{ width: s.number < current ? '100%' : '0%' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, setUser } = useUser();
  const { step, setStep } = useOnboardingStep();
const { email } = useEmail();

  const [username, setUsername] = useState(user?.username || '');
  const [githubId, setGithubId] = useState(String(user?.github_user_id || ''));
  const [token, setToken] = useState(user?.access_token || '');
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState('');

  const [repos, setRepos] = useState<Repo[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  const [activeTab, setActiveTab] = useState('claude');
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(false);

  const [actionCount, setActionCount] = useState(0);

  const handleStep1 = async () => {
    if (!username || !githubId || !token) { setStep1Error('All fields are required.'); return; }
    setStep1Loading(true);
    setStep1Error('');
    try {
      const githubUserIdNum = parseInt(githubId, 10);
      if (isNaN(githubUserIdNum)) { setStep1Error('GitHub User ID must be a number.'); setStep1Loading(false); return; }
      const response = await api.saveUser({ github_user_id: githubUserIdNum, username, github_pat: token , email }); //<-email
      setUser(response);
      setStep(2);
    } catch {
      setStep1Error('Failed to save. Please try again.');
    } finally {
      setStep1Loading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      if (!user?.github_user_id || !user?.access_token) throw new Error('User not initialized');
      const syncResponse = await api.syncRepos(user.github_user_id, user.access_token);
      if (!syncResponse.success) throw new Error(syncResponse.message || 'Sync failed');
      const reposResponse = await api.getRepos(user.id || '');
      if (reposResponse?.repos && Array.isArray(reposResponse.repos)) setRepos(reposResponse.repos);
      setSynced(true);
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleSetPermission = (index: number, permission: 'allow' | 'deny' | 'require_approval') => {
    setRepos((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        if (permission === 'allow') return { ...r, can_read: true, can_write: true };
        if (permission === 'require_approval') return { ...r, can_read: true, can_write: false };
        return { ...r, can_read: false, can_write: false };
      })
    );
  };

  const handleBulkPermission = (permission: 'allow' | 'deny' | 'require_approval') => {
    setRepos((prev) =>
      prev.map((r) => {
        if (permission === 'allow') return { ...r, can_read: true, can_write: true };
        if (permission === 'require_approval') return { ...r, can_read: true, can_write: false };
        return { ...r, can_read: false, can_write: false };
      })
    );
  };

  const getPermissionLabel = (repo: Repo): 'allow' | 'deny' | 'require_approval' => {
    if (repo.can_write) return 'allow';
    if (repo.can_read) return 'require_approval';
    return 'deny';
  };

  const handleSavePermissions = async () => {
    if (!user?.id) return;
    try {
      const permissions = repos.map(({ github_repo_id, can_read, can_write }) => ({
        github_repo_id, can_read: can_read || false, can_write: can_write || false,
      }));
      await api.setPermissions(user.id, permissions);
      setStep(4);
    } catch {
      setStep(4);
    }
  };

  useEffect(() => {
    if (step !== 4 || verified) return;
    const interval = setInterval(async () => {
      setChecking(true);
      try {

        const uname = user?.username || username;
        const uid = user?.id; // Capture the ID

        // Ensure BOTH uname and uid exist before calling the API
        if (!uname || !uid) return;
        const result = await api.getRecentActionCount(uid, uname);
        if (result[0] && Number(result[0].count) > 0) setVerified(true);
      } catch { /* ignore */ } finally {
        setChecking(false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, verified, user?.username, username]);

  useEffect(() => {
    if (step !== 5) return;
    const fetchCount = async () => {
      try {
        const metrics = await api.getMetrics();
        setActionCount(Number(metrics.total) || 0);
      } catch { /* ignore */ }
    };
    fetchCount();
  }, [step]);

  const mcpConfig = JSON.stringify({
    mcpServers: {
      'aegis-github': {
        url: 'https://app.runaegis.co/sse',
        headers: { user_id: String(user?.github_user_id || githubId || '{USER_GITHUB_ID}') },
      },
    },
  }, null, 2);

  const permOptions: Array<{ value: 'allow' | 'deny' | 'require_approval'; label: string; activeClass: string }> = [
    { value: 'allow', label: 'Allow', activeClass: 'bg-success/20 text-success' },
    { value: 'require_approval', label: 'Approval', activeClass: 'bg-foreground/10 text-foreground' },
    { value: 'deny', label: 'Deny', activeClass: 'bg-destructive/20 text-destructive' },
  ];

  const tabs = [
    { id: 'claude', label: 'Claude Code' },
    { id: 'cursor', label: 'Cursor' },
    { id: 'windsurf', label: 'Windsurf' },
    { id: 'custom', label: 'Other' },
  ];

  const inputClass = 'w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/40 focus:outline-none';
  const primaryBtn = 'flex items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-40 transition-all';
  const ghostBtn = 'flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all';

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-10 sm:py-14">
      <StepIndicator current={step} />

      <div className="w-full max-w-lg">

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="rounded-md border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h1 className="text-base font-semibold text-foreground">Connect GitHub</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Aegis needs access to your repositories.</p>
            </div>
            <div className="space-y-4 p-5">
              {step1Error && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {step1Error}
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">GitHub Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="octocat" className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">GitHub User ID</label>
                <input type="text" value={githubId} onChange={(e) => setGithubId(e.target.value)} placeholder="12345678" className={inputClass} />
                <p className="mt-1 text-xs text-muted-foreground">Find yours at api.github.com/users/YOUR_USERNAME</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Personal Access Token</label>
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_xxxx" className={inputClass} />
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Required token scopes</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li><code className="font-mono text-foreground/80">repo</code> &mdash; Full control of repositories</li>
                  <li><code className="font-mono text-foreground/80">read:org</code> &mdash; Read org membership</li>
                  <li><code className="font-mono text-foreground/80">workflow</code> &mdash; Update workflows</li>
                </ul>
                <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground transition-colors">
                  Create token <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <button onClick={handleStep1} disabled={step1Loading} className={`${primaryBtn} w-full`}>
                {step1Loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="rounded-md border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h1 className="text-base font-semibold text-foreground">Sync Repositories</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Discover repositories with your token.</p>
            </div>
            <div className="p-5">
              {!synced ? (
                <button onClick={handleSync} disabled={syncing} className={`${primaryBtn} w-full`}>
                  {syncing ? <><RefreshCw className="h-4 w-4 animate-spin" /> Syncing...</> : <><RefreshCw className="h-4 w-4" /> Sync repositories</>}
                </button>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4 text-success" />
                    {repos.length} repositories found
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {repos.map((repo) => (
                      <div key={repo.full_name} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                        <span className="min-w-0 flex-1 truncate">{repo.full_name}</span>
                        <span className="text-xs text-success">Allow</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex gap-2">
                    <button onClick={() => setStep(1)} className={ghostBtn}>
                      <ChevronLeft className="h-4 w-4" /> Back
                    </button>
                    <button onClick={() => setStep(3)} className={`${primaryBtn} flex-1`}>
                      Continue <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <div className="rounded-md border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h1 className="text-base font-semibold text-foreground">Configure Permissions</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Set access levels for each repository.</p>
            </div>
            <div className="p-5">
              <div className="mb-4 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md border border-border bg-muted/30 px-2 py-2 text-center">
                  <span className="block font-medium text-success">Allow</span>
                  <span className="text-muted-foreground">Auto-execute</span>
                </div>
                <div className="rounded-md border border-border bg-muted/30 px-2 py-2 text-center">
                  <span className="block font-medium text-foreground">Approval</span>
                  <span className="text-muted-foreground">Human review</span>
                </div>
                <div className="rounded-md border border-border bg-muted/30 px-2 py-2 text-center">
                  <span className="block font-medium text-destructive">Deny</span>
                  <span className="text-muted-foreground">Block all</span>
                </div>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Apply to all:</span>
                {permOptions.map((opt) => (
                  <button key={opt.value} onClick={() => handleBulkPermission(opt.value)} className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {repos.map((repo, i) => (
                  <div key={repo.full_name} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{repo.full_name}</span>
                    <div className="flex overflow-hidden rounded-md border border-border">
                      {permOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleSetPermission(i, opt.value)}
                          className={`px-2 py-1 text-xs font-medium transition-colors ${getPermissionLabel(repo) === opt.value ? opt.activeClass : 'bg-card text-muted-foreground hover:bg-muted'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setStep(2)} className={ghostBtn}>
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button onClick={handleSavePermissions} className={`${primaryBtn} flex-1`}>
                  Continue <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4 ── */}
        {step === 4 && (
          <div className="rounded-md border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h1 className="text-base font-semibold text-foreground">Connect Agent</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Add Aegis to your MCP configuration.</p>
            </div>
            <div className="p-5">
              <div className="mb-4 flex gap-1 rounded-md bg-muted p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-all ${activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="overflow-hidden rounded-md border border-border">
                <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5">
                  <span className="text-xs text-muted-foreground">mcp_config.json</span>
                  <CopyButton text={mcpConfig} />
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-xs text-foreground/80 leading-relaxed">{mcpConfig}</pre>
              </div>
              <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                {activeTab === 'claude' && <ol className="space-y-1"><li>1. Open Claude Code settings</li><li>2. Navigate to MCP Servers</li><li>3. Add the config above</li><li>4. Restart Claude Code</li></ol>}
                {activeTab === 'cursor' && <ol className="space-y-1"><li>1. Open Settings &rarr; Features &rarr; MCP</li><li>2. Click Add MCP Server</li><li>3. Paste the config</li></ol>}
                {activeTab === 'windsurf' && <ol className="space-y-1"><li>1. Open ~/.codeium/windsurf/mcp_config.json</li><li>2. Add the aegis-github server</li></ol>}
                {activeTab === 'custom' && <p>Point your MCP server URL to https://app.runaegis.co/sse with header <code className="text-foreground/80">user_id: {String(user?.github_user_id || githubId)}</code></p>}
              </div>

              {/* Connection status */}
              <div className="mt-3 flex items-center gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm">
                {verified ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-foreground">Agent connected</span>
                  </>
                ) : (
                  <>
                    <span className={`h-2 w-2 rounded-full ${checking ? 'bg-foreground/50 animate-pulse' : 'bg-muted-foreground/40'}`} />
                    <span className="text-muted-foreground">Waiting for first action&hellip;</span>
                  </>
                )}
              </div>

              <div className="mt-5 flex gap-2">
                <button onClick={() => setStep(3)} className={ghostBtn}>
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button onClick={() => setStep(5)} className={`${primaryBtn} flex-1`}>
                  Continue <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {!verified && (
                <button onClick={() => setStep(5)} className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Skip for now
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Step 5 ── */}
        {step === 5 && (
          <div className="rounded-md border border-border bg-card text-center">
            <div className="px-6 py-10">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted">
                <Shield className="h-7 w-7 text-foreground" />
              </div>
              <h1 className="text-xl font-semibold text-foreground">Aegis is active</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Your agents are now governed.</p>

              <div className="mx-auto mt-7 grid max-w-xs grid-cols-3 gap-3">
                {[
                  { value: actionCount, label: 'actions' },
                  { value: repos.length, label: 'repos' },
                  { value: 0, label: 'incidents' },
                ].map(({ value, label }) => (
                  <div key={label} className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => router.push('/dashboard')}
                className={`${primaryBtn} mx-auto mt-7`}
              >
                Go to Dashboard <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
