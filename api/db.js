const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join(__dirname, '..', 'database.sqlite');

// Stable reference that other modules destructure at require time
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
    pragma(q) {
      // sql.js ignores pragmas; safe no-op
      return;
    },
    exec(sql) {
      db.exec(sql);
      persist();
    },
    prepare(sql) {
      return {
        run(...params) {
          const stmt = db.prepare(sql);
          if (params && params.length === 1 && Array.isArray(params[0])) {
            stmt.bind(params[0]);
          } else {
            stmt.bind(params);
          }
          while (stmt.step()) {}
          stmt.free();
          const changes = db.getRowsModified();
          const res = db.exec('SELECT last_insert_rowid() as id');
          const lastID = (res && res[0] && res[0].values && res[0].values[0]) ? res[0].values[0][0] : undefined;
          persist();
          return { changes, lastInsertRowid: lastID };
        },
        get(...params) {
          const stmt = db.prepare(sql);
          if (params && params.length === 1 && Array.isArray(params[0])) {
            stmt.bind(params[0]);
          } else {
            stmt.bind(params);
          }
          let row = undefined;
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            row = {};
            cols.forEach((c, i) => row[c] = vals[i]);
          }
          stmt.free();
          return row;
        },
        all(...params) {
          const stmt = db.prepare(sql);
          if (params && params.length === 1 && Array.isArray(params[0])) {
            stmt.bind(params[0]);
          } else {
            stmt.bind(params);
          }
          const rows = [];
          while (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const obj = {};
            cols.forEach((c, i) => obj[c] = vals[i]);
            rows.push(obj);
          }
          stmt.free();
          return rows;
        }
      };
    }
  };
}

async function initDatabase() {
  if (SQL && _db) return;
  try {
    if (!SQL) {
      SQL = await initSqlJs({
        locateFile: file => require.resolve('sql.js/dist/' + file),
      });
    }
    if (fs.existsSync(dbPath)) {
      const filebuffer = fs.readFileSync(dbPath);
      _db = new SQL.Database(filebuffer);
    } else {
      _db = new SQL.Database();
    }

    // mutate the stable reference so previously-required modules now see methods
    Object.assign(dbRef, makeCompat(_db));

// Minimal schema for auth & basic features
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
    type TEXT NOT NULL,
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


    console.log('SQLite (sql.js) database initialized at', dbPath);
  } catch (error) {
    console.error('Error initializing sql.js database:', error);
    throw error;
  }
}

module.exports = { db: dbRef, initDatabase };
