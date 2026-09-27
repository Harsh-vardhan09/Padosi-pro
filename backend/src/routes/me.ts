import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { authenticatedUser } from '../middleware/auth.js';
import * as profiles from '../repositories/profiles.js';
import * as tasks from '../repositories/tasks.js';
import type { SelectedTask } from '../repositories/tasks.js';
import { duplicateTaskIds, unknownTaskIds } from '../services/tasks.js';
import { publicProfile } from './profile.js';

const selectionSchema = z.object({
  taskIds: z
    .array(z.number().int().positive('Task ids are positive integers'))
    .min(1, 'Choose at least one task'),
});

function publicSelectedTask(task: SelectedTask): Record<string, string | number> {
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    categoryId: task.categoryId,
    categoryName: task.categoryName,
    selectedAt: task.selectedAt.toISOString(),
  };
}

export const meRouter = Router();

meRouter.get('/', async (req, res) => {
  const user = authenticatedUser(req);
  const [profile, selectedTaskCount] = await Promise.all([
    profiles.findByUserId(user.id),
    tasks.countForUser(user.id),
  ]);

  res.json({
    user: { id: user.id, email: user.email, profileCompleted: profile !== null },
    profile: profile === null ? null : publicProfile(profile),
    selectedTaskCount,
  });
});

meRouter.get('/tasks', async (req, res) => {
  const selected = await tasks.listForUser(authenticatedUser(req).id);
  res.json({ tasks: selected.map(publicSelectedTask) });
});

meRouter.put('/tasks', async (req, res) => {
  const { taskIds } = selectionSchema.parse(req.body);
  const user = authenticatedUser(req);

  const duplicates = duplicateTaskIds(taskIds);
  if (duplicates.length > 0) {
    throw new AppError({
      status: 400,
      code: 'DUPLICATE_TASK_IDS',
      message: 'Each task can only be chosen once.',
      fields: { taskIds: `Repeated task ids: ${duplicates.join(', ')}` },
    });
  }

  const unknown = unknownTaskIds(taskIds, await tasks.findExistingIds(taskIds));
  if (unknown.length > 0) {
    throw new AppError({
      status: 400,
      code: 'UNKNOWN_TASK_IDS',
      message: 'Some of those tasks are no longer available.',
      fields: { taskIds: `Unknown task ids: ${unknown.join(', ')}` },
    });
  }

  await tasks.replaceForUser(user.id, taskIds);

  const selected = await tasks.listForUser(user.id);
  res.json({ tasks: selected.map(publicSelectedTask) });
});
