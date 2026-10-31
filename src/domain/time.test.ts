import { describe, expect, it } from 'vitest';
import {
  calendarDaysBetween,
  formatClock,
  formatDateWithWeekday,
  formatRelativeDateTime,
  formatRelativeDay,
  shanghaiParts,
  shanghaiTime,
  startOfDay,
  startOfMonth,
  startOfNextMonth,
  startOfWeek,
  weekdayOf,
} from './time';

const sh = shanghaiTime;

describe('北京时间换算', () => {
  it('北京时间凌晨属于当天，而不是 UTC 的前一天', () => {
    // 北京时间 2026-11-01 00:30 = UTC 2026-10-31 16:30
    const t = sh(2026, 11, 1, 0, 30);
    expect(new Date(t).toISOString()).toBe('2026-10-31T16:30:00.000Z');
    expect(shanghaiParts(t)).toMatchObject({ year: 2026, month: 11, day: 1, hour: 0, minute: 30 });
    expect(startOfDay(t)).toBe(sh(2026, 11, 1));
  });

  it('星期几：周一 = 1，周日 = 7', () => {
    expect(weekdayOf(sh(2026, 10, 26, 12))).toBe(1); // 周一
    expect(weekdayOf(sh(2026, 10, 31, 12))).toBe(6); // 周六
    expect(weekdayOf(sh(2026, 11, 1, 23, 59))).toBe(7); // 周日深夜
    expect(weekdayOf(sh(2026, 11, 2, 0, 0))).toBe(1); // 周一零点
  });

  it('一周从周一 0 点开始', () => {
    const monday = sh(2026, 10, 26);
    expect(startOfWeek(sh(2026, 10, 26, 0, 0))).toBe(monday);
    expect(startOfWeek(sh(2026, 10, 28, 15))).toBe(monday);
    expect(startOfWeek(sh(2026, 11, 1, 23, 59))).toBe(monday); // 周日还算这周
    expect(startOfWeek(sh(2026, 11, 2, 0, 1))).toBe(sh(2026, 11, 2)); // 周一换新的一周
  });

  it('跨年的周和月', () => {
    expect(startOfWeek(sh(2027, 1, 1, 9))).toBe(sh(2026, 12, 28));
    expect(startOfMonth(sh(2026, 12, 31, 23, 59))).toBe(sh(2026, 12, 1));
    expect(startOfNextMonth(sh(2026, 12, 15))).toBe(sh(2027, 1, 1));
    expect(startOfMonth(sh(2027, 1, 1, 0, 0))).toBe(sh(2027, 1, 1));
  });

  it('日历天数差按北京时间的日期算', () => {
    expect(calendarDaysBetween(sh(2026, 10, 30, 23, 50), sh(2026, 10, 31, 0, 10))).toBe(1);
    expect(calendarDaysBetween(sh(2026, 10, 31, 0, 10), sh(2026, 10, 31, 23, 50))).toBe(0);
    expect(calendarDaysBetween(sh(2026, 10, 1, 8), sh(2026, 10, 31, 8))).toBe(30);
  });
});

describe('中文日期格式', () => {
  const now = sh(2026, 10, 31, 20);

  it('时间和日期', () => {
    expect(formatClock(sh(2026, 10, 31, 8, 5))).toBe('08:05');
    expect(formatDateWithWeekday(now)).toBe('10月31日 周六');
  });

  it('相对日期', () => {
    expect(formatRelativeDay(sh(2026, 10, 31, 7), now)).toBe('今天');
    expect(formatRelativeDay(sh(2026, 10, 30, 23), now)).toBe('昨天');
    expect(formatRelativeDay(sh(2026, 10, 29, 1), now)).toBe('前天');
    expect(formatRelativeDay(sh(2026, 10, 27, 1), now)).toBe('4 天前');
    expect(formatRelativeDay(sh(2026, 10, 3, 1), now)).toBe('10月3日');
    expect(formatRelativeDay(sh(2025, 12, 3, 1), now)).toBe('2025年12月3日');
    expect(formatRelativeDateTime(sh(2026, 10, 30, 21, 30), now)).toBe('昨天 21:30');
    expect(formatRelativeDateTime(sh(2026, 10, 27, 21, 30), now)).toBe('4 天前');
  });
});
