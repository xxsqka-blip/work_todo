/** 首页卡片上的中文提示文字 */
import type { ChoreState } from '../domain/schedule';
import { DAY_MS, formatMonthDay, WEEKDAY_NAMES, weekdayOf } from '../domain/time';

export const STATUS_LABELS = {
  due: '该做了',
  later: '还不急',
  done: '本周已完成',
} as const;

function inDays(days: number, now: number): string {
  if (days <= 1) return '明天';
  if (days === 2) return '后天';
  const target = now + days * DAY_MS;
  return days < 7 ? `${days} 天后（${WEEKDAY_NAMES[weekdayOf(target) - 1]}）` : `${days} 天后（${formatMonthDay(target)}）`;
}

/** 状态提示：已经超了 2 天 / 明天该做 / 本周已完成… */
export function statusHint(s: ChoreState, now: number): string {
  switch (s.status) {
    case 'due':
      if (s.overdueDays > 0) return `已经超了 ${s.overdueDays} 天`;
      return s.lastCompletion ? '今天该做了' : '还没做过';
    case 'later':
      return s.dueInDays === null ? '还不急' : `${inDays(s.dueInDays, now)}该做`;
    case 'done':
      switch (s.periodLabel) {
        case '本周':
          return '本周已完成';
        case '本月':
          return '本月已完成';
        case '本期':
          return s.dueInDays === null ? '已完成' : `已完成 · ${inDays(s.dueInDays, now)}再做`;
        case '一次性':
          return '已完成';
      }
  }
}

/** 进度文字：本周 1/2 */
export function progressText(s: ChoreState): string {
  if (s.periodLabel === '一次性') return s.done > 0 ? '一次性 · 已做' : '一次性';
  return `${s.periodLabel} ${s.done}/${s.target}`;
}
