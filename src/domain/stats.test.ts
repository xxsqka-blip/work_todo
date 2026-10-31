import { describe, expect, it } from 'vitest';
import { breakdownByChore, groupByDay, monthRange, totalsByMember, weekRange } from './stats';
import { shanghaiTime as sh } from './time';
import type { Completion, Member } from './types';

const members: Member[] = [
  { id: 'me', name: '我', color: '#000' },
  { id: 'ta', name: 'TA', color: '#fff' },
];

let seq = 0;
function rec(memberId: string, choreId: string, points: number, at: number, name = choreId): Completion {
  seq += 1;
  return { id: `r${seq}`, memberId, choreId, points, doneAt: at, choreName: name, choreEmoji: '🧹' };
}

const NOW = sh(2026, 10, 31, 20); // 周六

describe('统计范围', () => {
  it('本周 = 周一 0 点到下周一 0 点，本月 = 1 号到下月 1 号', () => {
    expect(weekRange(NOW)).toEqual({ from: sh(2026, 10, 26), to: sh(2026, 11, 2) });
    expect(monthRange(NOW)).toEqual({ from: sh(2026, 10, 1), to: sh(2026, 11, 1) });
  });
});

describe('两个人各完成几次、各得多少分', () => {
  const list = [
    rec('me', 'cook', 3, sh(2026, 10, 31, 12)), // 本周
    rec('me', 'dish', 2, sh(2026, 10, 26, 0, 0)), // 本周第一分钟
    rec('ta', 'trash', 1, sh(2026, 10, 30, 8)), // 本周
    rec('ta', 'cook', 3, sh(2026, 10, 25, 23, 59)), // 上周日，算本月
    rec('me', 'bed', 2, sh(2026, 9, 30, 23, 59)), // 上个月
  ];

  it('本周', () => {
    const t = totalsByMember(members, list, weekRange(NOW));
    expect(t.map(({ member, count, points }) => [member.name, count, points])).toEqual([
      ['我', 2, 5],
      ['TA', 1, 1],
    ]);
  });

  it('本月', () => {
    const t = totalsByMember(members, list, monthRange(NOW));
    expect(t.map(({ member, count, points }) => [member.name, count, points])).toEqual([
      ['我', 2, 5],
      ['TA', 2, 4],
    ]);
  });

  it('没打过卡的人显示 0', () => {
    const t = totalsByMember(members, [], weekRange(NOW));
    expect(t.map((x) => [x.count, x.points])).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('按家务分开统计', () => {
    const rows = breakdownByChore(list, monthRange(NOW));
    expect(rows[0]).toMatchObject({ choreId: 'cook', total: 2, counts: { me: 1, ta: 1 } });
    expect(rows).toHaveLength(3);
  });
});

describe('历史记录按天分组', () => {
  it('新的在前，同一天的放一起', () => {
    const a = rec('me', 'x', 1, sh(2026, 10, 30, 23, 50));
    const b = rec('ta', 'y', 2, sh(2026, 10, 31, 0, 10));
    const c = rec('me', 'z', 3, sh(2026, 10, 31, 9));
    const groups = groupByDay([a, b, c]);
    expect(groups.map((g) => g.dayStart)).toEqual([sh(2026, 10, 31), sh(2026, 10, 30)]);
    expect(groups[0]!.items.map((x) => x.id)).toEqual([c.id, b.id]);
    expect(groups[0]!.points).toBe(5);
  });
});
