import React, { createContext, useContext, useEffect, useState } from "react";

export type AppTheme = "retro" | "modern";

interface ThemeContextType {
  theme: AppTheme;
  toggleTheme: () => void;
  isModern: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<AppTheme>(() => {
    const stored = localStorage.getItem("app-theme");
    return (stored as AppTheme) || "retro";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "modern") {
      root.classList.add("modern");
      root.classList.remove("retro");
    } else {
      root.classList.remove("modern");
      root.classList.add("retro");
    }
    localStorage.setItem("app-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "retro" ? "modern" : "retro"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isModern: theme === "modern" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
