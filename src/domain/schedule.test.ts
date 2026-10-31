import { describe, expect, it } from 'vitest';
import {
  computeChoreState,
  describeFrequency,
  describeInterval,
  groupChores,
  intervalDays,
} from './schedule';
import { shanghaiTime as sh } from './time';
import type { Chore, Completion, Frequency } from './types';

let seq = 0;

function chore(frequency: Frequency, extra: Partial<Chore> = {}): Chore {
  seq += 1;
  return {
    id: `c${seq}`,
    name: `家务${seq}`,
    emoji: '🧹',
    frequency,
    points: 1,
    reminder: { enabled: false, time: '20:00' },
    note: '',
    sortOrder: seq,
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

function done(c: Chore, at: number, memberId = 'me'): Completion {
  seq += 1;
  return {
    id: `d${seq}`,
    choreId: c.id,
    memberId,
    doneAt: at,
    points: c.points,
    choreName: c.name,
    choreEmoji: c.emoji,
  };
}

// 2026-10-26 是周一，2026-10-31 是周六
const SAT = sh(2026, 10, 31, 20, 0);

describe('间隔天数（7÷N、30÷N、30×M，四舍五入到整天）', () => {
  it('每周 N 次', () => {
    expect(intervalDays({ type: 'weekly', times: 7 })).toBe(1);
    expect(intervalDays({ type: 'weekly', times: 3 })).toBe(2);
    expect(intervalDays({ type: 'weekly', times: 2 })).toBe(4);
    expect(intervalDays({ type: 'weekly', times: 1 })).toBe(7);
  });
  it('每月 N 次、每 M 个月', () => {
    expect(intervalDays({ type: 'monthly', times: 2 })).toBe(15);
    expect(intervalDays({ type: 'monthly', times: 1 })).toBe(30);
    expect(intervalDays({ type: 'everyMonths', months: 3 })).toBe(90);
  });
  it('固定周几和一次性没有间隔', () => {
    expect(intervalDays({ type: 'weekdays', days: [1] })).toBeNull();
    expect(intervalDays({ type: 'once' })).toBeNull();
  });
});

describe('从来没做过的：直接算"该做了"', () => {
  it.each<Frequency>([
    { type: 'weekly', times: 7 },
    { type: 'weekly', times: 1 },
    { type: 'monthly', times: 2 },
    { type: 'everyMonths', months: 3 },
    { type: 'once' },
  ])('%o', (f) => {
    const s = computeChoreState(chore(f), [], SAT);
    expect(s.status).toBe('due');
    expect(s.done).toBe(0);
    expect(s.lastCompletion).toBeNull();
  });
});

describe('每周 N 次', () => {
  it('每天做的（每周 7 次）：今天做过就不急，昨天做的今天又该做了', () => {
    const c = chore({ type: 'weekly', times: 7 });
    const today = computeChoreState(c, [done(c, sh(2026, 10, 31, 8))], SAT);
    expect(today.status).toBe('later');
    expect(today.dueInDays).toBe(1);

    // 昨晚 23:00 做的，今早 7 点就该做了（按日历天，不按 24 小时）
    const yesterday = computeChoreState(c, [done(c, sh(2026, 10, 30, 23))], sh(2026, 10, 31, 7));
    expect(yesterday.status).toBe('due');
    expect(yesterday.overdueDays).toBe(0);
  });

  it('每周 3 次：隔 2 天变成该做了，进度显示 本周 x/3', () => {
    const c = chore({ type: 'weekly', times: 3 });
    const wed = sh(2026, 10, 28, 19);
    const thu = computeChoreState(c, [done(c, wed)], sh(2026, 10, 29, 9));
    expect(thu).toMatchObject({ status: 'later', periodLabel: '本周', done: 1, target: 3, dueInDays: 1 });

    const fri = computeChoreState(c, [done(c, wed)], sh(2026, 10, 30, 9));
    expect(fri).toMatchObject({ status: 'due', done: 1, target: 3, overdueDays: 0 });

    const sun = computeChoreState(c, [done(c, wed)], sh(2026, 11, 1, 9));
    expect(sun.overdueDays).toBe(2);
  });

  it('本周次数做满了就显示已完成，间隔到了也不再催', () => {
    const c = chore({ type: 'weekly', times: 2 });
    const list = [done(c, sh(2026, 10, 26, 9)), done(c, sh(2026, 10, 27, 9, 0), 'ta')];
    const s = computeChoreState(c, list, SAT); // 周六：离上次已经 4 天，超过间隔
    expect(s).toMatchObject({ status: 'done', done: 2, target: 2 });
  });

  it('新的一周进度清零，但"该不该做"仍按上次的间隔算', () => {
    const c = chore({ type: 'weekly', times: 1 });
    const sunday = sh(2026, 11, 1, 10);
    const list = [done(c, sunday)];
    const nextMon = computeChoreState(c, list, sh(2026, 11, 2, 9));
    expect(nextMon).toMatchObject({ status: 'later', done: 0, target: 1, dueInDays: 6 });

    const nextSun = computeChoreState(c, list, sh(2026, 11, 8, 9));
    expect(nextSun.status).toBe('due');
  });

  it('上周做的不算进本周进度', () => {
    const c = chore({ type: 'weekly', times: 2 });
    const s = computeChoreState(c, [done(c, sh(2026, 10, 25, 22))], sh(2026, 10, 26, 8));
    expect(s.done).toBe(0);
    expect(s.status).toBe('later');
  });

  it('上次是谁什么时候做的', () => {
    const c = chore({ type: 'weekly', times: 7 });
    const a = done(c, sh(2026, 10, 29, 9), 'me');
    const b = done(c, sh(2026, 10, 30, 21), 'ta');
    const s = computeChoreState(c, [b, a], SAT);
    expect(s.lastCompletion?.memberId).toBe('ta');
    expect(s.lastCompletion?.doneAt).toBe(b.doneAt);
  });

  it('别的家务的打卡不影响这一项', () => {
    const c1 = chore({ type: 'weekly', times: 7 });
    const c2 = chore({ type: 'weekly', times: 7 });
    const s = computeChoreState(c1, [done(c2, SAT)], SAT);
    expect(s.status).toBe('due');
  });
});

describe('每月 N 次', () => {
  it('换床单每月 2 次：间隔 15 天，本月做满就完成', () => {
    const c = chore({ type: 'monthly', times: 2 });
    const oct3 = done(c, sh(2026, 10, 3, 10));
    expect(computeChoreState(c, [oct3], sh(2026, 10, 17, 10))).toMatchObject({
      status: 'later',
      periodLabel: '本月',
      done: 1,
      target: 2,
      dueInDays: 1,
    });
    expect(computeChoreState(c, [oct3], sh(2026, 10, 18, 10)).status).toBe('due');

    const oct20 = done(c, sh(2026, 10, 20, 10));
    expect(computeChoreState(c, [oct3, oct20], SAT)).toMatchObject({ status: 'done', done: 2 });
  });

  it('新的一个月进度清零', () => {
    const c = chore({ type: 'monthly', times: 1 });
    const s = computeChoreState(c, [done(c, sh(2026, 10, 25, 10))], sh(2026, 11, 2, 10));
    expect(s).toMatchObject({ status: 'later', done: 0, target: 1, dueInDays: 22 });
  });
});

describe('每 M 个月一次', () => {
  const c = chore({ type: 'everyMonths', months: 3 });

  it('间隔 90 天；这周刚做的算已完成，更早做的算还不急', () => {
    const thisWeek = computeChoreState(c, [done(c, sh(2026, 10, 27, 10))], SAT);
    expect(thisWeek).toMatchObject({ status: 'done', periodLabel: '本期', done: 1, target: 1, dueInDays: 86 });

    const earlier = computeChoreState(c, [done(c, sh(2026, 9, 1, 10))], SAT);
    expect(earlier).toMatchObject({ status: 'later', done: 1, dueInDays: 30 });
  });

  it('过了 90 天就该做了', () => {
    const s = computeChoreState(c, [done(c, sh(2026, 8, 2, 10))], SAT);
    expect(s).toMatchObject({ status: 'due', done: 0, overdueDays: 0 });
  });
});

describe('每周固定周几', () => {
  // 每周二、五
  const c = chore({ type: 'weekdays', days: [5, 2] });

  it('还没到那天：还不急，显示还有几天', () => {
    const mon = computeChoreState(c, [], sh(2026, 10, 26, 9));
    expect(mon).toMatchObject({ status: 'later', done: 0, target: 2, dueInDays: 1 });
  });

  it('到了那天就是该做了', () => {
    const tue = computeChoreState(c, [], sh(2026, 10, 27, 9));
    expect(tue).toMatchObject({ status: 'due', overdueDays: 0 });
    const wed = computeChoreState(c, [], sh(2026, 10, 28, 9));
    expect(wed).toMatchObject({ status: 'due', overdueDays: 1 });
  });

  it('做了一次就抵掉一天，等下一个固定日', () => {
    const s = computeChoreState(c, [done(c, sh(2026, 10, 27, 20))], sh(2026, 10, 28, 9));
    expect(s).toMatchObject({ status: 'later', done: 1, dueInDays: 2 });
    const fri = computeChoreState(c, [done(c, sh(2026, 10, 27, 20))], sh(2026, 10, 30, 9));
    expect(fri.status).toBe('due');
  });

  it('提前做了也算', () => {
    const s = computeChoreState(c, [done(c, sh(2026, 10, 26, 20))], sh(2026, 10, 27, 9));
    expect(s.status).toBe('later');
  });

  it('本周都做了就完成', () => {
    const list = [done(c, sh(2026, 10, 27, 20)), done(c, sh(2026, 10, 30, 20))];
    expect(computeChoreState(c, list, SAT)).toMatchObject({ status: 'done', done: 2, target: 2 });
  });

  it('这周中间才新建的：创建之前的固定日不算', () => {
    const sunday = sh(2026, 11, 1, 10);
    const fresh = chore({ type: 'weekdays', days: [2, 5] }, { createdAt: sunday });
    // 周日新建"每周二、五"：本周的周二周五已经过去了，不催，等下周二
    expect(computeChoreState(fresh, [], sh(2026, 11, 1, 11))).toMatchObject({ status: 'later', dueInDays: 2 });
    expect(computeChoreState(fresh, [], sh(2026, 11, 3, 9))).toMatchObject({ status: 'due', overdueDays: 0 });

    // 周三新建"每周二、五"：周二不算，周五才该做
    const wedCreated = chore({ type: 'weekdays', days: [2, 5] }, { createdAt: sh(2026, 10, 28, 9) });
    expect(computeChoreState(wedCreated, [], sh(2026, 10, 29, 9))).toMatchObject({ status: 'later', dueInDays: 1 });
    expect(computeChoreState(wedCreated, [], sh(2026, 10, 30, 9))).toMatchObject({ status: 'due', overdueDays: 0 });
  });

  it('新的一周重新开始', () => {
    const list = [done(c, sh(2026, 10, 27, 20)), done(c, sh(2026, 10, 30, 20))];
    expect(computeChoreState(c, list, sh(2026, 11, 2, 9))).toMatchObject({ status: 'later', done: 0 });
  });
});

describe('一次性', () => {
  const c = chore({ type: 'once' });

  it('做过就完成', () => {
    const s = computeChoreState(c, [done(c, sh(2026, 10, 30, 9))], SAT);
    expect(s).toMatchObject({ status: 'done', done: 1, target: 1, hiddenFromHome: false });
  });

  it('上周以前做完的，首页不再显示', () => {
    const s = computeChoreState(c, [done(c, sh(2026, 10, 20, 9))], SAT);
    expect(s).toMatchObject({ status: 'done', hiddenFromHome: true });
  });
});

describe('首页分组', () => {
  it('分成该做了 / 还不急 / 已完成，并按紧急程度排序', () => {
    const daily = chore({ type: 'weekly', times: 7 }, { name: '做饭' });
    const twice = chore({ type: 'weekly', times: 2 }, { name: '拖地' });
    const weeklyDone = chore({ type: 'weekly', times: 1 }, { name: '擦柜子' });
    const never = chore({ type: 'weekly', times: 1 }, { name: '刷马桶' });
    const oldOnce = chore({ type: 'once' }, { name: '修灯泡' });
    const list = [
      done(daily, sh(2026, 10, 28, 9)), // 超了 2 天
      done(twice, sh(2026, 10, 30, 9)), // 还不急
      done(weeklyDone, sh(2026, 10, 29, 9)),
      done(oldOnce, sh(2026, 10, 1, 9)),
    ];
    const g = groupChores([daily, twice, weeklyDone, never, oldOnce], list, SAT);
    expect(g.due.map((s) => s.chore.name)).toEqual(['做饭', '刷马桶']);
    expect(g.later.map((s) => s.chore.name)).toEqual(['拖地']);
    expect(g.done.map((s) => s.chore.name)).toEqual(['擦柜子']);
  });
});

describe('频率说明', () => {
  it('中文描述', () => {
    expect(describeFrequency({ type: 'weekly', times: 7 })).toBe('每天');
    expect(describeFrequency({ type: 'weekly', times: 2 })).toBe('每周 2 次');
    expect(describeFrequency({ type: 'monthly', times: 2 })).toBe('每月 2 次');
    expect(describeFrequency({ type: 'everyMonths', months: 3 })).toBe('每 3 个月一次');
    expect(describeFrequency({ type: 'weekdays', days: [5, 2] })).toBe('每周二、五');
    expect(describeFrequency({ type: 'once' })).toBe('一次性');
    expect(describeInterval({ type: 'weekly', times: 3 })).toBe('约 2 天一次');
    expect(describeInterval({ type: 'weekly', times: 7 })).toBe('每天都该做');
    expect(describeInterval({ type: 'once' })).toBe('');
  });
});
