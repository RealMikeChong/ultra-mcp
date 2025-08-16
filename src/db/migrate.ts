import { migrate } from 'drizzle-orm/libsql/migrator';
import { getDatabase } from './connection';
import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from '../utils/logger';

export async function runMigrations(): Promise<void> {
  try {
    const db = await getDatabase();
    
    // Try bundled location first (production)
    let migrationsFolder = join(__dirname, 'drizzle');
    
    // If not found, try source location (development/tests)
    if (!existsSync(migrationsFolder)) {
      migrationsFolder = join(__dirname, '..', '..', 'drizzle');
    }
    
    // Final fallback for edge cases
    if (!existsSync(migrationsFolder)) {
      throw new Error(`Migrations folder not found. Searched: ${migrationsFolder}`);
    }
    
    await migrate(db as any, { migrationsFolder });
    
    logger.log('Database migrations completed successfully');
  } catch (error) {
    logger.error('Database migration failed:', error);
    throw error;
  }
}

// Auto-run migrations when this module is imported
// This ensures the database is always up-to-date
let _migrationsDone = false;
let _migrationsPromise: Promise<void> | null = null;
export async function ensureDatabaseReady(): Promise<void> {
  if (_migrationsDone) return;
  if (_migrationsPromise) {
    return _migrationsPromise;
  }
  _migrationsPromise = (async () => {
    try {
      await runMigrations();
      _migrationsDone = true;
    } catch (error) {
      logger.warn('Failed to run migrations, database may not be initialized:', error instanceof Error ? error.message : String(error));
    } finally {
      _migrationsPromise = null;
    }
  })();
  return _migrationsPromise;
}
