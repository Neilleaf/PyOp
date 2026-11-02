import { endpoint, json, readJson } from '../../server/http.js';
import { findRecording, parseConfiguration } from '../../server/recordings.js';

export default {
  fetch: endpoint('POST', async (request) => {
    const configuration = parseConfiguration(await readJson(request));
    return json({ demo: true, result: findRecording(configuration) });
  }),
};
