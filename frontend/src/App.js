import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import Sales from "./components/Sales";
import Expenses from "./components/Expenses";
import Inventory from "./components/Inventory";
import Payroll from "./components/Payroll";
import Reports from "./components/Reports";
import Invoice from "./components/Invoice";
import Tutorial from "./components/Tutorial";
import Settings from "./components/Settings";
import Login from "./components/Login";
import Register from "./components/Register";
import "./App.css";

function ProtectedApp() {
    const { user, loading } = useAuth();
    const [activeTab, setActiveTab] = useState("dashboard");

    if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
    if (!user) return <Navigate to="/login" replace />;

    const renderTab = () => {
        switch (activeTab) {
            case "dashboard": return <Dashboard />;
            case "sales": return <Sales />;
            case "expenses": return <Expenses />;
            case "inventory": return <Inventory />;
            case "payroll": return <Payroll />;
            case "reports": return <Reports />;
            case "invoice": return <Invoice />;
            case "tutorial": return <Tutorial />;
            case "settings": return <Settings />;
            default: return <Dashboard />;
        }
    };

    return (
        <div className="app-layout">
            <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="main-content">{renderTab()}</main>
        </div>
    );
}

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/*" element={<ProtectedApp />} />
        </Routes>
    );
}
