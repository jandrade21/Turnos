import React, { useState } from "react";
import { useApp } from "../App";
import { authService } from "../firebase/firebase";
import "../styles/login.css";

export default function LoginAdmin() {
  const { empresa, navigate } = useApp();
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const cred = await authService.loginAdmin(email, pass);
      const rol  = await authService.getRol(cred.user.uid);
      if (rol !== "admin") {
        await authService.logout();
        setError("Esta cuenta no tiene acceso de administrador.");
        setLoading(false);
        return;
      }
      navigate("admin");
    } catch (err) {
      setError("Email o contraseña incorrectos.");
    }
    setLoading(false);
  }

  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-iniciales">{empresa.iniciales}</div>
          <h1 className="login-nombre">{empresa.nombre}</h1>
          <p className="login-sub">Panel de administración</p>
        </div>
        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-grupo">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@empresa.com" required autoComplete="email" />
          </div>
          <div className="form-grupo">
            <label className="form-label">Contraseña</label>
            <input className="form-input" type="password" value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="••••••••" required autoComplete="current-password" />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn-login" type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
        <button className="btn-volver-cliente" onClick={() => navigate("booking")}>
          ← Volver al sistema de turnos
        </button>
      </div>
    </div>
  );
}
