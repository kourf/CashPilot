const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Users\\RO2TK\\AppData\\Local\\Temp\\chrome_pwa_test_' + Date.now();

const chrome = spawn(chromePath, [
  '--remote-debugging-port=9222',
  '--headless=new',
  '--user-data-dir=' + userDataDir,
  '--no-first-run',
  '--no-default-browser-check',
  'https://cashpilot-app-2026.web.app'
], { detached: false });

console.log('Started Chrome PID:', chrome.pid);

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      const tabs = await res.json();
      console.log('Available tabs:', tabs.length);
      const appTab = tabs.find(t => t.url.includes('cashpilot') || t.url.includes('web.app'));
      if (appTab && appTab.webSocketDebuggerUrl) {
        return appTab.webSocketDebuggerUrl;
      }
    } catch (e) {
      // wait
    }
  }
  return null;
}

async function run() {
  try {
    const wsUrl = await getWsUrl();
    console.log('WebSocket URL:', wsUrl);
    if (!wsUrl) {
      console.error('Could not connect to Chrome CDP');
      chrome.kill();
      process.exit(1);
    }

    const { WebSocket } = require('undici');
    const ws = new WebSocket(wsUrl);

    let id = 1;
    const send = (method, params = {}) => {
      const msgId = id++;
      ws.send(JSON.stringify({ id: msgId, method, params }));
      return new Promise((resolve) => {
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
      });
    };

    ws.addEventListener('open', async () => {
      console.log('Connected to CDP!');
      
      // Listen for console and page events
      ws.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Runtime.consoleAPICalled') {
          console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
        }
        if (msg.method === 'Log.entryAdded') {
          console.log('[BROWSER LOG]', msg.params.entry.level, msg.params.entry.text);
        }
      });

      await send('Console.enable');
      await send('Runtime.enable');
      await send('Page.enable');
      await send('ServiceWorker.enable');

      // Wait 5 seconds for page load & service worker to initialize
      console.log('Waiting 5s for page lifecycle...');
      await sleep(5000);

      // Check Manifest
      const manifestRes = await send('Page.getAppManifest');
      console.log('=== APP MANIFEST STATUS ===');
      console.log('Manifest URL:', manifestRes.url);
      console.log('Manifest Errors:', manifestRes.errors);
      if (manifestRes.data) {
        console.log('Manifest parsed successfully!');
      }

      // Check Installability
      const evalInstallable = await send('Runtime.evaluate', {
        expression: `({
          hasPrompt: Boolean(window.__pwaInstallPrompt),
          isStandalone: window.matchMedia('(display-mode: standalone)').matches,
          swRegistrations: 'serviceWorker' in navigator,
          controller: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller)
        })`,
        returnByValue: true
      });
      console.log('Window PWA check:', evalInstallable.result.value);

      // Check Service Worker status
      const swCheck = await send('Runtime.evaluate', {
        expression: `navigator.serviceWorker.getRegistrations().then(r => r.map(x => ({ scope: x.scope, active: Boolean(x.active) })))`,
        awaitPromise: true,
        returnByValue: true
      });
      console.log('ServiceWorker registrations:', swCheck.result.value);

      chrome.kill();
      process.exit(0);
    });
  } catch (err) {
    console.error('Error in CDP runner:', err);
    chrome.kill();
    process.exit(1);
  }
}

run();
