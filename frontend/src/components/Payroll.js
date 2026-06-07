import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function Payroll() {
    const { authFetch, user } = useAuth();
    const { addToast } = useToast();
    const [employees, setEmployees] = useState([]);
    const [payroll, setPayroll] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("employees");
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [runFor, setRunFor] = useState("");
    const [hours, setHours] = useState("");

    const [form, setForm] = useState({ name: "", pay_type: "hourly", salary: 0, hourly_rate: 0, tax_id: "" });

    const isAdmin = user?.role === "admin";

    const fetchData = () => {
        setLoading(true);
        Promise.all([
            authFetch("/employees").then(r => r.json()),
            authFetch("/payroll").then(r => r.json()),
        ]).then(([e, p]) => { setEmployees(e); setPayroll(p); })
        .catch(() => {}).finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const resetForm = () => {
        setForm({ name: "", pay_type: "hourly", salary: 0, hourly_rate: 0, tax_id: "" });
        setEditId(null);
        setShowForm(false);
    };

    const handleSave = async () => {
        if (!form.name) return;
        const body = { ...form, salary: Number(form.salary), hourly_rate: Number(form.hourly_rate) };
        if (editId) {
            await authFetch(`/employees/${editId}`, { method: "PUT", body: JSON.stringify(body) });
            addToast("Employee updated", "success");
        } else {
            await authFetch("/employees", { method: "POST", body: JSON.stringify(body) });
            addToast("Employee added", "success");
        }
        resetForm();
        fetchData();
    };

    const handleDelete = async (id) => {
        await authFetch(`/employees/${id}`, { method: "DELETE" });
        addToast("Employee deleted", "success");
        fetchData();
    };

    const startEdit = (e) => {
        setForm({ name: e.name, pay_type: e.pay_type, salary: e.salary, hourly_rate: e.hourly_rate, tax_id: e.tax_id || "" });
        setEditId(e.id);
        setShowForm(true);
    };

    const runPayroll = async () => {
        if (!runFor) return;
        const body = { employee_id: Number(runFor) };
        const emp = employees.find(e => e.id === Number(runFor));
        if (emp.pay_type === "hourly") {
            if (!hours) return addToast("Enter hours worked", "error");
            body.hours = Number(hours);
        }
        await authFetch("/payroll/run", { method: "POST", body: JSON.stringify(body) });
        setRunFor("");
        setHours("");
        addToast("Payroll processed", "success");
        fetchData();
    };

    const deletePayroll = async (id) => {
        await authFetch(`/payroll/${id}`, { method: "DELETE" });
        addToast("Payroll entry deleted", "success");
        fetchData();
    };

    const totalGross = payroll.reduce((a, p) => a + p.gross_pay, 0);
    const totalTax = payroll.reduce((a, p) => a + p.tax, 0);
    const totalNet = payroll.reduce((a, p) => a + p.net_pay, 0);

    if (loading) return <div className="page"><div className="spinner" /></div>;

    return (
        <div className="page">
            <h1>Payroll</h1>

            <div className="summary-cards" style={{ marginBottom: 16 }}>
                <div className="summary-card"><span className="card-label">Employees</span><span className="card-value">{employees.length}</span></div>
                <div className="summary-card"><span className="card-label">Total Gross</span><span className="card-value" style={{ color: "#2563eb" }}>${totalGross.toLocaleString()}</span></div>
                <div className="summary-card expenses"><span className="card-label">Total Tax</span><span className="card-value">${totalTax.toLocaleString()}</span></div>
                <div className="summary-card profit"><span className="card-label">Total Net</span><span className="card-value">${totalNet.toLocaleString()}</span></div>
            </div>

            <div className="tab-bar">
                <button className={`tab-btn ${tab === "employees" ? "active" : ""}`} onClick={() => setTab("employees")}>Employees</button>
                <button className={`tab-btn ${tab === "payroll" ? "active" : ""}`} onClick={() => setTab("payroll")}>Payroll History</button>
            </div>

            {tab === "employees" && (
                <>
                    {isAdmin && (
                        <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => { resetForm(); setShowForm(!showForm); }}>
                            {showForm ? "Cancel" : "Add Employee"}
                        </button>
                    )}
                    {showForm && (
                        <div className="inline-form">
                            <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            <select value={form.pay_type} onChange={e => setForm({ ...form, pay_type: e.target.value })}>
                                <option value="hourly">Hourly</option>
                                <option value="salary">Salary</option>
                            </select>
                            {form.pay_type === "salary" ? (
                                <input placeholder="Monthly salary" type="number" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} />
                            ) : (
                                <input placeholder="Hourly rate" type="number" value={form.hourly_rate} onChange={e => setForm({ ...form, hourly_rate: e.target.value })} />
                            )}
                            <input placeholder="Tax ID (optional)" value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })} />
                            <button className="btn-primary" onClick={handleSave}>{editId ? "Update" : "Save"}</button>
                        </div>
                    )}
                    <table className="data-table">
                        <thead>
                            <tr><th>Name</th><th>Type</th><th>Rate</th><th>Tax ID</th>{isAdmin && <th>Actions</th>}</tr>
                        </thead>
                        <tbody>
                            {employees.map(e => (
                                <tr key={e.id}>
                                    <td>{e.name}</td>
                                    <td><span className="badge">{e.pay_type}</span></td>
                                    <td>{e.pay_type === "salary" ? `$${Number(e.salary).toLocaleString()}/mo` : `$${e.hourly_rate}/hr`}</td>
                                    <td>{e.tax_id || "-"}</td>
                                    {isAdmin && (
                                        <td>
                                            <button className="btn-sm btn-edit" onClick={() => startEdit(e)}>Edit</button>
                                            <button className="btn-sm btn-delete" onClick={() => handleDelete(e.id)}>Delete</button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {employees.length === 0 && <tr><td colSpan={isAdmin ? 5 : 4} className="empty">No employees</td></tr>}
                        </tbody>
                    </table>
                </>
            )}

            {tab === "payroll" && (
                <>
                    {isAdmin && (
                        <div className="inline-form" style={{ marginBottom: 16 }}>
                            <select value={runFor} onChange={e => setRunFor(e.target.value)}>
                                <option value="">Select employee</option>
                                {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.pay_type})</option>)}
                            </select>
                            {employees.find(e => e.id === Number(runFor))?.pay_type === "hourly" && (
                                <input placeholder="Hours worked" type="number" value={hours} onChange={e => setHours(e.target.value)} />
                            )}
                            <button className="btn-primary" onClick={runPayroll}>Run Payroll</button>
                        </div>
                    )}
                    <table className="data-table">
                        <thead>
                            <tr><th>Employee</th><th>Type</th><th>Hours</th><th>Gross</th><th>Tax (20%)</th><th>Net</th><th>Date</th>{isAdmin && <th></th>}</tr>
                        </thead>
                        <tbody>
                            {payroll.map(p => (
                                <tr key={p.id}>
                                    <td>{p.employee_name}</td>
                                    <td><span className="badge">{p.pay_type}</span></td>
                                    <td>{p.pay_type === "hourly" ? p.hours : "-"}</td>
                                    <td>${Number(p.gross_pay).toLocaleString()}</td>
                                    <td style={{ color: "#dc2626" }}>-${Number(p.tax).toLocaleString()}</td>
                                    <td style={{ color: "#16a34a", fontWeight: 600 }}>${Number(p.net_pay).toLocaleString()}</td>
                                    <td>{p.created_at?.split(" ")[0]}</td>
                                    {isAdmin && <td><button className="btn-sm btn-delete" onClick={() => deletePayroll(p.id)}>Delete</button></td>}
                                </tr>
                            ))}
                            {payroll.length === 0 && <tr><td colSpan={isAdmin ? 8 : 7} className="empty">No payroll entries</td></tr>}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
}
