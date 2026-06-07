import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function Register() {
    const { register } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirm) return setError("Passwords do not match");
        try {
            await register(username, password);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h1>Business-in-a-Box</h1>
                <p className="auth-subtitle">Create a new account</p>
                {error && <div className="error-box">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Confirm Password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                    />
                    <button type="submit" className="btn-primary">Register</button>
                </form>
                <p className="auth-link">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
