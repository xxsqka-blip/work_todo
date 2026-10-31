import { useState } from 'preact/hooks';
import { groupChores, type ChoreState, type ChoreStatus } from '../domain/schedule';
import { formatDateWithWeekday, formatRelativeDateTime } from '../domain/time';
import { Avatar, EmptyState, Icon } from '../ui/components';
import { progressText, STATUS_LABELS, statusHint } from '../ui/describe';
import { useOverlay } from '../ui/overlays';
import { useStore } from '../ui/store';

export function HomePage(props: { onEditChore: (choreId: string) => void; onAddChore: () => void }) {
  const { data, now, me, memberById, mutate } = useStore();
  const { toast } = useOverlay();
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [flashId, setFlashId] = useState<string | null>(null);

  if (!data) return null;

  const groups = groupChores(data.chores, data.completions, now);

  async function checkIn(s: ChoreState) {
    if (!me || pending.has(s.chore.id)) return;
    setPending((p) => new Set(p).add(s.chore.id));
    const rec = await mutate((r) => r.addCompletion({ choreId: s.chore.id, memberId: me.id }));
    setPending((p) => {
      const n = new Set(p);
      n.delete(s.chore.id);
      return n;
    });
    if (!rec) return;
    setFlashId(s.chore.id);
    window.setTimeout(() => setFlashId((id) => (id === s.chore.id ? null : id)), 1600);
    toast({
      message: `${s.chore.emoji} ${s.chore.name}：记在「${me.name}」名下 +${rec.points} 分`,
      actionLabel: '撤销',
      onAction: async () => {
        const ok = await mutate(async (r) => {
          await r.removeCompletion(rec.id);
          return true;
        });
        if (ok) toast('已撤销这次打卡');
      },
    });
  }

  if (data.chores.length === 0) {
    return (
      <EmptyState emoji="🧺" title="还没有家务">
        <button type="button" class="btn btn-primary" onClick={props.onAddChore}>
          添加家务
        </button>
      </EmptyState>
    );
  }

  const section = (status: ChoreStatus, items: ChoreState[], emptyText: string) => (
    <section class={`group status-${status}`} aria-labelledby={`group-${status}`}>
      <h2 class="group-title" id={`group-${status}`}>
        <span class="status-dot" aria-hidden="true" />
        {STATUS_LABELS[status]}
        <span class="group-count">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p class="group-empty">{emptyText}</p>
      ) : (
        <ul class="card-list">
          {items.map((s) => (
            <ChoreCard
              key={s.chore.id}
              state={s}
              now={now}
              flash={flashId === s.chore.id}
              pending={pending.has(s.chore.id)}
              lastMemberName={s.lastCompletion ? memberById(s.lastCompletion.memberId)?.name ?? '已移除的成员' : null}
              onCheckIn={() => void checkIn(s)}
              onOpen={() => props.onEditChore(s.chore.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div class="home">
      <div class="today-line">
        <span>{formatDateWithWeekday(now)}</span>
        {me && (
          <span class="today-me">
            <Avatar member={me} size={18} />
            以「{me.name}」的身份打卡
          </span>
        )}
      </div>
      {section('due', groups.due, '都做完了，休息一下吧 🎉')}
      {section('later', groups.later, '暂时没有')}
      {section('done', groups.done, '这周还没有做满的家务')}
    </div>
  );
}

function ChoreCard(props: {
  state: ChoreState;
  now: number;
  flash: boolean;
  pending: boolean;
  lastMemberName: string | null;
  onCheckIn: () => void;
  onOpen: () => void;
}) {
  const { state: s, now } = props;
  const last = s.lastCompletion;
  return (
    <li class={`card chore-card status-${s.status} ${props.flash ? 'flash' : ''}`}>
      <button type="button" class="chore-main" onClick={props.onOpen} aria-label={`${s.chore.name}，查看或编辑`}>
        <span class="chore-emoji" aria-hidden="true">
          {s.chore.emoji}
        </span>
        <span class="chore-body">
          <span class="chore-name">{s.chore.name}</span>
          <span class="chore-meta">
            <span class="pill">{progressText(s)}</span>
            <span class="chore-hint">{statusHint(s, now)}</span>
          </span>
          {last && (
            <span class="chore-last">
              上次：{props.lastMemberName} · {formatRelativeDateTime(last.doneAt, now)}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        class="checkin"
        onClick={props.onCheckIn}
        disabled={props.pending}
        aria-label={`给「${s.chore.name}」打卡`}
      >
        <Icon.Check size={18} />
        <span>打卡</span>
      </button>
    </li>
  );
}
