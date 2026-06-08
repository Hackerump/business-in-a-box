const path = require("path");
const dns = require("dns");
const { URL } = require("url");

const toPgParams = (sql, params) => {
    let idx = 0;
    const sql2 = sql.replace(/\?/g, () => `$${++idx}`);
    return { sql: sql2, params };
};

const DATABASE_URL = process.env.DATABASE_URL;

if (DATABASE_URL) {
    const { Pool } = require("pg");

    // Resolve hostname to IPv4 to avoid ENETUNREACH on IPv6
    const parsed = new URL(DATABASE_URL);
    const hostname = parsed.hostname;
    let address = hostname;
    try {
        const results = dns.resolve4Sync(hostname);
        if (results.length > 0) {
            address = results[0];
        }
    } catch (e) {
        console.warn("DNS resolution failed, using hostname as-is:", e.message);
    }
    const connStr = DATABASE_URL.replace(hostname, address);

    let pool;
    try {
        pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
    } catch (e) {
        console.error("Failed to create PostgreSQL pool:", e.message);
        process.exit(1);
    }

    const query = (sql, params) => pool.query(sql, params || []).catch(err => {
        console.error("PostgreSQL error:", err.message);
        throw err;
    });

    module.exports = {
        run: (sql, params) => query(sql, params).then(r => ({ lastID: r.rows[0]?.id, changes: r.rowCount, rows: r.rows })),
        get: (sql, params) => query(sql, params).then(r => r.rows[0] || null),
        all: (sql, params) => query(sql, params).then(r => r.rows),
        execSchema: (sql) => pool.query(sql),
        close: () => pool.end(),
        isPG: true,
        strftime: (fmt, col) => ({ sql: `TO_CHAR(${col}, 'YYYY-MM')` }),
        insertOrIgnore: (table, cols, values, conflictCol) => {
            const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
            return `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) ON CONFLICT (${conflictCol}) DO NOTHING`;
        },
        returning: (sql) => {
            if (!sql.toUpperCase().includes("RETURNING")) return sql + " RETURNING *";
            return sql;
        },
    };
} else {
    const sqlite3 = require("sqlite3").verbose();
    const db = new sqlite3.Database(path.join(__dirname, "business.db"));

    module.exports = {
        run: (sql, params) => new Promise((resolve, reject) => {
            db.run(sql, params || [], function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        }),
        get: (sql, params) => new Promise((resolve, reject) => {
            db.get(sql, params || [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        }),
        all: (sql, params) => new Promise((resolve, reject) => {
            db.all(sql, params || [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }),
        execSchema: (sql) => new Promise((resolve, reject) => {
            db.exec(sql, (err) => { if (err) reject(err); else resolve(); });
        }),
        serialize: (fn) => db.serialize(fn),
        close: () => { db.close(); },
        isPG: false,
        strftime: (fmt, col) => ({ sql: `strftime('${fmt}', ${col})` }),
        insertOrIgnore: (table, cols, values) => {
            const placeholders = values.map(() => "?").join(", ");
            return `INSERT OR IGNORE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
        },
        returning: (sql) => sql,
    };
}
