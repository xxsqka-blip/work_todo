import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { browserStorage, LocalChoreRepository, LocalIdentityStore } from './data/localRepository';
import './styles.css';

// 演示版：数据存在这台设备上。第 2 步在这里换成连 Cloudflare 后台的实现。
const storage = browserStorage();
const repo = new LocalChoreRepository(storage);
const identity = new LocalIdentityStore(storage);

render(<App repo={repo} identity={identity} />, document.getElementById('app')!);

// 离线缓存；有新版本时自动更新
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}
