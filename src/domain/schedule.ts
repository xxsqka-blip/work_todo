/**
 * 排期和"该做了"的判定（PLAN.md 3.1、3.2 节）。全是纯函数，方便测试，
 * 第 2 步后端（定时推送）也会复用。
 *
 * 规则：
 * - 每周 N 次：上次做完后过了 7÷N 天（四舍五入到整天，至少 1 天）就"该做了"
 * - 每月 N 次：同理，间隔 30÷N 天
 * - 每 M 个月一次：间隔 30×M 天
 * - 每周固定周几：到了那天就"该做了"（本周做的次数少于已经到了的那几天）
 * - 一次性：没做过就"该做了"，做过就完成
 * - 从来没做过的：直接"该做了"
 * - 本周（本月）次数做满了：显示"已完成"，间隔到了也不再催
 * "过了几天"按北京时间的日历天数算：昨天做的，今天就算过了 1 天。
 */
import { dayIndex, startOfMonth, startOfWeek, weekdayOf, WEEKDAY_SHORT } from './time';
import type { Chore, Completion, Frequency, Weekday } from './types';

export type ChoreStatus = 'due' | 'later' | 'done';

export type PeriodLabel = '本周' | '本月' | '本期' | '一次性';

export interface ChoreState {
  chore: Chore;
  status: ChoreStatus;
  /** 进度按什么范围算 */
  periodLabel: PeriodLabel;
  /** 进度：这个范围里做了几次 / 应该做几次 */
  done: number;
  target: number;
  /** 最近一次打卡 */
  lastCompletion: Completion | null;
  /** 间隔型频率的间隔天数；固定周几、一次性为 null */
  intervalDays: number | null;
  /** 该做了：已经超出几天（0 = 今天刚到 / 从没做过） */
  overdueDays: number;
  /** 再过几天变成"该做了"；不适用时为 null */
  dueInDays: number | null;
  /** 一次性家务在本周之前就做完了，首页不再显示 */
  hiddenFromHome: boolean;
}

/** 间隔天数：每周 N 次 → 7÷N，每月 N 次 → 30÷N，每 M 个月 → 30×M（四舍五入，至少 1 天） */
export function intervalDays(freq: Frequency): number | null {
  switch (freq.type) {
    case 'weekly':
      return Math.max(1, Math.round(7 / Math.max(1, freq.times)));
    case 'monthly':
      return Math.max(1, Math.round(30 / Math.max(1, freq.times)));
    case 'everyMonths':
      return 30 * Math.max(1, freq.months);
    case 'weekdays':
    case 'once':
      return null;
  }
}

export function normalizeWeekdays(days: readonly number[]): Weekday[] {
  return [...new Set(days)].filter((d): d is Weekday => Number.isInteger(d) && d >= 1 && d <= 7).sort((a, b) => a - b);
}

