import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "./ConfirmDialog";

const PAGE_SIZE = 10;

export default function Expenses() {
    const { authFetch } = useAuth();
    const { addToast } = useToast();
    const [expenses, setExpenses] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [item, setItem] = useState("");
    const [cost, setCost] = useState("");
    const [category, setCategory] = useState("General");
    const [categories, setCategories] = useState([]);
    const [editing, setEditing] = useState(null);
    const [editItem, setEditItem] = useState("");
    const [editCost, setEditCost] = useState("");
    const [editCategory, setEditCategory] = useState("");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [confirm, setConfirm] = useState(null);

    const fetchExpenses = (p = page) => {
        setLoading(true);
        Promise.all([
            authFetch(`/expenses?page=${p}&limit=${PAGE_SIZE}&sort=newest`).then(r => r.json()),
            authFetch("/categories").then(r => r.json()),
        ]).then(([res, cats]) => {
            setExpenses(res.data);
            setTotal(res.total);
            setCategories(cats);
        }).catch(() => {}).finally(() => setLoading(false));
    };

    useEffect(() => { fetchExpenses(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const addExpense = async () => {
        if (!item || !cost) return;
        await authFetch("/expenses", {
            method: "POST",
            body: JSON.stringify({ item, cost: Number(cost), category })
        });
        setItem("");
        setCost("");
        setCategory("General");
        addToast("Expense added", "success");
        fetchExpenses(1);
    };

    const startEdit = (e) => {
        setEditing(e.id);
        setEditItem(e.item);
        setEditCost(e.cost);
        setEditCategory(e.category || "General");
    };

    const saveEdit = async (id) => {
        await authFetch(`/expenses/${id}`, {
            method: "PUT",
            body: JSON.stringify({ item: editItem, cost: Number(editCost), category: editCategory })
        });
        setEditing(null);
        addToast("Expense updated", "success");
        fetchExpenses(page);
    };

    const deleteExpense = async (id) => {
        await authFetch(`/expenses/${id}`, { method: "DELETE" });
        setConfirm(null);
        addToast("Expense deleted", "success");
        fetchExpenses(1);
    };

    const exportCSV = async () => {
        const res = await authFetch("/expenses/export/csv");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "expenses.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    const filtered = expenses.filter(e => e.item.toLowerCase().includes(search.toLowerCase()));
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const totalCost = filtered.reduce((a, e) => a + Number(e.cost), 0);

    return (
        <div className="page">
            <div className="page-header">
                <h1>Expenses</h1>
                <button className="btn-secondary" onClick={exportCSV}>Export CSV</button>
            </div>

            <div className="summary-cards" style={{ marginBottom: 16, gridTemplateColumns: "repeat(3, 1fr)" }}>
                <div className="summary-card expenses">
                    <span className="card-label">Total Expenses</span>
                    <span className="card-value">${totalCost.toLocaleString()}</span>
                </div>
                <div className="summary-card">
                    <span className="card-label">Average per Expense</span>
                    <span className="card-value">${filtered.length > 0 ? (totalCost / filtered.length).toLocaleString() : 0}</span>
                </div>
                <div className="summary-card">
                    <span className="card-label">Expense Count</span>
                    <span className="card-value">{filtered.length}</span>
                </div>
            </div>

            <div className="card-section">
                <h3>Record an Expense</h3>
                <div className="input-row">
                    <div className="field">
                        <label>Expense Item</label>
                        <input placeholder="e.g. Office supplies" value={item} onChange={e => setItem(e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Cost ($)</label>
                        <input placeholder="0.00" type="number" value={cost} onChange={e => setCost(e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Category</label>
                        <select value={category} onChange={e => setCategory(e.target.value)}>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <button className="btn-primary" style={{ marginTop: 22 }} onClick={addExpense}>Add Expense</button>
                </div>
            </div>

            <div className="search-row">
                <input placeholder="Search by item name..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
                <span className="item-count">{total} total expenses</span>
            </div>
            {loading ? <div className="spinner" /> : (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: "30%" }}>Expense Item</th>
                                <th style={{ width: "15%" }} className="num">Cost</th>
                                <th style={{ width: "15%" }}>Category</th>
                                <th style={{ width: "15%" }}>Date</th>
                                <th style={{ width: "90px" }} className="actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(e => (
                                <tr key={e.id}>
                                    {editing === e.id ? (
                                        <>
                                            <td><input value={editItem} onChange={ev => setEditItem(ev.target.value)} /></td>
                                            <td className="num"><input type="number" value={editCost} onChange={ev => setEditCost(ev.target.value)} /></td>
                                            <td>
                                                <select value={editCategory} onChange={ev => setEditCategory(ev.target.value)}>
                                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </td>
                                            <td>{e.created_at?.split(" ")[0]}</td>
                                            <td className="actions">
                                                <button className="btn-sm btn-save" onClick={() => saveEdit(e.id)}>Save</button>
                                                <button className="btn-sm btn-cancel" onClick={() => setEditing(null)}>Cancel</button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td>{e.item}</td>
                                            <td className="num">${Number(e.cost).toLocaleString()}</td>
                                            <td><span className="badge">{e.category}</span></td>
                                            <td>{e.created_at?.split(" ")[0]}</td>
                                            <td className="actions">
                                                <button className="btn-sm btn-edit" onClick={() => startEdit(e)}>Edit</button>
                                                <button className="btn-sm btn-delete" onClick={() => setConfirm(e.id)}>Delete</button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan="5" className="empty">{search ? "No matching expenses found" : "No expenses yet — record your first expense above"}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            {totalPages > 1 && (
                <div className="pagination">
                    <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchExpenses(p); }}>Prev</button>
                    <span>Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); fetchExpenses(p); }}>Next</button>
                </div>
            )}
            <ConfirmDialog
                open={confirm !== null}
                title="Delete Expense"
                message="Are you sure you want to delete this expense?"
                onConfirm={() => deleteExpense(confirm)}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}
