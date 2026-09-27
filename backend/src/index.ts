import 'dotenv/config';
import { createApp } from './app.js';
import { config } from './config.js';

const { PORT, NODE_ENV } = config();

createApp().listen(PORT, () => {
  console.log(`PadosiPro API listening on http://localhost:${PORT} (${NODE_ENV})`);
});
