// api/db.js
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join(__dirname, '..', 'database.sqlite');

// Stable reference that other modules import:  const { db, initDatabase } = require('./db')
const dbRef = {};      // <- is object ko hum mutate karte rahenge, taaki destructured imports valid rahein
let SQL = null;        // sql.js module handle
let _db = null;        // internal sql.js Database instance

// ---- helpers ----
function persist() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// better-sqlite3 jaisa chhota compat wrapper: dbRef.exec / dbRef.prepare(...).run/get/all
function makeCompat(db) {
  return {
    pragma(_q) {
      // sql.js pragmas ignore karta hai; safe no-op
    },
    exec(sql) {
      db.exec(sql);
      persist();
    },
    prepare(sql) {
      return {
        run(...params) {
          const stmt = db.prepare(sql);
          // allow either .run([a,b]) or .run(a,b)
          if (params.length === 1 && Array.isArray(params[0])) stmt.bind(params[0]);
          else stmt.bind(params);
          while (stmt.step()) {}   // execute fully
          stmt.free();

          const changes = db.getRowsModified();
          let lastInsertRowid;
          try {
            const res = db.exec('SELECT last_insert_rowid() AS id');
            lastInsertRowid = res && res[0] && res[0].values && res[0].values[0]
              ? res[0].values[0][0]
              : undefined;
          } catch (_) {}

          persist();
          return { changes, lastInsertRowid };
        },

        get(...params) {
          const stmt = db.prepare(sql);
          if (params.length === 1 && Array.isArray(params[0])) stmt.bind(params[0]);
          else stmt.bind(params);

          let row;
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            row = {};
            cols.forEach((c, i) => (row[c] = vals[i]));
          }
          stmt.free();
          return row;
        },

        all(...params) {
          const stmt = db.prepare(sql);
          if (params.length === 1 && Array.isArray(params[0])) stmt.bind(params[0]);
          else stmt.bind(params);

          const rows = [];
          while (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const obj = {};
            cols.forEach((c, i) => (obj[c] = vals[i]));
            rows.push(obj);
          }
          stmt.free();
          return rows;
        },
      };
    },
  };
}

// ---- main init ----
async function initDatabase() {
  // idempotent
  if (SQL && _db) return;

  // load wasm & open db
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file) => require.resolve('sql.js/dist/' + file),
    });
  }
  if (fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    _db = new SQL.Database(filebuffer);
  } else {
    _db = new SQL.Database();
  }

  // make the stable reference usable for already-required modules
  Object.assign(dbRef, makeCompat(_db));

  // ---------- SCHEMA (safe to run every start) ----------
  // Minimal tables your app expects
  dbRef.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      balance REAL DEFAULT 0.00,
      total_recharge REAL DEFAULT 0.00,
      total_withdraw REAL DEFAULT 0.00,
      referral_code TEXT UNIQUE,
      referred_by TEXT,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,            -- recharge | withdraw | purchase | etc
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER,
      amount REAL NOT NULL,
      daily_growth REAL DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS upi_ids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upi_id TEXT NOT NULL,
      daily_limit INTEGER DEFAULT 20,
      today_count INTEGER DEFAULT 0,
      rotate_after INTEGER DEFAULT 20,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ---------- MIGRATIONS (existing DBs ke liye incremental fixes) ----------
  try {
    const cols = dbRef.prepare('PRAGMA table_info(users)').all().map((r) => r.name);
    if (!cols.includes('total_welfare')) {
      dbRef.exec(`ALTER TABLE users ADD COLUMN total_welfare REAL DEFAULT 0.00`);
    }
  } catch (e) {
    console.error('users table migration failed:', e);
  }

  console.log('SQLite (sql.js) database initialized at', dbPath);
}

module.exports = { db: dbRef, initDatabase };
