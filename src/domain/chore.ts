/** 家务字段的整理和校验（前端表单和第 2 步的后端接口共用） */
import { normalizeWeekdays } from './schedule';
import type { ChoreInput, Frequency, FrequencyType } from './types';

export const LIMITS = {
  nameMax: 30,
  noteMax: 200,
  pointsMin: 1,
  pointsMax: 10,
  weeklyMax: 7,
  monthlyMax: 15,
  monthsMax: 12,
} as const;

export const DEFAULT_REMINDER_TIME = '20:00';

export const FREQUENCY_TYPE_LABELS: Record<FrequencyType, string> = {
  weekly: '每周几次',
  monthly: '每月几次',
  everyMonths: '隔几个月',
  weekdays: '固定周几',
  once: '一次性',
};

const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(n) || 0)));

export function normalizeFrequency(f: Frequency): Frequency {
  switch (f.type) {
    case 'weekly':
      return { type: 'weekly', times: clampInt(f.times, 1, LIMITS.weeklyMax) };
    case 'monthly':
      return { type: 'monthly', times: clampInt(f.times, 1, LIMITS.monthlyMax) };
    case 'everyMonths':
      return { type: 'everyMonths', months: clampInt(f.months, 1, LIMITS.monthsMax) };
    case 'weekdays':
      return { type: 'weekdays', days: normalizeWeekdays(f.days) };
    case 'once':
      return { type: 'once' };
  }
}

/** 换频率类型时给一个合理的默认值 */
export function defaultFrequency(type: FrequencyType): Frequency {
  switch (type) {
    case 'weekly':
      return { type, times: 1 };
    case 'monthly':
      return { type, times: 1 };
    case 'everyMonths':
      return { type, months: 3 };
    case 'weekdays':
      return { type, days: [6] };
    case 'once':
      return { type };
  }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeChoreInput(input: ChoreInput): ChoreInput {
  const emoji = [...input.emoji.trim()].slice(0, 8).join('');
  return {
    name: input.name.trim().slice(0, LIMITS.nameMax),
    emoji: emoji || '🧹',
    frequency: normalizeFrequency(input.frequency),
    points: clampInt(input.points, LIMITS.pointsMin, LIMITS.pointsMax),
    reminder: {
      enabled: Boolean(input.reminder.enabled),
      time: TIME_RE.test(input.reminder.time) ? input.reminder.time : DEFAULT_REMINDER_TIME,
    },
    note: input.note.trim().slice(0, LIMITS.noteMax),
  };
}

/** 返回第一条错误提示；没问题返回 null */
export function validateChoreInput(input: ChoreInput): string | null {
  if (!input.name.trim()) return '请填写家务名称';
  if (input.frequency.type === 'weekdays' && normalizeWeekdays(input.frequency.days).length === 0) {
    return '固定周几：至少选一天';
  }
  return null;
}

export function emptyChoreInput(): ChoreInput {
  return {
    name: '',
    emoji: '🧹',
    frequency: { type: 'weekly', times: 1 },
    points: 1,
    reminder: { enabled: false, time: DEFAULT_REMINDER_TIME },
    note: '',
  };
}
