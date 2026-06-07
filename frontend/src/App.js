import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import Sales from "./components/Sales";
import Expenses from "./components/Expenses";
import Inventory from "./components/Inventory";
import Payroll from "./components/Payroll";
import Reports from "./components/Reports";
import Invoice from "./components/Invoice";
import Settings from "./components/Settings";
import Tutorial from "./components/Tutorial";
import Login from "./components/Login";
import Register from "./components/Register";
import "./App.css";

function ProtectedLayout() {
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
            case "settings": return <Settings />;
            case "tutorial": return <Tutorial />;
            default: return <Dashboard />;
        }
    };

    return (
        <div className="app-layout">
            <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="main-content">
                {renderTab()}
            </main>
        </div>
    );
}

function PublicRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
    if (user) return <Navigate to="/" replace />;
    return children;
}

export default function App() {
    return (
        <BrowserRouter>
            <ThemeProvider>
                <AuthProvider>
                    <ToastProvider>
                        <Routes>
                            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
                            <Route path="/*" element={<ProtectedLayout />} />
                        </Routes>
                    </ToastProvider>
                </AuthProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
}
