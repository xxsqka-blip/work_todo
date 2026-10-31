/**
 * 数据模型。演示版存在手机本地（localStorage），第 2 步换成 Cloudflare D1，
 * 两边用的都是这一套类型。
 */

/** 1 = 周一 … 7 = 周日 */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Frequency =
  /** 每周 N 次（每天做的就是每周 7 次） */
  | { type: 'weekly'; times: number }
  /** 每月 N 次 */
  | { type: 'monthly'; times: number }
  /** 每 M 个月一次 */
  | { type: 'everyMonths'; months: number }
  /** 每周固定周几 */
  | { type: 'weekdays'; days: Weekday[] }
  /** 一次性 */
  | { type: 'once' };

export type FrequencyType = Frequency['type'];

export interface Reminder {
  enabled: boolean;
  /** 北京时间 "HH:MM" */
  time: string;
}

export interface Member {
  id: string;
  name: string;
  /** 头像颜色，统计图里也用 */
  color: string;
}

export interface Chore {
  id: string;
  name: string;
  emoji: string;
  frequency: Frequency;
  points: number;
  reminder: Reminder;
  note: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

/** 新建 / 编辑家务时用户能填的字段 */
export type ChoreInput = Pick<Chore, 'name' | 'emoji' | 'frequency' | 'points' | 'reminder' | 'note'>;

/** 一条打卡记录 */
export interface Completion {
  id: string;
  choreId: string;
  memberId: string;
  /** 打卡时间（毫秒时间戳） */
  doneAt: number;
  /** 打卡当时这项家务的分值 */
  points: number;
  /** 打卡当时的名称和图标，家务删掉后历史记录照样能显示 */
  choreName: string;
  choreEmoji: string;
}

export interface HouseholdData {
  members: Member[];
  chores: Chore[];
  completions: Completion[];
}
