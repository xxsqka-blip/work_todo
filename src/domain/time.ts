/**
 * 时间工具：一律按北京时间（Asia/Shanghai）计算，一周从周一开始。
 *
 * 北京时间从 1991 年起固定是 UTC+8、没有夏令时，所以这里直接用固定偏移，
 * 不依赖手机或服务器的时区设置，Cloudflare Workers 里也能原样复用。
 */
import type { Weekday } from './types';

export const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;
export const WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日'] as const;

/** 北京时间的第几天（1970-01-01 是第 0 天）。两个时间点的天数差 = 日历上隔了几天 */
export function dayIndex(ms: number): number {
  return Math.floor((ms + TZ_OFFSET_MS) / DAY_MS);
}

/** 第 index 天北京时间 0 点的时间戳 */
export function dayStartFromIndex(index: number): number {
  return index * DAY_MS - TZ_OFFSET_MS;
}

/** 当天北京时间 0 点 */
export function startOfDay(ms: number): number {
  return dayStartFromIndex(dayIndex(ms));
}

/** 星期几：1 = 周一 … 7 = 周日 */
export function weekdayOf(ms: number): Weekday {
  // 1970-01-01 是周四
  const mondayBased = (((dayIndex(ms) + 3) % 7) + 7) % 7;
  return (mondayBased + 1) as Weekday;
}

/** 本周一北京时间 0 点 */
export function startOfWeek(ms: number): number {
  return startOfDay(ms) - (weekdayOf(ms) - 1) * DAY_MS;
}

/** 下周一北京时间 0 点 */
export function startOfNextWeek(ms: number): number {
  return startOfWeek(ms) + 7 * DAY_MS;
}

export interface ShanghaiParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: Weekday;
}

export function shanghaiParts(ms: number): ShanghaiParts {
  const d = new Date(ms + TZ_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: weekdayOf(ms),
  };
}

/** 北京时间某年某月某日某时的时间戳（month 1–12，超出范围会自动进位） */
export function shanghaiTime(year: number, month: number, day = 1, hour = 0, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour, minute) - TZ_OFFSET_MS;
}

/** 本月 1 号北京时间 0 点 */
export function startOfMonth(ms: number): number {
  const p = shanghaiParts(ms);
  return shanghaiTime(p.year, p.month, 1);
}

/** 下个月 1 号北京时间 0 点 */
export function startOfNextMonth(ms: number): number {
  const p = shanghaiParts(ms);
  return shanghaiTime(p.year, p.month + 1, 1);
}

/** 日历上隔了几天（今天 = 0，昨天 = 1） */
export function calendarDaysBetween(fromMs: number, toMs: number): number {
  return dayIndex(toMs) - dayIndex(fromMs);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "08:05" */
export function formatClock(ms: number): string {
  const p = shanghaiParts(ms);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** "10月31日" */
export function formatMonthDay(ms: number): string {
  const p = shanghaiParts(ms);
  return `${p.month}月${p.day}日`;
}

/** "10月31日 周六" */
export function formatDateWithWeekday(ms: number): string {
  return `${formatMonthDay(ms)} ${WEEKDAY_NAMES[weekdayOf(ms) - 1]}`;
}

/** 相对日期：今天 / 昨天 / 前天 / 3 天前 / 10月3日 */
export function formatRelativeDay(ms: number, now: number): string {
  const diff = calendarDaysBetween(ms, now);
  if (diff <= 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff === 2) return '前天';
  if (diff < 7) return `${diff} 天前`;
  const p = shanghaiParts(ms);
  const n = shanghaiParts(now);
  return p.year === n.year ? formatMonthDay(ms) : `${p.year}年${formatMonthDay(ms)}`;
}

/** 相对日期 + 时间（一周以内带时间）：今天 08:05 / 3 天前 / 10月3日 */
export function formatRelativeDateTime(ms: number, now: number): string {
  const diff = calendarDaysBetween(ms, now);
  const day = formatRelativeDay(ms, now);
  return diff <= 2 ? `${day} ${formatClock(ms)}` : day;
}
