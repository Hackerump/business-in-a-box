import { useEffect, useState } from "react";

const API = process.env.REACT_APP_API_URL;

export default function App() {

    // ---------------- STATE ----------------
    const [sales, setSales] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [item, setItem] = useState("");
    const [amount, setAmount] = useState("");
    const [customer, setCustomer] = useState("");

    // ---------------- FETCH DATA ----------------
    const fetchData = async () => {
        const s = await fetch(`${API}/sales`).then(r => r.json());
        const e = await fetch(`${API}/expenses`).then(r => r.json());

        setSales(s);
        setExpenses(e);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // ---------------- ACTIONS ----------------
    const addSale = async () => {
        await fetch(`${API}/sales`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item, amount })
        });

        setItem("");
        setAmount("");
        fetchData();
    };

    const addExpense = async () => {
        await fetch(`${API}/expenses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item, amount })
        });

        setItem("");
        setAmount("");
        fetchData();
    };

    const generateInvoice = async () => {
        const items = sales.map(s => ({
            name: s.item,
            price: s.amount
        }));

        const res = await fetch(`${API}/invoice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                customer,
                items
            })
        });

        const data = await res.json();
        alert("Invoice created: " + data.file);
    };

    // ---------------- CALCULATIONS ----------------
    const totalSales = sales.reduce((a, b) => a + Number(b.amount), 0);
    const totalExpenses = expenses.reduce((a, b) => a + Number(b.cost), 0);
    const profit = totalSales - totalExpenses;

    // ---------------- UI ----------------
    return (
        <div style={{ padding: 20, fontFamily: "Arial" }}>
            <h1>Business-in-a-Box 📊</h1>

            <h3>Sales: ${totalSales}</h3>
            <h3>Expenses: ${totalExpenses}</h3>
            <h3>Profit: ${profit}</h3>

            <hr />

            <input
                placeholder="Item"
                value={item}
                onChange={(e) => setItem(e.target.value)}
            />

            <input
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
            />

            <br /><br />

            <input
                placeholder="Customer Name"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
            />

            <br /><br />

            <button onClick={addSale}>Add Sale</button>
            <button onClick={addExpense}>Add Expense</button>
            <button onClick={generateInvoice}>Generate Invoice 🧾</button>

            <hr />

            <h3>Sales</h3>
            {sales.map((s, i) => (
                <div key={i}>{s.item} - ${s.amount}</div>
            ))}

            <h3>Expenses</h3>
            {expenses.map((e, i) => (
                <div key={i}>{e.item} - ${e.cost}</div>
            ))}
        </div>
    );
}