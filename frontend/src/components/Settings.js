import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function Settings() {
    const { authFetch } = useAuth();
    const { addToast } = useToast();
    const [categories, setCategories] = useState([]);
    const [newName, setNewName] = useState("");
    const [newType, setNewType] = useState("both");
    const [editId, setEditId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editType, setEditType] = useState("both");
    const [users, setUsers] = useState([]);

    const fetchCategories = () => {
        authFetch("/categories/list").then(r => r.json()).then(setCategories).catch(() => {});
    };

    const fetchUsers = () => {
        authFetch("/users").then(r => r.json()).then(setUsers).catch(() => {});
    };

    useEffect(() => { fetchCategories(); fetchUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const addCategory = async () => {
        if (!newName.trim()) return;
        await authFetch("/categories", {
            method: "POST",
            body: JSON.stringify({ name: newName.trim(), type: newType })
        });
        setNewName("");
        setNewType("both");
        addToast("Category added", "success");
        fetchCategories();
    };

    const startEdit = (cat) => {
        setEditId(cat.id);
        setEditName(cat.name);
        setEditType(cat.type);
    };

    const saveEdit = async () => {
        if (!editName.trim()) return;
        await authFetch(`/categories/${editId}`, {
            method: "PUT",
            body: JSON.stringify({ name: editName.trim(), type: editType })
        });
        setEditId(null);
        addToast("Category updated", "success");
        fetchCategories();
    };

    const deleteCategory = async (id) => {
        await authFetch(`/categories/${id}`, { method: "DELETE" });
        addToast("Category deleted", "success");
        fetchCategories();
    };

    const changeRole = async (id, role) => {
        await authFetch(`/users/${id}/role`, {
            method: "PUT",
            body: JSON.stringify({ role })
        });
        addToast(`User role changed to ${role}`, "success");
        fetchUsers();
    };

    const typeLabels = { both: "Sales & Expenses", sales: "Sales Only", expenses: "Expenses Only" };

    return (
        <div className="page">
            <h1>Settings</h1>

            <div className="card-section" style={{ marginBottom: 20 }}>
                <h3>Manage Users</h3>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
                    Promote or demote users. The first user is always admin.
                </p>
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: "35%" }}>Username</th>
                                <th style={{ width: "20%" }}>Role</th>
                                <th style={{ width: "25%" }}>Created</th>
                                <th style={{ width: "120px" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td>{u.username}</td>
                                    <td><span className={`badge ${u.role === "admin" ? "badge-ok" : ""}`}>{u.role}</span></td>
                                    <td>{u.created_at?.split(" ")[0]}</td>
                                    <td className="actions">
                                        {u.role === "admin" ? (
                                            <button className="btn-sm btn-cancel" onClick={() => changeRole(u.id, "employee")}>Demote</button>
                                        ) : (
                                            <button className="btn-sm btn-edit" onClick={() => changeRole(u.id, "admin")}>Promote</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && <tr><td colSpan="4" className="empty">No users</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="card-section">
                <h3>Manage Categories</h3>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
                    Add, edit, or remove categories. Changes apply immediately to sales and expense forms.
                </p>

                <div className="input-row" style={{ flexWrap: "wrap" }}>
                    <div className="field">
                        <label>Category Name</label>
                        <input placeholder="e.g. Equipment" value={newName} onChange={e => setNewName(e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Applies To</label>
                        <select value={newType} onChange={e => setNewType(e.target.value)}>
                            <option value="both">Sales & Expenses</option>
                            <option value="sales">Sales Only</option>
                            <option value="expenses">Expenses Only</option>
                        </select>
                    </div>
                    <button className="btn-primary" style={{ marginTop: 22 }} onClick={addCategory}>Add Category</button>
                </div>

                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: "40%" }}>Name</th>
                                <th style={{ width: "30%" }}>Applies To</th>
                                <th style={{ width: "90px" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map(cat => (
                                <tr key={cat.id}>
                                    {editId === cat.id ? (
                                        <>
                                            <td><input value={editName} onChange={e => setEditName(e.target.value)} /></td>
                                            <td>
                                                <select value={editType} onChange={e => setEditType(e.target.value)}>
                                                    <option value="both">Sales & Expenses</option>
                                                    <option value="sales">Sales Only</option>
                                                    <option value="expenses">Expenses Only</option>
                                                </select>
                                            </td>
                                            <td className="actions">
                                                <button className="btn-sm btn-save" onClick={saveEdit}>Save</button>
                                                <button className="btn-sm btn-cancel" onClick={() => setEditId(null)}>Cancel</button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td>{cat.name}</td>
                                            <td><span className="badge">{typeLabels[cat.type]}</span></td>
                                            <td className="actions">
                                                <button className="btn-sm btn-edit" onClick={() => startEdit(cat)}>Edit</button>
                                                <button className="btn-sm btn-delete" onClick={() => deleteCategory(cat.id)}>Delete</button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                            {categories.length === 0 && <tr><td colSpan="3" className="empty">No categories</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}