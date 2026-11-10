import { createServer } from 'node:http';
import { handler } from './app.js';

const PORT = Number(process.env.PORT) || 3000;

createServer(handler).listen(PORT, () => {
  console.log(`\n  AFTR est lancé : http://localhost:${PORT}\n`);
});
