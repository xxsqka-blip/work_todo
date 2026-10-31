/**
 * 演示版的数据实现：全部存在这台设备的 localStorage 里，不连任何后端。
 * 第一次打开时自动导入初始家务清单（PLAN.md 第 7 节）。
 */
import { normalizeChoreInput, validateChoreInput } from '../domain/chore';
import { DEMO_MEMBERS, SEED_CHORES } from '../domain/seed';
import type { Chore, ChoreInput, Completion, HouseholdData, Member } from '../domain/types';
import type { AddCompletionInput, ChoreRepository, IdentityStore } from './repository';

/** localStorage 的最小子集，测试时可以换成内存实现 */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DEMO_STORAGE_KEY = 'jiawu.demo.v1';
export const IDENTITY_STORAGE_KEY = 'jiawu.memberId';

interface StoredData extends HouseholdData {
  version: 1;
}

export function randomId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface LocalRepositoryOptions {
  now?: () => number;
  newId?: () => string;
}

export class LocalChoreRepository implements ChoreRepository {
  readonly kind = 'demo' as const;
  private readonly now: () => number;
  private readonly newId: () => string;

  constructor(
    private readonly storage: KeyValueStorage,
    options: LocalRepositoryOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.newId = options.newId ?? randomId;
  }

  async load(): Promise<HouseholdData> {
    const { members, chores, completions } = this.read();
    return { members, chores, completions };
  }

  async updateMember(id: string, patch: { name: string }): Promise<Member> {
    const name = patch.name.trim().slice(0, 12);
    if (!name) throw new Error('名字不能为空');
    return this.mutate((d) => {
      const m = d.members.find((x) => x.id === id);
      if (!m) throw new Error('找不到这个成员');
      m.name = name;
      return { ...m };
    });
  }

  async createChore(input: ChoreInput): Promise<Chore> {
    const clean = this.check(input);
    return this.mutate((d) => {
      const t = this.now();
      const chore: Chore = {
        ...clean,
        id: this.newId(),
        sortOrder: d.chores.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1,
        createdAt: t,
        updatedAt: t,
      };
      d.chores.push(chore);
      return { ...chore };
    });
  }

  async updateChore(id: string, input: ChoreInput): Promise<Chore> {
    const clean = this.check(input);
    return this.mutate((d) => {
      const i = d.chores.findIndex((c) => c.id === id);
      if (i < 0) throw new Error('这项家务已经不在了');
      const chore: Chore = { ...d.chores[i]!, ...clean, updatedAt: this.now() };
      d.chores[i] = chore;
      return { ...chore };
    });
  }

  async deleteChore(id: string): Promise<void> {
    this.mutate((d) => {
      d.chores = d.chores.filter((c) => c.id !== id);
    });
  }

  async addCompletion(input: AddCompletionInput): Promise<Completion> {
    return this.mutate((d) => {
      const chore = d.chores.find((c) => c.id === input.choreId);
      if (!chore) throw new Error('这项家务已经不在了');
      if (!d.members.some((m) => m.id === input.memberId)) throw new Error('找不到这个成员');
      const completion: Completion = {
        id: this.newId(),
        choreId: chore.id,
        memberId: input.memberId,
        doneAt: input.doneAt ?? this.now(),
        points: chore.points,
        choreName: chore.name,
        choreEmoji: chore.emoji,
      };
      d.completions.push(completion);
      return { ...completion };
    });
  }

  async removeCompletion(id: string): Promise<void> {
    this.mutate((d) => {
      d.completions = d.completions.filter((c) => c.id !== id);
    });
  }

  subscribe(listener: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === DEMO_STORAGE_KEY) listener();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }

  async resetDemo(): Promise<void> {
    this.storage.removeItem(DEMO_STORAGE_KEY);
    this.read();
  }

  private check(input: ChoreInput): ChoreInput {
    const error = validateChoreInput(input);
    if (error) throw new Error(error);
    return normalizeChoreInput(input);
  }

  private mutate<T>(fn: (data: StoredData) => T): T {
    const data = this.read();
    const result = fn(data);
    this.write(data);
    return result;
  }

  private read(): StoredData {
    const raw = this.storage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StoredData;
        if (parsed && parsed.version === 1 && Array.isArray(parsed.chores)) return parsed;
      } catch {
        // 数据坏了就重新导入
      }
    }
    const seeded = this.seed();
    this.write(seeded);
    return seeded;
  }

  private write(data: StoredData): void {
    this.storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
  }

  private seed(): StoredData {
    const t = this.now();
    const chores: Chore[] = SEED_CHORES.map((input, i) => ({
      ...normalizeChoreInput(input),
      id: this.newId(),
      sortOrder: i + 1,
      createdAt: t,
      updatedAt: t,
    }));
    return { version: 1, members: DEMO_MEMBERS.map((m) => ({ ...m })), chores, completions: [] };
  }
}

export class LocalIdentityStore implements IdentityStore {
  constructor(private readonly storage: KeyValueStorage) {}

  getMemberId(): string | null {
    return this.storage.getItem(IDENTITY_STORAGE_KEY);
  }

  setMemberId(id: string): void {
    this.storage.setItem(IDENTITY_STORAGE_KEY, id);
  }
}

/** 内存版 storage：测试用，也用于 localStorage 不可用的情况（比如无痕模式） */
export class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** 浏览器里优先用 localStorage；用不了（被禁用）就退回内存，保证页面能打开 */
export function browserStorage(): KeyValueStorage {
  try {
    const s = window.localStorage;
    const probe = '__jiawu_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return new MemoryStorage();
  }
}
