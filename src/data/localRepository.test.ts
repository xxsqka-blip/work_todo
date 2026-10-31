import { describe, expect, it } from 'vitest';
import { emptyChoreInput } from '../domain/chore';
import { groupChores } from '../domain/schedule';
import { SEED_CHORES } from '../domain/seed';
import { totalsByMember, weekRange } from '../domain/stats';
import { shanghaiTime as sh } from '../domain/time';
import { DEMO_STORAGE_KEY, LocalChoreRepository, LocalIdentityStore, MemoryStorage } from './localRepository';

function setup(now = sh(2026, 10, 31, 20)) {
  const storage = new MemoryStorage();
  let n = 0;
  let t = now;
  const repo = new LocalChoreRepository(storage, { now: () => t, newId: () => `id${++n}` });
  return { storage, repo, setNow: (v: number) => (t = v) };
}

describe('初始家务清单（PLAN.md 第 7 节）', () => {
  it('第一次打开自动导入 18 项，提醒全部关，两个示例成员', async () => {
    const { repo, storage } = setup();
    const data = await repo.load();
    expect(data.chores).toHaveLength(18);
    expect(data.members.map((m) => m.name)).toEqual(['我', 'TA']);
    expect(data.chores.every((c) => !c.reminder.enabled)).toBe(true);
    expect(data.completions).toEqual([]);
    expect(storage.getItem(DEMO_STORAGE_KEY)).not.toBeNull();
  });

  it('名称、图标、频率、积分和表格一致', () => {
    const rows = SEED_CHORES.map((c) => [c.name, c.emoji, c.frequency, c.points]);
    expect(rows).toEqual([
      ['做饭', '🍳', { type: 'weekly', times: 7 }, 3],
      ['洗碗擦灶台', '🍽️', { type: 'weekly', times: 7 }, 2],
      ['扔垃圾（厨余 + 客厅）', '🗑️', { type: 'weekly', times: 7 }, 1],
      ['吸地拖地', '🧹', { type: 'weekly', times: 2 }, 2],
      ['洗衣服晒衣服', '👕', { type: 'weekly', times: 2 }, 2],
      ['浴室洗漱区域清洁', '🚿', { type: 'weekly', times: 1 }, 2],
      ['擦柜子', '🧽', { type: 'weekly', times: 1 }, 1],
      ['换床单', '🛏️', { type: 'monthly', times: 2 }, 2],
      ['收衣服叠衣服', '🧺', { type: 'weekly', times: 2 }, 1],
      ['买菜', '🛒', { type: 'weekly', times: 2 }, 2],
      ['刷马桶', '🚽', { type: 'weekly', times: 1 }, 1],
      ['整理收纳', '📦', { type: 'weekly', times: 1 }, 1],
      ['换毛巾', '🛁', { type: 'weekly', times: 1 }, 1],
      ['扔快递盒和纸箱', '♻️', { type: 'weekly', times: 1 }, 1],
      ['清理冰箱', '🧊', { type: 'monthly', times: 1 }, 2],
      ['清洗洗衣机滤网和胶圈', '🫧', { type: 'monthly', times: 1 }, 1],
      ['擦窗户', '🪟', { type: 'everyMonths', months: 3 }, 3],
      ['浇花', '🪴', { type: 'weekly', times: 2 }, 1],
    ]);
  });

  it('第二次打开不会重复导入', async () => {
    const { repo, storage } = setup();
    await repo.load();
    const again = new LocalChoreRepository(storage);
    expect((await again.load()).chores).toHaveLength(18);
  });
});

