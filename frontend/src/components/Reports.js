import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Reports() {
    const { authFetch } = useAuth();
    const [sheet, setSheet] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        authFetch("/balance-sheet").then(r => r.json()).then(setSheet).catch(() => {}).finally(() => setLoading(false));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="page"><div className="spinner" /></div>;
    if (!sheet) return <div className="page"><p>Failed to load reports</p></div>;

    const barData = [
        { name: "Revenue", value: sheet.revenue },
        { name: "Expenses", value: sheet.expenses },
        { name: "Net Income", value: Math.max(sheet.netIncome, 0) },
    ];

    return (
        <div className="page">
            <h1>Financial Reports</h1>

            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Balance Sheet</h2>

            <div className="summary-cards" style={{ marginBottom: 16, gridTemplateColumns: "repeat(4, 1fr)" }}>
                <div className="summary-card">
                    <span className="card-label">Revenue</span>
                    <span className="card-value" style={{ color: "#22c55e" }}>${Number(sheet.revenue).toLocaleString()}</span>
                </div>
                <div className="summary-card">
                    <span className="card-label">Expenses</span>
                    <span className="card-value" style={{ color: "#ef4444" }}>${Number(sheet.expenses).toLocaleString()}</span>
                </div>
                <div className={`summary-card ${sheet.netIncome >= 0 ? "profit" : "loss"}`}>
                    <span className="card-label">Net Income</span>
                    <span className="card-value">${Number(sheet.netIncome).toLocaleString()}</span>
                </div>
                <div className="summary-card profit">
                    <span className="card-label">Inventory Value</span>
                    <span className="card-value">${Number(sheet.assets.inventory).toLocaleString()}</span>
                </div>
            </div>

            <div className="charts-row" style={{ marginBottom: 24 }}>
                <div className="chart-card">
                    <h3>Income Overview</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={barData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip />
                            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="chart-card">
                    <h3>Equity Breakdown</h3>
                    <table className="data-table" style={{ boxShadow: "none" }}>
                        <tbody>
                            <tr><td>Cash</td><td style={{ textAlign: "right", fontWeight: 600 }}>${Number(sheet.assets.cash).toLocaleString()}</td></tr>
                            <tr><td>Inventory</td><td style={{ textAlign: "right", fontWeight: 600 }}>${Number(sheet.assets.inventory).toLocaleString()}</td></tr>
                            <tr style={{ borderTop: "2px solid #e5e7eb" }}><td><strong>Total Assets</strong></td><td style={{ textAlign: "right", fontWeight: 700, color: "#16a34a" }}>${Number(sheet.assets.total).toLocaleString()}</td></tr>
                            <tr><td>Liabilities</td><td style={{ textAlign: "right", fontWeight: 600, color: "#dc2626" }}>${Number(sheet.liabilities.total).toLocaleString()}</td></tr>
                            <tr style={{ borderTop: "2px solid #e5e7eb" }}><td><strong>Total Equity</strong></td><td style={{ textAlign: "right", fontWeight: 700, color: "#2563eb" }}>${Number(sheet.equity.total).toLocaleString()}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
