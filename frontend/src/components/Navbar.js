import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function Navbar({ activeTab, setActiveTab }) {
    const { user, logout } = useAuth();
    const { dark, toggle } = useTheme();
    const isAdmin = user?.role === "admin";
    const tabs = [
        { id: "dashboard", label: "Dashboard" },
        { id: "sales", label: "Sales" },
        { id: "expenses", label: "Expenses" },
        { id: "inventory", label: "Inventory" },
        { id: "payroll", label: "Payroll", admin: true },
        { id: "reports", label: "Reports" },
        { id: "invoice", label: "Invoice" },
        { id: "tutorial", label: "Tutorial" },
        { id: "settings", label: "Settings", admin: true },
    ];

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h2>Business-in-a-Box</h2>
                <span style={{ fontSize: 11, color: "#64748b" }}>{user?.role}</span>
            </div>
            <nav className="sidebar-nav">
                {tabs.filter(t => !t.admin || isAdmin).map(tab => (
                    <button
                        key={tab.id}
                        className={`sidebar-link ${activeTab === tab.id ? "active" : ""}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>
            <div className="sidebar-footer">
                <div className="sidebar-footer-row">
                    <span className="user-name">{user?.username}</span>
                    <button className="btn-icon" onClick={toggle} title={dark ? "Light mode" : "Dark mode"}>
                        {dark ? "☀️" : "🌙"}
                    </button>
                </div>
                <button className="btn-logout" onClick={logout}>Logout</button>
            </div>
        </div>
    );
}
