/**
 * PW1 MySQL Read-Only Connector & Database Introspector
 *
 * Strictly READ-ONLY module for inspecting and reconciling legacy Laravel MySQL databases against PW2.
 * Security Guardrail: Only SELECT, SHOW, and DESCRIBE queries are permitted.
 * All write/mutation commands are blocked and rejected at runtime.
 */

import mysql from "mysql2/promise";

export interface Pw1DbConfig {
  url?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
}

export interface Pw1ConnectionStatus {
  connected: boolean;
  message: string;
  database?: string;
  serverVersion?: string;
  tablesCount?: number;
  latencyMs?: number;
  tables?: string[];
}

export interface TableColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string | null;
  comment?: string;
}

export interface TableSchemaInfo {
  tableName: string;
  columns: TableColumnMetadata[];
  rowCount?: number;
}

let pool: mysql.Pool | null = null;

/**
 * Parses MySQL connection configuration from environment variables.
 */
export function getPw1DbConfig(): Pw1DbConfig | null {
  const url = process.env.PW1_DATABASE_URL;
  if (url && url.trim().length > 0) {
    return { url: url.trim() };
  }

  const host = process.env.PW1_DB_HOST;
  const user = process.env.PW1_DB_USER;
  const database = process.env.PW1_DB_NAME;

  if (host && user && database) {
    return {
      host,
      port: process.env.PW1_DB_PORT ? parseInt(process.env.PW1_DB_PORT, 10) : 3306,
      user,
      password: process.env.PW1_DB_PASSWORD || "",
      database,
      ssl: process.env.PW1_DB_SSL === "true",
    };
  }

  return null;
}

/**
 * Enforces strict Read-Only security guardrail on any incoming SQL string.
 * Throws an Error if any write, mutation, or DDL command is detected.
 */
export function assertReadOnlyQuery(sql: string): void {
  const normalized = sql.trim().toUpperCase();

  // Allow only SELECT, SHOW, DESCRIBE, EXPLAIN
  const allowedPrefixes = ["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN"];
  const isAllowed = allowedPrefixes.some((prefix) => normalized.startsWith(prefix));

  if (!isAllowed) {
    throw new Error(
      `[SECURITY ERROR] Blocked unauthorized non-read-only SQL statement. Only SELECT/SHOW/DESCRIBE queries are permitted. Query: ${sql.slice(0, 50)}...`,
    );
  }

  // Double check forbidden mutation keywords anywhere in query
  const forbiddenPatterns = [
    /\bINSERT\s+INTO\b/i,
    /\bUPDATE\s+/i,
    /\bDELETE\s+FROM\b/i,
    /\bDROP\s+TABLE\b/i,
    /\bDROP\s+DATABASE\b/i,
    /\bALTER\s+TABLE\b/i,
    /\bTRUNCATE\s+/i,
    /\bCREATE\s+TABLE\b/i,
    /\bCREATE\s+DATABASE\b/i,
    /\bRENAME\s+TABLE\b/i,
    /\bREPLACE\s+INTO\b/i,
    /\bGRANT\s+/i,
    /\bREVOKE\s+/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(normalized)) {
      throw new Error(
        `[SECURITY ERROR] Query contains forbidden mutation keyword (${pattern}). Operation rejected.`,
      );
    }
  }
}

/**
 * Returns or initializes the shared MySQL connection pool.
 */
export function getPw1ConnectionPool(overrideConfig?: Pw1DbConfig): mysql.Pool {
  if (pool) return pool;

  const config = overrideConfig || getPw1DbConfig();
  if (!config) {
    throw new Error(
      "PW1 database configuration is missing. Please set PW1_DATABASE_URL or PW1_DB_HOST in .env.local",
    );
  }

  if (config.url) {
    pool = mysql.createPool({
      uri: config.url,
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 5,
      idleTimeout: 30000,
      queueLimit: 0,
      connectTimeout: 10000,
      enableKeepAlive: true,
    });
  } else {
    pool = mysql.createPool({
      host: config.host,
      port: config.port || 3306,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 5,
      idleTimeout: 30000,
      queueLimit: 0,
      connectTimeout: 10000,
      enableKeepAlive: true,
    });
  }

  return pool;
}

/**
 * Resets the connection pool (useful for config changes and tests).
 */
export async function closePw1Pool(): Promise<void> {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}

/**
 * Tests live connection and fetches database overview metadata.
 */
