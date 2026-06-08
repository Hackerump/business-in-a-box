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

    // Replace hostname with IPv4 address to avoid ENETUNREACH on IPv6
    const buildConnStr = () => {
        const match = DATABASE_URL.match(/^postgres:\/\/([^@]+)@([^:]+)(:\d+)\/(.+)$/);
        if (!match) return DATABASE_URL;
        const [, auth, host, port, db] = match;
        try {
            const addr = dns.promises.resolve4(host);
            // Can't await here, will handle in init
        } catch (e) {
            // ignore
        }
        return DATABASE_URL;
    };

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

        console.log("Connecting to PostgreSQL...");

        let pool;
        try {
            pool = new Pool({
                connectionString: connStr,
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 10000,
            });
        } catch (e) {
            console.error("Failed to create PostgreSQL pool:", e.message);
            process.exit(1);
        }

        dbInst.run = (sql, params) => pool.query(sql, params || []).then(r => ({ lastID: r.rows[0]?.id, changes: r.rowCount, rows: r.rows }));
        dbInst.get = (sql, params) => pool.query(sql, params || []).then(r => r.rows[0] || null);
        dbInst.all = (sql, params) => pool.query(sql, params || []).then(r => r.rows);
        dbInst.execSchema = (sql) => pool.query(sql);
        dbInst.close = () => pool.end();
        dbInst.isPG = true;

        // Run schema init now that pool is ready
        try {
            const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
            await pool.query(schema);
            console.log("Schema initialized");
        } catch (e) {
            console.error("Schema init failed:", e.message);
        }
    };

    const dbInst = {
        run: () => { throw new Error("Database not initialized yet"); },
        get: () => { throw new Error("Database not initialized yet"); },
        all: () => { throw new Error("Database not initialized yet"); },
        execSchema: () => { throw new Error("Database not initialized yet"); },
        close: () => {},
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

    init().catch(err => {
        console.error("Database initialization failed:", err.message);
        process.exit(1);
    });

    module.exports = dbInst;
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
