const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const puppeteer = require("puppeteer");
const fs = require("fs");

try { require("dotenv").config(); } catch {}

const app = express();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
    console.error("FATAL: JWT_SECRET environment variable not set");
    process.exit(1);
}
const SECRET = JWT_SECRET || "dev-secret-change-in-production";
const PORT = process.env.PORT || 3001;
const TAX_RATE = 0.20;
const INVOICES_DIR = path.join(__dirname, "invoices");

if (!fs.existsSync(INVOICES_DIR)) fs.mkdirSync(INVOICES_DIR, { recursive: true });

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "1mb" }));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 20,
    message: { success: false, message: "Too many attempts, try again later" },
    standardHeaders: true, legacyHeaders: false,
});
app.use("/api/login", authLimiter);
app.use("/api/register", authLimiter);

const db = new sqlite3.Database(path.join(__dirname, "business.db"));

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'employee',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`UPDATE users SET role = 'admin' WHERE id = 1 AND role = 'employee'`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, sku TEXT UNIQUE,
        quantity REAL DEFAULT 0, reorder_threshold REAL DEFAULT 5,
        unit_cost REAL DEFAULT 0,
        user_id INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item TEXT NOT NULL, amount REAL NOT NULL,
        category TEXT DEFAULT 'General',
        product_id INTEGER, quantity REAL DEFAULT 1, cogs REAL DEFAULT 0,
        sale_type TEXT DEFAULT 'product',
        service_hours REAL, service_rate REAL,
        user_id INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item TEXT NOT NULL, cost REAL NOT NULL,
        category TEXT DEFAULT 'General',
        user_id INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL, unit_cost REAL NOT NULL,
        user_id INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        pay_type TEXT NOT NULL CHECK(pay_type IN ('salary','hourly')),
        salary REAL DEFAULT 0, hourly_rate REAL DEFAULT 0, tax_id TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payroll (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        pay_type TEXT NOT NULL, hours REAL DEFAULT 0,
        gross_pay REAL NOT NULL, tax REAL NOT NULL, net_pay REAL NOT NULL,
        user_id INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE, type TEXT DEFAULT 'both',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_no TEXT, file_name TEXT NOT NULL, total REAL,
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    const migrate = (table) => {
        db.run(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER REFERENCES users(id)`, (err) => {
            if (!err) db.run(`UPDATE ${table} SET user_id = 1 WHERE user_id IS NULL`);
        });
    };
    // Migrate service columns for sales table
    db.run(`ALTER TABLE sales ADD COLUMN sale_type TEXT DEFAULT 'product'`, () => {});
    db.run(`ALTER TABLE sales ADD COLUMN service_hours REAL`, () => {});
    db.run(`ALTER TABLE sales ADD COLUMN service_rate REAL`, () => {});

    migrate("sales"); migrate("expenses"); migrate("products");
    migrate("purchases"); migrate("employees"); migrate("payroll");

    db.run(`INSERT OR IGNORE INTO categories (name, type) VALUES
        ('General','both'),('Products','sales'),('Services','sales'),
        ('Rent & Lease','expenses'),('Utilities','expenses'),
        ('Supplies','expenses'),('Materials','both'),
        ('Labor','expenses'),('Shipping','both'),
        ('Marketing & Ads','expenses'),('Insurance','expenses'),
        ('Taxes & Licenses','expenses'),('Maintenance','expenses'),
        ('Software','expenses'),('Travel','expenses'),('Other','both')
    `);
});

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "No token provided" });
    }
    try {
        req.user = jwt.verify(authHeader.split(" ")[1], SECRET);
        next();
    } catch {
        res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
};

const adminMiddleware = (req, res, next) => {
    db.get("SELECT role FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (err || !user || user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Admin access required" });
        }
        req.user.role = user.role;
        next();
    });
};

const buildQuery = (table, req, prefix) => {
    const p = prefix || table;
    const { category, startDate, endDate, page, limit, sort } = req.query;
    const conditions = [`${p}.user_id = ?`];
    const params = [req.user.id];
    if (category && category !== "all") { conditions.push(`${p}.category = ?`); params.push(category); }
    if (startDate) { conditions.push(`${p}.created_at >= ?`); params.push(startDate); }
    if (endDate) { conditions.push(`${p}.created_at <= ?`); params.push(endDate + " 23:59:59"); }
    const where = "WHERE " + conditions.join(" AND ");
    const orderBy = sort === "oldest" ? `ORDER BY ${p}.created_at ASC` : `ORDER BY ${p}.created_at DESC`;
    const limitClause = limit ? "LIMIT ?" : "";
    const offsetClause = page && limit ? "OFFSET ?" : "";
    if (limit) params.push(Number(limit));
    if (page && limit) params.push((Number(page) - 1) * Number(limit));
    return { where, orderBy, limitClause, offsetClause, params, alias: p };
};

const validate = (fields, body) => {
    for (const field of fields) {
        if (body[field] === undefined || body[field] === null || body[field] === "") {
            return `${field} is required`;
        }
    }
    return null;
};

/* AUTH */
app.post("/api/register", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: "Username and password required" });
        if (password.length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
        if (username.length < 3) return res.status(400).json({ success: false, message: "Username must be at least 3 characters" });
        const hash = await bcrypt.hash(password, 10);
        db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
            if (err) return res.status(500).json({ success: false, message: "Database error" });
            const role = row.count === 0 ? "admin" : "employee";
            db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, hash, role], function (err) {
                if (err) return res.status(400).json({ success: false, message: "Username already exists" });
                const token = jwt.sign({ id: this.lastID, username, role }, SECRET, { expiresIn: "7d" });
                res.json({ success: true, data: { token, user: { id: this.lastID, username, role } }, message: "Registration successful" });
            });
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post("/api/login", (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: "Username and password required" });
        db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
            if (err) return res.status(500).json({ success: false, message: "Database error" });
            if (!user || !(await bcrypt.compare(password, user.password))) {
                return res.status(401).json({ success: false, message: "Invalid credentials" });
            }
            const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: "7d" });
            res.json({ success: true, data: { token, user: { id: user.id, username: user.username, role: user.role } }, message: "Login successful" });
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.get("/api/me", authMiddleware, (req, res) => {
    db.get("SELECT id, username, role FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        res.json({ success: true, data: { user: user || req.user } });
    });
});

/* USER MANAGEMENT */
app.get("/api/users", authMiddleware, adminMiddleware, (req, res) => {
    db.all("SELECT id, username, role, created_at FROM users ORDER BY username ASC", (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        res.json(rows);
    });
});

app.put("/api/users/:id/role", authMiddleware, adminMiddleware, (req, res) => {
    const { role } = req.body;
    if (!role || !["admin", "employee"].includes(role)) return res.status(400).json({ success: false, message: "Invalid role" });
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ success: false, message: "Cannot change your own role" });
    db.run("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id], function (err) {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (this.changes === 0) return res.status(404).json({ success: false, message: "User not found" });
        db.get("SELECT id, username, role, created_at FROM users WHERE id = ?", [req.params.id], (err, row) => {
            if (err) return res.status(500).json({ success: false, message: "Database error" });
            res.json({ success: true, data: row, message: "Role updated" });
        });
    });
});

/* CATEGORIES */
app.get("/api/categories", authMiddleware, (req, res) => {
    const { type } = req.query;
    let sql = "SELECT name FROM categories";
    const params = [];
    if (type && type !== "all") { sql += " WHERE type = ? OR type = 'both'"; params.push(type); }
    sql += " ORDER BY name ASC";
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        res.json(rows.map(r => r.name));
    });
});

app.get("/api/categories/list", authMiddleware, adminMiddleware, (req, res) => {
    db.all("SELECT * FROM categories ORDER BY name ASC", (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        res.json(rows);
    });
});

app.post("/api/categories", authMiddleware, adminMiddleware, (req, res) => {
    const { name, type } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: "Name required" });
    db.run("INSERT INTO categories (name, type) VALUES (?, ?)", [name.trim(), type || "both"], function (err) {
        if (err) return res.status(400).json({ success: false, message: "Category already exists" });
        res.json({ success: true, data: { id: this.lastID, name: name.trim(), type: type || "both" }, message: "Category created" });
    });
});

app.put("/api/categories/:id", authMiddleware, adminMiddleware, (req, res) => {
    const { name, type } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: "Name required" });
    db.run("UPDATE categories SET name=?, type=? WHERE id=?", [name.trim(), type || "both", req.params.id], function (err) {
        if (err) return res.status(400).json({ success: false, message: "Category name already exists" });
        if (this.changes === 0) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, data: { id: Number(req.params.id), name: name.trim(), type: type || "both" }, message: "Category updated" });
    });
});

app.delete("/api/categories/:id", authMiddleware, adminMiddleware, (req, res) => {
    db.run("DELETE FROM categories WHERE id=?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (this.changes === 0) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, message: "Deleted" });
    });
});

/* PRODUCTS */
app.get("/api/products", authMiddleware, (req, res) => {
    db.all("SELECT * FROM products WHERE user_id = ? ORDER BY name ASC", [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        res.json(rows);
    });
});

app.get("/api/products/low-stock", authMiddleware, (req, res) => {
    db.all("SELECT * FROM products WHERE user_id = ? AND quantity <= reorder_threshold ORDER BY quantity ASC", [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        res.json(rows);
    });
});

app.post("/api/products", authMiddleware, adminMiddleware, (req, res) => {
    const { name, sku, quantity, reorder_threshold, unit_cost } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: "Name required" });
    if (quantity !== undefined && (isNaN(quantity) || quantity < 0)) return res.status(400).json({ success: false, message: "Invalid quantity" });
    db.run("INSERT INTO products (name, sku, quantity, reorder_threshold, unit_cost, user_id) VALUES (?, ?, ?, ?, ?, ?)",
        [name.trim(), sku || null, Number(quantity) || 0, Number(reorder_threshold) || 5, Number(unit_cost) || 0, req.user.id], function (err) {
        if (err) return res.status(400).json({ success: false, message: "SKU already exists" });
        db.get("SELECT * FROM products WHERE id = ? AND user_id = ?", [this.lastID, req.user.id], (err, row) => {
            if (err) return res.status(500).json({ success: false, message: "Database error" });
            res.json({ success: true, data: row, message: "Product created" });
        });
    });
});

app.put("/api/products/:id", authMiddleware, adminMiddleware, (req, res) => {
    const { name, sku, quantity, reorder_threshold, unit_cost } = req.body;
    db.run("UPDATE products SET name=COALESCE(?,name), sku=COALESCE(?,sku), quantity=COALESCE(?,quantity), reorder_threshold=COALESCE(?,reorder_threshold), unit_cost=COALESCE(?,unit_cost) WHERE id=? AND user_id=?",
        [name, sku, quantity !== undefined ? Number(quantity) : null, reorder_threshold !== undefined ? Number(reorder_threshold) : null, unit_cost !== undefined ? Number(unit_cost) : null, req.params.id, req.user.id], function (err) {
        if (err) return res.status(400).json({ success: false, message: "SKU already exists" });
        if (this.changes === 0) return res.status(404).json({ success: false, message: "Not found" });
        db.get("SELECT * FROM products WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], (err, row) => {
            if (err) return res.status(500).json({ success: false, message: "Database error" });
            res.json({ success: true, data: row, message: "Product updated" });
        });
    });
});

app.delete("/api/products/:id", authMiddleware, adminMiddleware, (req, res) => {
    db.run("DELETE FROM products WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (this.changes === 0) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, message: "Deleted" });
    });
});

/* PURCHASES */
app.get("/api/purchases", authMiddleware, (req, res) => {
    db.all("SELECT p.*, pr.name as product_name FROM purchases p LEFT JOIN products pr ON p.product_id = pr.id WHERE p.user_id = ? ORDER BY p.created_at DESC",
        [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        res.json(rows);
    });
});

app.post("/api/purchases", authMiddleware, adminMiddleware, (req, res) => {
    const { product_id, quantity, unit_cost } = req.body;
    if (!product_id || !quantity) return res.status(400).json({ success: false, message: "Product and quantity required" });
    if (isNaN(quantity) || quantity <= 0) return res.status(400).json({ success: false, message: "Invalid quantity" });

    db.get("SELECT id FROM products WHERE id = ? AND user_id = ?", [product_id, req.user.id], (err, product) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        db.run("INSERT INTO purchases (product_id, quantity, unit_cost, user_id) VALUES (?, ?, ?, ?)",
            [product_id, Number(quantity), Number(unit_cost) || 0, req.user.id], function (err) {
            if (err) return res.status(500).json({ success: false, message: err.message });
            db.run("UPDATE products SET quantity = quantity + ?, unit_cost = ? WHERE id = ? AND user_id = ?",
                [Number(quantity), Number(unit_cost), product_id, req.user.id]);
            db.get("SELECT p.*, pr.name as product_name FROM purchases p LEFT JOIN products pr ON p.product_id = pr.id WHERE p.id = ?",
                [this.lastID], (err, row) => {
                if (err) return res.status(500).json({ success: false, message: "Database error" });
                res.json({ success: true, data: row, message: "Purchase recorded" });
            });
        });
    });
});

/* SALES */
app.get("/api/sales", authMiddleware, (req, res) => {
    const { where, orderBy, limitClause, offsetClause, params, alias } = buildQuery("sales", req, "s");
    db.all(`SELECT s.*, p.name as product_name FROM sales s LEFT JOIN products p ON s.product_id = p.id ${where} ${orderBy} ${limitClause} ${offsetClause}`, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        const countParams = params.slice(0, params.length - (req.query.limit ? 2 : 0));
        db.get(`SELECT COUNT(*) as total FROM sales ${alias} ${where}`, countParams, (err2, count) => {
            if (err2) return res.status(500).json({ success: false, message: "Database error" });
            res.json({ success: true, data: rows, total: count.total });
        });
    });
});

app.post("/api/sales", authMiddleware, (req, res) => {
    const { item, amount, category, product_id, quantity, sale_type, service_hours, service_rate } = req.body;
    if (!item || !item.trim() || amount == null) return res.status(400).json({ success: false, message: "Item and amount required" });
    if (isNaN(amount) || amount <= 0) return res.status(400).json({ success: false, message: "Invalid amount" });

    const type = sale_type === "service" ? "service" : "product";
    const qty = Number(quantity) || 1;
    const sHours = type === "service" ? (Number(service_hours) || 0) : null;
    const sRate = type === "service" ? (Number(service_rate) || 0) : null;

    const doSale = (cogs = 0) => {
        db.run("INSERT INTO sales (item, amount, category, product_id, quantity, cogs, user_id, sale_type, service_hours, service_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [item.trim(), Number(amount), category || "General", product_id || null, qty, cogs, req.user.id, type, sHours, sRate], function (err) {
            if (err) return res.status(500).json({ success: false, message: err.message });
            db.get("SELECT s.*, p.name as product_name FROM sales s LEFT JOIN products p ON s.product_id = p.id WHERE s.id = ?",
                [this.lastID], (err, row) => {
                if (err) return res.status(500).json({ success: false, message: "Database error" });
                res.json({ success: true, data: row, message: "Sale recorded" });
            });
        });
    };

    if (type === "product" && product_id) {
        db.get("SELECT * FROM products WHERE id = ? AND user_id = ?", [product_id, req.user.id], (err, product) => {
            if (err) return res.status(500).json({ success: false, message: "Database error" });
            if (product) {
                const cogs = product.unit_cost * qty;
                db.run("UPDATE products SET quantity = quantity - ? WHERE id = ? AND user_id = ?", [qty, product_id, req.user.id]);
                doSale(cogs);
            } else {
                doSale(0);
            }
        });
    } else {
        doSale(0);
    }
});

app.put("/api/sales/:id", authMiddleware, (req, res) => {
    const { item, amount, category, sale_type, service_hours, service_rate } = req.body;
    db.run("UPDATE sales SET item=COALESCE(?,item), amount=COALESCE(?,amount), category=COALESCE(?,category), sale_type=COALESCE(?,sale_type), service_hours=COALESCE(?,service_hours), service_rate=COALESCE(?,service_rate) WHERE id=? AND user_id=?",
        [item || null, amount !== undefined ? Number(amount) : null, category || null, sale_type || null, service_hours !== undefined ? Number(service_hours) : null, service_rate !== undefined ? Number(service_rate) : null, req.params.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (this.changes === 0) return res.status(404).json({ success: false, message: "Not found" });
        db.get("SELECT s.*, p.name as product_name FROM sales s LEFT JOIN products p ON s.product_id = p.id WHERE s.id = ? AND s.user_id = ?",
            [req.params.id, req.user.id], (err, row) => {
            if (err) return res.status(500).json({ success: false, message: "Database error" });
            res.json({ success: true, data: row, message: "Sale updated" });
        });
    });
});

app.delete("/api/sales/:id", authMiddleware, (req, res) => {
    db.run("DELETE FROM sales WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (this.changes === 0) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, message: "Deleted" });
    });
});

app.get("/api/sales/export/csv", authMiddleware, (req, res) => {
    const q = buildQuery("sales", req, "s");
    db.all(`SELECT s.* FROM sales s ${q.where} ${q.orderBy}`, q.params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        const csv = "id,item,type,amount,category,product_id,quantity,cogs,service_hours,service_rate,date\n" + rows.map(r =>
            `${r.id},"${r.item}",${r.sale_type || "product"},${r.amount},"${r.category}",${r.product_id || ""},${r.quantity},${r.cogs},${r.service_hours || ""},${r.service_rate || ""},${r.created_at}`
        ).join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=sales.csv");
        res.send(csv);
    });
});

/* EXPENSES */
app.get("/api/expenses", authMiddleware, (req, res) => {
    const { where, orderBy, limitClause, offsetClause, params } = buildQuery("expenses", req);
    db.all(`SELECT * FROM expenses ${where} ${orderBy} ${limitClause} ${offsetClause}`, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        const countParams = params.slice(0, params.length - (req.query.limit ? 2 : 0));
        db.get(`SELECT COUNT(*) as total FROM expenses ${where}`, countParams, (err2, count) => {
            if (err2) return res.status(500).json({ success: false, message: "Database error" });
            res.json({ success: true, data: rows, total: count.total });
        });
    });
});

app.post("/api/expenses", authMiddleware, (req, res) => {
    const { item, cost, category } = req.body;
    if (!item || !item.trim() || cost == null) return res.status(400).json({ success: false, message: "Item and cost required" });
    if (isNaN(cost) || cost < 0) return res.status(400).json({ success: false, message: "Invalid cost" });
    db.run("INSERT INTO expenses (item, cost, category, user_id) VALUES (?, ?, ?, ?)",
        [item.trim(), Number(cost), category || "General", req.user.id], function (err) {
        if (err) return res.status(500).json({ success: false, message: err.message });
        db.get("SELECT * FROM expenses WHERE id = ? AND user_id = ?", [this.lastID, req.user.id], (err, row) => {
            if (err) return res.status(500).json({ success: false, message: "Database error" });
            res.json({ success: true, data: row, message: "Expense recorded" });
        });
    });
});

app.put("/api/expenses/:id", authMiddleware, (req, res) => {
    const { item, cost, category } = req.body;
    db.run("UPDATE expenses SET item=COALESCE(?,item), cost=COALESCE(?,cost), category=COALESCE(?,category) WHERE id=? AND user_id=?",
        [item || null, cost !== undefined ? Number(cost) : null, category || null, req.params.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (this.changes === 0) return res.status(404).json({ success: false, message: "Not found" });
        db.get("SELECT * FROM expenses WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], (err, row) => {
            if (err) return res.status(500).json({ success: false, message: "Database error" });
            res.json({ success: true, data: row, message: "Expense updated" });
        });
    });
});

app.delete("/api/expenses/:id", authMiddleware, (req, res) => {
    db.run("DELETE FROM expenses WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (this.changes === 0) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, message: "Deleted" });
    });
});

app.get("/api/expenses/export/csv", authMiddleware, (req, res) => {
    const { where, orderBy, params } = buildQuery("expenses", req);
    db.all(`SELECT * FROM expenses ${where} ${orderBy}`, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        const csv = "id,item,cost,category,date\n" + rows.map(r =>
            `${r.id},"${r.item}",${r.cost},"${r.category}",${r.created_at}`
        ).join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=expenses.csv");
        res.send(csv);
    });
});

/* EMPLOYEES */
app.get("/api/employees", authMiddleware, (req, res) => {
    db.all("SELECT * FROM employees WHERE user_id = ? ORDER BY name ASC", [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        res.json(rows);
    });
});

app.post("/api/employees", authMiddleware, adminMiddleware, (req, res) => {
    const { name, pay_type, salary, hourly_rate, tax_id } = req.body;
    if (!name || !name.trim() || !pay_type) return res.status(400).json({ success: false, message: "Name and pay type required" });
    if (!["salary", "hourly"].includes(pay_type)) return res.status(400).json({ success: false, message: "Invalid pay type" });
    db.run("INSERT INTO employees (name, pay_type, salary, hourly_rate, tax_id, user_id) VALUES (?, ?, ?, ?, ?, ?)",
        [name.trim(), pay_type, Number(salary) || 0, Number(hourly_rate) || 0, tax_id || null, req.user.id], function (err) {
        if (err) return res.status(500).json({ success: false, message: err.message });
        db.get("SELECT * FROM employees WHERE id = ? AND user_id = ?", [this.lastID, req.user.id], (err, row) => {
            if (err) return res.status(500).json({ success: false, message: "Database error" });
            res.json({ success: true, data: row, message: "Employee created" });
        });
    });
});

app.put("/api/employees/:id", authMiddleware, adminMiddleware, (req, res) => {
    const { name, pay_type, salary, hourly_rate, tax_id } = req.body;
    db.run("UPDATE employees SET name=COALESCE(?,name), pay_type=COALESCE(?,pay_type), salary=COALESCE(?,salary), hourly_rate=COALESCE(?,hourly_rate), tax_id=COALESCE(?,tax_id) WHERE id=? AND user_id=?",
        [name || null, pay_type || null, salary !== undefined ? Number(salary) : null, hourly_rate !== undefined ? Number(hourly_rate) : null, tax_id !== undefined ? tax_id : null, req.params.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (this.changes === 0) return res.status(404).json({ success: false, message: "Not found" });
        db.get("SELECT * FROM employees WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], (err, row) => {
            if (err) return res.status(500).json({ success: false, message: "Database error" });
            res.json({ success: true, data: row, message: "Employee updated" });
        });
    });
});

app.delete("/api/employees/:id", authMiddleware, adminMiddleware, (req, res) => {
    db.run("DELETE FROM employees WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (this.changes === 0) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, message: "Deleted" });
    });
});

/* PAYROLL */
app.get("/api/payroll", authMiddleware, (req, res) => {
    db.all("SELECT p.*, e.name as employee_name FROM payroll p LEFT JOIN employees e ON p.employee_id = e.id WHERE p.user_id = ? ORDER BY p.created_at DESC",
        [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        res.json(rows);
    });
});

app.post("/api/payroll/run", authMiddleware, adminMiddleware, (req, res) => {
    const { employee_id, hours } = req.body;
    if (!employee_id) return res.status(400).json({ success: false, message: "Employee required" });

    db.get("SELECT * FROM employees WHERE id = ? AND user_id = ?", [employee_id, req.user.id], (err, emp) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (!emp) return res.status(404).json({ success: false, message: "Employee not found" });

        let gross = 0;
        if (emp.pay_type === "salary") {
            gross = emp.salary / 12;
        } else {
            if (!hours || hours <= 0) return res.status(400).json({ success: false, message: "Hours required for hourly employees" });
            gross = Number(hours) * emp.hourly_rate;
        }

        const tax = Math.round(gross * TAX_RATE * 100) / 100;
        const net = Math.round((gross - tax) * 100) / 100;

        db.run("INSERT INTO payroll (employee_id, pay_type, hours, gross_pay, tax, net_pay, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [employee_id, emp.pay_type, Number(hours) || 0, gross, tax, net, req.user.id], function (err) {
            if (err) return res.status(500).json({ success: false, message: err.message });
            db.get("SELECT p.*, e.name as employee_name FROM payroll p LEFT JOIN employees e ON p.employee_id = e.id WHERE p.id = ?",
                [this.lastID], (err, row) => {
                if (err) return res.status(500).json({ success: false, message: "Database error" });
                res.json({ success: true, data: row, message: "Payroll processed" });
            });
        });
    });
});

app.delete("/api/payroll/:id", authMiddleware, adminMiddleware, (req, res) => {
    db.run("DELETE FROM payroll WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (this.changes === 0) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, message: "Deleted" });
    });
});

/* SUMMARY */
app.get("/api/summary", authMiddleware, (req, res) => {
    const { category, startDate, endDate } = req.query;
    const conditions = ["user_id = ?"]; const params = [req.user.id];
    if (category && category !== "all") { conditions.push("category = ?"); params.push(category); }
    if (startDate) { conditions.push("created_at >= ?"); params.push(startDate); }
    if (endDate) { conditions.push("created_at <= ?"); params.push(endDate + " 23:59:59"); }
    const where = "WHERE " + conditions.join(" AND ");

    db.get(`SELECT COALESCE(SUM(amount),0) as totalSales FROM sales ${where}`, params, (err, s) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        const expParams = [...params];
        const pWhere = where.replace("category","1");
        db.get(`SELECT COALESCE(SUM(cost),0) as totalExpenses FROM expenses ${where}`, params, (err, e) => {
            if (err) return res.status(500).json({ success: false, message: "Database error" });
            db.get(`SELECT COALESCE(SUM(gross_pay),0) as totalPayroll FROM payroll ${pWhere}`, params, (err, p) => {
                if (err) return res.status(500).json({ success: false, message: "Database error" });
                const totalSales = Number(s.totalSales);
                const totalExpenses = Number(e.totalExpenses) + Number(p.totalPayroll);
                res.json({ totalSales, totalExpenses, profit: totalSales - totalExpenses, totalPayroll: Number(p.totalPayroll) });
            });
        });
    });
});

/* TRENDS */
app.get("/api/trends", authMiddleware, (req, res) => {
    db.all(`SELECT strftime('%Y-%m',created_at) as month, SUM(amount) as total FROM sales WHERE user_id = ? GROUP BY month ORDER BY month`,
        [req.user.id], (err, salesData) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        db.all(`SELECT strftime('%Y-%m',created_at) as month, SUM(cost) as total FROM expenses WHERE user_id = ? GROUP BY month ORDER BY month`,
            [req.user.id], (err, expData) => {
            if (err) return res.status(500).json({ success: false, message: "Database error" });
            const months = [...new Set([...salesData.map(x => x.month), ...expData.map(x => x.month)])].sort();
            res.json(months.map(m => ({
                month: m,
                sales: Number(salesData.find(x => x.month === m)?.total || 0),
                expenses: Number(expData.find(x => x.month === m)?.total || 0),
            })));
        });
    });
});

/* BALANCE SHEET */
app.get("/api/balance-sheet", authMiddleware, (req, res) => {
    db.get("SELECT COALESCE(SUM(amount),0) as totalSales FROM sales WHERE user_id = ?", [req.user.id], (err, s) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        db.get("SELECT COALESCE(SUM(cost),0) as totalExpenses FROM expenses WHERE user_id = ?", [req.user.id], (err, e) => {
            if (err) return res.status(500).json({ success: false, message: "Database error" });
            db.get("SELECT COALESCE(SUM(net_pay),0) as totalPayroll FROM payroll WHERE user_id = ?", [req.user.id], (err, p) => {
                if (err) return res.status(500).json({ success: false, message: "Database error" });
                db.get("SELECT COALESCE(SUM(quantity * unit_cost),0) as inventoryValue FROM products WHERE user_id = ?", [req.user.id], (err, inv) => {
                    if (err) return res.status(500).json({ success: false, message: "Database error" });
                    const revenue = Number(s.totalSales);
                    const expenses = Number(e.totalExpenses) + Number(p.totalPayroll);
                    const netIncome = revenue - expenses;
                    const invValue = Number(inv.inventoryValue);
                    res.json({
                        revenue, expenses, netIncome,
                        assets: { cash: netIncome, inventory: invValue, total: invValue + netIncome },
                        liabilities: { total: 0 },
                        equity: { retained: netIncome, total: invValue + netIncome }
                    });
                });
            });
        });
    });
});

/* INVOICE */
let browserInstance = null;

app.post("/api/invoice", authMiddleware, async (req, res) => {
    try {
        const { customer, items, invoiceNo, dueDate, dateOfIssue, taxRate, companyName, addressLine1, addressLine2, addressCountry, phone, email, billToName, billToCompany, billToAddress, billToCity, billToCountry, billToEmail, currencySymbol, currencyCode } = req.body;

        if (!items || !items.length) return res.status(400).json({ success: false, message: "Items required" });

        // Validate items belong to this user
        const itemIds = items.filter(i => i.id).map(i => i.id);
        if (itemIds.length > 0) {
            const validIds = await new Promise((resolve, reject) => {
                const placeholders = itemIds.map(() => "?").join(",");
                db.all(`SELECT id FROM sales WHERE id IN (${placeholders}) AND user_id = ?`,
                    [...itemIds, req.user.id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(new Set(rows.map(r => r.id)));
                });
            });
            for (const item of items) {
                if (item.id && !validIds.has(item.id)) {
                    return res.status(400).json({ success: false, message: `Invalid item: ${item.name}` });
                }
            }
        }

        const sym = currencySymbol || "$";
        const code = currencyCode || "USD";

        const subtotal = items.reduce((a, i) => a + Number(i.price), 0);
        const taxPct = Number(taxRate) || 0;
        const taxAmt = subtotal * (taxPct / 100);
        const grandTotal = subtotal + taxAmt;

        const fmt = (n) => Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

        const itemRows = items.map(item => {
            const price = Number(item.price);
            const qty = item.quantity || 1;
            const rate = price / qty;
            return `<tr><td>${item.name.replace(/</g,'&lt;')}</td><td class="right">${sym}${fmt(rate)}</td><td class="right">${qty}</td><td class="right">${sym}${fmt(price)}</td></tr>`;
        }).join("\n    ");

        let template = fs.readFileSync(path.join(__dirname, "invoice_template.html"), "utf8");
        const escapeHtml = (str) => (str || "").replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        const safe = (v) => escapeHtml(v);

        template = template
            .replaceAll("{{companyName}}", safe(companyName) || "Business-in-a-Box")
            .replaceAll("{{phone}}", safe(phone))
            .replaceAll("{{addressLine1}}", safe(addressLine1))
            .replaceAll("{{addressLine2}}", safe(addressLine2))
            .replaceAll("{{addressCountry}}", safe(addressCountry))
            .replaceAll("{{billToName}}", safe(billToName) || "Customer")
            .replaceAll("{{billToCompany}}", safe(billToCompany))
            .replaceAll("{{billToAddress}}", safe(billToAddress))
            .replaceAll("{{billToCity}}", safe(billToCity))
            .replaceAll("{{billToCountry}}", safe(billToCountry))
            .replaceAll("{{dateOfIssue}}", dateOfIssue ? new Date(dateOfIssue).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }))
            .replaceAll("{{dueDate}}", dueDate ? new Date(dueDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : "N/A")
            .replaceAll("{{invoiceNo}}", safe(invoiceNo) || `INV-${Date.now().toString().slice(-6)}`)
            .replaceAll("{{items}}", itemRows)
            .replaceAll("{{currencySymbol}}", sym)
            .replaceAll("{{currencyCode}}", code)
            .replaceAll("{{subtotal}}", fmt(subtotal))
            .replaceAll("{{tax}}", fmt(taxAmt))
            .replaceAll("{{total}}", fmt(grandTotal))
            .replaceAll("{{amountDue}}", fmt(grandTotal));

        const pdfFile = `invoice_${Date.now()}.pdf`;
        const pdfPath = path.join(INVOICES_DIR, pdfFile);
        const htmlPath = pdfPath.replace(".pdf", ".html");

        fs.writeFileSync(htmlPath, template);

        if (!browserInstance) {
            browserInstance = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
        }
        const page = await browserInstance.newPage();
        await page.goto("file://" + htmlPath, { waitUntil: "networkidle0", timeout: 30000 });
        await page.pdf({ path: pdfPath, format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
        await page.close();
        fs.unlinkSync(htmlPath);

        db.run("INSERT INTO invoices (invoice_no, file_name, total, user_id) VALUES (?, ?, ?, ?)",
            [invoiceNo || `INV-${Date.now().toString().slice(-6)}`, pdfFile, grandTotal, req.user.id]);

        res.json({ success: true, data: { file: pdfFile, total: grandTotal, invoiceNo: invoiceNo || `INV-${Date.now().toString().slice(-6)}` }, message: "Invoice generated" });
    } catch (err) {
        console.error("Invoice generation error:", err);
        res.status(500).json({ success: false, message: "Failed to generate invoice" });
    }
});

app.get("/api/invoice/:fileName", authMiddleware, (req, res) => {
    const fileName = path.basename(req.params.fileName);
    if (!fileName.endsWith(".pdf")) return res.status(400).json({ success: false, message: "Invalid file type" });
    const filePath = path.join(INVOICES_DIR, fileName);
    if (!filePath.startsWith(INVOICES_DIR)) return res.status(403).json({ success: false, message: "Forbidden" });

    // Verify user owns this invoice
    db.get("SELECT id FROM invoices WHERE file_name = ? AND user_id = ?", [fileName, req.user.id], (err, record) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (!record) return res.status(404).json({ success: false, message: "Invoice not found" });
        if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: "File not found" });
        res.download(filePath);
    });
});

app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
});

const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

process.on("SIGTERM", async () => {
    if (browserInstance) await browserInstance.close();
    server.close(() => process.exit(0));
});

process.on("SIGINT", async () => {
    if (browserInstance) await browserInstance.close();
    server.close(() => process.exit(0));
});
