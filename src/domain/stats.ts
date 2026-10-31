/** 统计和历史记录用到的纯函数 */
import { dayIndex, dayStartFromIndex, startOfMonth, startOfNextMonth, startOfNextWeek, startOfWeek } from './time';
import type { Completion, Member } from './types';

/** 时间范围 [from, to) */
export interface DateRange {
  from: number;
  to: number;
}

export function weekRange(now: number): DateRange {
  return { from: startOfWeek(now), to: startOfNextWeek(now) };
}

export function monthRange(now: number): DateRange {
  return { from: startOfMonth(now), to: startOfNextMonth(now) };
}

export function inRange(c: Completion, range: DateRange): boolean {
  return c.doneAt >= range.from && c.doneAt < range.to;
}

export interface MemberTotals {
  member: Member;
  count: number;
  points: number;
}

/** 每个人在这段时间里完成了几次、得了多少分（没做的人也列出来，记 0） */
export function totalsByMember(
  members: readonly Member[],
  completions: readonly Completion[],
  range: DateRange,
): MemberTotals[] {
  return members.map((member) => {
    const mine = completions.filter((c) => c.memberId === member.id && inRange(c, range));
    return { member, count: mine.length, points: mine.reduce((sum, c) => sum + c.points, 0) };
  });
}

export interface ChoreBreakdownRow {
  choreId: string;
  name: string;
  emoji: string;
  /** memberId → 次数 */
  counts: Record<string, number>;
  total: number;
}

/** 按家务分开看：这段时间每项家务谁做了几次 */
export function breakdownByChore(completions: readonly Completion[], range: DateRange): ChoreBreakdownRow[] {
  const rows = new Map<string, ChoreBreakdownRow & { latest: number }>();
  for (const c of completions) {
    if (!inRange(c, range)) continue;
    let row = rows.get(c.choreId);
    if (!row) {
      row = { choreId: c.choreId, name: c.choreName, emoji: c.choreEmoji, counts: {}, total: 0, latest: c.doneAt };
      rows.set(c.choreId, row);
    }
    if (c.doneAt >= row.latest) {
      row.latest = c.doneAt;
      row.name = c.choreName;
      row.emoji = c.choreEmoji;
    }
    row.counts[c.memberId] = (row.counts[c.memberId] ?? 0) + 1;
    row.total += 1;
  }
  return [...rows.values()]
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'zh-CN'))
    .map(({ latest: _latest, ...row }) => row);
}

export interface DayGroup {
  /** 当天北京时间 0 点 */
  dayStart: number;
  items: Completion[];
  points: number;
}

/** 历史记录：按天分组，新的在前 */
export function groupByDay(completions: readonly Completion[]): DayGroup[] {
  const sorted = [...completions].sort((a, b) => b.doneAt - a.doneAt);
  const groups: DayGroup[] = [];
  for (const c of sorted) {
    const start = dayStartFromIndex(dayIndex(c.doneAt));
    let g = groups[groups.length - 1];
    if (!g || g.dayStart !== start) {
      g = { dayStart: start, items: [], points: 0 };
      groups.push(g);
    }
    g.items.push(c);
    g.points += c.points;
  }
  return groups;
}
