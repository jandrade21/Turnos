import React, { useState } from "react";
import { useApp } from "../App";
import { authService } from "../firebase/firebase";
import "../styles/login.css";

export default function AuthCliente({ redirect = "mis-turnos" }) {
  const { empresa, navigate } = useApp();
  const [tab, setTab]         = useState("login"); // "login" | "registro"
  const [nombre, setNombre]   = useState("");
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [pass2, setPass2]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [resetSent, setResetSent] = useState(false);

  const ERRORES = {
    "auth/email-already-in-use":  "Ese email ya tiene una cuenta. Iniciá sesión.",
    "auth/weak-password":          "La contraseña debe tener al menos 6 caracteres.",
    "auth/invalid-email":          "El email no es válido.",
    "auth/user-not-found":         "No existe una cuenta con ese email.",
    "auth/wrong-password":         "Contraseña incorrecta.",
    "auth/invalid-credential":     "Email o contraseña incorrectos.",
    "auth/too-many-requests":      "Demasiados intentos. Esperá unos minutos.",
  };

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await authService.loginCliente(email, pass);
      navigate(redirect);
    } catch (err) {
      setError(ERRORES[err.code] || "Error al iniciar sesión.");
    }
    setLoading(false);
  }

  async function handleRegistro(e) {
    e.preventDefault();
    if (pass !== pass2) { setError("Las contraseñas no coinciden."); return; }
    setLoading(true); setError("");
    try {
      await authService.registrarCliente(nombre, email, pass);
      navigate(redirect);
    } catch (err) {
      setError(ERRORES[err.code] || "Error al crear la cuenta.");
    }
    setLoading(false);
  }

  async function handleReset() {
    if (!email) { setError("Ingresá tu email primero."); return; }
    setLoading(true); setError("");
    try {
      await authService.resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setError(ERRORES[err.code] || "No se pudo enviar el email.");
    }
    setLoading(false);
  }

  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-iniciales">{empresa.iniciales}</div>
          <h1 className="login-nombre">{empresa.nombre}</h1>
          <p className="login-sub">Tu cuenta de turnos</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === "login" ? "active" : ""}`}
            onClick={() => { setTab("login"); setError(""); }}
          >Ingresar</button>
          <button
            className={`auth-tab ${tab === "registro" ? "active" : ""}`}
            onClick={() => { setTab("registro"); setError(""); }}
          >Crear cuenta</button>
        </div>

        {tab === "login" && (
          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-grupo">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="juan@email.com" required autoComplete="email" />
            </div>
            <div className="form-grupo">
              <label className="form-label">Contraseña</label>
              <input className="form-input" type="password" value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password" />
            </div>
            {error && <p className="error-msg">{error}</p>}
            {resetSent && <p className="success-msg">✓ Te enviamos un email para restablecer tu contraseña.</p>}
            <button className="btn-login" type="submit" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
            <button type="button" className="btn-link" onClick={handleReset} disabled={loading}>
              Olvidé mi contraseña
            </button>
          </form>
        )}

        {tab === "registro" && (
          <form className="login-form" onSubmit={handleRegistro}>
            <div className="form-grupo">
              <label className="form-label">Nombre completo</label>
              <input className="form-input" type="text" value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Juan Pérez" required autoComplete="name" />
            </div>
            <div className="form-grupo">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="juan@email.com" required autoComplete="email" />
            </div>
            <div className="form-grupo">
              <label className="form-label">Contraseña</label>
              <input className="form-input" type="password" value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="Mínimo 6 caracteres" required autoComplete="new-password" />
            </div>
            <div className="form-grupo">
              <label className="form-label">Confirmar contraseña</label>
              <input className="form-input" type="password" value={pass2}
                onChange={e => setPass2(e.target.value)}
                placeholder="Repetí la contraseña" required autoComplete="new-password" />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button className="btn-login" type="submit" disabled={loading}>
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>
        )}

        <button className="btn-volver-cliente" onClick={() => navigate("booking")}>
          ← Volver al inicio sin registrarme
        </button>
      </div>
    </div>
  );
}
