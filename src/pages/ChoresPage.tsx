/** 家务管理：列表、添加、复制、编辑；成员改名；演示数据重置 */
import { useState } from 'preact/hooks';
import { describeFrequency, describeInterval } from '../domain/schedule';
import type { Chore, Member } from '../domain/types';
import { Avatar, Icon, Sheet } from '../ui/components';
import { useOverlay } from '../ui/overlays';
import { useStore } from '../ui/store';

export function ChoresPage(props: { onAdd: () => void; onEdit: (id: string) => void; onCopy: (id: string) => void }) {
  const { data, repo, mutate } = useStore();
  const { toast, confirm } = useOverlay();
  const [renaming, setRenaming] = useState<Member | null>(null);

  if (!data) return null;
  const chores = [...data.chores].sort((a, b) => a.sortOrder - b.sortOrder);

  async function resetDemo() {
    const ok = await confirm({
      title: '恢复成初始清单？',
      message: '会删掉这台手机上所有的家务和打卡记录，换回最开始的 18 项家务。',
      confirmLabel: '恢复',
      danger: true,
    });
    if (!ok) return;
    const done = await mutate(async (r) => {
      await r.resetDemo?.();
      return true;
    });
    if (done) toast('已恢复成初始清单');
  }

  return (
    <div class="chores-page">
      <div class="toolbar">
        <span class="toolbar-text">共 {chores.length} 项</span>
        <button type="button" class="btn btn-primary btn-small" onClick={props.onAdd}>
          <Icon.Plus size={18} />
          添加家务
        </button>
      </div>

      <ul class="list card">
        {chores.map((c) => (
          <ChoreRow key={c.id} chore={c} onEdit={() => props.onEdit(c.id)} onCopy={() => props.onCopy(c.id)} />
        ))}
        {chores.length === 0 && <li class="list-empty">还没有家务，点右上角"添加家务"。</li>}
      </ul>

      <h2 class="section-title">成员</h2>
      <ul class="list card">
        {data.members.map((m) => (
          <li class="list-row" key={m.id}>
            <Avatar member={m} size={32} />
            <span class="list-row-main">
              <span class="list-row-title">{m.name}</span>
            </span>
            <button type="button" class="btn btn-secondary btn-small" onClick={() => setRenaming(m)}>
              改名字
            </button>
          </li>
        ))}
      </ul>

      {repo.kind === 'demo' && (
        <>
          <h2 class="section-title">演示模式</h2>
          <div class="card note-card">
            <p>
              现在是<strong>演示版</strong>：数据只存在这台手机上，两个人的手机之间还不会同步。顶部的"我是"可以切换身份，用来试试两个人轮流打卡的效果。
            </p>
            <p>确认界面和流程没问题后，下一步会接上 Cloudflare 后台：两个人共用一份数据，还能收到提醒。</p>
            <button type="button" class="btn btn-danger-text" onClick={() => void resetDemo()}>
              恢复成初始清单
            </button>
          </div>
        </>
      )}

      {renaming && <RenameSheet member={renaming} onClose={() => setRenaming(null)} />}
    </div>
  );
}

function ChoreRow(props: { chore: Chore; onEdit: () => void; onCopy: () => void }) {
  const c = props.chore;
  const interval = describeInterval(c.frequency);
  return (
    <li class="list-row">
      <button type="button" class="list-row-button" onClick={props.onEdit} aria-label={`编辑「${c.name}」`}>
        <span class="chore-emoji small" aria-hidden="true">
          {c.emoji}
        </span>
        <span class="list-row-main">
          <span class="list-row-title">{c.name}</span>
          <span class="list-row-sub">
            {describeFrequency(c.frequency)}
            {interval && interval !== '每天都该做' ? `（${interval}）` : ''} · {c.points} 分
            {c.reminder.enabled && (
              <span class="reminder-tag">
                <Icon.Bell /> {c.reminder.time}
              </span>
            )}
          </span>
          {c.note && <span class="list-row-note">{c.note}</span>}
        </span>
      </button>
      <button type="button" class="icon-btn" onClick={props.onCopy} aria-label={`复制「${c.name}」`} title="复制">
        <Icon.Copy />
        <span class="icon-btn-label">复制</span>
      </button>
    </li>
  );
}

function RenameSheet(props: { member: Member; onClose: () => void }) {
  const { mutate } = useStore();
  const { toast } = useOverlay();
  const [name, setName] = useState(props.member.name);

  async function save() {
    const ok = await mutate((r) => r.updateMember(props.member.id, { name }));
    if (ok) {
      toast(`已改成「${ok.name}」`);
      props.onClose();
    }
  }

  return (
    <Sheet
      title="改名字"
      onClose={props.onClose}
      left={
        <button type="button" class="link-btn" onClick={props.onClose}>
          取消
        </button>
      }
      right={
        <button type="button" class="link-btn strong" onClick={() => void save()}>
          保存
        </button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div class="field">
          <label class="field-label" for="member-name">
            名字（最多 12 个字）
          </label>
          <input
            id="member-name"
            class="input"
            value={name}
            maxLength={12}
            autoFocus
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </div>
      </form>
    </Sheet>
  );
}
