const path = require("path");

const toPgParams = (sql, params) => {
    let idx = 0;
    const converted = sql.replace(/\?/g, () => `$${++idx}`);
    return { sql: converted, params };
};

const DATABASE_URL = process.env.DATABASE_URL;

if (DATABASE_URL) {
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

    module.exports = {
        run: (sql, params) => {
            const q = toPgParams(sql, params || []);
            return pool.query(q.sql, q.params).then(r => ({ lastID: r.rows[0]?.id, changes: r.rowCount, rows: r.rows }));
        },
        get: (sql, params) => {
            const q = toPgParams(sql, params || []);
            return pool.query(q.sql, q.params).then(r => r.rows[0] || null);
        },
        all: (sql, params) => {
            const q = toPgParams(sql, params || []);
            return pool.query(q.sql, q.params).then(r => r.rows);
        },
        execSchema: async (sql) => { await pool.query(sql); },
        close: () => pool.end(),
        isPG: true,
        dateTrunc: (fmt, col) => {  // fmt: 'month', col: column name
            return { sql: `DATE_TRUNC('${fmt}', ${col})`, format: fmt };
        },
        toChar: (col, fmt) => {
            return { sql: `TO_CHAR(${col}, '${fmt}')`, format: fmt };
        },
        strftime: (fmt, col) => {
            // Map SQLite strftime to PostgreSQL
            const map = { '%Y-%m': `TO_CHAR(${col}, 'YYYY-MM')` };
            return { sql: map[fmt] || `TO_CHAR(${col}, '${fmt}')` };
        },
        insertOrIgnore: (table, cols, values, conflictCol) => {
            const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
            return `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) ON CONFLICT (${conflictCol}) DO NOTHING`;
        },
        returning: (sql) => {
            if (!sql.toUpperCase().includes("RETURNING")) {
                return sql + " RETURNING *";
            }
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
        dateTrunc: (fmt, col) => ({ sql: col, format: fmt }),  // SQLite stores as TEXT already
        toChar: (col, fmt) => ({ sql: col, format: fmt }),
        strftime: (fmt, col) => ({ sql: `strftime('${fmt}', ${col})`, format: fmt }),
        insertOrIgnore: (table, cols, values) => {
            const placeholders = values.map(() => "?").join(", ");
            return `INSERT OR IGNORE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
        },
        returning: (sql) => sql,
    };
}
