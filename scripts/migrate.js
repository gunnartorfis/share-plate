import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '../data/share-plate.db')
const migrationsDir = path.join(__dirname, '../drizzle')

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
  const stmts = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const stmt of stmts) {
    try {
      db.exec(stmt)
    } catch {
      // Table already exists is fine
    }
  }
  console.log(`Applied: ${file}`)
}

db.close()
console.log('Done.')