export async function testPw1Connection(overrideConfig?: Pw1DbConfig): Promise<Pw1ConnectionStatus> {
  const start = Date.now();
  try {
    const activePool = getPw1ConnectionPool(overrideConfig);
    const connection = await activePool.getConnection();

    try {
      // Set session to READ ONLY for safety
      await connection.query("SET SESSION TRANSACTION READ ONLY;");

      const [versionRows] = await connection.query<mysql.RowDataPacket[]>("SELECT VERSION() as version, DATABASE() as db;");
      const [tableRows] = await connection.query<mysql.RowDataPacket[]>("SHOW TABLES;");

      const version = (versionRows[0] as any)?.version || "Unknown";
      const database = (versionRows[0] as any)?.db || "Unknown";
      const tableNames = tableRows.map((r: any) => Object.values(r)[0] as string);

      return {
        connected: true,
        message: "Kết nối thành công tới CSDL PW1 (MySQL) ở chế độ READ-ONLY.",
        database,
        serverVersion: version,
        tablesCount: tableNames.length,
        tables: tableNames,
        latencyMs: Date.now() - start,
      };
    } finally {
      connection.release();
    }
  } catch (err: any) {
    return {
      connected: false,
      message: `Không thể kết nối tới MySQL PW1: ${err.message || String(err)}`,
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Executes a strictly READ-ONLY query against PW1 MySQL database.
 */
export async function queryPw1ReadOnly<T extends mysql.RowDataPacket[] | mysql.RowDataPacket[][]>(
  sql: string,
  params: any[] = [],
): Promise<T> {
  assertReadOnlyQuery(sql);

  const activePool = getPw1ConnectionPool();
  const connection = await activePool.getConnection();

  try {
    // Re-assert read only transaction
    await connection.query("SET SESSION TRANSACTION READ ONLY;");
    const [results] = await connection.query<T>(sql, params);
    return results;
  } finally {
    connection.release();
  }
}

/**
 * Introspects all tables and column schemas dynamically from PW1 information_schema.
 */
export async function introspectAllPw1Tables(databaseName?: string): Promise<TableSchemaInfo[]> {
  const db = databaseName || (await testPw1Connection()).database;
  if (!db || db === "Unknown") return [];

  const sql = `
    SELECT
      TABLE_NAME as tableName,
      COLUMN_NAME as columnName,
      DATA_TYPE as dataType,
      IS_NULLABLE as isNullable,
      COLUMN_KEY as columnKey,
      COLUMN_DEFAULT as columnDefault,
      COLUMN_COMMENT as columnComment
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ?
    ORDER BY TABLE_NAME, ORDINAL_POSITION;
  `;

  const rows = await queryPw1ReadOnly<mysql.RowDataPacket[]>(sql, [db]);

  const tablesMap = new Map<string, TableColumnMetadata[]>();

  for (const row of rows) {
    const tName = row.tableName;
    if (!tablesMap.has(tName)) {
      tablesMap.set(tName, []);
    }

    tablesMap.get(tName)!.push({
      name: row.columnName,
      type: row.dataType,
      nullable: row.isNullable === "YES",
      isPrimaryKey: row.columnKey === "PRI",
      defaultValue: row.columnDefault,
      comment: row.columnComment,
    });
  }

  const result: TableSchemaInfo[] = [];
  for (const [tableName, columns] of tablesMap.entries()) {
    result.push({
      tableName,
      columns,
    });
  }

  return result;
}

/**
 * Fetches all records from a given table for a specific store/merchant ID with safety limits.
 */
export async function fetchStoreTableRecords(
  tableName: string,
  storeId?: string | number,
  limit = 200,
): Promise<{ tableName: string; rows: any[]; count: number }> {
  // Sanitize table name (only alphanumeric and underscore)
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }

  let sql = `SELECT * FROM \`${tableName}\``;
  const params: any[] = [];

  if (storeId !== undefined) {
    // Check if table has a store_id / shop_id / merchant_id / user_id column
    const columns = await queryPw1ReadOnly<mysql.RowDataPacket[]>(
      `SHOW COLUMNS FROM \`${tableName}\``,
    );
    const colNames = columns.map((c: any) => c.Field.toLowerCase());

    const storeCol = ["store_id", "shop_id", "merchant_id", "tenant_id", "user_id", "id"].find((c) =>
      colNames.includes(c),
    );

    if (storeCol) {
      sql += ` WHERE \`${storeCol}\` = ?`;
      params.push(storeId);
    }
  }

  sql += ` LIMIT ${Math.min(limit, 1000)};`;

  const rows = await queryPw1ReadOnly<mysql.RowDataPacket[]>(sql, params);
  return {
    tableName,
    rows,
    count: rows.length,
  };
}
