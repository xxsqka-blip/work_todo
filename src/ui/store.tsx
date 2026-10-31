/**
 * 界面的数据状态：通过 ChoreRepository 读写，界面不关心数据存在哪里。
 * 打开 App、切回前台时会重新读取（第 2 步连上后端后再加定时刷新）。
 */
import type { ComponentChildren } from 'preact';
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useState } from 'preact/hooks';
import type { ChoreRepository, IdentityStore } from '../data/repository';
import type { HouseholdData, Member } from '../domain/types';
import { useOverlay } from './overlays';

export interface Store {
  repo: ChoreRepository;
  data: HouseholdData | null;
  loadError: string | null;
  /** 当前时间，每 30 秒更新一次，用来判断"该做了" */
  now: number;
  /** 当前用谁的身份打卡 */
  me: Member | null;
  setMe(id: string): void;
  memberById(id: string): Member | undefined;
  refresh(): Promise<void>;
  /** 执行一次修改，成功后刷新数据；失败时弹出提示并返回 undefined */
  mutate<T>(fn: (repo: ChoreRepository) => Promise<T>): Promise<T | undefined>;
}

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

function errorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : '出了点问题，请再试一次';
}

export function StoreProvider(props: { repo: ChoreRepository; identity: IdentityStore; children: ComponentChildren }) {
  const { repo, identity } = props;
  const { toast } = useOverlay();
  const [data, setData] = useState<HouseholdData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [meId, setMeId] = useState<string | null>(() => identity.getMemberId());

  const refresh = useCallback(async () => {
    try {
      const d = await repo.load();
      setData(d);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
    setNow(Date.now());
  }, [repo]);

  useEffect(() => {
    void refresh();
    const unsubscribe = repo.subscribe(() => void refresh());
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(tick);
    };
  }, [repo, refresh]);

  const mutate = useCallback(
    async <T,>(fn: (r: ChoreRepository) => Promise<T>): Promise<T | undefined> => {
      try {
        const result = await fn(repo);
        await refresh();
        return result;
      } catch (e) {
        toast({ message: errorMessage(e), tone: 'error' });
        await refresh();
        return undefined;
      }
    },
    [repo, refresh, toast],
  );

  const members = data?.members ?? [];
  // 没选过或者选的人不在了，默认第一个成员
  const me = members.find((m) => m.id === meId) ?? members[0] ?? null;

  const setMe = useCallback(
    (id: string) => {
      identity.setMemberId(id);
      setMeId(id);
    },
    [identity],
  );

  const store = useMemo<Store>(
    () => ({
      repo,
      data,
      loadError,
      now,
      me,
      setMe,
      memberById: (id: string) => data?.members.find((m) => m.id === id),
      refresh,
      mutate,
    }),
    [repo, data, loadError, now, me, setMe, refresh, mutate],
  );

  return <StoreContext.Provider value={store}>{props.children}</StoreContext.Provider>;
}
