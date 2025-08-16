import { readFile, stat, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';
import fg from 'fast-glob';
import ignore from 'ignore';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { getVectorDB, float32ArrayToBuffer } from './db';
import { EmbeddingProvider } from '../providers/embeddings';
import { logger } from '../utils/logger';
import { VectorConfig } from '../config/schema';

export interface IndexingOptions {
  projectPath: string;
  provider: EmbeddingProvider;
  config: VectorConfig;
  force?: boolean;
  onProgress?: (message: string) => void;
}

export interface IndexingResult {
  filesIndexed: number;
  chunksCreated: number;
  timeMs: number;
}

export async function indexProject(options: IndexingOptions): Promise<IndexingResult> {
  const startTime = Date.now();
  const { projectPath, provider, config, force = false, onProgress } = options;
  
  onProgress?.('Initializing vector database...');
  const { db, client } = await getVectorDB(projectPath);
  
  // Update .gitignore if needed
  await updateGitignore(projectPath);
  
  // Get files to index
  onProgress?.('Scanning project files...');
  const files = await getFilesToIndex(projectPath, config.filePatterns);
  
  if (files.length === 0) {
    logger.warn('No files found to index');
    return { filesIndexed: 0, chunksCreated: 0, timeMs: Date.now() - startTime };
  }
  
  onProgress?.(`Found ${files.length} files to process`);
  
  // Create text splitter
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
  });
  
  let filesIndexed = 0;
  let chunksCreated = 0;
  
  // Process files in batches
  for (let i = 0; i < files.length; i += config.batchSize) {
    const batch = files.slice(i, i + config.batchSize);
    const batchChunks: Array<{
      id: string;
      relpath: string;
      chunk: string;
      hash: string;
      mtimeMs: number;
      embedding?: number[];
    }> = [];
    
    // Process batch
    for (const filePath of batch) {
      try {
        const relPath = relative(projectPath, filePath);
        const stats = await stat(filePath);
        const content = await readFile(filePath, 'utf-8');
        
        // Skip empty files
        if (!content.trim()) continue;
        
        // Split into chunks
        const chunks = await splitter.splitText(content);
        
        for (let idx = 0; idx < chunks.length; idx++) {
          const chunk = chunks[idx];
          const id = `${relPath}#${idx}`;
          const hash = createHash('sha256').update(chunk).digest('hex');
          
          // Check if chunk already exists with same hash
          if (!force) {
            const result = await client.execute({
              sql: `SELECT hash, mtime_ms FROM vector_chunks WHERE id = ?`,
              args: [id]
            });
            
            if (result.rows.length > 0) {
              const row = result.rows[0];
              const existing = {
                hash: row[0] as string,
                mtime_ms: row[1] as number
              };
              
              if (existing.hash === hash && existing.mtime_ms === stats.mtimeMs) {
                continue; // Skip unchanged chunk
              }
            }
          }
          
          batchChunks.push({
            id,
            relpath: relPath,
            chunk,
            hash,
            mtimeMs: stats.mtimeMs,
          });
        }
        
        filesIndexed++;
      } catch (error) {
        logger.error(`Error processing file ${filePath}:`, error);
      }
    }
    
    // Generate embeddings for batch
    if (batchChunks.length > 0) {
      onProgress?.(`Generating embeddings for batch ${Math.floor(i / config.batchSize) + 1}...`);
      
      try {
        const texts = batchChunks.map(c => c.chunk);
        const embeddings = await provider.getEmbeddings(texts);
        
        // Store chunks with embeddings (dual-table approach)
        for (let j = 0; j < batchChunks.length; j++) {
          const chunk = batchChunks[j];
          const embedding = embeddings[j];
          
          // Validate embedding dimensions
          if (embedding.length !== 1536) {
            logger.warn(`Embedding dimension mismatch for ${chunk.id}: expected 1536, got ${embedding.length}`);
            continue;
          }
          
          try {
            // 1. Insert/update metadata in main table
            const result = await client.execute({
              sql: `INSERT OR REPLACE INTO vector_chunks (id, relpath, chunk, hash, mtime_ms)
                    VALUES (?, ?, ?, ?, ?)`,
              args: [
                chunk.id,
                chunk.relpath,
                chunk.chunk,
                chunk.hash,
                chunk.mtimeMs,
              ]
            });
            
            // 2. Get the rowid for linking
            const rowidResult = await client.execute({
              sql: `SELECT rowid FROM vector_chunks WHERE id = ?`,
              args: [chunk.id]
            });
            
            if (rowidResult.rows.length > 0) {
              const rowid = rowidResult.rows[0][0] as number;
              
              // 3. Try to insert into VSS virtual table
              try {
                // VSS requires DELETE before INSERT for updates
                await client.execute({
                  sql: `DELETE FROM vss_vectors WHERE rowid = ?`,
                  args: [rowid]
                });
                
                await client.execute({
                  sql: `INSERT INTO vss_vectors (rowid, embedding) VALUES (?, ?)`,
                  args: [rowid, new Float32Array(embedding).buffer]
                });
              } catch (vssError) {
                // VSS not available, fallback to adding embedding to main table
                await client.execute({
                  sql: `UPDATE vector_chunks SET embedding = ? WHERE id = ?`,
                  args: [float32ArrayToBuffer(embedding), chunk.id]
                });
              }
              
              chunksCreated++;
            }
          } catch (error) {
            logger.error(`Error storing chunk ${chunk.id}:`, error);
          }
        }
      } catch (error) {
        logger.error('Error generating embeddings:', error);
        throw error;
      }
    }
    
    onProgress?.(`Processed ${Math.min(i + config.batchSize, files.length)} / ${files.length} files`);
  }
  
  const timeMs = Date.now() - startTime;
  onProgress?.(`Indexing complete: ${filesIndexed} files, ${chunksCreated} chunks in ${(timeMs / 1000).toFixed(1)}s`);
  
  return { filesIndexed, chunksCreated, timeMs };
}

async function getFilesToIndex(projectPath: string, patterns: string[]): Promise<string[]> {
  // Read .gitignore
  let ig = ignore();
  const gitignorePath = join(projectPath, '.gitignore');
  
  if (existsSync(gitignorePath)) {
    try {
      const gitignoreContent = await readFile(gitignorePath, 'utf-8');
      ig = ignore().add(gitignoreContent);
    } catch (error) {
      logger.warn('Could not read .gitignore:', error);
    }
  }
  
  // Always ignore .ultra-mcp directory
  ig.add('.ultra-mcp');
  
  // Find files matching patterns
  const files = await fg(patterns, {
    cwd: projectPath,
    absolute: true,
    dot: false,
    followSymbolicLinks: false,
    ignore: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.ultra-mcp/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/coverage/**',
    ],
  });
  
  // Filter by gitignore
  return files.filter(file => {
    const relPath = relative(projectPath, file);
    return !ig.ignores(relPath);
  });
}

async function updateGitignore(projectPath: string): Promise<void> {
  const gitignorePath = join(projectPath, '.gitignore');
  
  try {
    let content = '';
    
    if (existsSync(gitignorePath)) {
      content = await readFile(gitignorePath, 'utf-8');
    }
    
    if (!content.includes('.ultra-mcp')) {
      const addition = content.endsWith('\n') ? '' : '\n';
      await appendFile(gitignorePath, `${addition}\n# Ultra MCP vector index\n.ultra-mcp/\n`);
      logger.log('Added .ultra-mcp to .gitignore');
    }
  } catch (error) {
    logger.warn('Could not update .gitignore:', error);
  }
}