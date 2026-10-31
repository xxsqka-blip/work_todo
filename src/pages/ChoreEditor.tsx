/** 添加 / 编辑 / 复制家务的面板。添加时可以"保存并继续添加"，一口气录好几项 */
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  defaultFrequency,
  emptyChoreInput,
  FREQUENCY_TYPE_LABELS,
  LIMITS,
  validateChoreInput,
} from '../domain/chore';
import { describeInterval, normalizeWeekdays } from '../domain/schedule';
import { WEEKDAY_SHORT } from '../domain/time';
import type { Chore, ChoreInput, FrequencyType, Weekday } from '../domain/types';
import { Segmented, Sheet, Stepper, Switch } from '../ui/components';
import { useOverlay } from '../ui/overlays';
import { useStore } from '../ui/store';

export type EditorMode = 'add' | 'edit' | 'copy';

const EMOJI_CHOICES = [
  '🍳', '🍽️', '🗑️', '🧹', '👕', '🚿', '🧽', '🛏️', '🧺', '🛒', '🚽', '📦',
  '🛁', '♻️', '🧊', '🫧', '🪟', '🪴', '🧼', '🧴', '🪣', '🧻', '🪥', '💡',
  '🔧', '🐱', '🐶', '🐟', '👶', '🚗', '💰', '📮', '🥬', '🍚', '🛋️', '📚',
];

const FREQ_OPTIONS = (Object.keys(FREQUENCY_TYPE_LABELS) as FrequencyType[]).map((value) => ({
  value,
  label: FREQUENCY_TYPE_LABELS[value],
}));

function lastGrapheme(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) {
    const parts = [...new Seg('zh', { granularity: 'grapheme' }).segment(trimmed)];
    return parts[parts.length - 1]?.segment ?? trimmed;
  }
  return trimmed;
}

function inputFromChore(c: Chore): ChoreInput {
  return {
    name: c.name,
    emoji: c.emoji,
    frequency: structuredClone(c.frequency),
    points: c.points,
    reminder: { ...c.reminder },
    note: c.note,
  };
}

