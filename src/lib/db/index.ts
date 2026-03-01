import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { drizzle } from 'drizzle-orm/sql.js'
import * as schema from './schema'
import fs from 'node:fs'
import path from 'node:path'

let sqliteDb: SqlJsDatabase | null = null

export async function getDb() {
  if (sqliteDb) return sqliteDb

  const SQL = await initSqlJs()
  const dbPath = path.join(process.cwd(), 'data', 'share-plate.db')

  let buffer: Buffer | undefined
  if (fs.existsSync(dbPath)) {
    buffer = fs.readFileSync(dbPath)
  }

  sqliteDb = new SQL.Database(buffer)

  sqliteDb.run('PRAGMA journal_mode = WAL')
  sqliteDb.run('PRAGMA foreign_keys = ON')

  return sqliteDb
}

export async function getDbWithSchema() {
  const sqlite = await getDb()
  return drizzle(sqlite, { schema })
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, _prop) {
    throw new Error(
      'Use `await getDbWithSchema()` instead of `db` - SQLite on serverless requires async initialization',
    )
  },
})

export type DB = ReturnType<typeof drizzle>
