import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";

export default function Dashboard() {
    const { authFetch } = useAuth();
    const { dark } = useTheme();
    const [sales, setSales] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [summary, setSummary] = useState({ totalSales: 0, totalExpenses: 0, profit: 0 });
    const [trends, setTrends] = useState([]);
    const [categories, setCategories] = useState([]);
    const [lowStock, setLowStock] = useState([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const fetchData = () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (category !== "all") params.set("category", category);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        const qs = params.toString();

        Promise.all([
            authFetch(`/sales${qs ? "?" + qs : ""}`).then(r => r.json()),
            authFetch(`/expenses${qs ? "?" + qs : ""}`).then(r => r.json()),
            authFetch(`/summary${qs ? "?" + qs : ""}`).then(r => r.json()),
            authFetch("/trends").then(r => r.json()),
            authFetch("/categories").then(r => r.json()),
            authFetch("/products/low-stock").then(r => r.json()),
        ]).then(([s, e, summ, trend, cats, ls]) => {
            setSales(s.data || []);
            setExpenses(e.data || []);
            setSummary(summ);
            setTrends(trend);
            setCategories(cats);
            setLowStock(ls);
        }).catch(() => {}).finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const formatCurrency = (n) => `$${Number(n).toLocaleString()}`;

    const pieData = [
        { name: "Sales", value: Math.max(summary.totalSales, 0) },
        { name: "Expenses", value: Math.max(summary.totalExpenses, 0) },
    ];
    const COLORS = ["#22c55e", "#ef4444"];

    const allTransactions = [
        ...sales.map(s => ({ ...s, type: "sale", value: s.amount })),
        ...expenses.map(e => ({ ...e, type: "expense", value: -e.cost })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);

    const categorySummary = [...new Set([...sales.map(s => s.category), ...expenses.map(e => e.category)])].map(cat => {
        const sTotal = sales.filter(s => s.category === cat).reduce((a, s) => a + Number(s.amount), 0);
        const eTotal = expenses.filter(e => e.category === cat).reduce((a, e) => a + Number(e.cost), 0);
        return { category: cat, sales: sTotal, expenses: eTotal, net: sTotal - eTotal };
    });

    if (loading) return <div className="page"><div className="spinner" /></div>;

    return (
        <div className="page">
            <h1>Dashboard</h1>

            <div className="filter-row">
                <select value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="all">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                <button className="btn-primary" onClick={fetchData}>Apply</button>
            </div>

            {lowStock.length > 0 && (
                <div className={`alert-box ${dark ? "alert-dark" : "alert-warning"}`} style={{ marginBottom: 16 }}>
                    <strong>⚠ Low Stock:</strong> {lowStock.map(p => `${p.name} (${p.quantity} left)`).join(", ")}
                </div>
            )}

            <div className="summary-cards">
                <div className="summary-card sales">
                    <span className="card-label">Total Sales</span>
                    <span className="card-value">{formatCurrency(summary.totalSales)}</span>
                </div>
                <div className="summary-card expenses">
                    <span className="card-label">Total Expenses</span>
                    <span className="card-value">{formatCurrency(summary.totalExpenses)}</span>
                </div>
                <div className={`summary-card ${summary.profit >= 0 ? "profit" : "loss"}`}>
                    <span className="card-label">{summary.profit >= 0 ? "Profit" : "Loss"}</span>
                    <span className="card-value">{formatCurrency(Math.abs(summary.profit))}</span>
                </div>
            </div>

            <div className="charts-row">
                <div className="chart-card">
                    <h3>Sales vs Expenses (Monthly)</h3>
                    {trends.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={trends}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="month" stroke="#6b7280" />
                                <YAxis stroke="#6b7280" />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="sales" stroke="#22c55e" strokeWidth={2} />
                                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : <p className="empty-chart">No trend data yet</p>}
                </div>
                <div className="chart-card">
                    <h3>Sales vs Expenses</h3>
                    {summary.totalSales > 0 || summary.totalExpenses > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: $${value}`}>
                                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                                </Pie>
                                <Tooltip /><Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <p className="empty-chart">No data yet</p>}
                </div>
            </div>

            <div className="charts-row" style={{ marginTop: 16 }}>
                <div className="chart-card">
                    <h3>By Category</h3>
                    {categorySummary.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={categorySummary}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="category" stroke="#6b7280" />
                                <YAxis stroke="#6b7280" />
                                <Tooltip />
                                <Bar dataKey="sales" fill="#22c55e" name="Sales" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="empty-chart">No data yet</p>}
                </div>
                <div className="chart-card">
                    <h3>Recent Transactions</h3>
                    <div className="recent-list">
                        {allTransactions.length > 0 ? allTransactions.map(t => (
                            <div key={`${t.type}-${t.id}`} className="recent-item">
                                <div>
                                    <span className="recent-item-name">{t.item}</span>
                                    <span className={`recent-item-cat ${t.type}`}>{t.type}</span>
                                </div>
                                <span className={`recent-item-value ${t.type === "sale" ? "positive" : "negative"}`}>
                                    {t.type === "sale" ? "+" : "-"}${Math.abs(t.value).toLocaleString()}
                                </span>
                            </div>
                        )) : <p className="empty-chart">No transactions yet</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
