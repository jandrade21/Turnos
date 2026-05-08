import React, { useState, useEffect } from "react";
import { useApp } from "../App";
import { turnosService, authService, formatFechaLarga, formatFechaCorta, hoyISO } from "../firebase/firebase";
import "../styles/mis-turnos.css";

const ESTADO_COLOR = {
  confirmado: "#10b981",
  pendiente:  "#f59e0b",
  cancelado:  "#6b7280",
  completado: "#6366f1",
};
const ESTADO_LABEL = {
  confirmado: "Confirmado",
  pendiente:  "Pendiente",
  cancelado:  "Cancelado",
  completado: "Completado",
};

function formatPrecio(n) {
  if (!n) return "";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

export default function MisTurnos() {
  const { empresa, user, navigate } = useApp();
  const [turnos,   setTurnos]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filtro,   setFiltro]   = useState("proximos"); // proximos | pasados | todos
  const [pagina,   setPagina]   = useState(1);
  const [modal,    setModal]    = useState(null); // turno seleccionado para cancelar
  const [motivo,   setMotivo]   = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [msg,      setMsg]      = useState("");

  const hoy = hoyISO();
  const POR_PAGINA = 10;

  useEffect(() => {
    if (!user) return;
    cargar();
  }, [user]);

  useEffect(() => { setPagina(1); }, [filtro]);

  async function cargar() {
    setLoading(true);
    try {
      await turnosService.vincularPorEmail(user.email, user.uid);
    } catch (e) {
      console.warn("vincularPorEmail:", e);
    }
    try {
      const data = await turnosService.obtenerDelCliente(user.uid, user.email);
      setTurnos(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const filtrados = turnos.filter(t => {
    if (filtro === "proximos") return t.fechaISO >= hoy && t.estado !== "cancelado";
    if (filtro === "pasados")  return t.fechaISO < hoy  || t.estado === "completado";
    return true;
  }).sort((a, b) => {
    if (filtro === "proximos") return a.fechaISO.localeCompare(b.fechaISO) || a.horaInicio.localeCompare(b.horaInicio);
    return b.fechaISO.localeCompare(a.fechaISO);
  });

  async function confirmarCancelacion() {
    if (!modal) return;
    const hsAntes = empresa.turnos.cancelacionHsMinimas || 2;
    const [y, m, d] = modal.fechaISO.split("-").map(Number);
    const [hh, mm]  = modal.horaInicio.split(":").map(Number);
    const fechaTurno = new Date(y, m - 1, d, hh, mm);
    const ahora      = new Date();
    const diffHs     = (fechaTurno - ahora) / (1000 * 60 * 60);
    if (diffHs < hsAntes) {
      setMsg(`No podés cancelar con menos de ${hsAntes}hs de anticipación.`);
      setModal(null);
      return;
    }
    setCancelando(true);
    try {
      await turnosService.cancelar(modal.id, motivo);
      setMsg("Turno cancelado correctamente.");
      await cargar();
    } catch (e) {
      console.error("cancelar:", e);
      setMsg("No se pudo cancelar el turno. Recargá la página e intentá de nuevo.");
    }
    setCancelando(false);
    setModal(null);
    setMotivo("");
  }

  async function logout() {
    await authService.logout();
    navigate("booking");
  }

  return (
    <div className="mis-turnos-root">
      {/* Header */}
      <header className="mt-header">
        <div className="mt-brand">
          <div className="mt-iniciales">{empresa.iniciales}</div>
          <div>
            <div className="mt-empresa">{empresa.nombre}</div>
            <div className="mt-bienvenida">Hola, {user?.displayName || user?.email}</div>
          </div>
        </div>
        <div className="mt-header-actions">
          <button className="mt-btn-nuevo" onClick={() => navigate("booking")}>+ Nuevo turno</button>
          <button className="mt-btn-logout" onClick={logout}>Salir</button>
        </div>
      </header>

      <main className="mt-main">
        {/* Filtros */}
        <div className="mt-filtros">
          {[
            { id: "proximos", label: "Próximos" },
            { id: "pasados",  label: "Historial" },
            { id: "todos",    label: "Todos" },
          ].map(f => (
            <button
              key={f.id}
              className={`mt-filtro-btn ${filtro === f.id ? "active" : ""}`}
              onClick={() => setFiltro(f.id)}
            >{f.label}</button>
          ))}
        </div>

        {msg && (
          <div className={`mt-msg ${msg.includes("Error") || msg.includes("No podés") ? "error" : "ok"}`}>
            {msg}
            <button onClick={() => setMsg("")} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "inherit" }}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="mt-loading">Cargando tus turnos...</div>
        ) : filtrados.length === 0 ? (
          <div className="mt-vacio">
            <div className="mt-vacio-icono">📅</div>
            <p>{filtro === "proximos" ? "No tenés turnos próximos." : "No hay turnos en esta sección."}</p>
            <button className="mt-btn-nuevo" onClick={() => navigate("booking")}>Sacar un turno</button>
          </div>
        ) : (
          <div className="mt-lista">
            {filtrados.slice(0, pagina * POR_PAGINA).map(t => {
              const esPasado  = t.fechaISO < hoy;
              const esCancelado = t.estado === "cancelado";
              const puedeCanc   = !esPasado && !esCancelado && t.estado !== "completado" && empresa.turnos.permitirCancelacion;
              return (
                <div key={t.id} className={`mt-card ${esCancelado ? "cancelado" : ""} ${esPasado ? "pasado" : ""}`}>
                  <div className="mt-card-header">
                    <div className="mt-card-fecha">
                      <span className="mt-fecha-dia">{t.fechaISO?.split("-")[2]}</span>
                      <span className="mt-fecha-mes">
                        {new Date(t.fechaISO + "T12:00:00").toLocaleDateString("es-AR", { month: "short" })}
                      </span>
                    </div>
                    <div className="mt-card-body">
                      <div className="mt-card-servicio">{t.servicioNombre}</div>
                      <div className="mt-card-meta">
                        <span>⏰ {t.horaInicio}hs</span>
                        {t.profesionalNombre && t.profesionalNombre !== "Sin preferencia" && (
                          <span>👤 {t.profesionalNombre}</span>
                        )}
                        {t.precio && empresa.turnos.mostrarPrecio && (
                          <span>💰 {formatPrecio(t.precio)}</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-card-estado">
                      <span className="mt-estado-badge" style={{
                        background: ESTADO_COLOR[t.estado] + "22",
                        color: ESTADO_COLOR[t.estado],
                      }}>
                        {ESTADO_LABEL[t.estado]}
                      </span>
                    </div>
                  </div>

                  {t.estado === "cancelado" && t.motivoCancelacion && (
                    <div className="mt-motivo">Motivo: {t.motivoCancelacion}</div>
                  )}

                  {puedeCanc && (
                    <div className="mt-card-footer">
                      <button
                        className="mt-btn-cancelar"
                        onClick={() => { setModal(t); setMotivo(""); }}
                      >
                        Cancelar turno
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {filtrados.length > pagina * POR_PAGINA && (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <button
                  className="mt-btn-nuevo"
                  onClick={() => setPagina(p => p + 1)}
                >
                  Ver más
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal de cancelación */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            <h3 className="modal-titulo">Cancelar turno</h3>
            <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 16 }}>
              {modal.servicioNombre} — {formatFechaLarga(modal.fechaISO)} a las {modal.horaInicio}hs
            </p>
            <div className="form-grupo">
              <label className="form-label">Motivo (opcional)</label>
              <textarea
                className="form-input"
                rows={3}
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="¿Por qué cancelás? (no es obligatorio)"
              />
            </div>
            <div className="modal-acciones">
              <button className="admin-btn" onClick={() => setModal(null)}>Volver</button>
              <button
                className="admin-btn danger"
                onClick={confirmarCancelacion}
                disabled={cancelando}
              >
                {cancelando ? "Cancelando..." : "Confirmar cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
