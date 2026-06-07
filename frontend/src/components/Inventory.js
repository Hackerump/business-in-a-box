import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";

export default function Inventory() {
    const { authFetch, user } = useAuth();
    const { addToast } = useToast();
    const { dark } = useTheme();
    const [products, setProducts] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [lowStock, setLowStock] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("products");
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);

    const [form, setForm] = useState({ name: "", sku: "", quantity: 0, reorder_threshold: 5, unit_cost: 0 });
    const [purchaseForm, setPurchaseForm] = useState({ product_id: "", quantity: 1, unit_cost: 0 });

    const isAdmin = user?.role === "admin";

    const fetchData = () => {
        setLoading(true);
        Promise.all([
            authFetch("/products").then(r => r.json()),
            authFetch("/purchases").then(r => r.json()),
            authFetch("/products/low-stock").then(r => r.json()),
        ]).then(([p, pu, ls]) => {
            setProducts(p);
            setPurchases(pu);
            setLowStock(ls);
        }).catch(() => {}).finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const resetForm = () => {
        setForm({ name: "", sku: "", quantity: 0, reorder_threshold: 5, unit_cost: 0 });
        setEditId(null);
        setShowForm(false);
    };

    const handleSave = async () => {
        if (!form.name) return;
        if (editId) {
            await authFetch(`/products/${editId}`, { method: "PUT", body: JSON.stringify(form) });
            addToast("Product updated", "success");
        } else {
            await authFetch("/products", { method: "POST", body: JSON.stringify(form) });
            addToast("Product added", "success");
        }
        resetForm();
        fetchData();
    };

    const handleDelete = async (id) => {
        await authFetch(`/products/${id}`, { method: "DELETE" });
        addToast("Product deleted", "success");
        fetchData();
    };

    const startEdit = (p) => {
        setForm({ name: p.name, sku: p.sku || "", quantity: p.quantity, reorder_threshold: p.reorder_threshold, unit_cost: p.unit_cost });
        setEditId(p.id);
        setShowForm(true);
    };

    const handlePurchase = async () => {
        if (!purchaseForm.product_id || !purchaseForm.quantity) return;
        await authFetch("/purchases", {
            method: "POST",
            body: JSON.stringify({ product_id: Number(purchaseForm.product_id), quantity: Number(purchaseForm.quantity), unit_cost: Number(purchaseForm.unit_cost) })
        });
        setPurchaseForm({ product_id: "", quantity: 1, unit_cost: 0 });
        addToast("Stock added", "success");
        fetchData();
    };

    const totalValue = products.reduce((a, p) => a + p.quantity * p.unit_cost, 0);
    const totalStock = products.reduce((a, p) => a + p.quantity, 0);
    const numCols = isAdmin ? 8 : 7;

    if (loading) return <div className="page"><div className="spinner" /></div>;

    return (
        <div className="page">
            <h1>Inventory</h1>

            {lowStock.length > 0 && (
                <div className={`alert-box ${dark ? "alert-dark" : "alert-warning"}`} style={{ marginBottom: 16 }}>
                    <strong>⚠ Low Stock:</strong> {lowStock.map(p => `${p.name} (${p.quantity} left)`).join(", ")}
                </div>
            )}

            <div className="summary-cards" style={{ marginBottom: 16 }}>
                <div className="summary-card profit">
                    <span className="card-label">Products</span>
                    <span className="card-value">{products.length}</span>
                </div>
                <div className="summary-card">
                    <span className="card-label">Total Stock (units)</span>
                    <span className="card-value">{totalStock}</span>
                </div>
                <div className="summary-card sales">
                    <span className="card-label">Inventory Value ($)</span>
                    <span className="card-value">${totalValue.toLocaleString()}</span>
                </div>
            </div>

            <div className="tab-bar">
                <button className={`tab-btn ${tab === "products" ? "active" : ""}`} onClick={() => setTab("products")}>Products</button>
                <button className={`tab-btn ${tab === "purchases" ? "active" : ""}`} onClick={() => setTab("purchases")}>Purchase History</button>
            </div>

            {tab === "products" && (
                <>
                    <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => { resetForm(); setShowForm(!showForm); }}>
                        {showForm ? "Cancel" : "Add Product"}
                    </button>

                    {showForm && (
                        <div className="inline-form">
                            <div className="form-row">
                                <input placeholder="Product name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                                <input placeholder="SKU (optional)" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
                            </div>
                            <div className="form-row">
                                <label>Initial stock: <input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></label>
                                <label>Reorder when ≤: <input type="number" value={form.reorder_threshold} onChange={e => setForm({ ...form, reorder_threshold: Number(e.target.value) })} /></label>
                                <label>Unit cost ($): <input type="number" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: Number(e.target.value) })} /></label>
                                {editId && <label>Current stock: <strong>{products.find(p => p.id === editId)?.quantity}</strong></label>}
                            </div>
                            <button className="btn-primary" onClick={handleSave}>{editId ? "Update" : "Save"}</button>
                        </div>
                    )}

                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "30%" }}>Name</th>
                                    <th style={{ width: "15%" }}>SKU</th>
                                    <th style={{ width: "10%" }}>Stock</th>
                                    <th style={{ width: "10%" }}>Min</th>
                                    <th style={{ width: "12%" }}>Unit Cost</th>
                                    <th style={{ width: "13%" }}>Value</th>
                                    <th style={{ width: "10%" }}>Status</th>
                                    {isAdmin && <th style={{ width: "90px" }}>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(p => {
                                    const low = p.quantity <= p.reorder_threshold;
                                    return (
                                        <tr key={p.id} className={low ? "row-warning" : ""}>
                                            <td>{p.name}</td>
                                            <td>{p.sku || "-"}</td>
                                            <td className="num">{p.quantity}</td>
                                            <td className="num">{p.reorder_threshold}</td>
                                            <td className="num">${Number(p.unit_cost).toFixed(2)}</td>
                                            <td className="num">${(p.quantity * p.unit_cost).toLocaleString()}</td>
                                            <td>{low ? <span className="badge badge-danger">Low</span> : <span className="badge badge-ok">OK</span>}</td>
                                            {isAdmin && (
                                                <td className="actions">
                                                    <button className="btn-sm btn-edit" onClick={() => startEdit(p)}>Edit</button>
                                                    <button className="btn-sm btn-delete" onClick={() => handleDelete(p.id)}>Delete</button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                {products.length === 0 && <tr><td colSpan={numCols} className="empty">No products yet</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {tab === "purchases" && (
                <>
                    {isAdmin && (
                        <div className="inline-form" style={{ marginBottom: 16 }}>
                            <div className="form-row">
                                <select value={purchaseForm.product_id} onChange={e => {
                                    const p = products.find(x => x.id === Number(e.target.value));
                                    setPurchaseForm({ ...purchaseForm, product_id: e.target.value, unit_cost: p ? p.unit_cost : 0 });
                                }} style={{ minWidth: 200 }}>
                                    <option value="">Select product</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name} (stock: {p.quantity})</option>)}
                                </select>
                                <label>Qty: <input type="number" value={purchaseForm.quantity} onChange={e => setPurchaseForm({ ...purchaseForm, quantity: Number(e.target.value) })} /></label>
                                <label>Unit cost ($): <input type="number" value={purchaseForm.unit_cost} onChange={e => setPurchaseForm({ ...purchaseForm, unit_cost: Number(e.target.value) })} /></label>
                            </div>
                            <button className="btn-primary" onClick={handlePurchase}>Restock</button>
                        </div>
                    )}
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "30%" }}>Product</th>
                                    <th style={{ width: "15%" }}>Qty</th>
                                    <th style={{ width: "20%" }}>Unit Cost</th>
                                    <th style={{ width: "20%" }}>Total</th>
                                    <th style={{ width: "15%" }}>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchases.map(p => (
                                    <tr key={p.id}>
                                        <td>{p.product_name || `Product #${p.product_id}`}</td>
                                        <td className="num">{p.quantity}</td>
                                        <td className="num">${Number(p.unit_cost).toFixed(2)}</td>
                                        <td className="num">${(p.quantity * p.unit_cost).toLocaleString()}</td>
                                        <td>{p.created_at?.split(" ")[0]}</td>
                                    </tr>
                                ))}
                                {purchases.length === 0 && <tr><td colSpan="5" className="empty">No purchases yet</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
