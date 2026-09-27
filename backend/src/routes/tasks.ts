import { Router } from 'express';
import * as tasks from '../repositories/tasks.js';

export const tasksRouter = Router();

tasksRouter.get('/', async (_req, res) => {
  res.json({ categories: await tasks.listCatalogue() });
});
