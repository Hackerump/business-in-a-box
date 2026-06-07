import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
    const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

    useEffect(() => {
        document.body.classList.toggle("dark", dark);
        localStorage.setItem("theme", dark ? "dark" : "light");
    }, [dark]);

    const toggle = () => setDark(prev => !prev);

    return (
        <ThemeContext.Provider value={{ dark, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
