import { createApiServer } from './local.js';

const server = createApiServer();
server.listen(3001, '127.0.0.1', () =>
  console.log('PyOp recorded-demo API: http://127.0.0.1:3001'),
);
