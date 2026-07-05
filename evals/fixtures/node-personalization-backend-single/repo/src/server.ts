import express from 'express';
import { userTable } from './datastores/userTable';
import { eventStore } from './datastores/eventStore';
import { sessionCache } from './datastores/sessionCache';
import { exportDataSubject, eraseDataSubject } from './consent/registry';
import { isFeatureEnabled } from './features';

export function createServer() {
  const app = express();
  app.use(express.json());

  app.post('/track', (req, res) => {
    if (!isFeatureEnabled('feature:analytics-tier')) {
      res.status(404).end();
      return;
    }
    const { tenant, user, eventName } = req.body;
    eventStore.record({ tenant, user, eventName, timestamp: Date.now() });
    res.status(202).end();
  });

  app.post('/session', (req, res) => {
    const { userId, token } = req.body;
    sessionCache.put(userId, token);
    res.status(202).end();
  });

  app.get('/data-subject/:tenant/:user/export', async (req, res) => {
    res.json(await exportDataSubject(req.params.tenant, req.params.user));
  });

  app.delete('/data-subject/:tenant/:user', async (req, res) => {
    await eraseDataSubject(req.params.tenant, req.params.user);
    res.status(204).end();
  });

  void userTable;
  return app;
}
