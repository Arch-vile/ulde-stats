import express, { Request, Response } from 'express';
import cors from 'cors';
import gamesRouter from './routes/games';
import eventsRouter from './routes/events';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use('/api/games', gamesRouter);
app.use('/api/games/:id/events', eventsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
