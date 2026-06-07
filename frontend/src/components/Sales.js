import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "./ConfirmDialog";

const PAGE_SIZE = 10;

export default function Sales() {
    const { authFetch } = useAuth();
    const { addToast } = useToast();
    const [sales, setSales] = useState([]);
    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [item, setItem] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState("General");
    const [productId, setProductId] = useState("");
    const [categories, setCategories] = useState([]);
    const [editing, setEditing] = useState(null);
    const [editItem, setEditItem] = useState("");
    const [editAmount, setEditAmount] = useState("");
    const [editCategory, setEditCategory] = useState("");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [confirm, setConfirm] = useState(null);
    const [saleType, setSaleType] = useState("product");
    const [serviceHours, setServiceHours] = useState("");
    const [serviceRate, setServiceRate] = useState("");

    const fetchSales = (p = page) => {
        setLoading(true);
        Promise.all([
            authFetch(`/sales?page=${p}&limit=${PAGE_SIZE}&sort=newest`).then(r => r.json()),
            authFetch("/categories").then(r => r.json()),
            authFetch("/products").then(r => r.json()),
        ]).then(([res, cats, prods]) => {
            setSales(res.data);
            setTotal(res.total);
            setCategories(cats);
            setProducts(prods);
        }).catch(() => {}).finally(() => setLoading(false));
    };

    useEffect(() => { fetchSales(1); }, []);

    useEffect(() => {
        if (saleType === "service" && serviceHours && serviceRate) {
            setAmount((Number(serviceHours) * Number(serviceRate)).toFixed(2));
        }
    }, [saleType, serviceHours, serviceRate]);

    const addSale = async () => {
        if (!item || !amount) return;
        const body = { item, amount: Number(amount), category, sale_type: saleType };
        if (saleType === "product") {
            body.product_id = productId ? Number(productId) : null;
            body.quantity = 1;
        } else {
            body.service_hours = Number(serviceHours) || 0;
            body.service_rate = Number(serviceRate) || 0;
        }
        await authFetch("/sales", {
            method: "POST",
            body: JSON.stringify(body)
        });
        setItem("");
        setAmount("");
        setCategory("General");
        setProductId("");
        setSaleType("product");
        setServiceHours("");
        setServiceRate("");
        addToast("Sale recorded", "success");
        fetchSales(1);
    };

    const startEdit = (s) => {
        setEditing(s.id);
        setEditItem(s.item);
        setEditAmount(s.amount);
        setEditCategory(s.category || "General");
    };

    const saveEdit = async (id) => {
        await authFetch(`/sales/${id}`, {
            method: "PUT",
            body: JSON.stringify({ item: editItem, amount: Number(editAmount), category: editCategory })
        });
        setEditing(null);
        addToast("Sale updated", "success");
        fetchSales(page);
    };

    const deleteSale = async (id) => {
        await authFetch(`/sales/${id}`, { method: "DELETE" });
        setConfirm(null);
        addToast("Sale deleted", "success");
        fetchSales(1);
    };

    const exportCSV = async () => {
        const res = await authFetch("/sales/export/csv");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "sales.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    const filtered = sales.filter(s => s.item.toLowerCase().includes(search.toLowerCase()));
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const totalRevenue = filtered.reduce((a, s) => a + Number(s.amount), 0);
    const totalCogs = filtered.reduce((a, s) => a + Number(s.cogs), 0);

    return (
        <div className="page">
            <div className="page-header">
                <h1>Sales</h1>
                <button className="btn-secondary" onClick={exportCSV}>Export CSV</button>
            </div>

            <div className="summary-cards" style={{ marginBottom: 16, gridTemplateColumns: "repeat(4, 1fr)" }}>
                <div className="summary-card profit">
                    <span className="card-label">Revenue</span>
                    <span className="card-value">${totalRevenue.toLocaleString()}</span>
                </div>
                <div className="summary-card expenses">
                    <span className="card-label">Cost of Goods Sold</span>
                    <span className="card-value">${totalCogs.toLocaleString()}</span>
                </div>
                <div className="summary-card sales">
                    <span className="card-label">Gross Profit</span>
                    <span className="card-value">${(totalRevenue - totalCogs).toLocaleString()}</span>
                </div>
                <div className="summary-card">
                    <span className="card-label">Margin</span>
                    <span className="card-value">{totalRevenue > 0 ? ((totalRevenue - totalCogs) / totalRevenue * 100).toFixed(1) : 0}%</span>
                </div>
            </div>

            <div className="card-section">
                <h3>Record a Sale</h3>
                <div className="input-row">
                    <div className="field">
                        <label>Type</label>
                        <select value={saleType} onChange={e => setSaleType(e.target.value)}>
                            <option value="product">Product Sale</option>
                            <option value="service">Service Sale</option>
                        </select>
                    </div>
                    <div className="field">
                        <label>{saleType === "product" ? "Item" : "Service"}</label>
                        <input placeholder={saleType === "product" ? "e.g. Widget" : "e.g. Consulting"} value={item} onChange={e => setItem(e.target.value)} />
                    </div>
                    {saleType === "service" && (
                        <>
                            <div className="field">
                                <label>Hours</label>
                                <input placeholder="0" type="number" value={serviceHours} onChange={e => setServiceHours(e.target.value)} />
                            </div>
                            <div className="field">
                                <label>Rate ($/hr)</label>
                                <input placeholder="0.00" type="number" value={serviceRate} onChange={e => setServiceRate(e.target.value)} />
                            </div>
                        </>
                    )}
                    <div className="field">
                        <label>Amount ($)</label>
                        <input placeholder="0.00" type="number" value={amount} onChange={e => setAmount(e.target.value)}
                            readOnly={saleType === "service" && serviceHours && serviceRate ? true : false}
                            style={saleType === "service" && serviceHours && serviceRate ? { opacity: 0.6 } : {}} />
                    </div>
                    <div className="field">
                        <label>Category</label>
                        <select value={category} onChange={e => setCategory(e.target.value)}>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    {saleType === "product" && (
                        <div className="field">
                            <label>Product (auto-deduct stock)</label>
                            <select value={productId} onChange={e => setProductId(e.target.value)}>
                                <option value="">Not applicable</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name} (stock: {p.quantity})</option>)}
                            </select>
                        </div>
                    )}
                    <button className="btn-primary" style={{ marginTop: 22 }} onClick={addSale}>
                        {saleType === "product" ? "Add Sale" : "Add Service"}
                    </button>
                </div>
            </div>

            <div className="search-row">
                <input placeholder="Search by item name..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
                <span className="item-count">{total} total sales</span>
            </div>
            {loading ? <div className="spinner" /> : (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: "18%" }}>Item / Service</th>
                                <th style={{ width: "8%" }}>Type</th>
                                <th style={{ width: "11%" }} className="num">Amount</th>
                                <th style={{ width: "10%" }}>Category</th>
                                <th style={{ width: "8%" }} className="num">COGS</th>
                                <th style={{ width: "10%" }} className="num">Gross Profit</th>
                                <th style={{ width: "7%" }} className="num">Margin</th>
                                <th style={{ width: "10%" }}>Date</th>
                                <th style={{ width: "90px" }} className="actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(s => {
                                const profit = s.amount - s.cogs;
                                const margin = s.amount > 0 ? (profit / s.amount * 100).toFixed(1) : "-";
                                return (
                                    <tr key={s.id}>
                                        {editing === s.id ? (
                                            <>
                                                <td><input value={editItem} onChange={e => setEditItem(e.target.value)} /></td>
                                                <td><span className="badge">{s.sale_type || "product"}</span></td>
                                                <td className="num"><input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} /></td>
                                                <td>
                                                    <select value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                </td>
                                                <td className="num">-</td>
                                                <td className="num">-</td>
                                                <td className="num">-</td>
                                                <td>{s.created_at?.split(" ")[0]}</td>
                                                <td className="actions">
                                                    <button className="btn-sm btn-save" onClick={() => saveEdit(s.id)}>Save</button>
                                                    <button className="btn-sm btn-cancel" onClick={() => setEditing(null)}>Cancel</button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td>
                                                    {s.item}
                                                    {s.sale_type === "service" && (s.service_hours || s.service_rate) &&
                                                        <span className="muted"> ({s.service_hours || 0}h × ${Number(s.service_rate || 0).toFixed(2)}/hr)</span>
                                                    }
                                                    {s.product_name ? <span className="muted"> ({s.product_name})</span> : null}
                                                </td>
                                                <td><span className={`badge ${s.sale_type === "service" ? "badge-ok" : ""}`}>{s.sale_type || "product"}</span></td>
                                                <td className="num">${Number(s.amount).toLocaleString()}</td>
                                                <td><span className="badge">{s.category}</span></td>
                                                <td className="num">{s.cogs > 0 ? `$${Number(s.cogs).toFixed(2)}` : "-"}</td>
                                                <td className="num" style={{ color: profit >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                                                    {s.cogs > 0 ? `$${profit.toFixed(2)}` : "-"}
                                                </td>
                                                <td className="num">{margin !== "-" ? `${margin}%` : "-"}</td>
                                                <td>{s.created_at?.split(" ")[0]}</td>
                                                <td className="actions">
                                                    <button className="btn-sm btn-edit" onClick={() => startEdit(s)}>Edit</button>
                                                    <button className="btn-sm btn-delete" onClick={() => setConfirm(s.id)}>Delete</button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan="9" className="empty">{search ? "No matching sales found" : "No sales yet — record your first sale above"}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            {totalPages > 1 && (
                <div className="pagination">
                    <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchSales(p); }}>Prev</button>
                    <span>Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); fetchSales(p); }}>Next</button>
                </div>
            )}
            <ConfirmDialog
                open={confirm !== null}
                title="Delete Sale"
                message="Are you sure you want to delete this sale?"
                onConfirm={() => deleteSale(confirm)}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}
