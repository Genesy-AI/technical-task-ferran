import { PrismaClient } from '@prisma/client'

/**
 * One client for the process. The API routes and the Temporal activities run in the same process
 * (see `index.ts`), so they must not each open their own connection pool.
 */
export const prisma = new PrismaClient()
