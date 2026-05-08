import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../App";
import {
  turnosService, bloqueosService, profesionalesService, serviciosService,
  configuracionService, authService,
  hoyISO, sumarDias, getLunesDe, formatFechaLarga, formatFechaCorta,
} from "../firebase/firebase";
import Estadisticas from "./Estadisticas";
import "../styles/admin.css";

const ESTADO_COLOR = { confirmado:"#10b981", pendiente:"#f59e0b", cancelado:"#6b7280", completado:"#6366f1" };
const ESTADO_LABEL = { confirmado:"Confirmado", pendiente:"Pendiente", cancelado:"Cancelado", completado:"Completado" };
const DIAS_SEMANA  = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function formatPrecio(n) {
  if (!n) return "";
  return new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);
}

// ─── AGENDA: vista semanal + lista simple ─────────────────────
function AgendaSemanalLista({ profesionales }) {
  const { empresa } = useApp();
  const [semanaBase, setSemanaBase] = useState(() => getLunesDe(hoyISO()));
  const [diaSeleccionado, setDiaSeleccionado] = useState(hoyISO());
  const [turnosSemana, setTurnosSemana] = useState([]);
  const [turnosDia,    setTurnosDia]    = useState([]);
  const [bloqueosDia,  setBloqueosDia]  = useState([]);
  const [loading, setLoading]  = useState(false);
  const [detalle, setDetalle]  = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [motivoCanc, setMotivoCanc]   = useState("");
  const [profesionalFiltro, setProfesionalFiltro] = useState("todos");

  const diasSemana = Array.from({ length: 7 }, (_, i) => sumarDias(semanaBase, i));
  const domingo    = diasSemana[6];
  const hoy        = hoyISO();

  // Cargar toda la semana
  useEffect(() => {
    setLoading(true);
    Promise.all([
      turnosService.obtenerPorRango(semanaBase, domingo),
      bloqueosService.obtenerPorRango(semanaBase, domingo),
    ]).then(([t, b]) => {
      setTurnosSemana(t);
      setLoading(false);
    });
  }, [semanaBase]);

  // Filtrar para el día seleccionado
  useEffect(() => {
    const td = turnosSemana.filter(t => t.fechaISO === diaSeleccionado);
    td.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    setTurnosDia(td);
  }, [diaSeleccionado, turnosSemana]);

  useEffect(() => {
    bloqueosService.obtenerPorFecha(diaSeleccionado).then(setBloqueosDia);
  }, [diaSeleccionado]);

  function turnosDeDia(fecha) {
    return turnosSemana.filter(t => t.fechaISO === fecha && t.estado !== "cancelado");
  }

  function navSemana(delta) {
    setSemanaBase(s => sumarDias(s, delta * 7));
  }

  async function cancelarTurno() {
    if (!cancelModal) return;
    await turnosService.cancelar(cancelModal.id, motivoCanc);
    const updated = turnosSemana.map(t =>
      t.id === cancelModal.id ? { ...t, estado: "cancelado", motivoCancelacion: motivoCanc } : t
    );
    setTurnosSemana(updated);
    setDetalle(null);
    setCancelModal(null);
    setMotivoCanc("");
  }

  async function cambiarEstado(id, estado) {
    await turnosService.actualizar(id, { estado });
    const updated = turnosSemana.map(t => t.id === id ? { ...t, estado } : t);
    setTurnosSemana(updated);
    if (detalle?.id === id) setDetalle({ ...detalle, estado });
  }

  // Aplicar filtro de profesional - SOLUCIÓN DEFINITIVA
  const turnosFiltrados = profesionalFiltro === "todos" 
    ? turnosDia 
    : profesionalFiltro === "sin_asignar"
      ? turnosDia.filter(t => !t.profesionalId || t.profesionalId === "" || t.profesionalId === null || t.profesionalNombre === "Sin preferencia")
      : turnosDia.filter(t => {
          // Caso 1: Si el profesional está seleccionado por ID
          if (profesionalFiltro !== "sin_asignar" && profesionalFiltro !== "todos") {
            return t.profesionalId === profesionalFiltro;
          }
          // Caso 2: Para "sin_asignar", verificar si no tiene profesional asignado
          return !t.profesionalId || t.profesionalId === "" || t.profesionalId === null || t.profesionalNombre === "Sin preferencia";
        });

  return (
    <div className="agenda-root">
      {/* Nav semana */}
      <div className="semana-nav">
        <button className="admin-btn-sm" onClick={() => navSemana(-1)}>‹ Semana ant.</button>
        <div className="semana-titulo">
          {(() => {
            const [y1,m1,d1] = semanaBase.split("-");
            const [y2,m2,d2] = domingo.split("-");
            const mes1 = MESES[parseInt(m1)-1];
            const mes2 = MESES[parseInt(m2)-1];
            return mes1 === mes2
              ? `${d1} – ${d2} de ${mes1} ${y1}`
              : `${d1} ${mes1} – ${d2} ${mes2} ${y2}`;
          })()}
          {diasSemana.includes(hoy) && <span className="hoy-badge">Esta semana</span>}
        </div>
        <button className="admin-btn-sm" onClick={() => navSemana(1)}>Semana sig. ›</button>
      </div>

      {/* Vista semanal — fila de días */}
      <div className="semana-grid">
        {diasSemana.map((fecha, i) => {
          const turnos = turnosDeDia(fecha);
          const esHoy = fecha === hoy;
          const esSel = fecha === diaSeleccionado;
          const [,, d] = fecha.split("-");
          
          // Ordenar turnos por hora
          const turnosOrdenados = [...turnos].sort((a, b) => 
            a.horaInicio.localeCompare(b.horaInicio)
          );
          
          return (
            <button
              key={fecha}
              className={`semana-dia ${esHoy ? "hoy" : ""} ${esSel ? "selected" : ""}`}
              onClick={() => setDiaSeleccionado(fecha)}
            >
              <span className="semana-dia-nombre">{DIAS_SEMANA[i]}</span>
              <span className="semana-dia-num">{parseInt(d)}</span>
              
              {loading ? (
                <span className="semana-cargando">…</span>
              ) : turnos.length === 0 ? (
                <span className="semana-libre">libre</span>
              ) : (
                <div className="semana-turnos-container">
                 <div className="semana-turnos-count">
                  {turnos.length > 0 && (
                    <div className="semana-turnos-number">
                      {turnos.length}
                    </div>
                  )}
                </div>
                  {turnos.length > 3 && (
                    <div className="semana-turno-item more">
                      +{turnos.length - 3} más
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Filtro de profesionales */}
      <div className="profesional-filtro">
        <select 
          className="admin-select"
          value={profesionalFiltro}
          onChange={e => setProfesionalFiltro(e.target.value)}
        >
          <option value="todos">Mostrar todos los profesionales</option>
          {profesionales.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
          <option value="sin_asignar">Turnos sin asignar</option>
        </select>
      </div>

{/* Lista horizontal de turnos */}
<div className="turnos-lista-contenido">
  <div className="turnos-grid">
    {turnosFiltrados.map(turno => (
      <div 
        key={turno.id} 
        className={`turno-item-lista estado-${turno.estado}`}
        onClick={() => setDetalle(turno)}
      >
        <div className="turno-info-lista">
          <div className="turno-cliente-lista">{turno.clienteNombre}</div>
          <div className="turno-servicio-lista">{turno.servicioNombre}</div>
          <div className="turno-profesional-lista">
            {turno.profesionalId 
              ? profesionales.find(p => p.id === turno.profesionalId)?.nombre 
              : "Sin asignar"}
          </div>
        </div>
        <div className="turno-hora-lista">{turno.horaInicio}</div>
<div className="turno-acciones-lista">
  {turno.estado !== "completado" && turno.estado !== "cancelado" && (
    <button 
      className="admin-btn-sm success" 
      onClick={(e) => {
        e.stopPropagation();
        cambiarEstado(turno.id, "completado");
      }}
    >
      ✓ Completado
    </button>
  )}
  {turno.estado !== "completado" && turno.estado !== "cancelado" && (
    <button 
      className="admin-btn-sm danger" 
      onClick={(e) => {
        e.stopPropagation();
        setCancelModal(turno);
      }}
    >
      ✕ Cancelar
    </button>
  )}
</div>  
      </div>
    ))}
  </div>
</div>

      {/* Modal de detalle del turno */}
      {detalle && !cancelModal && (
        <div className="modal-overlay" onClick={() => setDetalle(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDetalle(null)}>✕</button>
            <h3 className="modal-titulo">Detalle del turno</h3>
            <div className="modal-grid">
              {[["Cliente",     detalle.clienteNombre],
                ["Email",       detalle.clienteEmail],
                ["Teléfono",    detalle.clienteTelefono || "—"],
                ["Servicio",    detalle.servicioNombre],
                ["Profesional", detalle.profesionalNombre && detalle.profesionalNombre !== "Sin preferencia" 
                                ? detalle.profesionalNombre 
                                : "Sin asignar"],
                ["Horario",     `${detalle.horaInicio} – ${detalle.horaFin}`],
                ["Precio",      formatPrecio(detalle.precio) || "—"],
                ["Notas",       detalle.notas || "—"],
                ["Nro.",        `#${detalle.id?.slice(-6).toUpperCase()}`],
              ].map(([k,v]) => (
                <div className="modal-row" key={k}>
                  <span>{k}</span>
                  <strong style={{maxWidth:"60%",textAlign:"right",wordBreak:"break-word"}}>{v}</strong>
                </div>
              ))}
            </div>
                <div className="modal-acciones" style={{marginTop:20}}>
                  {detalle.estado !== "completado" && detalle.estado !== "cancelado" && (
                    <button className="admin-btn success" onClick={() => cambiarEstado(detalle.id, "completado")}>✓ Completado</button>
                  )}
                  {detalle.estado === "cancelado" && (
                    <button className="admin-btn" onClick={() => cambiarEstado(detalle.id, "confirmado")}>Reactivar</button>
                  )}
                  {detalle.estado !== "completado" && detalle.estado !== "cancelado" && (
                    <button className="admin-btn danger" onClick={() => setCancelModal(detalle)}>✕ Cancelar</button>
                  )}
                </div>
          </div>
        </div>
      )}

      {/* Modal de cancelación */}
      {cancelModal && (
        <div className="modal-overlay" onClick={() => setCancelModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setCancelModal(null)}>✕</button>
            <h3 className="modal-titulo">Cancelar turno</h3>
            <p style={{fontSize:14,color:"var(--color-text-muted)",marginBottom:16}}>
              {cancelModal.clienteNombre} — {cancelModal.servicioNombre} a las {cancelModal.horaInicio}hs
            </p>
            <div className="form-grupo">
              <label className="form-label">Motivo (se notifica al cliente)</label>
              <textarea className="form-input" rows={3} value={motivoCanc}
                onChange={e => setMotivoCanc(e.target.value)}
                placeholder="Ej: profesional sin disponibilidad, emergencia..." />
            </div>
            <div className="modal-acciones">
              <button className="admin-btn" onClick={() => setCancelModal(null)}>Volver</button>
              <button className="admin-btn danger" onClick={cancelarTurno}>Confirmar cancelación</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ─── GESTIÓN DE PROFESIONALES ─────────────────────────────
function GestionProfesionales({ profesionales, onRefresh, todosServicios }) {
  const [form, setForm] = useState({ nombre: "", especialidad: "", bio: "", serviciosQueAtiende: [] });
  const [editId,        setEditId]        = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [msg,           setMsg]           = useState("");
  const [confirmarElim, setConfirmarElim] = useState(null);
  const [sinPreferencia,    setSinPreferencia]    = useState(true);
  const [msgConfig,         setMsgConfig]         = useState("");
  const [savingConfig,      setSavingConfig]       = useState(false);

  useEffect(() => {
    configuracionService.obtener()
      .then(c => setSinPreferencia(c.sinPreferencia !== false))
      .catch(() => {});
  }, []);

  async function toggleSinPreferencia() {
    const nuevo = !sinPreferencia;
    setSavingConfig(true);
    setMsgConfig("");
    try {
      await configuracionService.actualizar({ sinPreferencia: nuevo });
      setSinPreferencia(nuevo);
      setMsgConfig(nuevo ? "✓ Opción activada." : "✓ Opción desactivada.");
    } catch (e) {
      setMsgConfig("Error al guardar. Verificá las reglas de Firestore.");
    }
    setSavingConfig(false);
    setTimeout(() => setMsgConfig(""), 3000);
  }

  function resetForm() { setForm({ nombre: "", especialidad: "", bio: "", serviciosQueAtiende: [] }); setEditId(null); }

  function editarProf(p) {
    setForm({ nombre: p.nombre, especialidad: p.especialidad || "", bio: p.bio || "", serviciosQueAtiende: p.serviciosQueAtiende || [] });
    setEditId(p.id);
    document.getElementById("form-prof")?.scrollIntoView({ behavior: "smooth" });
  }

  function toggleServicio(id) {
    setForm(f => ({
      ...f,
      serviciosQueAtiende: f.serviciosQueAtiende.includes(id)
        ? f.serviciosQueAtiende.filter(s => s !== id)
        : [...f.serviciosQueAtiende, id],
    }));
  }

  async function guardar() {
    if (!form.nombre.trim()) { setMsg("El nombre es obligatorio."); return; }
    setLoading(true); setMsg("");
    try {
      if (editId) {
        await profesionalesService.actualizar(editId, form);
        setMsg("Profesional actualizado.");
      } else {
        await profesionalesService.crear(form);
        setMsg("Profesional agregado.");
      }
      resetForm();
      await onRefresh();
    } catch (e) { setMsg("Error al guardar."); }
    setLoading(false);
  }

  async function toggleActivo(p) {
    if (p.activo) await profesionalesService.desactivar(p.id);
    else          await profesionalesService.activar(p.id);
    await onRefresh();
  }

  async function eliminar(id) {
    await profesionalesService.eliminar(id);
    setConfirmarElim(null);
    await onRefresh();
  }

  return (
    <div className="gestion-prof">
      {/* Toggle sin preferencia */}
      <div style={{ marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, fontSize:14, color:"var(--color-text)" }}>Opción "Sin preferencia de profesional"</div>
            <div style={{ fontSize:12, color:"var(--color-text-muted)", marginTop:3 }}>
              Permite que los clientes elijan "El primero disponible" al reservar un turno
            </div>
          </div>
          <button
            onClick={toggleSinPreferencia}
            disabled={savingConfig}
            className="admin-btn"
            style={{ minWidth:100, background: sinPreferencia ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.08)", borderColor: sinPreferencia ? "#10b981" : "#ef4444", color: sinPreferencia ? "#059669" : "#ef4444" }}
          >
            {savingConfig ? "Guardando..." : sinPreferencia ? "✓ Activo" : "✕ Inactivo"}
          </button>
        </div>
        {msgConfig && (
          <p style={{ fontSize:13, margin:"6px 0 0 4px", color: msgConfig.includes("Error") ? "#ef4444" : "#059669" }}>
            {msgConfig}
          </p>
        )}
      </div>

      {/* Lista de profesionales */}
      <h3 className="config-titulo">Profesionales</h3>
      <div className="prof-lista">
        {profesionales.length === 0 && (
          <p style={{color:"var(--color-text-muted)",fontSize:14}}>No hay profesionales registrados. Agregá el primero.</p>
        )}
        {profesionales.map(p => (
          <div key={p.id} className={`prof-item ${!p.activo ? "inactivo" : ""}`}>
            <div className="prof-item-avatar">{p.nombre.split(" ").map(x => x[0]).join("").slice(0,2)}</div>
            <div className="prof-item-info">
              <div className="prof-item-nombre">
                {p.nombre}
                {!p.activo && <span className="badge-inactivo">Inactivo</span>}
              </div>
              {p.especialidad && <div className="prof-item-esp">{p.especialidad}</div>}
              {p.serviciosQueAtiende?.length > 0 && (
                <div className="prof-item-servicios">
                  {p.serviciosQueAtiende.map(sid => {
                    const s = todosServicios.find(x => x.id === sid);
                    return s ? <span key={sid} className="serv-pill">{s.nombre}</span> : null;
                  })}
                </div>
              )}
            </div>
            <div className="prof-item-acciones">
              <button className="admin-btn-sm" onClick={() => editarProf(p)}>Editar</button>
              <button className="admin-btn-sm" onClick={() => toggleActivo(p)}>{p.activo ? "Desactivar" : "Activar"}</button>
              <button className="admin-btn-sm danger" onClick={() => setConfirmarElim(p)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {/* Formulario */}
      <div className="config-form" id="form-prof" style={{marginTop:24}}>
        <h4 style={{marginBottom:16,fontSize:15,fontWeight:600}}>{editId ? "Editar profesional" : "Agregar profesional"}</h4>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="form-grupo">
            <label className="form-label">Nombre <span style={{color:"var(--color-accent)"}}>*</span></label>
            <input className="admin-input" value={form.nombre} onChange={e => setForm(f=>({...f,nombre:e.target.value}))} placeholder="Nombre completo" />
          </div>
          <div className="form-grupo">
            <label className="form-label">Especialidad</label>
            <input className="admin-input" value={form.especialidad} onChange={e => setForm(f=>({...f,especialidad:e.target.value}))} placeholder="Ej: Coloración y mechas" />
          </div>
        </div>
        <div className="form-grupo">
          <label className="form-label">Bio / descripción</label>
          <input className="admin-input" value={form.bio} onChange={e => setForm(f=>({...f,bio:e.target.value}))} placeholder="Años de experiencia, formación..." />
        </div>
        <div className="form-grupo">
          <label className="form-label">Servicios que atiende</label>
          <div className="servicios-check-grid">
            {todosServicios.map(s => (
              <label key={s.id} className={`serv-check ${form.serviciosQueAtiende.includes(s.id) ? "sel" : ""}`}>
                <input type="checkbox" checked={form.serviciosQueAtiende.includes(s.id)}
                  onChange={() => toggleServicio(s.id)} style={{display:"none"}} />
                {s.nombre}
              </label>
            ))}
          </div>
        </div>
        {msg && <p className={`msg-${msg.includes("Error") ? "err" : "ok"}`}>{msg}</p>}
        <div style={{display:"flex",gap:10}}>
          <button className="admin-btn" onClick={guardar} disabled={loading}>{loading ? "Guardando..." : editId ? "Actualizar" : "Agregar profesional"}</button>
          {editId && <button className="admin-btn" onClick={resetForm}>Cancelar</button>}
        </div>
      </div>

      {confirmarElim && (
        <div className="modal-overlay" onClick={() => setConfirmarElim(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setConfirmarElim(null)}>✕</button>
            <h3 className="modal-titulo">Eliminar profesional</h3>
            <p style={{fontSize:14,color:"var(--color-text-muted)",margin:"12px 0 20px"}}>
              ¿Eliminar a <strong>{confirmarElim.nombre}</strong>? Sus turnos existentes no se borran, pero ya no aparecerá para nuevas reservas.
            </p>
            <div className="modal-acciones">
              <button className="admin-btn" onClick={() => setConfirmarElim(null)}>Cancelar</button>
              <button className="admin-btn danger" onClick={() => eliminar(confirmarElim.id)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const NOMBRES_DIA = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

function BloqueoItem({ b, profesionales, onEliminar }) {
  const nombreProf = b.profesionalId !== "todos"
    ? profesionales.find(p => p.id === b.profesionalId)?.nombre || b.profesionalId
    : null;
  return (
    <div className="blq-item">
      <div className="blq-item-info">
        {b.tipo === "diaRepetido"
          ? <span className="blq-tag tag-repetido">Todos los {NOMBRES_DIA[b.diaSemana]}</span>
          : <span className="blq-tag tag-fecha">{b.fecha}</span>
        }
        <span className="blq-horario">{b.horaInicio ? `${b.horaInicio} – ${b.horaFin}` : "Día completo"}</span>
        {b.motivo && <span className="blq-motivo">{b.motivo}</span>}
        {nombreProf && <span className="blq-prof">{nombreProf}</span>}
      </div>
      <button className="btn-revertir-uno" onClick={() => onEliminar(b.id)} title="Revertir este bloqueo">
        Revertir
      </button>
    </div>
  );
}

function ListaBloqueos({ titulo, lista, profesionales, onEliminar, onRevertirTodos }) {
  if (!lista.length) return null;
  return (
    <div className="blq-lista">
      <div className="blq-lista-header">
        <span className="blq-lista-titulo">{titulo} <span className="blq-count">({lista.length})</span></span>
        <button className="btn-revertir-todos" onClick={() => onRevertirTodos(lista)}>
          Revertir todos
        </button>
      </div>
      {lista.map(b => (
        <BloqueoItem key={b.id} b={b} profesionales={profesionales} onEliminar={onEliminar} />
      ))}
    </div>
  );
}

// ─── BLOQUEOS ─────────────────────────────────────────────
function Bloqueos({ profesionales }) {
  const [tipo, setTipo] = useState("dia");
  const [profBloqueo, setProfBloqueo] = useState("todos");
  const [horaIni, setHoraIni] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState({ texto: "", ok: true });
  const [cargando, setCargando] = useState(false);
  // Día específico
  const [fechaDia, setFechaDia] = useState(hoyISO());
  // Rango de fechas
  const [fechaDesde, setFechaDesde] = useState(hoyISO());
  const [fechaHasta, setFechaHasta] = useState(hoyISO());
  // Día repetido
  const [diaSemana, setDiaSemana] = useState("1");
  // Todos los bloqueos
  const [bloqueos, setBloqueos] = useState([]);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const data = await bloqueosService.obtenerTodos();
      setBloqueos(data);
    } catch (e) { console.error(e); }
  }

  const mostrarMsg = (texto, ok = true) => {
    setMsg({ texto, ok });
    setTimeout(() => setMsg({ texto: "", ok: true }), 3000);
  };

  async function agregar() {
    if (!motivo.trim()) { mostrarMsg("El motivo es obligatorio.", false); return; }
    if (tipo === "rango" && fechaDesde > fechaHasta) {
      mostrarMsg("La fecha de inicio debe ser anterior al fin.", false); return;
    }
    setCargando(true);
    try {
      const base = { profesionalId: profBloqueo, horaInicio: horaIni || null, horaFin: horaFin || null, motivo };
      if (tipo === "dia") {
        await bloqueosService.crear({ ...base, tipo: "dia", fecha: fechaDia });
        mostrarMsg("Día bloqueado correctamente.");
      } else if (tipo === "rango") {
        let f = fechaDesde;
        while (f <= fechaHasta) {
          await bloqueosService.crear({ ...base, tipo: "dia", fecha: f });
          f = sumarDias(f, 1);
        }
        mostrarMsg("Rango de fechas bloqueado.");
      } else {
        await bloqueosService.crear({ ...base, tipo: "diaRepetido", diaSemana: Number(diaSemana) });
        mostrarMsg(`Todos los ${NOMBRES_DIA[Number(diaSemana)]} bloqueados.`);
      }
      await cargar();
    } catch (e) {
      mostrarMsg("Error al guardar el bloqueo.", false);
    } finally {
      setCargando(false);
    }
  }

  async function eliminar(id) {
    try {
      await bloqueosService.eliminar(id);
      await cargar();
      mostrarMsg("Bloqueo revertido.");
    } catch (e) { mostrarMsg("Error al revertir.", false); }
  }

  async function revertirTodos(lista) {
    try {
      for (const b of lista) await bloqueosService.eliminar(b.id);
      await cargar();
      mostrarMsg(`${lista.length} bloqueo${lista.length > 1 ? "s" : ""} revertido${lista.length > 1 ? "s" : ""}.`);
    } catch (e) { mostrarMsg("Error al revertir.", false); }
  }

  const cantDias = (fechaDesde <= fechaHasta)
    ? Math.round((new Date(fechaHasta) - new Date(fechaDesde)) / 86400000) + 1
    : 0;

  // Siempre mostramos todos los bloqueos activos, sin filtrar por tab
  const todosDia = bloqueos
    .filter(b => b.tipo === "dia")
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const todosRepetidos = bloqueos
    .filter(b => b.tipo === "diaRepetido")
    .sort((a, b) => a.diaSemana - b.diaSemana);

  return (
    <div className="blq-panel">
      <div className="blq-form-card">
        <h3 className="blq-titulo">Gestión de Bloqueos</h3>

        {/* Selector de tipo */}
        <div className="blq-tabs">
          {[
            { id: "dia",         label: "Día específico" },
            { id: "rango",       label: "Rango de fechas" },
            { id: "diaRepetido", label: "Día de la semana" },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              className={`blq-tab ${tipo === t.id ? "active" : ""}`}
              onClick={() => setTipo(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Campos por tipo */}
        <div className="blq-campos">
          {tipo === "dia" && (
            <div className="blq-grid-2">
              <div className="form-grupo">
                <label className="form-label">Fecha</label>
                <input type="date" className="admin-input" value={fechaDia} onChange={e => setFechaDia(e.target.value)} />
              </div>
              <div className="form-grupo">
                <label className="form-label">Profesional</label>
                <select className="admin-select" value={profBloqueo} onChange={e => setProfBloqueo(e.target.value)}>
                  <option value="todos">Todos</option>
                  {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="form-grupo">
                <label className="form-label">Hora inicio (opcional)</label>
                <input type="time" className="admin-input" value={horaIni} onChange={e => setHoraIni(e.target.value)} />
              </div>
              <div className="form-grupo">
                <label className="form-label">Hora fin (opcional)</label>
                <input type="time" className="admin-input" value={horaFin} onChange={e => setHoraFin(e.target.value)} />
              </div>
            </div>
          )}

          {tipo === "rango" && (
            <div>
              <div className="blq-grid-3">
                <div className="form-grupo">
                  <label className="form-label">Desde</label>
                  <input type="date" className="admin-input" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
                </div>
                <div className="form-grupo">
                  <label className="form-label">Hasta</label>
                  <input type="date" className="admin-input" value={fechaHasta} min={fechaDesde} onChange={e => setFechaHasta(e.target.value)} />
                </div>
                <div className="form-grupo">
                  <label className="form-label">Profesional</label>
                  <select className="admin-select" value={profBloqueo} onChange={e => setProfBloqueo(e.target.value)}>
                    <option value="todos">Todos</option>
                    {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="blq-grid-2">
                <div className="form-grupo">
                  <label className="form-label">Hora inicio (opcional)</label>
                  <input type="time" className="admin-input" value={horaIni} onChange={e => setHoraIni(e.target.value)} />
                </div>
                <div className="form-grupo">
                  <label className="form-label">Hora fin (opcional)</label>
                  <input type="time" className="admin-input" value={horaFin} onChange={e => setHoraFin(e.target.value)} />
                </div>
              </div>
              {cantDias > 0 && (
                <p className="blq-rango-info">Se bloquearán <strong>{cantDias}</strong> día{cantDias > 1 ? "s" : ""}</p>
              )}
            </div>
          )}

          {tipo === "diaRepetido" && (
            <div>
              <p className="blq-desc">Bloquea permanentemente un día de la semana. Por ejemplo: todos los lunes.</p>
              <div className="blq-grid-2">
                <div className="form-grupo">
                  <label className="form-label">Día de la semana</label>
                  <select className="admin-select" value={diaSemana} onChange={e => setDiaSemana(e.target.value)}>
                    <option value="1">Lunes</option>
                    <option value="2">Martes</option>
                    <option value="3">Miércoles</option>
                    <option value="4">Jueves</option>
                    <option value="5">Viernes</option>
                    <option value="6">Sábado</option>
                    <option value="0">Domingo</option>
                  </select>
                </div>
                <div className="form-grupo">
                  <label className="form-label">Profesional</label>
                  <select className="admin-select" value={profBloqueo} onChange={e => setProfBloqueo(e.target.value)}>
                    <option value="todos">Todos</option>
                    {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="form-grupo">
                  <label className="form-label">Hora inicio (opcional)</label>
                  <input type="time" className="admin-input" value={horaIni} onChange={e => setHoraIni(e.target.value)} />
                </div>
                <div className="form-grupo">
                  <label className="form-label">Hora fin (opcional)</label>
                  <input type="time" className="admin-input" value={horaFin} onChange={e => setHoraFin(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <div className="form-grupo" style={{ marginTop: 4 }}>
            <label className="form-label">Motivo <span style={{ color: "var(--color-accent)" }}>*</span></label>
            <input
              className="admin-input"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Vacaciones, feriado, emergencia..."
            />
          </div>

          <div className="blq-actions">
            <button className="blq-btn-guardar" onClick={agregar} disabled={cargando || !motivo.trim()}>
              {cargando ? "Guardando..." : "Bloquear"}
            </button>
            {msg.texto && <span className={msg.ok ? "msg-ok" : "msg-err"}>{msg.texto}</span>}
          </div>
        </div>
      </div>

      {/* Todos los bloqueos activos — siempre visibles */}
      {(todosDia.length > 0 || todosRepetidos.length > 0) ? (
        <div className="blq-resultados">
          {todosRepetidos.length > 0 && (
            <ListaBloqueos
              titulo="Días recurrentes bloqueados"
              lista={todosRepetidos}
              profesionales={profesionales}
              onEliminar={eliminar}
              onRevertirTodos={revertirTodos}
            />
          )}
          {todosDia.length > 0 && (
            <ListaBloqueos
              titulo="Días específicos bloqueados"
              lista={todosDia}
              profesionales={profesionales}
              onEliminar={eliminar}
              onRevertirTodos={revertirTodos}
            />
          )}
        </div>
      ) : (
        <p className="blq-empty">No hay bloqueos activos.</p>
      )}
    </div>
  );
}
// ─── LISTA COMPLETA DE TURNOS ──────────────────────────────
const PAGE_SIZE = 20;

function ListaTurnos() {
  const [turnos,     setTurnos]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingMas, setLoadingMas] = useState(false);
  const [cursor,     setCursor]     = useState(null);
  const [hayMas,     setHayMas]     = useState(false);
  const [filtro,     setFiltro]     = useState("todos");
  const [busqueda,   setBusqueda]   = useState("");
  const [detalle,    setDetalle]    = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [motivoCanc, setMotivoCanc]   = useState("");

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    const { items, nextCursor, hayMas: hm } = await turnosService.obtenerTodosPage({}, PAGE_SIZE);
    setTurnos(items);
    setCursor(nextCursor);
    setHayMas(hm);
    setLoading(false);
  }

  async function cargarMas() {
    if (!hayMas || loadingMas) return;
    setLoadingMas(true);
    const { items, nextCursor, hayMas: hm } = await turnosService.obtenerTodosPage({}, PAGE_SIZE, cursor);
    setTurnos(prev => [...prev, ...items]);
    setCursor(nextCursor);
    setHayMas(hm);
    setLoadingMas(false);
  }

  async function cancelar() {
    await turnosService.cancelar(cancelModal.id, motivoCanc);
    setTurnos(ts => ts.map(t => t.id === cancelModal.id ? {...t, estado:"cancelado"} : t));
    setCancelModal(null);
    setMotivoCanc("");
    setDetalle(null);
  }

  async function cambiarEstado(id, estado) {
    await turnosService.actualizar(id, { estado });
    setTurnos(ts => ts.map(t => t.id === id ? {...t, estado} : t));
    if (detalle?.id === id) setDetalle({...detalle, estado});
  }

  const filtrados = turnos.filter(t => {
    const matchE = filtro === "todos" || t.estado === filtro;
    const matchB = !busqueda ||
      t.clienteNombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.clienteEmail?.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.servicioNombre?.toLowerCase().includes(busqueda.toLowerCase());
    return matchE && matchB;
  });

  return (
    <div className="lista-turnos">
      <div className="lista-filtros">
        <input className="admin-search" placeholder="Buscar por nombre, email o servicio..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select className="admin-select" value={filtro} onChange={e => setFiltro(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="confirmado">Confirmados</option>
          <option value="pendiente">Pendientes</option>
          <option value="completado">Completados</option>
          <option value="cancelado">Cancelados</option>
        </select>
      </div>
      {loading ? <div className="admin-loading">Cargando...</div>
      : filtrados.length === 0 ? <p className="admin-empty">No hay turnos.</p>
      : (
        <div className="tabla-turnos">
          <div className="tabla-header">
            <span>Fecha</span><span>Hora</span><span>Cliente</span><span>Servicio</span><span>Estado</span><span></span>
          </div>
              {filtrados.map(t => (
                <div key={t.id} className="tabla-row" style={{alignItems:"center"}}>
                  <span>{formatFechaCorta(t.fechaISO)}</span>
                  <span>{t.horaInicio}</span>
                  <div><div className="tabla-cliente">{t.clienteNombre}</div><div className="tabla-email">{t.clienteEmail}</div></div>
                  <span>{t.servicioNombre}</span>
                  <span className="estado-badge-sm" style={{background:ESTADO_COLOR[t.estado]+"22",color:ESTADO_COLOR[t.estado]}}>
                    {ESTADO_LABEL[t.estado]}
                  </span>
                  <div style={{display:"flex",gap:6}}>
                    {t.estado !== "completado" && t.estado !== "cancelado" && (
                      <button className="admin-btn-sm success" onClick={() => cambiarEstado(t.id,"completado")}>✓</button>
                    )}
                    {t.estado !== "cancelado" && (
                      <button className="admin-btn-sm danger" onClick={() => { setDetalle(t); setCancelModal(t); }}>✕</button>
                    )}
                  </div>
                </div>
              ))}
          {hayMas && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <button
                className="admin-btn"
                onClick={cargarMas}
                disabled={loadingMas}
              >
                {loadingMas ? "Cargando..." : "Ver más"}
              </button>
            </div>
          )}
        </div>
      )}

      {detalle && !cancelModal && (
        <div className="modal-overlay" onClick={() => setDetalle(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDetalle(null)}>✕</button>
            <h3 className="modal-titulo">Turno #{detalle.id?.slice(-6).toUpperCase()}</h3>
            <div className="modal-grid">
              {[["Cliente",detalle.clienteNombre],["Email",detalle.clienteEmail],["Teléfono",detalle.clienteTelefono||"—"],
                ["Servicio",detalle.servicioNombre],["Profesional",detalle.profesionalNombre||"—"],
                ["Fecha",formatFechaCorta(detalle.fechaISO)],["Horario",`${detalle.horaInicio} – ${detalle.horaFin}`],
                ["Precio",formatPrecio(detalle.precio)||"—"],["Notas",detalle.notas||"—"],
                ...(detalle.motivoCancelacion ? [["Motivo canc.",detalle.motivoCancelacion]] : []),
              ].map(([k,v]) => (
                <div className="modal-row" key={k}><span>{k}</span>
                  <strong style={{maxWidth:"60%",textAlign:"right",wordBreak:"break-word"}}>{v}</strong>
                </div>
              ))}
            </div>
            <div className="modal-acciones" style={{marginTop:20}}>
              {detalle.estado !== "completado" && detalle.estado !== "cancelado" && (
                <button className="admin-btn success" onClick={() => cambiarEstado(detalle.id,"completado")}>✓ Completado</button>
              )}
              {detalle.estado !== "cancelado" && (
                <button className="admin-btn danger" onClick={() => setCancelModal(detalle)}>✕ Cancelar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {cancelModal && (
        <div className="modal-overlay" onClick={() => setCancelModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setCancelModal(null)}>✕</button>
            <h3 className="modal-titulo">Cancelar turno</h3>
            <p style={{fontSize:14,color:"var(--color-text-muted)",marginBottom:16}}>
              {cancelModal.clienteNombre} — {cancelModal.servicioNombre} el {formatFechaCorta(cancelModal.fechaISO)}
            </p>
            <div className="form-grupo">
              <label className="form-label">Motivo</label>
              <textarea className="form-input" rows={3} value={motivoCanc}
                onChange={e => setMotivoCanc(e.target.value)} placeholder="Motivo de cancelación..." />
            </div>
            <div className="modal-acciones">
              <button className="admin-btn" onClick={() => setCancelModal(null)}>Volver</button>
              <button className="admin-btn danger" onClick={cancelar}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GESTION SERVICIOS ───────────────────────────────────
const EMOJIS_SERV = ["✂️","💈","💇","💅","🌟","🎨","💫","💧","🌿","✨","🔥","💎","🧴","🪮","👄","🦷","🧖","💆"];
const COLORES_SERV = ["#e94560","#6366f1","#10b981","#f59e0b","#d97706","#7c3aed","#0ea5e9","#ec4899","#059669","#dc2626"];

function GestionServicios({ servicios, onRefresh }) {
  const { empresa } = useApp();
  const [form, setForm] = useState({ nombre:"", descripcion:"", duracion:30, precio:0, icono:"✂️", color:"#e94560" });
  const [editId,        setEditId]        = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [msg,           setMsg]           = useState("");
  const [confirmarElim, setConfirmarElim] = useState(null);

  function resetForm() { setForm({ nombre:"", descripcion:"", duracion:30, precio:0, icono:"✂️", color:"#e94560" }); setEditId(null); }

  function editar(s) {
    setForm({ nombre:s.nombre, descripcion:s.descripcion||"", duracion:s.duracion, precio:s.precio, icono:s.icono||"✂️", color:s.color||"#e94560" });
    setEditId(s.id);
    document.getElementById("form-serv")?.scrollIntoView({ behavior:"smooth" });
  }

  async function guardar() {
    if (!form.nombre.trim()) { setMsg("El nombre es obligatorio."); return; }
    setLoading(true); setMsg("");
    try {
      const datos = { ...form, duracion: Number(form.duracion), precio: Number(form.precio) };
      if (editId) {
        await serviciosService.actualizar(editId, datos);
        setMsg("Servicio actualizado.");
      } else {
        await serviciosService.crear(datos);
        setMsg("Servicio agregado.");
      }
      resetForm();
      await onRefresh();
    } catch (e) { setMsg("Error al guardar."); }
    setLoading(false);
  }

  async function toggleActivo(s) {
    if (s.activo !== false) await serviciosService.desactivar(s.id);
    else                    await serviciosService.activar(s.id);
    await onRefresh();
  }

  async function eliminar(id) {
    await serviciosService.eliminar(id);
    setConfirmarElim(null);
    await onRefresh();
  }

  async function importarConfig() {
    setLoading(true); setMsg("");
    try {
      await serviciosService.importarDesdeConfig(empresa.servicios);
      await onRefresh();
      setMsg(`✓ ${empresa.servicios.length} servicios importados correctamente.`);
    } catch (e) {
      console.error("importarConfig:", e);
      setMsg("Error al importar. Verificá las reglas de Firestore (ver instrucciones en firebase.js).");
    }
    setLoading(false);
  }

  return (
    <div className="gestion-prof">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h3 className="config-titulo" style={{margin:0}}>Servicios</h3>
        <button className="admin-btn" onClick={importarConfig} disabled={loading}
          title="Importa los servicios definidos en empresa.config.js a Firestore">
          ↓ {servicios.length === 0 ? "Importar desde configuración" : "Re-importar configuración"}
        </button>
      </div>

      <div className="prof-lista">
        {servicios.length === 0 && (
          <p style={{color:"var(--color-text-muted)",fontSize:14}}>
            No hay servicios en Firestore. Hacé clic en "Importar desde configuración" para cargar los servicios existentes, o creá uno nuevo abajo.
          </p>
        )}
        {servicios.map(s => (
          <div key={s.id} className={`prof-item ${s.activo === false ? "inactivo" : ""}`}>
            <div className="prof-item-avatar" style={{ background: s.color || "#e94560", fontSize:20 }}>{s.icono || "✂️"}</div>
            <div className="prof-item-info">
              <div className="prof-item-nombre">
                {s.nombre}
                {s.activo === false && <span className="badge-inactivo">Inactivo</span>}
              </div>
              <div className="prof-item-esp">{s.duracion} min · {formatPrecio(s.precio)}</div>
              {s.descripcion && <div style={{fontSize:12,color:"var(--color-text-muted)",marginTop:2}}>{s.descripcion}</div>}
            </div>
            <div className="prof-item-acciones">
              <button className="admin-btn-sm" onClick={() => editar(s)}>Editar</button>
              <button className="admin-btn-sm" onClick={() => toggleActivo(s)}>{s.activo !== false ? "Desactivar" : "Activar"}</button>
              <button className="admin-btn-sm danger" onClick={() => setConfirmarElim(s)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      <div className="config-form" id="form-serv" style={{marginTop:24}}>
        <h4 style={{marginBottom:16,fontSize:15,fontWeight:600}}>{editId ? "Editar servicio" : "Nuevo servicio"}</h4>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="form-grupo">
            <label className="form-label">Nombre <span style={{color:"var(--color-accent)"}}>*</span></label>
            <input className="admin-input" value={form.nombre} onChange={e => setForm(f=>({...f,nombre:e.target.value}))} placeholder="Ej: Corte de cabello" />
          </div>
          <div className="form-grupo">
            <label className="form-label">Descripción</label>
            <input className="admin-input" value={form.descripcion} onChange={e => setForm(f=>({...f,descripcion:e.target.value}))} placeholder="Descripción breve" />
          </div>
          <div className="form-grupo">
            <label className="form-label">Duración (minutos)</label>
            <input className="admin-input" type="number" min="5" step="5" value={form.duracion} onChange={e => setForm(f=>({...f,duracion:e.target.value}))} />
          </div>
          <div className="form-grupo">
            <label className="form-label">Precio (ARS)</label>
            <input className="admin-input" type="number" min="0" value={form.precio} onChange={e => setForm(f=>({...f,precio:e.target.value}))} />
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="form-grupo">
            <label className="form-label">Ícono</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {EMOJIS_SERV.map(e => (
                <button key={e} type="button" onClick={() => setForm(f=>({...f,icono:e}))} style={{
                  padding:"5px 9px", borderRadius:8, fontSize:17, cursor:"pointer",
                  border: form.icono===e ? "2px solid var(--color-accent)" : "1px solid var(--border)",
                  background: form.icono===e ? "rgba(233,69,96,.08)" : "var(--surface)",
                }}>{e}</button>
              ))}
            </div>
          </div>
          <div className="form-grupo">
            <label className="form-label">Color</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              {COLORES_SERV.map(c => (
                <button key={c} type="button" onClick={() => setForm(f=>({...f,color:c}))} style={{
                  width:30, height:30, borderRadius:8, background:c, cursor:"pointer",
                  border: form.color===c ? "3px solid var(--color-text)" : "2px solid transparent",
                  outline: form.color===c ? "2px solid white" : "none",
                }} />
              ))}
              <input type="color" value={form.color} onChange={e => setForm(f=>({...f,color:e.target.value}))}
                style={{width:30,height:30,borderRadius:8,border:"1px solid var(--border)",padding:0,cursor:"pointer"}} title="Color personalizado" />
            </div>
          </div>
        </div>
        {msg && <p className={`msg-${msg.includes("Error") ? "err" : "ok"}`}>{msg}</p>}
        <div style={{display:"flex",gap:10}}>
          <button className="admin-btn" onClick={guardar} disabled={loading}>{loading ? "Guardando..." : editId ? "Actualizar servicio" : "Agregar servicio"}</button>
          {editId && <button className="admin-btn" onClick={resetForm}>Cancelar</button>}
        </div>
      </div>

      {confirmarElim && (
        <div className="modal-overlay" onClick={() => setConfirmarElim(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setConfirmarElim(null)}>✕</button>
            <h3 className="modal-titulo">Eliminar servicio</h3>
            <p style={{fontSize:14,color:"var(--color-text-muted)",margin:"12px 0 20px"}}>
              ¿Eliminar <strong>{confirmarElim.nombre}</strong>? Los turnos existentes no se borran, pero ya no estará disponible para nuevas reservas.
            </p>
            <div className="modal-acciones">
              <button className="admin-btn" onClick={() => setConfirmarElim(null)}>Cancelar</button>
              <button className="admin-btn danger" onClick={() => eliminar(confirmarElim.id)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN PANEL PRINCIPAL ────────────────────────────────
export default function AdminPanel() {
  const { empresa, user, navigate } = useApp();
  const [tab,          setTab]          = useState("agenda");
  const [menuAbierto,  setMenuAbierto]  = useState(false);
  const [profesionales, setProfesionales] = useState([]);
  const [servicios,     setServicios]     = useState([]);

  useEffect(() => { cargarProfs(); cargarServs(); }, []);

  async function cargarProfs() {
    try {
      const data = await profesionalesService.obtenerTodos();
      if (data.length === 0 && empresa.profesionales?.length > 0) {
        setProfesionales(empresa.profesionales.map(p => ({ ...p, activo: true })));
      } else {
        setProfesionales(data.filter(p => p.activo !== false));
      }
    } catch (e) {
      setProfesionales(empresa.profesionales?.map(p => ({ ...p, activo: true })) || []);
    }
  }

  async function cargarServs() {
    try {
      const data = await serviciosService.obtenerTodos();
      setServicios(data);
    } catch (e) {
      setServicios(empresa.servicios?.map(s => ({ ...s, activo: true })) || []);
    }
  }

  const todosServicios = servicios.length > 0
    ? servicios.map(s => ({ id: s.id, nombre: s.nombre }))
    : empresa.servicios.map(s => ({ id: s.id, nombre: s.nombre }));

  const TABS = [
    { id: "agenda",        icono: "📅", label: "Agenda" },
    { id: "lista",         icono: "📋", label: "Turnos" },
    { id: "profesionales", icono: "👥", label: "Profesionales" },
    { id: "servicios",     icono: "✂️",  label: "Servicios" },
    { id: "bloqueos",      icono: "🔒", label: "Bloqueos" },
    { id: "stats",         icono: "📈", label: "Estadísticas" },
  ];

  const tabActual = TABS.find(t => t.id === tab);

  return (
    <div className="admin-root">
      <header className="admin-header">
        <div className="admin-brand">
          <button className="admin-hamburger" onClick={() => setMenuAbierto(m => !m)} aria-label="Abrir menú">
            ☰
          </button>
          <span className="admin-badge">⚙</span>
          <span className="admin-nombre">{empresa.nombre}</span>
          <span className="admin-seccion-mobile">{tabActual?.icono} {tabActual?.label}</span>
        </div>
        <div className="admin-header-right">
          <span className="admin-email">{user?.email}</span>
          <button className="btn-logout" onClick={() => authService.logout().then(() => navigate("booking"))}>Salir</button>
        </div>
      </header>

      <div className="admin-body">
        {menuAbierto && (
          <div className="admin-menu-overlay" onClick={() => setMenuAbierto(false)} />
        )}

        <nav className={`admin-sidebar${menuAbierto ? " open" : ""}`}>
          <div className="sidebar-header">
            <span className="sidebar-titulo">{empresa.nombre}</span>
            <button className="sidebar-close" onClick={() => setMenuAbierto(false)}>✕</button>
          </div>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`sidebar-item${tab === t.id ? " active" : ""}`}
              onClick={() => { setTab(t.id); setMenuAbierto(false); }}
            >
              <span className="sidebar-icono">{t.icono}</span>
              <span className="sidebar-label">{t.label}</span>
            </button>
          ))}
        </nav>

        <main className="admin-main">
          {tab === "agenda"        && <AgendaSemanalLista profesionales={profesionales} />}
          {tab === "lista"         && <ListaTurnos />}
          {tab === "profesionales" && <GestionProfesionales profesionales={profesionales} onRefresh={cargarProfs} todosServicios={todosServicios} />}
          {tab === "servicios"     && <GestionServicios servicios={servicios} onRefresh={cargarServs} />}
          {tab === "bloqueos"      && <Bloqueos profesionales={profesionales} />}
          {tab === "stats"         && <Estadisticas />}
        </main>
      </div>
    </div>
  );
}