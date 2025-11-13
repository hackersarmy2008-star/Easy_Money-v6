// api/db.js
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join(__dirname, '..', 'database.sqlite');

// Stable reference (so require('./db').db works even before init)
const dbRef = {};
let SQL = null;
let _db = null;

function persist() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function makeCompat(db) {
  return {
    pragma(_q) {
      // no-op for sql.js
    },
    exec(sql) {
      db.exec(sql);
      persist();
    },
    prepare(sql) {
      return {
        run(...params) {
          const stmt = db.prepare(sql);
          if (params.length === 1 && Array.isArray(params[0])) stmt.bind(params[0]);
          else stmt.bind(params);
          while (stmt.step()) {}
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
    // better-sqlite3 style transaction wrapper
    transaction(fn) {
      return (...args) => {
        try {
          db.exec('BEGIN');
          const out = fn(...args);
          db.exec('COMMIT');
          persist();
          return out;
        } catch (e) {
          try { db.exec('ROLLBACK'); } catch (_) {}
          throw e;
        }
      };
    },
  };
}

async function initDatabase() {
  if (SQL && _db) return;

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

  // expose compat methods on dbRef
  Object.assign(dbRef, makeCompat(_db));

  // ---------- SCHEMA (safe to run every start) ----------
  dbRef.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      balance REAL DEFAULT 0.00,
      total_recharge REAL DEFAULT 0.00,
      total_withdraw REAL DEFAULT 0.00,
      total_welfare REAL DEFAULT 0.00,
      referral_code TEXT UNIQUE,
      referred_by TEXT,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,             -- recharge | withdraw | purchase | etc
      amount REAL NOT NULL,
      upi_id INTEGER,                 -- optional FK to upi_ids for recharge
      status TEXT DEFAULT 'pending',  -- pending | approved | failed
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      requested_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      upi_id TEXT,
      admin_id INTEGER,
      reason TEXT,
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

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      checkin_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS upi_ids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upi_id TEXT NOT NULL,
      daily_limit INTEGER DEFAULT 20,
      today_count INTEGER DEFAULT 0,
      rotate_after INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ---------- MIGRATIONS / ensure columns exist ----------
  try {
    // if transactions missing upi_id column, attempt to add (no-op if exists)
    try {
      const tcols = dbRef.prepare('PRAGMA table_info(transactions)').all().map(r => r.name);
      if (!tcols.includes('upi_id')) {
        dbRef.exec('ALTER TABLE transactions ADD COLUMN upi_id INTEGER;');
        console.log('Migration: added transactions.upi_id');
      }
    } catch (e) {
      // ignore if ALTER not supported or already present
    }

    // ensure total_welfare exists
    try {
      const cols = dbRef.prepare('PRAGMA table_info(users)').all().map(r => r.name);
      if (!cols.includes('total_welfare')) {
        dbRef.exec('ALTER TABLE users ADD COLUMN total_welfare REAL DEFAULT 0.00');
        console.log('Migration: added users.total_welfare');
      }
    } catch (e) {
      // ignore
    }
  } catch (e) {
    console.error('Migration error:', e);
  }

  // ---------- SEED default UPI if none ----------
  try {
    const r = dbRef.prepare('SELECT COUNT(*) AS c FROM upi_ids').get();
    if (!r || !r.c) {
      const defaultUpi = process.env.DEFAULT_UPI_ID || 'demo@upi';
      dbRef.prepare('INSERT INTO upi_ids (upi_id, daily_limit, today_count, rotate_after) VALUES (?, ?, ?, ?)')
        .run(defaultUpi, 20, 0, 10);
      console.log('Seeded default UPI ID:', defaultUpi);
    }
  } catch (e) {
    console.error('Seeding UPI failed:', e);
  }

  console.log('SQLite (sql.js) database initialized at', dbPath);
}

module.exports = { db: dbRef, initDatabase };