describe('打卡和撤销', () => {
  it('打卡记在当前成员名下，状态和统计跟着变；撤销后恢复', async () => {
    const { repo } = setup();
    const now = sh(2026, 10, 31, 20);
    const { chores, members } = await repo.load();
    const cook = chores.find((c) => c.name === '做饭')!;
    const ta = members[1]!;

    const before = await repo.load();
    expect(groupChores(before.chores, before.completions, now).due.map((s) => s.chore.id)).toContain(cook.id);

    const rec = await repo.addCompletion({ choreId: cook.id, memberId: ta.id });
    expect(rec).toMatchObject({ choreId: cook.id, memberId: ta.id, points: 3, choreName: '做饭', doneAt: now });

    const after = await repo.load();
    const g = groupChores(after.chores, after.completions, now);
    const state = [...g.due, ...g.later, ...g.done].find((s) => s.chore.id === cook.id)!;
    expect(state).toMatchObject({ status: 'later', done: 1, target: 7 });
    expect(state.lastCompletion?.memberId).toBe(ta.id);
    expect(totalsByMember(after.members, after.completions, weekRange(now)).map((t) => t.points)).toEqual([0, 3]);

    await repo.removeCompletion(rec.id);
    const undone = await repo.load();
    expect(undone.completions).toHaveLength(0);
    expect(groupChores(undone.chores, undone.completions, now).due.map((s) => s.chore.id)).toContain(cook.id);
  });

  it('打卡记下当时的分值，之后改分不影响旧记录', async () => {
    const { repo } = setup();
    const { chores, members } = await repo.load();
    const c = chores[0]!;
    await repo.addCompletion({ choreId: c.id, memberId: members[0]!.id });
    await repo.updateChore(c.id, { ...c, points: 5 });
    const data = await repo.load();
    expect(data.completions[0]!.points).toBe(3);
    expect(data.chores[0]!.points).toBe(5);
  });

  it('不存在的家务或成员不能打卡', async () => {
    const { repo } = setup();
    const { chores } = await repo.load();
    await expect(repo.addCompletion({ choreId: 'nope', memberId: 'member-me' })).rejects.toThrow();
    await expect(repo.addCompletion({ choreId: chores[0]!.id, memberId: 'nobody' })).rejects.toThrow();
  });
});

describe('家务增删改', () => {
  it('新增的排在最后，字段会被整理', async () => {
    const { repo } = setup();
    const created = await repo.createChore({
      ...emptyChoreInput(),
      name: '  修灯泡 ',
      emoji: '💡',
      frequency: { type: 'once' },
      points: 99,
    });
    expect(created).toMatchObject({ name: '修灯泡', points: 10, sortOrder: 19 });
    const data = await repo.load();
    expect(data.chores.at(-1)!.id).toBe(created.id);
  });

  it('名称为空、固定周几没选日子时报错', async () => {
    const { repo } = setup();
    await expect(repo.createChore({ ...emptyChoreInput(), name: '  ' })).rejects.toThrow('名称');
    await expect(
      repo.createChore({ ...emptyChoreInput(), name: '倒垃圾', frequency: { type: 'weekdays', days: [] } }),
    ).rejects.toThrow('至少选一天');
  });

  it('编辑和删除；删除后历史记录还在', async () => {
    const { repo } = setup();
    const { chores, members } = await repo.load();
    const c = chores[1]!;
    await repo.addCompletion({ choreId: c.id, memberId: members[0]!.id });
    const updated = await repo.updateChore(c.id, { ...c, name: '洗碗', frequency: { type: 'weekdays', days: [3, 1, 3] } });
    expect(updated.frequency).toEqual({ type: 'weekdays', days: [1, 3] });
    await repo.deleteChore(c.id);
    const data = await repo.load();
    expect(data.chores.find((x) => x.id === c.id)).toBeUndefined();
    expect(data.completions).toHaveLength(1);
    expect(data.completions[0]!.choreName).toBe('洗碗擦灶台');
  });

  it('改成员名字', async () => {
    const { repo } = setup();
    await repo.updateMember('member-ta', { name: ' 小王 ' });
    expect((await repo.load()).members[1]!.name).toBe('小王');
    await expect(repo.updateMember('member-ta', { name: ' ' })).rejects.toThrow();
  });

  it('重置演示数据', async () => {
    const { repo } = setup();
    const { chores, members } = await repo.load();
    await repo.addCompletion({ choreId: chores[0]!.id, memberId: members[0]!.id });
    await repo.deleteChore(chores[0]!.id);
    await repo.resetDemo();
    const data = await repo.load();
    expect(data.chores).toHaveLength(18);
    expect(data.completions).toHaveLength(0);
  });

  it('本地数据损坏时重新导入，不会打不开', async () => {
    const { repo, storage } = setup();
    storage.setItem(DEMO_STORAGE_KEY, '{oops');
    expect((await repo.load()).chores).toHaveLength(18);
  });
});

describe('我是谁', () => {
  it('记在本机', () => {
    const storage = new MemoryStorage();
    const id = new LocalIdentityStore(storage);
    expect(id.getMemberId()).toBeNull();
    id.setMemberId('member-ta');
    expect(new LocalIdentityStore(storage).getMemberId()).toBe('member-ta');
  });
});
