/**
 * 演示版走查：在 iPhone 13 尺寸的浏览器里把主要流程走一遍，每一步都有断言，截图存到 docs/screenshots/。
 * 用固定的模拟时间（2026-11-01 周日 → 11-02 周一 → 11-04 周三），结果可以重复。
 *
 * 用法（需要 Playwright，云端开发环境里自带）：
 *   npm run build
 *   npx vite preview --port 4173 &
 *   node scripts/demo-walkthrough.cjs docs/screenshots http://localhost:4173/
 */
const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');
const OUT = process.argv[2] || 'docs/screenshots';
const BASE = process.argv[3] || 'http://localhost:4173/';

const at = (s) => new Date(s + '+08:00'); // 北京时间
const log = (...a) => console.log('✔', ...a);
const exact = (t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

(async () => {
  const browser = await chromium.launch();
  const device = { ...devices['iPhone 13'], deviceScaleFactor: 2 };
  const ctx = await browser.newContext({ ...device, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const shot = async (name, { waitToast = false } = {}) => {
    if (waitToast) await page.locator('.toast').waitFor({ state: 'detached', timeout: 8000 });
    await page.waitForTimeout(350); // 等动画
    await page.screenshot({ path: `${OUT}/${name}.png` });
  };
  const card = (name) => page.locator('.chore-card', { has: page.locator('.chore-name', { hasText: exact(name) }) });
  const inGroup = async (name, status) => {
    await assert.equal(await page.locator(`section.status-${status} .chore-card`, { has: page.locator('.chore-name', { hasText: exact(name) }) }).count(), 1, `${name} 应该在 ${status} 组`);
  };
  const checkIn = async (name) => {
    await card(name).locator('.checkin').click();
    await page.locator('.toast').waitFor();
  };
  const switchTo = async (who) => {
    await page.locator('.who', { hasText: exact(who) }).click();
    assert.equal(await page.locator('.who.active').innerText(), who);
  };
  const goTab = (label) => page.locator('.tab', { hasText: label }).click();
  const setTime = async (s) => {
    await page.clock.setFixedTime(at(s));
    await page.reload();
    await page.locator('.chore-card').first().waitFor();
  };

  // ---------- 第 0 天：周日 11月1日 10:00，第一次打开 ----------
  await page.clock.setFixedTime(at('2026-11-01T10:00:00'));
  await page.goto(BASE);
  await page.locator('.chore-card').first().waitFor();
  assert.equal(await page.locator('section.status-due .chore-card').count(), 18, '首次打开导入 18 项，全部"该做了"');
  assert.equal(await page.locator('.who.active').innerText(), '我');
  log('首次打开：导入 18 项初始家务，默认身份"我"');
  await shot('01-first-open');

  await switchTo('TA');
  assert.match(await page.locator('.toast').innerText(), /现在以「TA」的身份打卡/);
  log('切换成员：TA');

  await checkIn('买菜');
  assert.match(await page.locator('.toast').innerText(), /买菜：记在「TA」名下 \+2 分/);
  await inGroup('买菜', 'later');
  assert.match(await card('买菜').innerText(), /本周 1\/2/);
  assert.match(await card('买菜').innerText(), /上次：TA · 今天 10:00/);
  log('TA 打卡"买菜"：移到"还不急"，进度 1/2，显示上次是 TA');
  await card('买菜').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await shot('02-switch-member-check-in');

  await switchTo('我');
  await checkIn('换毛巾');
  await inGroup('换毛巾', 'done');
  log('我 打卡"换毛巾"（每周 1 次）：移到"本周已完成"');

  await checkIn('洗衣服晒衣服');
  await inGroup('洗衣服晒衣服', 'later');
  await page.locator('.toast-action', { hasText: '撤销' }).click();
  await page.locator('.toast', { hasText: '已撤销这次打卡' }).waitFor();
  await inGroup('洗衣服晒衣服', 'due');
  assert.match(await card('洗衣服晒衣服').innerText(), /本周 0\/2/);
  assert.match(await card('洗衣服晒衣服').innerText(), /还没做过/);
  log('误点"洗衣服晒衣服"后点撤销：回到"该做了"，进度 0/2');
  await card('洗衣服晒衣服').scrollIntoViewIfNeeded();
  await shot('03-undo');

  // ---------- 第 1 天：周一 11月2日 19:00（新的一周） ----------
  await setTime('2026-11-02T19:00:00');
  assert.match(await card('买菜').innerText(), /本周 0\/2/, '新的一周进度清零');
  await inGroup('买菜', 'later');
  await inGroup('换毛巾', 'later');
  log('新的一周：进度清零，但"该不该做"按间隔，买菜、换毛巾仍是"还不急"');
  await switchTo('TA');
  for (const n of ['做饭', '吸地拖地', '擦柜子']) await checkIn(n);
  await switchTo('我');
  for (const n of ['洗碗擦灶台', '扔垃圾（厨余 + 客厅）', '换床单']) await checkIn(n);

  // ---------- 第 3 天：周三 11月4日 20:30 ----------
  await setTime('2026-11-04T20:30:00');
  await inGroup('做饭', 'due');
  assert.match(await card('做饭').innerText(), /已经超了 1 天/);
  assert.match(await card('做饭').innerText(), /上次：TA · 前天 19:00/);
  await inGroup('吸地拖地', 'later');
  assert.match(await card('吸地拖地').innerText(), /本周 1\/2[\s\S]*后天该做/);
  await inGroup('买菜', 'later');
  assert.match(await card('买菜').innerText(), /明天该做/);
  await inGroup('擦柜子', 'done');
  await inGroup('换床单', 'later');
  assert.match(await card('换床单').innerText(), /本月 1\/2[\s\S]*13 天后（11月17日）该做/);
  log('周三：每天的家务又"该做了"（超 1 天）；每周 2 次的按 4 天间隔；换床单按 15 天间隔');
  await page.locator('section.status-later').scrollIntoViewIfNeeded();
  await shot('04-wednesday-home');

  await checkIn('做饭');
  await checkIn('扔垃圾（厨余 + 客厅）');
  await inGroup('做饭', 'later');

  // ---------- 添加家务：连续添加两项 ----------
  await goTab('家务');
  assert.equal(await page.locator('.chores-page .list-row-button').count(), 18);
  await page.getByRole('button', { name: '添加家务' }).click();
  await page.locator('#chore-name').fill('修灯泡');
  await page.getByRole('button', { name: '图标 💡' }).click();
  await page.getByRole('radio', { name: '一次性' }).click();
  await page.locator('.stepper[aria-label="积分"] button[aria-label="增加"]').click();
  await page.getByRole('button', { name: '保存，继续添加下一项' }).click();
  await page.locator('.added-banner', { hasText: '这次已添加 1 项：修灯泡' }).waitFor();
  assert.equal(await page.locator('#chore-name').inputValue(), '', '继续添加时名称清空');
  log('添加"修灯泡"后表单清空，可以接着填下一项');

  await page.locator('#chore-name').fill('倒可回收垃圾');
  await page.getByRole('button', { name: '图标 ♻️' }).click();
  await page.getByRole('radio', { name: '固定周几' }).click();
  await page.getByRole('button', { name: '周六' }).click(); // 取消默认的周六
  await page.getByRole('button', { name: '周二' }).click();
  await page.getByRole('button', { name: '周五' }).click();
  await page.locator('.stepper[aria-label="积分"] button[aria-label="减少"]').click();
  await page.getByRole('switch', { name: '提醒' }).click();
  await page.locator('input[aria-label="提醒时间"]').fill('20:30');
  await page.locator('.sheet-body').evaluate((el) => el.scrollTo(0, 0));
  await shot('05-add-chores-continuously', { waitToast: true });
  await page.locator('.sheet-body').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await shot('06-reminder-and-save');
  await page.getByRole('button', { name: '保存并关闭' }).click();
  await page.locator('.sheet').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.chores-page .list-row-button').count(), 20);
  const recycleRow = page.locator('.list-row', { hasText: '倒可回收垃圾' });
  assert.match(await recycleRow.innerText(), /每周二、五/);
  assert.match(await recycleRow.innerText(), /20:30/);
  log('再添加"倒可回收垃圾"（每周二、五，提醒 20:30）：家务从 18 项变成 20 项');

  // ---------- 复制一项再改 ----------
  await page.getByRole('button', { name: '复制「擦窗户」' }).click();
  assert.equal(await page.locator('.sheet-title').innerText(), '复制家务');
  await page.locator('#chore-name').fill('擦纱窗');
  await page.getByRole('button', { name: '保存并关闭' }).click();
  await page.locator('.sheet').waitFor({ state: 'detached' });
  const copied = page.locator('.list-row', { hasText: '擦纱窗' });
  assert.match(await copied.innerText(), /每 3 个月一次/);
  assert.match(await copied.innerText(), /3 分/);
  log('复制"擦窗户"改名"擦纱窗"：频率、积分沿用');
  await page.locator('.list-row', { hasText: '修灯泡' }).scrollIntoViewIfNeeded();
  await shot('07-chore-list', { waitToast: true });

  // ---------- 回首页看新家务，TA 打卡修灯泡 ----------
  await goTab('今天');
  await inGroup('修灯泡', 'due');
  await inGroup('倒可回收垃圾', 'later');
  assert.match(await card('倒可回收垃圾').innerText(), /后天该做/, '周三新建，本周二不算，周五才该做');
  await switchTo('TA');
  await checkIn('修灯泡');
  await inGroup('修灯泡', 'done');
  log('新家务出现在首页；周三新建的"每周二、五"不追究已经过去的周二');

  // ---------- 统计 ----------
  await goTab('统计');
  const rows = async (i) =>
    page.locator('.stats-card').nth(i).locator('tbody tr.stats-row').evaluateAll((trs) =>
      trs.map((tr) => [...tr.querySelectorAll('th,td')].map((c) => { const k = c.cloneNode(true); k.querySelectorAll('.avatar').forEach((a) => a.remove()); return k.textContent.replace(/\s+/g, ''); })),
    );
  assert.deepEqual(await rows(0), [['我', '5次', '9分'], ['TA', '4次', '8分']], '本周统计');
  assert.deepEqual(await rows(1), [['我', '6次', '10分'], ['TA', '5次', '10分']], '本月统计');
  log('统计：本周 我 5 次 9 分 / TA 4 次 8 分；本月 我 6 次 10 分 / TA 5 次 10 分');
  await shot('08-stats', { waitToast: true });

  // ---------- 历史记录 ----------
  await goTab('记录');
  assert.equal(await page.locator('.day-group').count(), 3);
  assert.match(await page.locator('.day-title').first().innerText(), /今天 · 11月4日 周三[\s\S]*3 次 · 6 分/);
  log('历史记录：按天倒序，三天的记录');
  await shot('09-history');

  // ---------- 离线也能打开 ----------
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => !!navigator.serviceWorker.controller));
  await ctx.setOffline(true);
  await page.reload();
  await page.locator('.list-row').first().waitFor();
  log('断网后刷新：页面照常打开（service worker 离线缓存）');
  await ctx.setOffline(false);

  // ---------- 深色模式 ----------
  const data = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  const dark = await browser.newContext({ ...device, locale: 'zh-CN', colorScheme: 'dark' });
  await dark.addInitScript((d) => {
    if (!localStorage.getItem('jiawu.demo.v1')) for (const [k, v] of Object.entries(JSON.parse(d))) localStorage.setItem(k, v);
  }, data);
  const dp = await dark.newPage();
  await dp.clock.setFixedTime(at('2026-11-04T20:40:00'));
  await dp.goto(BASE);
  await dp.locator('.chore-card').first().waitFor();
  await dp.waitForTimeout(300);
  await dp.screenshot({ path: `${OUT}/10-dark-mode.png` });
  log('深色模式跟随系统');

  // ---------- 窄屏 + 长名字：顶栏不能被挤出屏幕 ----------
  await page.clock.setFixedTime(at('2026-11-04T20:45:00'));
  await goTab('家务');
  for (const [i, name] of [[0, '老婆大人'], [1, '老公大人']]) {
    await page.locator('.list-row', { hasText: '改名字' }).nth(i).getByRole('button', { name: '改名字' }).click();
    await page.locator('#member-name').fill(name);
    await page.getByRole('button', { name: '保存' }).click();
    await page.locator('.sheet').waitFor({ state: 'detached' });
  }
  await page.setViewportSize({ width: 375, height: 667 });
  await goTab('今天');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `窄屏不应横向溢出，溢出了 ${overflow}px`);
  const box = await page.locator('.whoami').boundingBox();
  assert.ok(box.x + box.width <= 375, '成员切换按钮在屏幕内');
  log('iPhone SE 宽度（375px）+ 长名字：顶栏不溢出');
  await page.screenshot({ path: `${OUT}/11-narrow-screen-long-names.png` });

  assert.deepEqual(errors, [], '浏览器控制台没有报错');
  log('全程浏览器控制台没有报错');
  await browser.close();
})().catch((e) => {
  console.error('✘', e.message);
  process.exit(1);
});
