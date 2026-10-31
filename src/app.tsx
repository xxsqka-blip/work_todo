import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { ChoreRepository, IdentityStore } from './data/repository';
import { ChoreEditor, type EditorMode } from './pages/ChoreEditor';
import { ChoresPage } from './pages/ChoresPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { StatsPage } from './pages/StatsPage';
import { Icon } from './ui/components';
import { OverlayProvider, useOverlay } from './ui/overlays';
import { StoreProvider, useStore } from './ui/store';

type Tab = 'today' | 'chores' | 'history' | 'stats';

const TABS: { id: Tab; label: string; title: string; icon: () => JSX.Element }[] = [
  { id: 'today', label: '今天', title: '今天', icon: () => <Icon.Home /> },
  { id: 'chores', label: '家务', title: '家务清单', icon: () => <Icon.List /> },
  { id: 'history', label: '记录', title: '打卡记录', icon: () => <Icon.Clock /> },
  { id: 'stats', label: '统计', title: '统计', icon: () => <Icon.Chart /> },
];

function tabFromHash(): Tab {
  const id = location.hash.replace(/^#\/?/, '');
  return TABS.some((t) => t.id === id) ? (id as Tab) : 'today';
}

function useHashTab(): [Tab, (t: Tab) => void] {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (t: Tab) => {
    const hash = t === 'today' ? '#/' : `#/${t}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
    setTab(t);
    window.scrollTo(0, 0);
  };
  return [tab, go];
}

export function App(props: { repo: ChoreRepository; identity: IdentityStore }) {
  return (
    <OverlayProvider>
      <StoreProvider repo={props.repo} identity={props.identity}>
        <Shell />
      </StoreProvider>
    </OverlayProvider>
  );
}

interface EditorState {
  mode: EditorMode;
  choreId?: string;
}

function Shell() {
  const { data, loadError, refresh, repo } = useStore();
  const [tab, setTab] = useHashTab();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const current = TABS.find((t) => t.id === tab)!;
  const editingChore = editor?.choreId ? data?.chores.find((c) => c.id === editor.choreId) : undefined;

  const openEditor = (mode: EditorMode, choreId?: string) => setEditor({ mode, choreId });

  return (
    <div class="app">
      <header class="topbar">
        <div class="topbar-title">
          <h1>{current.title}</h1>
          {repo.kind === 'demo' && <span class="badge">演示</span>}
        </div>
        <MemberSwitcher />
      </header>

      <main class="main">
        {loadError && (
          <div class="card error-card" role="alert">
            <p>数据读取失败：{loadError}</p>
            <button type="button" class="btn btn-secondary" onClick={() => void refresh()}>
              重试
            </button>
          </div>
        )}
        {!data && !loadError && <p class="loading">正在加载…</p>}
        {data && tab === 'today' && (
          <HomePage onEditChore={(id) => openEditor('edit', id)} onAddChore={() => openEditor('add')} />
        )}
        {data && tab === 'chores' && (
          <ChoresPage
            onAdd={() => openEditor('add')}
            onEdit={(id) => openEditor('edit', id)}
            onCopy={(id) => openEditor('copy', id)}
          />
        )}
        {data && tab === 'history' && <HistoryPage />}
        {data && tab === 'stats' && <StatsPage />}
      </main>

      <nav class="tabbar" aria-label="主菜单">
        {TABS.map((t) => (
          <button
            type="button"
            class={`tab ${t.id === tab ? 'active' : ''}`}
            aria-current={t.id === tab ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.icon()}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {editor && (editor.mode === 'add' || editingChore) && (
        <ChoreEditor
          key={`${editor.mode}-${editor.choreId ?? 'new'}`}
          mode={editor.mode}
          chore={editingChore}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

/** 顶部"我是谁"切换：打卡记在当前这个人名下 */
function MemberSwitcher() {
  const { data, me, setMe } = useStore();
  const { toast } = useOverlay();
  if (!data || data.members.length === 0) return null;
  return (
    <div class="whoami" role="radiogroup" aria-label="我是谁">
      <span class="whoami-label">我是</span>
      {data.members.map((m) => {
        const active = me?.id === m.id;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={active}
            class={`who ${active ? 'active' : ''}`}
            onClick={() => {
              if (active) return;
              setMe(m.id);
              toast(`现在以「${m.name}」的身份打卡`);
            }}
          >
            <span class="who-dot" style={{ background: m.color }} aria-hidden="true" />
            {m.name}
          </button>
        );
      })}
    </div>
  );
}
