import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);
const API = process.env.REACT_APP_API_URL || "http://localhost:3001/api";

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const tok = localStorage.getItem("token");
        if (tok) {
            fetch(`${API}/me`, {
                headers: { Authorization: `Bearer ${tok}` }
            })
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (data && data.success) { setUser(data.data.user); setToken(tok); }
                    else { setToken(null); localStorage.removeItem("token"); }
                })
                .catch(() => { setToken(null); localStorage.removeItem("token"); })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (username, password) => {
        const res = await fetch(`${API}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Login failed");
        localStorage.setItem("token", data.data.token);
        setToken(data.data.token);
        setUser(data.data.user);
        navigate("/");
    };

    const register = async (username, password) => {
        const res = await fetch(`${API}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Registration failed");
        localStorage.setItem("token", data.data.token);
        setToken(data.data.token);
        setUser(data.data.user);
        navigate("/");
    };

    const logout = () => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
        navigate("/login");
    };

    const authFetch = async (url, options = {}) => {
        const tok = localStorage.getItem("token");
        if (!tok) throw new Error("Not authenticated");

        const res = await fetch(`${API}${url}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tok}`,
                ...options.headers
            }
        });

        if (res.status === 401) {
            localStorage.removeItem("token");
            setToken(null);
            setUser(null);
            navigate("/login");
            throw new Error("Session expired");
        }

        return res;
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout, authFetch }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
