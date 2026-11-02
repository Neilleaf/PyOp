import { endpoint, json } from '../server/http.js';
import { catalog } from '../server/recordings.js';

export default {
  fetch: endpoint('GET', () => json({ demo: true, benchmarks: catalog() })),
};
