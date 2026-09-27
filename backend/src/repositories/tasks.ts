import { prisma } from '../db/prisma.js';

export type CatalogueTask = {
  id: number;
  name: string;
  description: string;
};

export type CatalogueCategory = {
  id: number;
  name: string;
  sortOrder: number;
  tasks: CatalogueTask[];
};

export function listCatalogue(): Promise<CatalogueCategory[]> {
  return prisma.taskCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      sortOrder: true,
      tasks: {
        orderBy: { name: 'asc' },
        select: { id: true, name: true, description: true },
      },
    },
  });
}

export async function findExistingIds(ids: number[]): Promise<number[]> {
  const tasks = await prisma.task.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  return tasks.map((task) => task.id);
}

export type SelectedTask = CatalogueTask & {
  categoryId: number;
  categoryName: string;
  selectedAt: Date;
};

export async function listForUser(userId: string): Promise<SelectedTask[]> {
  const rows = await prisma.userTask.findMany({
    where: { userId },
    orderBy: [{ task: { category: { sortOrder: 'asc' } } }, { task: { name: 'asc' } }],
    select: {
      createdAt: true,
      task: {
        select: {
          id: true,
          name: true,
          description: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.task.id,
    name: row.task.name,
    description: row.task.description,
    categoryId: row.task.category.id,
    categoryName: row.task.category.name,
    selectedAt: row.createdAt,
  }));
}

export function countForUser(userId: string): Promise<number> {
  return prisma.userTask.count({ where: { userId } });
}

/**
 * Replaces the whole selection in one transaction: a half-applied change would leave the user
 * looking at tasks they did not choose.
 */
export async function replaceForUser(userId: string, taskIds: number[]): Promise<void> {
  await prisma.$transaction([
    prisma.userTask.deleteMany({ where: { userId } }),
    prisma.userTask.createMany({ data: taskIds.map((taskId) => ({ userId, taskId })) }),
  ]);
}
