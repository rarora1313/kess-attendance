import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import router from './routes';
import { startScheduler } from './services/scheduler';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api', router);

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Backend running at http://localhost:${PORT}`);
  startScheduler();
});