export function ChoreEditor(props: { mode: EditorMode; chore?: Chore; onClose: () => void }) {
  const { mode, chore, onClose } = props;
  const { mutate } = useStore();
  const { toast, confirm } = useOverlay();
  const [form, setForm] = useState<ChoreInput>(() => (chore ? inputFromChore(chore) : emptyChoreInput()));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addedNames, setAddedNames] = useState<string[]>([]);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'add' || mode === 'copy') {
      const el = nameRef.current;
      el?.focus();
      if (mode === 'copy') el?.select();
    }
  }, []);

  const set = <K extends keyof ChoreInput>(key: K, value: ChoreInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  const title = mode === 'edit' ? '编辑家务' : mode === 'copy' ? '复制家务' : '添加家务';
  const f = form.frequency;

  async function save(continueAdding: boolean) {
    const problem = validateChoreInput(form);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      if (mode === 'edit' && chore) {
        const ok = await mutate((r) => r.updateChore(chore.id, form));
        if (ok) {
          toast(`已保存「${ok.name}」`);
          onClose();
        }
        return;
      }
      const created = await mutate((r) => r.createChore(form));
      if (!created) return;
      if (continueAdding) {
        setAddedNames((names) => [...names, created.name]);
        // 名称、图标、备注清空；频率、积分、提醒保留，方便录相似的家务
        setForm((prev) => ({ ...prev, name: '', emoji: '🧹', note: '' }));
        toast(`已添加「${created.name}」，接着填下一项`);
        nameRef.current?.focus();
      } else {
        toast(`已添加「${created.name}」`);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!chore) return;
    const ok = await confirm({
      title: `删除「${chore.name}」？`,
      message: '已经打过的卡会保留在历史记录和统计里。',
      confirmLabel: '删除',
      danger: true,
    });
    if (!ok) return;
    const done = await mutate(async (r) => {
      await r.deleteChore(chore.id);
      return true;
    });
    if (done) {
      toast(`已删除「${chore.name}」`);
      onClose();
    }
  }

  const toggleDay = (d: Weekday) => {
    if (f.type !== 'weekdays') return;
    const has = f.days.includes(d);
    set('frequency', { type: 'weekdays', days: normalizeWeekdays(has ? f.days.filter((x) => x !== d) : [...f.days, d]) });
  };

  const interval = describeInterval(f);

  return (
    <Sheet
      title={title}
      onClose={onClose}
      left={
        <button type="button" class="link-btn" onClick={onClose}>
          {addedNames.length > 0 ? '完成' : '取消'}
        </button>
      }
      right={
        <button type="button" class="link-btn strong" onClick={() => void save(false)} disabled={saving}>
          保存
        </button>
      }
    >
      <form
        class="editor"
        onSubmit={(e) => {
          e.preventDefault();
          void save(mode !== 'edit');
        }}
      >
        {addedNames.length > 0 && (
          <div class="added-banner" role="status">
            这次已添加 {addedNames.length} 项：{addedNames.join('、')}
          </div>
        )}

        <div class="field">
          <label class="field-label" for="chore-name">
            名称
          </label>
          <div class="name-row">
            <input
              id="chore-emoji"
              class="input emoji-input"
              value={form.emoji}
              aria-label="图标"
              inputMode="text"
              onFocus={(e) => e.currentTarget.select()}
              onInput={(e) => {
                const v = lastGrapheme(e.currentTarget.value);
                if (v) set('emoji', v);
              }}
            />
            <input
              id="chore-name"
              ref={nameRef}
              class="input"
              value={form.name}
              maxLength={LIMITS.nameMax}
              placeholder="比如：倒垃圾"
              enterKeyHint={mode === 'edit' ? 'done' : 'next'}
              autoComplete="off"
              onInput={(e) => set('name', e.currentTarget.value)}
            />
          </div>
          <p class="field-hint">点左边的图标可以用键盘输入任意 emoji，或者在下面左右滑动挑一个：</p>
          <div class="emoji-grid" role="group" aria-label="选一个图标">
            {EMOJI_CHOICES.map((e) => (
              <button
                type="button"
                class={`emoji-choice ${form.emoji === e ? 'active' : ''}`}
                aria-label={`图标 ${e}`}
                aria-pressed={form.emoji === e}
                onClick={() => set('emoji', e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div class="field">
          <div class="field-label">频率</div>
          <Segmented
            label="频率类型"
            options={FREQ_OPTIONS}
            value={f.type}
            onChange={(t) => t !== f.type && set('frequency', defaultFrequency(t))}
            small
          />
          <div class="freq-detail">
            {f.type === 'weekly' && (
              <div class="row">
                <span>每周</span>
                <Stepper
                  label="每周几次"
                  value={f.times}
                  min={1}
                  max={LIMITS.weeklyMax}
                  onChange={(v) => set('frequency', { type: 'weekly', times: v })}
                />
                <span>次</span>
              </div>
            )}
            {f.type === 'monthly' && (
              <div class="row">
                <span>每月</span>
                <Stepper
                  label="每月几次"
                  value={f.times}
                  min={1}
                  max={LIMITS.monthlyMax}
                  onChange={(v) => set('frequency', { type: 'monthly', times: v })}
                />
                <span>次</span>
              </div>
            )}
            {f.type === 'everyMonths' && (
              <div class="row">
                <span>每</span>
                <Stepper
                  label="每几个月"
                  value={f.months}
                  min={1}
                  max={LIMITS.monthsMax}
                  onChange={(v) => set('frequency', { type: 'everyMonths', months: v })}
                />
                <span>个月一次</span>
              </div>
            )}
            {f.type === 'weekdays' && (
              <div class="weekday-picker" role="group" aria-label="每周哪几天">
                {WEEKDAY_SHORT.map((label, i) => {
                  const d = (i + 1) as Weekday;
                  const on = f.days.includes(d);
                  return (
                    <button
                      type="button"
                      class={`weekday ${on ? 'active' : ''}`}
                      aria-pressed={on}
                      aria-label={`周${label}`}
                      onClick={() => toggleDay(d)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            <p class="field-hint">
              {f.type === 'weekly' && `${interval}：上次做完后过了 7÷${f.times} 天就变成"该做了"；本周做满 ${f.times} 次就不再催。`}
              {f.type === 'monthly' && `${interval}：上次做完后过了 30÷${f.times} 天就变成"该做了"；本月做满 ${f.times} 次就不再催。`}
              {f.type === 'everyMonths' && `${interval}：上次做完后过了 30×${f.months} 天就变成"该做了"。`}
              {f.type === 'weekdays' && '到了选中的那天就变成"该做了"，提前做也算。'}
              {f.type === 'once' && '做一次就完成，之后不再出现。'}
            </p>
          </div>
        </div>

        <div class="field">
          <div class="field-label">积分</div>
          <div class="row">
            <Stepper
              label="积分"
              value={form.points}
              min={LIMITS.pointsMin}
              max={LIMITS.pointsMax}
              onChange={(v) => set('points', v)}
            />
            <span>分</span>
          </div>
          <p class="field-hint">参考：1 分约 15 分钟以内，2 分约 15～45 分钟，3 分超过 45 分钟或者特别累。</p>
        </div>

        <div class="field">
          <div class="row space-between">
            <span class="field-label inline">提醒</span>
            <Switch
              label="提醒"
              checked={form.reminder.enabled}
              onChange={(v) => set('reminder', { ...form.reminder, enabled: v })}
            />
          </div>
          {form.reminder.enabled && (
            <div class="row">
              <span>变成"该做了"那天的</span>
              <input
                type="time"
                class="input time-input"
                aria-label="提醒时间"
                value={form.reminder.time}
                onInput={(e) => e.currentTarget.value && set('reminder', { ...form.reminder, time: e.currentTarget.value })}
              />
            </div>
          )}
          <p class="field-hint">演示版只保存这个设置，还不会真的推送。接上后台以后，会同时提醒你们两个人。</p>
        </div>

        <div class="field">
          <label class="field-label" for="chore-note">
            备注
          </label>
          <textarea
            id="chore-note"
            class="input"
            rows={2}
            maxLength={LIMITS.noteMax}
            placeholder="可以不填"
            value={form.note}
            onInput={(e) => set('note', e.currentTarget.value)}
          />
        </div>

        {error && (
          <p class="form-error" role="alert">
            {error}
          </p>
        )}

        <div class="editor-actions">
          {mode === 'edit' ? (
            <>
              <button type="submit" class="btn btn-primary btn-block" disabled={saving}>
                保存
              </button>
              <button type="button" class="btn btn-danger-text btn-block" onClick={() => void remove()}>
                删除这项家务
              </button>
            </>
          ) : (
            <>
              <button type="submit" class="btn btn-primary btn-block" disabled={saving}>
                保存，继续添加下一项
              </button>
              <button type="button" class="btn btn-secondary btn-block" disabled={saving} onClick={() => void save(false)}>
                保存并关闭
              </button>
            </>
          )}
        </div>
      </form>
    </Sheet>
  );
}
