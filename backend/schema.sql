-- PostgreSQL schema for Supabase
-- Run this in the Supabase SQL editor to initialize the database

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'employee',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL, sku TEXT UNIQUE,
    quantity REAL DEFAULT 0, reorder_threshold REAL DEFAULT 5,
    unit_cost REAL DEFAULT 0,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    item TEXT NOT NULL, amount REAL NOT NULL,
    category TEXT DEFAULT 'General',
    product_id INTEGER, quantity REAL DEFAULT 1, cogs REAL DEFAULT 0,
    sale_type TEXT DEFAULT 'product',
    service_hours REAL, service_rate REAL,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    item TEXT NOT NULL, cost REAL NOT NULL,
    category TEXT DEFAULT 'General',
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    quantity REAL NOT NULL, unit_cost REAL NOT NULL,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    pay_type TEXT NOT NULL CHECK(pay_type IN ('salary','hourly')),
    salary REAL DEFAULT 0, hourly_rate REAL DEFAULT 0, tax_id TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    pay_type TEXT NOT NULL, hours REAL DEFAULT 0,
    gross_pay REAL NOT NULL, tax REAL NOT NULL, net_pay REAL NOT NULL,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE, type TEXT DEFAULT 'both',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_no TEXT, file_name TEXT NOT NULL, total REAL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Set first user as admin (run after registration)
-- UPDATE users SET role = 'admin' WHERE id = 1 AND role = 'employee';

-- Seed categories
INSERT INTO categories (name, type) VALUES
    ('General','both'),('Products','sales'),('Services','sales'),
    ('Rent & Lease','expenses'),('Utilities','expenses'),
    ('Supplies','expenses'),('Materials','both'),
    ('Labor','expenses'),('Shipping','both'),
    ('Marketing & Ads','expenses'),('Insurance','expenses'),
    ('Taxes & Licenses','expenses'),('Maintenance','expenses'),
    ('Software','expenses'),('Travel','expenses'),('Other','both')
ON CONFLICT (name) DO NOTHING;
