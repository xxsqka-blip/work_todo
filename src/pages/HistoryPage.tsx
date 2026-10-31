/** 历史记录：按时间倒序，按天分组，可以按人筛选、撤销某一条 */
import { useState } from 'preact/hooks';
import { groupByDay } from '../domain/stats';
import { formatClock, formatDateWithWeekday, formatRelativeDay } from '../domain/time';
import type { Completion } from '../domain/types';
import { Avatar, EmptyState, Segmented } from '../ui/components';
import { useOverlay } from '../ui/overlays';
import { useStore } from '../ui/store';

const PAGE = 100;

function dayLabel(dayStart: number, now: number): string {
  const rel = formatRelativeDay(dayStart, now);
  const date = formatDateWithWeekday(dayStart);
  return ['今天', '昨天', '前天'].includes(rel) ? `${rel} · ${date}` : date;
}

export function HistoryPage() {
  const { data, now, memberById, mutate } = useStore();
  const { toast, confirm } = useOverlay();
  const [who, setWho] = useState<string>('all');
  const [limit, setLimit] = useState(PAGE);

  if (!data) return null;

  const filtered = data.completions.filter((c) => who === 'all' || c.memberId === who);
  const sorted = [...filtered].sort((a, b) => b.doneAt - a.doneAt);
  const groups = groupByDay(sorted.slice(0, limit));

  async function undo(c: Completion) {
    const member = memberById(c.memberId);
    const ok = await confirm({
      title: '撤销这条打卡？',
      message: `${c.choreEmoji} ${c.choreName} · ${member?.name ?? ''} · ${formatRelativeDay(c.doneAt, now)} ${formatClock(c.doneAt)}`,
      confirmLabel: '撤销',
      danger: true,
    });
    if (!ok) return;
    const done = await mutate(async (r) => {
      await r.removeCompletion(c.id);
      return true;
    });
    if (done) toast('已撤销');
  }

  const options = [{ value: 'all', label: '全部' }, ...data.members.map((m) => ({ value: m.id, label: m.name }))];

  return (
    <div class="history-page">
      <Segmented label="看谁的记录" options={options} value={who} onChange={setWho} />

      {groups.length === 0 ? (
        <EmptyState emoji="📝" title="还没有打卡记录">
          在"今天"页点"打卡"，记录就会出现在这里。
        </EmptyState>
      ) : (
        groups.map((g) => (
          <section class="day-group" key={g.dayStart}>
            <h2 class="day-title">
              <span>{dayLabel(g.dayStart, now)}</span>
              <span class="day-sum">
                {g.items.length} 次 · {g.points} 分
              </span>
            </h2>
            <ul class="list card">
              {g.items.map((c) => {
                const m = memberById(c.memberId);
                return (
                  <li class="list-row" key={c.id}>
                    <span class="chore-emoji small" aria-hidden="true">
                      {c.choreEmoji}
                    </span>
                    <span class="list-row-main">
                      <span class="list-row-title">{c.choreName}</span>
                      <span class="list-row-sub">
                        <Avatar member={m} size={16} /> {m?.name ?? '已移除的成员'} · {formatClock(c.doneAt)}
                      </span>
                    </span>
                    <span class="points">+{c.points}</span>
                    <button type="button" class="btn btn-secondary btn-tiny" onClick={() => void undo(c)}>
                      撤销
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {sorted.length > limit && (
        <button type="button" class="btn btn-secondary btn-block" onClick={() => setLimit((l) => l + PAGE)}>
          再看 {Math.min(PAGE, sorted.length - limit)} 条
        </button>
      )}
    </div>
  );
}
