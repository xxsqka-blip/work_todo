/// <reference lib="webworker" />
/**
 * Service worker：把网页文件缓存到手机上，没网也能打开。
 * 第 3 步会在这里加上接收推送通知的代码。
 */
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry | string> };

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// 所有页面地址都返回缓存里的 index.html（单页应用），接口地址除外
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }));
