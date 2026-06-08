import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function Invoice() {
    const { authFetch } = useAuth();
    const [sales, setSales] = useState([]);
    const [dateOfIssue, setDateOfIssue] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [invoiceNo, setInvoiceNo] = useState("");
    const [selected, setSelected] = useState([]);
    const [lastInvoice, setLastInvoice] = useState(null);
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState("info");
    const [companyName, setCompanyName] = useState("Business-in-a-Box");
    const [addressLine1, setAddressLine1] = useState("123 Commerce Street");
    const [addressLine2, setAddressLine2] = useState("New York, NY 10001");
    const [addressCountry, setAddressCountry] = useState("Canada");
    const [phone, setPhone] = useState("(555) 234-5678");
    const [email, setEmail] = useState("billing@businessbox.com");
    const [billToName, setBillToName] = useState("");
    const [billToCompany, setBillToCompany] = useState("");
    const [billToAddress, setBillToAddress] = useState("");
    const [billToCity, setBillToCity] = useState("");
    const [billToCountry, setBillToCountry] = useState("");
    const [billToEmail, setBillToEmail] = useState("");
    const [currencySymbol, setCurrencySymbol] = useState("$");
    const [currencyCode, setCurrencyCode] = useState("USD");

    useEffect(() => {
        authFetch("/sales").then(r => r.json()).then(d => setSales(d.data || []));
        setInvoiceNo(`INV-${Date.now().toString().slice(-6)}`);
        setDateOfIssue(new Date().toISOString().split("T")[0]);
        const d = new Date();
        d.setDate(d.getDate() + 30);
        setDueDate(d.toISOString().split("T")[0]);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleItem = (id) => {
        setSelected(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const selectAll = () => {
        setSelected(selected.length === sales.length ? [] : sales.map(s => s.id));
    };

    const generateInvoice = async () => {
        if (!billToName && !billToCompany) {
            setMessage("Enter a recipient name or company");
            setMessageType("error");
            return;
        }
        if (selected.length === 0) {
            setMessage("Select at least one item");
            setMessageType("error");
            return;
        }
        const items = sales.filter(s => selected.includes(s.id)).map(s => ({
            name: s.item,
            price: s.amount,
            quantity: 1
        }));

        try {
            const res = await authFetch("/invoice", {
                method: "POST",
                body: JSON.stringify({ customer: billToName, items, invoiceNo, dueDate, dateOfIssue, companyName, addressLine1, addressLine2, addressCountry, phone, email, billToName, billToCompany, billToAddress, billToCity, billToCountry, billToEmail, currencySymbol, currencyCode })
            });
            const data = await res.json();
            if (data.success) {
                setLastInvoice(data.data);
                setMessage(`Invoice #${invoiceNo} generated`);
                setMessageType("success");
            } else {
                setMessage(data.message || "Failed to generate invoice");
                setMessageType("error");
            }
        } catch (err) {
            setMessage("Network error — please try again");
            setMessageType("error");
        }
    };

    const downloadInvoice = async (e) => {
        if (!lastInvoice) return;
        const res = await authFetch(`/invoice/${lastInvoice.file}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = lastInvoice.file;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const fmt = (n) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const selectedItems = sales.filter(s => selected.includes(s.id));
    const subtotal = selectedItems.reduce((a, s) => a + Number(s.amount), 0);

    return (
        <div className="page">
            <h1>Invoice Generator</h1>
            {message && <div className={`info-box ${messageType === "error" ? "error-box" : ""}`}>{message}{lastInvoice && messageType === "success" && <span className="message-download" onClick={downloadInvoice}> Download PDF</span>}</div>}

            <div className="invoice-layout">
                <div className="invoice-form">
                    <div className="card-section">
                        <h3>Invoice Details</h3>
                        <div className="invoice-fields">
                            <div className="field">
                                <label>Invoice Number</label>
                                <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
                            </div>
                            <div className="field">
                                <label>Date of Issue</label>
                                <input type="date" value={dateOfIssue} onChange={e => setDateOfIssue(e.target.value)} />
                            </div>
                            <div className="field">
                                <label>Due Date</label>
                                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                            </div>
                            <div className="field">
                                <label>Currency Symbol</label>
                                <input value={currencySymbol} onChange={e => setCurrencySymbol(e.target.value)} placeholder="$" />
                            </div>
                            <div className="field">
                                <label>Currency Code</label>
                                <input value={currencyCode} onChange={e => setCurrencyCode(e.target.value)} placeholder="USD" />
                            </div>
                        </div>
                    </div>

                    <div className="card-section">
                        <h3>Recipient Address</h3>
                        <div className="invoice-fields" style={{ gridTemplateColumns: "1fr 1fr" }}>
                            <div className="field">
                                <label>Contact Name</label>
                                <input value={billToName} onChange={e => setBillToName(e.target.value)} />
                            </div>
                            <div className="field">
                                <label>Company</label>
                                <input value={billToCompany} onChange={e => setBillToCompany(e.target.value)} />
                            </div>
                            <div className="field" style={{ gridColumn: "1 / -1" }}>
                                <label>Street Address</label>
                                <input value={billToAddress} onChange={e => setBillToAddress(e.target.value)} />
                            </div>
                            <div className="field" style={{ gridColumn: "1 / -1" }}>
                                <label>City / Province / Postal</label>
                                <input value={billToCity} onChange={e => setBillToCity(e.target.value)} />
                            </div>
                            <div className="field">
                                <label>Country</label>
                                <input value={billToCountry} onChange={e => setBillToCountry(e.target.value)} />
                            </div>
                            <div className="field">
                                <label>Email</label>
                                <input value={billToEmail} onChange={e => setBillToEmail(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div className="card-section">
                        <h3>Your Company Address</h3>
                        <div className="invoice-fields" style={{ gridTemplateColumns: "1fr 1fr" }}>
                            <div className="field">
                                <label>Company Name</label>
                                <input value={companyName} onChange={e => setCompanyName(e.target.value)} />
                            </div>
                            <div className="field">
                                <label>Phone</label>
                                <input value={phone} onChange={e => setPhone(e.target.value)} />
                            </div>
                            <div className="field" style={{ gridColumn: "1 / -1" }}>
                                <label>Street Address</label>
                                <input value={addressLine1} onChange={e => setAddressLine1(e.target.value)} />
                            </div>
                            <div className="field" style={{ gridColumn: "1 / -1" }}>
                                <label>City / Province / Postal</label>
                                <input value={addressLine2} onChange={e => setAddressLine2(e.target.value)} />
                            </div>
                            <div className="field">
                                <label>Country</label>
                                <input value={addressCountry} onChange={e => setAddressCountry(e.target.value)} />
                            </div>
                            <div className="field">
                                <label>Email</label>
                                <input value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div className="card-section" style={{ flex: 1 }}>
                        <div className="section-header">
                            <h3>Line Items</h3>
                            <label className="select-all">
                                <input type="checkbox" checked={selected.length === sales.length && sales.length > 0} onChange={selectAll} />
                                Select all
                            </label>
                        </div>
                        <div className="table-wrap">
                            <table className="data-table invoice-item-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "40px" }}></th>
                                        <th style={{ width: "45%" }}>Item</th>
                                        <th style={{ width: "20%" }} className="num">Amount</th>
                                        <th style={{ width: "25%" }}>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sales.map(s => (
                                        <tr key={s.id} className={selected.includes(s.id) ? "selected" : ""}>
                                            <td>
                                                <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleItem(s.id)} />
                                            </td>
                                            <td>{s.item}</td>
                                            <td className="num">{fmt(s.amount)}</td>
                                            <td>{s.created_at?.split(" ")[0]}</td>
                                        </tr>
                                    ))}
                                    {sales.length === 0 && (
                                        <tr><td colSpan="4" className="empty">No sales available — add sales first</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="invoice-sidebar">
                    <div className="card-section">
                        <h3>Invoice Preview</h3>
                        {selectedItems.length > 0 ? (
                            <>
                                <div className="preview-header">
                                    <p className="preview-customer"><strong>Bill To:</strong> {billToName || "(customer name)"}</p>
                                    {billToCompany && <p className="preview-meta">{billToCompany}</p>}
                                    {billToAddress && <p className="preview-meta">{billToAddress}</p>}
                                    {billToCity && <p className="preview-meta">{billToCity}</p>}
                                    {billToEmail && <p className="preview-meta">{billToEmail}</p>}
                                    <p className="preview-meta">Invoice #: {invoiceNo}</p>
                                    <p className="preview-meta">Due: {dueDate || "-"}</p>
                                </div>
                                <div className="preview-items">
                                    {selectedItems.map(s => (
                                        <div key={s.id} className="preview-row">
                                            <span>{s.item}</span>
                                            <span>{fmt(s.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="preview-total">
                                    <span>Total</span>
                                    <span>{fmt(subtotal)}</span>
                                </div>
                                <div className="invoice-actions">
                                    <button className="btn-primary" style={{ width: "100%" }} onClick={generateInvoice}>
                                        Generate Invoice
                                    </button>
                                    {lastInvoice && (
                                        <button className="btn-secondary" style={{ width: "100%" }} onClick={downloadInvoice}>
                                            Download Invoice
                                        </button>
                                    )}
                                </div>
                            </>
                        ) : (
                            <p className="empty-chart" style={{ padding: 20 }}>Select items from the list</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