export function computeChoreState(chore: Chore, completions: readonly Completion[], now: number): ChoreState {
  const own = completions.filter((c) => c.choreId === chore.id).sort((a, b) => b.doneAt - a.doneAt);
  const last = own[0] ?? null;
  const today = dayIndex(now);
  const daysSinceLast = last ? Math.max(0, today - dayIndex(last.doneAt)) : null;
  const weekStart = startOfWeek(now);
  const countSince = (from: number) => own.filter((c) => c.doneAt >= from).length;
  const interval = intervalDays(chore.frequency);

  const base = {
    chore,
    lastCompletion: last,
    intervalDays: interval,
    overdueDays: 0,
    dueInDays: null as number | null,
    hiddenFromHome: false,
  };

  const byInterval = (days: number) => {
    if (daysSinceLast === null) return { status: 'due' as const, overdueDays: 0, dueInDays: null };
    if (daysSinceLast >= days) return { status: 'due' as const, overdueDays: daysSinceLast - days, dueInDays: null };
    return { status: 'later' as const, overdueDays: 0, dueInDays: days - daysSinceLast };
  };

  const f = chore.frequency;
  switch (f.type) {
    case 'weekly':
    case 'monthly': {
      const periodLabel = f.type === 'weekly' ? '本周' : '本月';
      const done = countSince(f.type === 'weekly' ? weekStart : startOfMonth(now));
      const target = Math.max(1, f.times);
      if (done >= target) return { ...base, periodLabel, done, target, status: 'done' };
      return { ...base, periodLabel, done, target, ...byInterval(interval!) };
    }

    case 'everyMonths': {
      const r = byInterval(interval!);
      const done = r.status === 'later' ? 1 : 0;
      // 间隔还没到：这周做的放进"已完成"，更早做的算"还不急"
      if (r.status === 'later' && last && last.doneAt >= weekStart) {
        return { ...base, periodLabel: '本期', done, target: 1, ...r, status: 'done' };
      }
      return { ...base, periodLabel: '本期', done, target: 1, ...r };
    }

    case 'weekdays': {
      const days = normalizeWeekdays(f.days);
      const target = days.length;
      const done = countSince(weekStart);
      if (target === 0) return { ...base, periodLabel: '本周', done, target, status: 'later' };
      if (done >= target) return { ...base, periodLabel: '本周', done, target, status: 'done' };
      const todayWd = weekdayOf(now);
      // 本周已经到了的固定日（家务创建之前的那几天不算）
      const createdDay = dayIndex(chore.createdAt);
      const weekStartDay = dayIndex(weekStart);
      const arrived = days.filter((d) => d <= todayWd && weekStartDay + d - 1 >= createdDay);
      if (done < arrived.length) {
        // 做一次抵掉最早的一天，剩下最早没抵掉的那天算起
        return { ...base, periodLabel: '本周', done, target, status: 'due', overdueDays: todayWd - arrived[done]! };
      }
      // 多做的次数提前抵掉后面的固定日
      const upcoming = days.filter((d) => d > todayWd);
      const next = upcoming[done - arrived.length];
      const dueInDays = next !== undefined ? next - todayWd : 7 - todayWd + days[0]!;
      return { ...base, periodLabel: '本周', done, target, status: 'later', dueInDays };
    }

    case 'once': {
      if (!last) return { ...base, periodLabel: '一次性', done: 0, target: 1, status: 'due' };
      return {
        ...base,
        periodLabel: '一次性',
        done: 1,
        target: 1,
        status: 'done',
        hiddenFromHome: last.doneAt < weekStart,
      };
    }
  }
}

export interface GroupedChores {
  due: ChoreState[];
  later: ChoreState[];
  done: ChoreState[];
}

/** 首页三组：该做了（超得越久越靠前）/ 还不急（越快到期越靠前）/ 已完成（最近做的靠前） */
export function groupChores(chores: readonly Chore[], completions: readonly Completion[], now: number): GroupedChores {
  const states = chores.map((c) => computeChoreState(c, completions, now)).filter((s) => !s.hiddenFromHome);
  const bySort = (a: ChoreState, b: ChoreState) => a.chore.sortOrder - b.chore.sortOrder;
  return {
    due: states.filter((s) => s.status === 'due').sort((a, b) => b.overdueDays - a.overdueDays || bySort(a, b)),
    later: states
      .filter((s) => s.status === 'later')
      .sort((a, b) => (a.dueInDays ?? Infinity) - (b.dueInDays ?? Infinity) || bySort(a, b)),
    done: states
      .filter((s) => s.status === 'done')
      .sort((a, b) => (b.lastCompletion?.doneAt ?? 0) - (a.lastCompletion?.doneAt ?? 0) || bySort(a, b)),
  };
}

/** "每天" / "每周 2 次" / "每月 1 次" / "每 3 个月一次" / "每周二、五" / "一次性" */
export function describeFrequency(freq: Frequency): string {
  switch (freq.type) {
    case 'weekly':
      return freq.times >= 7 ? '每天' : `每周 ${freq.times} 次`;
    case 'monthly':
      return `每月 ${freq.times} 次`;
    case 'everyMonths':
      return freq.months === 1 ? '每个月一次' : `每 ${freq.months} 个月一次`;
    case 'weekdays': {
      const days = normalizeWeekdays(freq.days);
      if (days.length === 0) return '每周固定周几（未选）';
      return `每周${days.map((d) => WEEKDAY_SHORT[d - 1]).join('、')}`;
    }
    case 'once':
      return '一次性';
  }
}

/** 间隔说明，例如"约 2 天一次"；固定周几、一次性返回空字符串 */
export function describeInterval(freq: Frequency): string {
  const days = intervalDays(freq);
  if (days === null) return '';
  if (days === 1) return '每天都该做';
  return `约 ${days} 天一次`;
}
