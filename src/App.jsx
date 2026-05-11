import React, { useState, useEffect, createContext, useContext } from "react";
import { EMPRESA } from "./config/empresa.config";
import { authService, turnosService } from "./firebase/firebase";
import BookingFlow    from "./pages/BookingFlow";
import AdminPanel     from "./pages/AdminPanel";
import LoginAdmin     from "./pages/LoginAdmin";
import AuthCliente    from "./pages/AuthCliente";
import MisTurnos      from "./pages/MisTurnos";
import Setup          from "./pages/Setup";

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

function injectarTema(tema) {
  const r = document.documentElement;
  r.style.setProperty("--color-primary",    tema.colorPrimario);
  r.style.setProperty("--color-secondary",  tema.colorSecundario);
  r.style.setProperty("--color-accent",     tema.colorAcento);
  r.style.setProperty("--color-accent2",    tema.colorAcento2);
  r.style.setProperty("--color-text",       tema.colorTexto);
  r.style.setProperty("--color-text-muted", tema.colorTextoMuted);
  r.style.setProperty("--font-display",     tema.fontDisplay);
  r.style.setProperty("--font-body",        tema.fontBody);
  r.style.setProperty("--border-radius",    tema.borderRadius);
  const names = [tema.fontDisplay, tema.fontBody]
    .map(f => f.replace(/['"]/g, "").split(",")[0].trim())
    .filter(Boolean);
  const link = document.createElement("link");
  link.rel  = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${names.map(n => n.replace(/ /g, "+") + ":wght@400;500;600;700").join("&family=")}&display=swap`;
  document.head.appendChild(link);
}

function getPage() {
  const h = window.location.hash;
  if (h.startsWith("#/admin"))      return "admin";
  if (h.startsWith("#/login-admin")) return "login-admin";
  if (h.startsWith("#/mis-turnos")) return "mis-turnos";
  if (h.startsWith("#/auth"))       return "auth";
  if (h.startsWith("#/setup"))      return "setup";
  return "booking";
}

export default function App() {
  const [page, setPage]           = useState(getPage());
  const [user, setUser]           = useState(null);
  const [rol,  setRol]            = useState(null);
  const [authLoading, setLoading] = useState(true);

  useEffect(() => {
    injectarTema(EMPRESA.tema);
    document.title = "Turnos Ya";
    const handler = () => setPage(getPage());
    window.addEventListener("hashchange", handler);

    const unsub = authService.onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        const r = await authService.getRol(u.uid);
        setRol(r);
        if (r !== "admin") {
          turnosService.vincularPorEmail(u.email, u.uid).catch(err => console.warn("vincularPorEmail:", err));
        }
      } else {
        setRol(null);
      }
      setLoading(false);
    });
    return () => { unsub(); window.removeEventListener("hashchange", handler); };
  }, []);

  const navigate = (p) => {
    window.location.hash = p === "booking" ? "/" : `/${p}`;
    setPage(p);
  };

  if (authLoading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"var(--color-primary)" }}>
      <div className="spinner" />
    </div>
  );

  const isAdmin  = rol === "admin";
  const isClient = !!user && !isAdmin;

  return (
    <AppContext.Provider value={{ empresa: EMPRESA, user, rol, isAdmin, isClient, navigate }}>
      <div className="app-root">
        {page === "booking"     && <BookingFlow />}
        {page === "auth"        && <AuthCliente />}
        {page === "mis-turnos"  && (isClient ? <MisTurnos /> : <AuthCliente redirect="mis-turnos" />)}
        {page === "login-admin" && <LoginAdmin />}
        {page === "admin"       && (isAdmin ? <AdminPanel /> : <LoginAdmin />)}
        {page === "setup"       && <Setup />}
      </div>
    </AppContext.Provider>
  );
}
