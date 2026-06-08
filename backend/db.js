const path = require("path");
const fs = require("fs");
const dns = require("dns");

const toPgParams = (sql, params) => {
    let idx = 0;
    const sql2 = sql.replace(/\?/g, () => `$${++idx}`);
    return { sql: sql2, params };
};

const DATABASE_URL = process.env.DATABASE_URL;

if (DATABASE_URL) {
    const { Pool } = require("pg");
    let pool;

    const init = async () => {
        const match = DATABASE_URL.match(/^postgres:\/\/([^@]+)@([^:]+)(:\d+)\/(.+)$/);
        let connStr = DATABASE_URL;
        if (match) {
            const [, auth, host, port, db] = match;
            try {
                const addr = await dns.promises.resolve4(host);
                if (addr && addr.length > 0) {
                    connStr = `postgres://${auth}@${addr[0]}${port}/${db}`;
                }
            } catch (e) {
                console.warn("DNS resolution failed, using hostname as-is:", e.message);
            }
        }

        pool = new Pool({
            connectionString: connStr,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000,
        });

        // Test connection
        try {
            const client = await pool.connect();
            client.release();
            console.log("PostgreSQL connected");
            // Run schema
            const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
            await pool.query(schema);
            console.log("Schema initialized");
        } catch (e) {
            console.error("PostgreSQL connection failed:", e.message);
        }
    };

    const dbInst = {
        ready: init(),
        isPG: true,
        async run(sql, params) {
            await this.ready;
            const q = toPgParams(sql, params || []);
            const r = await pool.query(q.sql, q.params);
            return { lastID: r.rows[0]?.id, changes: r.rowCount, rows: r.rows };
        },
        async get(sql, params) {
            await this.ready;
            const q = toPgParams(sql, params || []);
            const r = await pool.query(q.sql, q.params);
            return r.rows[0] || null;
        },
        async all(sql, params) {
            await this.ready;
            const q = toPgParams(sql, params || []);
            const r = await pool.query(q.sql, q.params);
            return r.rows;
        },
        async execSchema(sql) { await pool.query(sql); },
        close: () => pool.end(),
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

    module.exports = dbInst;
} else {
    const sqlite3 = require("sqlite3").verbose();
    const db = new sqlite3.Database(path.join(__dirname, "business.db"));

    module.exports = {
        ready: Promise.resolve(),
        isPG: false,
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
        strftime: (fmt, col) => ({ sql: `strftime('${fmt}', ${col})` }),
        insertOrIgnore: (table, cols, values) => {
            const placeholders = values.map(() => "?").join(", ");
            return `INSERT OR IGNORE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
        },
        returning: (sql) => sql,
    };
}
