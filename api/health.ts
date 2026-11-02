import { endpoint, json } from '../server/http.js';

export default {
  fetch: endpoint('GET', () =>
    json({
      status: 'ok',
      service: 'PyOp API',
      demo: true,
      mode: 'recorded-demo',
      execution_enabled: false,
    }),
  ),
};
