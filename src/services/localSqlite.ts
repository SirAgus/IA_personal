import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';
import localforage from 'localforage';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { Agent, Thread, DBMessage } from './db';

const DB_KEY = 'chat-ai-v2-sqlite';

let sqlPromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;

const getSql = () => {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: () => sqlWasmUrl
    });
  }
  return sqlPromise;
};

const ensureSchema = (db: Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      agent_id INTEGER,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      reasoning_content TEXT,
      metrics TEXT,
      created_at TEXT
    );
  `);
};

const getDb = async () => {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await getSql();
      const stored = await localforage.getItem<ArrayBuffer | Uint8Array>(DB_KEY);
      const data = stored instanceof ArrayBuffer ? new Uint8Array(stored) : stored || undefined;
      const db = data ? new SQL.Database(data) : new SQL.Database();
      ensureSchema(db);
      return db;
    })();
  }
  return dbPromise;
};

const persistDb = async (db: Database) => {
  const data = db.export();
  await localforage.setItem(DB_KEY, data);
};

const run = (db: Database, sql: string, params: SqlValue[] = []) => {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    // Exhaust statements that return rows.
  }
  stmt.free();
};

const all = <T = Record<string, unknown>>(db: Database, sql: string, params: SqlValue[] = []) => {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
};

const getRow = <T = Record<string, unknown>>(db: Database, sql: string, params: SqlValue[] = []) => {
  const rows = all<T>(db, sql, params);
  return rows[0] || null;
};

const nowIso = () => new Date().toISOString();

const parseMetrics = (value: unknown) => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
};

const stringifyMetrics = (value: unknown) => {
  if (!value) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

export const listThreads = async (): Promise<Thread[]> => {
  const db = await getDb();
  return all<Thread>(db, 'SELECT id, title, agent_id, updated_at FROM threads ORDER BY updated_at DESC, id DESC');
};

export const getThread = async (id: number): Promise<Thread | null> => {
  const db = await getDb();
  return getRow<Thread>(db, 'SELECT id, title, agent_id, updated_at FROM threads WHERE id = ?', [id]);
};

export const createThread = async (title: string, agentId?: number | null): Promise<Thread> => {
  const db = await getDb();
  const updatedAt = nowIso();
  run(db, 'INSERT INTO threads (title, agent_id, updated_at) VALUES (?, ?, ?)', [
    title,
    agentId ?? null,
    updatedAt
  ]);
  const row = getRow<{ id: number }>(db, 'SELECT last_insert_rowid() as id');
  await persistDb(db);
  return { id: row?.id, title, agent_id: agentId ?? null, updated_at: updatedAt };
};

export const updateThread = async (id: number, updates: Partial<Pick<Thread, 'title' | 'agent_id'>>): Promise<void> => {
  const db = await getDb();
  const existing = await getThread(id);
  if (!existing) return;
  const updatedAt = nowIso();
  const nextTitle = updates.title ?? existing.title;
  const nextAgentId = updates.agent_id ?? existing.agent_id ?? null;
  run(db, 'UPDATE threads SET title = ?, agent_id = ?, updated_at = ? WHERE id = ?', [
    nextTitle,
    nextAgentId,
    updatedAt,
    id
  ]);
  await persistDb(db);
};

export const deleteThread = async (id: number): Promise<void> => {
  const db = await getDb();
  run(db, 'DELETE FROM messages WHERE thread_id = ?', [id]);
  run(db, 'DELETE FROM threads WHERE id = ?', [id]);
  await persistDb(db);
};

export const listMessages = async (threadId: number): Promise<DBMessage[]> => {
  const db = await getDb();
  const rows = all<DBMessage & { metrics?: string | null }>(
    db,
    'SELECT id, thread_id, role, content, reasoning_content, metrics, created_at FROM messages WHERE thread_id = ? ORDER BY id ASC',
    [threadId]
  );
  return rows.map(row => ({
    ...row,
    metrics: parseMetrics(row.metrics)
  }));
};

export const addMessage = async (message: Omit<DBMessage, 'id' | 'created_at'>): Promise<DBMessage> => {
  const db = await getDb();
  const createdAt = nowIso();
  run(db, 'INSERT INTO messages (thread_id, role, content, reasoning_content, metrics, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    message.thread_id,
    message.role,
    message.content,
    message.reasoning_content ?? null,
    stringifyMetrics(message.metrics),
    createdAt
  ]);
  run(db, 'UPDATE threads SET updated_at = ? WHERE id = ?', [createdAt, message.thread_id]);
  const row = getRow<{ id: number }>(db, 'SELECT last_insert_rowid() as id');
  await persistDb(db);
  return { ...message, id: row?.id, created_at: createdAt };
};

export const listAgents = async (): Promise<Agent[]> => {
  const db = await getDb();
  return all<Agent>(db, 'SELECT id, name, description, system_prompt FROM agents ORDER BY updated_at DESC, id DESC');
};

export const getAgent = async (id: number): Promise<Agent | null> => {
  const db = await getDb();
  return getRow<Agent>(db, 'SELECT id, name, description, system_prompt FROM agents WHERE id = ?', [id]);
};

export const createAgent = async (payload: Omit<Agent, 'id'>): Promise<Agent> => {
  const db = await getDb();
  const stamp = nowIso();
  run(db, 'INSERT INTO agents (name, description, system_prompt, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
    payload.name,
    payload.description,
    payload.system_prompt,
    stamp,
    stamp
  ]);
  const row = getRow<{ id: number }>(db, 'SELECT last_insert_rowid() as id');
  await persistDb(db);
  return { id: row?.id, ...payload };
};

export const updateAgent = async (id: number, payload: Omit<Agent, 'id'>): Promise<void> => {
  const db = await getDb();
  const stamp = nowIso();
  run(db, 'UPDATE agents SET name = ?, description = ?, system_prompt = ?, updated_at = ? WHERE id = ?', [
    payload.name,
    payload.description,
    payload.system_prompt,
    stamp,
    id
  ]);
  await persistDb(db);
};

export const deleteAgent = async (id: number): Promise<void> => {
  const db = await getDb();
  run(db, 'DELETE FROM agents WHERE id = ?', [id]);
  await persistDb(db);
};
