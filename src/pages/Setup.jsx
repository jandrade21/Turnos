import React, { useState, useEffect } from "react";
import { useApp } from "../App";
import {
  db, auth,
  profesionalesService,
  authService,
} from "../firebase/firebase";
import {
  collection, doc, setDoc, getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { EMPRESA } from "../config/empresa.config";
import "../styles/login.css";

/**
 * Página de primer setup — solo visible en /#/setup
 * Una vez que el admin está creado, esta ruta puede deshabilitarse.
 *
 * Para habilitarla temporalmente: agregar en App.jsx:
 *   import Setup from "./pages/Setup";
 *   {page === "setup" && <Setup />}
 * y en getPage():
 *   if (h.startsWith("#/setup")) return "setup";
 */

const PASOS = [
  { id: "check",  label: "Verificar estado" },
  { id: "admin",  label: "Crear admin" },
  { id: "profs",  label: "Crear profesionales" },
  { id: "listo",  label: "¡Listo!" },
];

function Tick() {
  return <span style={{ color: "#10b981", marginRight: 8 }}>✓</span>;
}
function Cruz() {
  return <span style={{ color: "#ef4444", marginRight: 8 }}>✗</span>;
}

export default function Setup() {
  const { navigate } = useApp();

  const [paso,       setPaso]       = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [msg,        setMsg]        = useState("");
  const [error,      setError]      = useState("");

  // Estado de verificación
  const [checks, setChecks] = useState({
    firestore: null,   // true/false/null
    adminExiste: null,
    profsExisten: null,
  });

  // Formulario admin
  const [adminNombre, setAdminNombre] = useState("Administrador");
  const [adminEmail,  setAdminEmail]  = useState("");
  const [adminPass,   setAdminPass]   = useState("");
  const [adminPass2,  setAdminPass2]  = useState("");

  // ── Paso 0: verificar estado actual ───────────────────
  useEffect(() => {
    verificar();
  }, []);

  async function verificar() {
    setLoading(true);
    const resultado = { firestore: false, adminExiste: false, profsExisten: false };

    // Chequear Firestore
    try {
      const snap = await getDocs(collection(db, "usuarios"));
      resultado.firestore = true;
      // Chequear si hay algún admin
      const adminDoc = snap.docs.find(d => d.data().rol === "admin");
      resultado.adminExiste = !!adminDoc;
    } catch (e) {
      resultado.firestore = false;
    }

    // Chequear profesionales
    try {
      const snap = await getDocs(collection(db, "profesionales"));
      resultado.profsExisten = snap.docs.length > 0;
    } catch (e) {
      resultado.profsExisten = false;
    }

    setChecks(resultado);
    setLoading(false);
  }

  // ── Paso 1: crear admin ───────────────────────────────
  async function crearAdmin(e) {
    e.preventDefault();
    if (adminPass !== adminPass2) { setError("Las contraseñas no coinciden."); return; }
    if (adminPass.length < 6)     { setError("La contraseña debe tener al menos 6 caracteres."); return; }

    setLoading(true); setError(""); setMsg("");
    try {
      // Crear en Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
      await updateProfile(cred.user, { displayName: adminNombre });

      // Crear documento en Firestore con rol admin
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        nombre:   adminNombre,
        email:    adminEmail,
        rol:      "admin",
        creadoEn: serverTimestamp(),
      });

      setMsg(`✓ Admin creado: ${adminEmail}`);
      await verificar();
      setPaso(2);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("Ese email ya tiene una cuenta. Si ya es admin, pasá al siguiente paso.");
      } else {
        setError(err.message);
      }
    }
    setLoading(false);
  }

  // ── Paso 2: crear profesionales ───────────────────────
  async function crearProfesionales() {
    setLoading(true); setError(""); setMsg("");
    try {
      // Verificar si ya existen
      const snap = await getDocs(collection(db, "profesionales"));
      if (snap.docs.length > 0) {
        setMsg(`ℹ Ya hay ${snap.docs.length} profesionales. No se duplicaron.`);
        setPaso(3);
        setLoading(false);
        return;
      }

      // Tomar profesionales de empresa.config.js
      for (const prof of EMPRESA.profesionales) {
        await profesionalesService.crear({
          nombre:               prof.nombre,
          especialidad:         prof.especialidad || "",
          bio:                  prof.bio || "",
          serviciosQueAtiende:  prof.serviciosQueAtiende || [],
        });
      }

      // Crear colecciones vacías para turnos y bloqueos
      // (en Firestore no se pueden crear vacías, se crean solas con el primer doc)
      // Solo ponemos un mensaje informativo

      setMsg(`✓ ${EMPRESA.profesionales.length} profesionales creados desde empresa.config.js`);
      await verificar();
      setPaso(3);
    } catch (err) {
      setError("Error al crear profesionales: " + err.message);
    }
    setLoading(false);
  }

  return (
    <div className="login-root">
      <div className="login-card" style={{ maxWidth: 500 }}>
        {/* Header */}
        <div className="login-brand">
          <div className="login-iniciales">⚙</div>
          <h1 className="login-nombre">Setup inicial</h1>
          <p className="login-sub">{EMPRESA.nombre}</p>
        </div>

        {/* Barra de progreso */}
        <div style={{ display: "flex", marginBottom: 28, gap: 0 }}>
          {PASOS.map((p, i) => (
            <div key={p.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: i < paso ? "#10b981" : i === paso ? "var(--color-accent)" : "rgba(255,255,255,.1)",
                border: `1.5px solid ${i < paso ? "#10b981" : i === paso ? "var(--color-accent)" : "rgba(255,255,255,.15)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: i <= paso ? "#fff" : "var(--color-text-muted)",
                transition: "all .3s",
              }}>
                {i < paso ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 10, color: i === paso ? "var(--color-text)" : "var(--color-text-muted)", textAlign: "center" }}>
                {p.label}
              </span>
            </div>
          ))}
        </div>

        {/* ── Paso 0: Verificar ── */}
        {paso === 0 && (
          <div>
            <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Estado de Firebase</h3>
            {loading ? (
              <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Verificando conexión...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                <div style={{ fontSize: 14 }}>
                  {checks.firestore ? <Tick /> : <Cruz />}
                  Firestore conectado {!checks.firestore && <span style={{ color: "#fca5a5" }}> — Revisá las credenciales en firebase.js</span>}
                </div>
                <div style={{ fontSize: 14 }}>
                  {checks.adminExiste ? <Tick /> : <span style={{ color: "#f59e0b", marginRight: 8 }}>○</span>}
                  Usuario admin {checks.adminExiste ? "ya existe" : "no creado todavía"}
                </div>
                <div style={{ fontSize: 14 }}>
                  {checks.profsExisten ? <Tick /> : <span style={{ color: "#f59e0b", marginRight: 8 }}>○</span>}
                  Profesionales {checks.profsExisten ? "ya cargados" : "no cargados todavía"}
                </div>
              </div>
            )}
            {checks.adminExiste && checks.profsExisten ? (
              <div>
                <div style={{ background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 8, padding: "12px 16px", fontSize: 14, color: "#6ee7b7", marginBottom: 16 }}>
                  ✓ Todo ya está configurado. Podés ingresar al panel.
                </div>
                <button className="btn-login" onClick={() => navigate("login-admin")}>
                  Ir al login de admin
                </button>
              </div>
            ) : (
              <button className="btn-login" onClick={() => setPaso(checks.adminExiste ? 2 : 1)} disabled={!checks.firestore}>
                {checks.firestore ? "Continuar con el setup →" : "No hay conexión con Firebase"}
              </button>
            )}
          </div>
        )}

        {/* ── Paso 1: Crear admin ── */}
        {paso === 1 && (
          <form onSubmit={crearAdmin} className="login-form">
            <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Crear cuenta de administrador</h3>
            <div className="form-grupo">
              <label className="form-label">Nombre</label>
              <input className="form-input" value={adminNombre}
                onChange={e => setAdminNombre(e.target.value)}
                placeholder="Administrador" required />
            </div>
            <div className="form-grupo">
              <label className="form-label">Email del admin</label>
              <input className="form-input" type="email" value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                placeholder="admin@tuempresa.com" required autoComplete="off" />
            </div>
            <div className="form-grupo">
              <label className="form-label">Contraseña</label>
              <input className="form-input" type="password" value={adminPass}
                onChange={e => setAdminPass(e.target.value)}
                placeholder="Mínimo 6 caracteres" required autoComplete="new-password" />
            </div>
            <div className="form-grupo">
              <label className="form-label">Confirmar contraseña</label>
              <input className="form-input" type="password" value={adminPass2}
                onChange={e => setAdminPass2(e.target.value)}
                placeholder="Repetir contraseña" required autoComplete="new-password" />
            </div>
            {error && <p className="error-msg">{error}</p>}
            {msg   && <p className="success-msg">{msg}</p>}
            <button className="btn-login" type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear admin →"}
            </button>
          </form>
        )}

        {/* ── Paso 2: Crear profesionales ── */}
        {paso === 2 && (
          <div>
            <h3 style={{ marginBottom: 12, fontSize: 15, fontWeight: 600 }}>Cargar profesionales</h3>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16 }}>
              Se van a cargar los profesionales definidos en <code style={{ background: "rgba(255,255,255,.08)", padding: "1px 6px", borderRadius: 4 }}>empresa.config.js</code>:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {EMPRESA.profesionales.map(p => (
                <div key={p.id} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                  <div style={{ color: "var(--color-accent)", fontSize: 12 }}>{p.especialidad}</div>
                </div>
              ))}
            </div>
            {error && <p className="error-msg">{error}</p>}
            {msg   && <p className="success-msg">{msg}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-login" onClick={crearProfesionales} disabled={loading}>
                {loading ? "Cargando..." : "Cargar profesionales →"}
              </button>
              <button className="btn-volver-cliente" style={{ flex: "none", padding: "10px 16px" }} onClick={() => setPaso(3)}>
                Saltar
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 3: Listo ── */}
        {paso === 3 && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, background: "#10b981", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, margin: "0 auto 16px",
              boxShadow: "0 0 0 12px rgba(16,185,129,.15)",
            }}>✓</div>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>¡Setup completado!</h3>
            <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 24 }}>
              Firebase está listo. Las colecciones <strong>turnos</strong> y <strong>bloqueos</strong> se crean automáticamente cuando se use la app.
            </p>
            <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "14px 18px", textAlign: "left", marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>
                Qué se creó
              </div>
              {[
                "✓ Colección usuarios — documento del admin con rol: admin",
                `✓ Colección profesionales — ${EMPRESA.profesionales.length} documentos`,
                "✓ Colecciones turnos y bloqueos — se generan al primer uso",
              ].map((t, i) => (
                <div key={i} style={{ fontSize: 13, color: "var(--color-text)", padding: "4px 0", borderBottom: i < 2 ? "1px solid rgba(255,255,255,.06)" : "none" }}>
                  {t}
                </div>
              ))}
            </div>
            <button className="btn-login" onClick={() => navigate("login-admin")}>
              Ir al panel de admin →
            </button>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 12 }}>
              Tip: podés deshabilitar /#/setup en App.jsx una vez que todo esté configurado.
            </p>
          </div>
        )}

        <button className="btn-volver-cliente" onClick={() => navigate("booking")}>
          ← Volver al sistema de turnos
        </button>
      </div>
    </div>
  );
}
