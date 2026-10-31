/** 统计：本周、本月两个人各完成几次、各得多少分，放在一起对比 */
import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { breakdownByChore, monthRange, totalsByMember, weekRange, type DateRange } from '../domain/stats';
import { formatMonthDay, shanghaiParts } from '../domain/time';
import type { HouseholdData } from '../domain/types';
import { Avatar, Segmented } from '../ui/components';
import { useStore } from '../ui/store';

type PeriodKey = 'week' | 'month';

export function StatsPage() {
  const { data, now } = useStore();
  const [detail, setDetail] = useState<PeriodKey>('week');
  if (!data) return null;

  const week = weekRange(now);
  const month = monthRange(now);
  const ranges: Record<PeriodKey, DateRange> = { week, month };

  return (
    <div class="stats-page">
      <PeriodCard
        title="本周"
        subtitle={`${formatMonthDay(week.from)} – ${formatMonthDay(week.to - 1)}`}
        data={data}
        range={week}
      />
      <PeriodCard title="本月" subtitle={`${shanghaiParts(now).month}月`} data={data} range={month} />

      <h2 class="section-title">每项家务谁做了几次</h2>
      <Segmented
        label="明细范围"
        options={[
          { value: 'week', label: '本周' },
          { value: 'month', label: '本月' },
        ]}
        value={detail}
        onChange={setDetail}
      />
      <Breakdown data={data} range={ranges[detail]} />
    </div>
  );
}

function PeriodCard(props: { title: string; subtitle: string; data: HouseholdData; range: DateRange }) {
  const totals = totalsByMember(props.data.members, props.data.completions, props.range);
  const maxPoints = Math.max(1, ...totals.map((t) => t.points));
  const sumCount = totals.reduce((s, t) => s + t.count, 0);
  const sumPoints = totals.reduce((s, t) => s + t.points, 0);

  return (
    <section class="card stats-card" aria-label={`${props.title}统计`}>
      <div class="stats-card-head">
        <h2 class="stats-title">{props.title}</h2>
        <span class="stats-sub">{props.subtitle}</span>
      </div>
      <table class="stats-table">
        <thead>
          <tr>
            <th scope="col">成员</th>
            <th scope="col">完成</th>
            <th scope="col">积分</th>
          </tr>
        </thead>
        <tbody>
          {totals.map((t) => (
            <Fragment key={t.member.id}>
              <tr class="stats-row">
                <th scope="row">
                  <span class="stats-member">
                    <Avatar member={t.member} size={22} />
                    {t.member.name}
                  </span>
                </th>
                <td>
                  <strong>{t.count}</strong> 次
                </td>
                <td>
                  <strong>{t.points}</strong> 分
                </td>
              </tr>
              <tr class="stats-bar-row" aria-hidden="true">
                <td colSpan={3}>
                  <div class="bar-track">
                    <div
                      class="bar-fill"
                      style={{ width: `${(t.points / maxPoints) * 100}%`, background: t.member.color }}
                    />
                  </div>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">合计</th>
            <td>{sumCount} 次</td>
            <td>{sumPoints} 分</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

function Breakdown(props: { data: HouseholdData; range: DateRange }) {
  const rows = breakdownByChore(props.data.completions, props.range);
  if (rows.length === 0) return <p class="group-empty">这段时间还没有打卡</p>;
  return (
    <ul class="list card">
      {rows.map((r) => (
        <li class="list-row" key={r.choreId}>
          <span class="chore-emoji small" aria-hidden="true">
            {r.emoji}
          </span>
          <span class="list-row-main">
            <span class="list-row-title">{r.name}</span>
            <span class="list-row-sub chips">
              {props.data.members.map((m) => (
                <span class="chip" key={m.id}>
                  <Avatar member={m} size={16} />
                  {m.name} {r.counts[m.id] ?? 0}
                </span>
              ))}
            </span>
          </span>
          <span class="points">共 {r.total} 次</span>
        </li>
      ))}
    </ul>
  );
}
