import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/db/seed.ts',
  },
  datasource: {
    // Not prisma/config's env(): that throws when the variable is absent, and `prisma generate`
    // runs during `docker build`, where no database URL exists yet.
    url: process.env.DATABASE_URL ?? '',
  },
});
