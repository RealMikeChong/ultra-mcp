import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

export interface VectorDatabase {
  db: ReturnType<typeof drizzle>;
  client: ReturnType<typeof createClient>;
  path: string;
}

export async function getVectorDB(projectPath: string): Promise<VectorDatabase> {
  const dbDir = join(projectPath, '.ultra-mcp');
  const dbPath = join(dbDir, 'vector-index-v1.sqlite3');
  
  // Create directory if needed
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
    logger.log(`Created vector database directory at ${dbDir}`);
  }
  
  try {
    const client = createClient({ url: `file:${dbPath}` });
    const db = drizzle(client);
    
    // Run string-based migration to create tables and indexes
    await db.run(`
      CREATE TABLE IF NOT EXISTS vector_chunks (
        id TEXT PRIMARY KEY,
        relpath TEXT NOT NULL,
        chunk TEXT NOT NULL,
        hash TEXT NOT NULL,
        mtime_ms INTEGER NOT NULL,
        embedding F32_BLOB(1536) NOT NULL,
        created_at INTEGER DEFAULT (unixepoch('now', 'subsec') * 1000)
      );
    `);
    
    // Create regular indexes
    await db.run(`
      CREATE INDEX IF NOT EXISTS relpath_idx ON vector_chunks(relpath);
    `);
    
    await db.run(`
      CREATE INDEX IF NOT EXISTS hash_idx ON vector_chunks(hash);
    `);
    
    // Create vector index using libsql's built-in vector extension
    try {
      await db.run(`
        CREATE INDEX IF NOT EXISTS vec_idx 
        ON vector_chunks(libsql_vector_idx(embedding, 'metric=cosine'));
      `);
      logger.log('Vector index created successfully');
    } catch (error) {
      // Vector index might not be available in all libsql versions
      logger.warn('Could not create vector index, will use fallback search:', error);
    }
    
    return { db, client, path: dbPath };
  } catch (error) {
    throw new Error(`Failed to initialize vector database: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function clearVectorDB(projectPath: string): Promise<void> {
  const { client } = await getVectorDB(projectPath);
  
  try {
    await client.execute({
      sql: 'DELETE FROM vector_chunks',
      args: []
    });
    logger.log('Vector database cleared');
  } catch (error) {
    throw new Error(`Failed to clear vector database: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getVectorCount(projectPath: string): Promise<number> {
  const { client } = await getVectorDB(projectPath);
  
  try {
    const result = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM vector_chunks',
      args: []
    });
    
    return result.rows.length > 0 ? (result.rows[0][0] as number) : 0;
  } catch (error) {
    logger.error('Failed to get vector count:', error);
    return 0;
  }
}

export function float32ArrayToBuffer(array: number[]): Buffer {
  return Buffer.from(new Float32Array(array).buffer);
}

export function bufferToFloat32Array(buffer: Buffer): Float32Array {
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}