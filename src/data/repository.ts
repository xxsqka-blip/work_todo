/**
 * 数据层接口。界面只通过这个接口读写数据：
 * - 演示版：LocalChoreRepository（存在手机本地 localStorage）
 * - 第 2 步：换成调用 Cloudflare Workers 接口（数据在 D1），界面代码不用改
 */
import type { Chore, ChoreInput, Completion, HouseholdData, Member } from '../domain/types';

export interface AddCompletionInput {
  choreId: string;
  memberId: string;
  /** 不填就是现在 */
  doneAt?: number;
}

export interface ChoreRepository {
  /** 'demo' = 演示版本地数据；'cloud' = 连后端 */
  readonly kind: 'demo' | 'cloud';

  /** 读取整个"家"的数据：成员、家务、打卡记录 */
  load(): Promise<HouseholdData>;

  updateMember(id: string, patch: { name: string }): Promise<Member>;

  createChore(input: ChoreInput): Promise<Chore>;
  updateChore(id: string, input: ChoreInput): Promise<Chore>;
  /** 删除家务；已有的打卡记录保留（历史和统计照样显示） */
  deleteChore(id: string): Promise<void>;

  /** 打卡 */
  addCompletion(input: AddCompletionInput): Promise<Completion>;
  /** 撤销 / 删除一条打卡记录 */
  removeCompletion(id: string): Promise<void>;

  /** 数据在别处被改了（另一个标签页、另一台手机）时通知界面刷新。返回取消订阅的函数 */
  subscribe(listener: () => void): () => void;

  /** 仅演示版：清空并恢复成初始清单 */
  resetDemo?(): Promise<void>;
}

/** "我是谁"：这台设备上当前用谁的身份打卡 */
export interface IdentityStore {
  getMemberId(): string | null;
  setMemberId(id: string): void;
}
