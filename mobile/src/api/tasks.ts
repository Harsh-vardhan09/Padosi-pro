import { z } from 'zod';
import { request } from './client';

const catalogueTaskSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
});

const catalogueSchema = z.object({
  categories: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      sortOrder: z.number(),
      tasks: z.array(catalogueTaskSchema),
    }),
  ),
});

const selectedTasksSchema = z.object({
  tasks: z.array(
    catalogueTaskSchema.extend({
      categoryId: z.number(),
      categoryName: z.string(),
      selectedAt: z.string(),
    }),
  ),
});

export type CatalogueTask = z.infer<typeof catalogueTaskSchema>;
export type Catalogue = z.infer<typeof catalogueSchema>;
export type CatalogueCategory = Catalogue['categories'][number];
export type SelectedTask = z.infer<typeof selectedTasksSchema>['tasks'][number];

export function getCatalogue(token: string): Promise<Catalogue> {
  return request('/api/tasks', catalogueSchema, { method: 'GET', token });
}

export function getSelectedTasks(token: string): Promise<{ tasks: SelectedTask[] }> {
  return request('/api/me/tasks', selectedTasksSchema, { method: 'GET', token });
}

export function saveSelectedTasks(
  token: string,
  taskIds: number[],
): Promise<{ tasks: SelectedTask[] }> {
  return request('/api/me/tasks', selectedTasksSchema, {
    method: 'PUT',
    body: { taskIds },
    token,
  });
}
