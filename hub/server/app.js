import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverCapabilities } from './discover.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ scanRoots = ['agents'], processManager, launcher }) {
  const app = express();
  app.use(express.json());

  function load() {
    return discoverCapabilities(scanRoots);
  }
  function findCap(id) {
    return load().capabilities.find(c => c.id === id);
  }

  app.get('/api/capabilities', (req, res) => {
    const { capabilities, warnings } = load();
    const withStatus = capabilities.map(c =>
      c.launch.type === 'server' ? { ...c, status: processManager.status(c.id) } : c
    );
    res.json({ capabilities: withStatus, warnings });
  });

  app.post('/api/launch/:id', async (req, res) => {
    const cap = findCap(req.params.id);
    if (!cap) return res.status(404).json({ error: '未知能力' });
    if (cap.launch.type === 'server') {
      const r = await processManager.start(cap);
      return res.status(r.ok ? 200 : 500).json(r);
    }
    const r = await launcher.launchNonServer(cap);
    return res.status(r.ok ? 200 : 500).json(r);
  });

  app.post('/api/stop/:id', (req, res) => {
    const cap = findCap(req.params.id);
    if (!cap) return res.status(404).json({ error: '未知能力' });
    res.json(processManager.stop(cap.id));
  });

  app.get('/api/logs/:id', (req, res) => {
    const cap = findCap(req.params.id);
    if (!cap) return res.status(404).json({ error: '未知能力' });
    res.json({ lines: processManager.logs(cap.id) });
  });

  app.use(express.static(path.join(here, '../web')));
  return app;
}
