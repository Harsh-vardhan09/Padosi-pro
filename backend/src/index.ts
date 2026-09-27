import 'dotenv/config';
import { createApp } from './app.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const app = createApp();

app.listen(env.PORT, () => {
  console.log(`PadosiPro API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
