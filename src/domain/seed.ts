/**
 * 初始家务清单，照 PLAN.md 第 7 节的表格。所有提醒默认关。
 * 演示版第一次打开时导入；第 2 步建"家"的时候也用这份。
 */
import type { ChoreInput, Member } from './types';

const OFF = { enabled: false, time: '20:00' } as const;
const SUGGESTED = '预设的建议项，用不上可以删';

const weekly = (times: number) => ({ type: 'weekly', times }) as const;
const monthly = (times: number) => ({ type: 'monthly', times }) as const;
const everyMonths = (months: number) => ({ type: 'everyMonths', months }) as const;

export const SEED_CHORES: readonly ChoreInput[] = [
  { name: '做饭', emoji: '🍳', frequency: weekly(7), points: 3, reminder: OFF, note: '' },
  { name: '洗碗擦灶台', emoji: '🍽️', frequency: weekly(7), points: 2, reminder: OFF, note: '' },
  { name: '扔垃圾（厨余 + 客厅）', emoji: '🗑️', frequency: weekly(7), points: 1, reminder: OFF, note: '' },
  { name: '吸地拖地', emoji: '🧹', frequency: weekly(2), points: 2, reminder: OFF, note: '' },
  { name: '洗衣服晒衣服', emoji: '👕', frequency: weekly(2), points: 2, reminder: OFF, note: '' },
  { name: '浴室洗漱区域清洁', emoji: '🚿', frequency: weekly(1), points: 2, reminder: OFF, note: '' },
  { name: '擦柜子', emoji: '🧽', frequency: weekly(1), points: 1, reminder: OFF, note: '' },
  { name: '换床单', emoji: '🛏️', frequency: monthly(2), points: 2, reminder: OFF, note: '' },
  { name: '收衣服叠衣服', emoji: '🧺', frequency: weekly(2), points: 1, reminder: OFF, note: SUGGESTED },
  { name: '买菜', emoji: '🛒', frequency: weekly(2), points: 2, reminder: OFF, note: SUGGESTED },
  { name: '刷马桶', emoji: '🚽', frequency: weekly(1), points: 1, reminder: OFF, note: SUGGESTED },
  { name: '整理收纳', emoji: '📦', frequency: weekly(1), points: 1, reminder: OFF, note: SUGGESTED },
  { name: '换毛巾', emoji: '🛁', frequency: weekly(1), points: 1, reminder: OFF, note: SUGGESTED },
  { name: '扔快递盒和纸箱', emoji: '♻️', frequency: weekly(1), points: 1, reminder: OFF, note: SUGGESTED },
  { name: '清理冰箱', emoji: '🧊', frequency: monthly(1), points: 2, reminder: OFF, note: SUGGESTED },
  { name: '清洗洗衣机滤网和胶圈', emoji: '🫧', frequency: monthly(1), points: 1, reminder: OFF, note: SUGGESTED },
  { name: '擦窗户', emoji: '🪟', frequency: everyMonths(3), points: 3, reminder: OFF, note: SUGGESTED },
  { name: '浇花', emoji: '🪴', frequency: weekly(2), points: 1, reminder: OFF, note: '预设的建议项，没养花就删' },
];

/** 演示版的两个示例成员 */
export const DEMO_MEMBERS: readonly Member[] = [
  { id: 'member-me', name: '我', color: '#d55181' },
  { id: 'member-ta', name: 'TA', color: '#3987e5' },
];
