import React, { useState, useEffect } from "react";
import { useApp } from "../App";
import { turnosService, bloqueosService, profesionalesService, serviciosService, configuracionService, authService, generarSlots, hoyISO } from "../firebase/firebase";
import emailjs from "@emailjs/browser";
import "../styles/booking.css";
// Añade esta línea en las importaciones
import { enviarConfirmacion } from "../integrations/emailjs"; // Ajusta la ruta según tu estructura

const STEPS = ["Servicio", "Profesional", "Fecha y hora", "Tus datos", "Confirmación"];

// ─── Helpers ──────────────────────────────────────────────
function formatFecha(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const fecha = new Date(y, m - 1, d);
  return fecha.toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatPrecio(n) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

function getIniciales(nombre) {
  return nombre.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

function getDiasDelMes(year, month) {
  const dias = [];
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  // padding
  for (let i = 0; i < first.getDay(); i++) dias.push(null);
  for (let d = 1; d <= last.getDate(); d++) dias.push(d);
  return dias;
}

async function enviarEmailConfirmacion(turno, empresa) {
  // Generar HTML para campos opcionales
  const precio_row = turno.precio 
    ? `<div class="turno-row"><span>Precio</span><strong>${formatPrecio(turno.precio)}</strong></div>`
    : "";
    
  const notas_row = turno.notas && turno.notas !== "—" && turno.notas.trim() !== ""
    ? `<div class="turno-row"><span>Notas</span><strong>${turno.notas}</strong></div>`
    : "";
    
  const whatsapp_link = empresa.contacto.whatsapp
    ? `https://wa.me/${empresa.contacto.whatsapp.replace(/\D/g, '')}`
    : "javascript:void(0)"; // Enlace nulo si no hay WhatsApp

  const params = {
    cliente_nombre: turno.clienteNombre,
    empresa_nombre: empresa.nombre,
    servicio_nombre: turno.servicioNombre,
    profesional_nombre: turno.profesionalNombre || "Sin preferencia",
    fecha: formatFecha(turno.fechaISO),
    hora: turno.horaInicio,
    precio_row: precio_row,
    notas_row: notas_row,
    turno_id: turno.id?.slice(-6).toUpperCase() || "",
    whatsapp_link: whatsapp_link,
    empresa_telefono: empresa.contacto.telefono || "No disponible",
    empresa_direccion: empresa.contacto.direccion || "No disponible",
  };

  console.log("Parámetros enviados a EmailJS:", params);

  try {
    await emailjs.send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID,
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
      params,
      import.meta.env.VITE_EMAILJS_PUBLIC_KEY
    );
    console.log("Correo enviado exitosamente a:", turno.clienteEmail);
  } catch (error) {
    console.error("Error al enviar correo:", error);
    throw new Error("No se pudo enviar el correo de confirmación.");
  }
}
// ─── Step 1: Selección de servicio ────────────────────────
function StepServicio({ seleccionado, onSelect, servicios }) {
  const { empresa } = useApp();
  const lista = servicios?.length > 0 ? servicios : empresa.servicios;
  return (
    <div className="step-content">
      <h2 className="step-title">¿Qué servicio necesitás?</h2>
      <div className="servicios-grid">
        {lista.map((s) => (
          <button
            key={s.id}
            className={`servicio-card ${seleccionado?.id === s.id ? "selected" : ""}`}
            onClick={() => onSelect(s)}
          >
            <span className="servicio-icono">{s.icono}</span>
            <div className="servicio-info">
              <span className="servicio-nombre">{s.nombre}</span>
              <span className="servicio-desc">{s.descripcion}</span>
              <div className="servicio-meta">
                <span className="servicio-tiempo">⏱ {s.duracion} min</span>
                {empresa.turnos.mostrarPrecio && (
                  <span className="servicio-precio" style={{ color: s.color }}>{formatPrecio(s.precio)}</span>
                )}
              </div>
            </div>
            {seleccionado?.id === s.id && <span className="check-icon">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Selección de profesional ────────────────────
function StepProfesional({ servicio, seleccionado, onSelect, profesionales, sinPreferencia }) {
  return (
    <div className="step-content">
      <h2 className="step-title">Elegí tu profesional</h2>
      {sinPreferencia !== false && (
        <button
          className={`profesional-card ${seleccionado?.id === "cualquiera" ? "selected" : ""}`}
          onClick={() => onSelect({ id: "cualquiera", nombre: "El primero disponible", especialidad: "Cualquier profesional disponible" })}
        >
          <div className="prof-avatar cualquiera">?</div>
          <div className="prof-info">
            <span className="prof-nombre">Sin preferencia</span>
            <span className="prof-esp">El primero disponible</span>
          </div>
          {seleccionado?.id === "cualquiera" && <span className="check-icon">✓</span>}
        </button>
      )}
      {profesionales.map((p) => (
        <button
          key={p.id}
          className={`profesional-card ${seleccionado?.id === p.id ? "selected" : ""}`}
          onClick={() => onSelect(p)}
        >
          <div className="prof-avatar">{getIniciales(p.nombre)}</div>
          <div className="prof-info">
            <span className="prof-nombre">{p.nombre}</span>
            <span className="prof-esp">{p.especialidad}</span>
            {p.bio && <span className="prof-bio">{p.bio}</span>}
          </div>
          {seleccionado?.id === p.id && <span className="check-icon">✓</span>}
        </button>
      ))}
    </div>
  );
}

// ─── Step 3: Fecha y hora ─────────────────────────────────
function StepFechaHora({ servicio, profesional, fechaSeleccionada, horaSeleccionada, onSelect }) {
  const { empresa } = useApp();
  const hoy = new Date();
  const [viewYear, setViewYear] = useState(hoy.getFullYear());
  const [viewMonth, setViewMonth] = useState(hoy.getMonth());
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bloqueosActivos, setBloqueosActivos] = useState([]);
  const [avisoBloqueado, setAvisoBloqueado] = useState(null); // { motivo }

  const diasMes = getDiasDelMes(viewYear, viewMonth);
  const diasSemana = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
  const nombresMes = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  useEffect(() => {
    bloqueosService.obtenerTodos().then(setBloqueosActivos).catch(console.error);
  }, []);

  function getFechaISO(dia) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }

  function getBloqueoCompleto(dia) {
    if (!dia) return null;
    const iso = getFechaISO(dia);
    const [y, m, d] = iso.split("-").map(Number);
    const diaSemana = new Date(y, m - 1, d).getDay();
    return bloqueosActivos.find(b =>
      (b.tipo === "dia" && b.fecha === iso && !b.horaInicio) ||
      (b.tipo === "diaRepetido" && b.diaSemana === diaSemana && !b.horaInicio)
    ) || null;
  }

  function isDiaDisponible(dia) {
    if (!dia) return false;
    const d = new Date(viewYear, viewMonth, dia);
    const hoyInicio = new Date(); hoyInicio.setHours(0, 0, 0, 0);
    const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + empresa.turnos.anticipacionMaxDias);
    if (d < hoyInicio) return false;
    if (d > maxDate) return false;
    if (!empresa.horarios.diasHabiles.includes(d.getDay())) return false;
    const iso = getFechaISO(dia);
    if (empresa.horarios.diasBloqueados.includes(iso)) return false;
    if (getBloqueoCompleto(dia)) return false;
    return true;
  }

  async function cargarSlots(fechaISO) {
    setLoadingSlots(true);
    try {
      const turnosDelDia = await turnosService.obtenerPorFecha(fechaISO);
      const bloqueos = await bloqueosService.obtenerPorFecha(fechaISO);
      const turnosFiltrados = profesional?.id && profesional.id !== "cualquiera"
        ? turnosDelDia.filter(t => t.profesionalId === profesional.id)
        : turnosDelDia;
      const duracion = servicio?.duracion || empresa.horarios.duracionTurnoMin;
      const generados = generarSlots(
        empresa.horarios.horaApertura,
        empresa.horarios.horaCierre,
        duracion,
        turnosFiltrados,
        bloqueos
      );

      // Bloquear slots pasados cuando el día seleccionado es hoy
      const esHoy = fechaISO === hoyISO();
      const slotsFinal = esHoy
        ? (() => {
            const ahora = new Date();
            const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
            return generados.map(slot => {
              const [h, m] = slot.hora.split(":").map(Number);
              return (h * 60 + m) <= minAhora
                ? { ...slot, disponible: false }
                : slot;
            });
          })()
        : generados;

      setSlots(slotsFinal);
    } catch (e) {
      console.error(e);
      setSlots([]);
    }
    setLoadingSlots(false);
  }

  function seleccionarDia(dia) {
    if (!dia) return;
    const bloqueo = getBloqueoCompleto(dia);
    if (bloqueo || !isDiaDisponible(dia)) {
      if (bloqueo) setAvisoBloqueado(bloqueo);
      return;
    }
    setAvisoBloqueado(null);
    const iso = getFechaISO(dia);
    onSelect(iso, null);
    cargarSlots(iso);
  }

  function prevMes() {
    setAvisoBloqueado(null);
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMes() {
    setAvisoBloqueado(null);
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  return (
    <div className="step-content">
      <h2 className="step-title">Elegí fecha y hora</h2>
      <div className="calendario-container">
        <div className="cal-header">
          <button className="cal-nav" onClick={prevMes}>‹</button>
          <span className="cal-mes">{nombresMes[viewMonth]} {viewYear}</span>
          <button className="cal-nav" onClick={nextMes}>›</button>
        </div>
        <div className="cal-grid-header">
          {diasSemana.map(d => <span key={d} className="cal-dia-nombre">{d}</span>)}
        </div>
        <div className="cal-grid">
          {diasMes.map((dia, i) => {
            const iso = dia ? getFechaISO(dia) : null;
            const esSeleccionado = iso === fechaSeleccionada;
            const disponible = isDiaDisponible(dia);
            const bloqueo = dia ? getBloqueoCompleto(dia) : null;
            return (
              <button
                key={i}
                className={`cal-dia ${!dia ? "vacio" : ""} ${disponible ? "disponible" : "bloqueado"} ${bloqueo ? "bloqueado-db" : ""} ${esSeleccionado ? "selected" : ""}`}
                onClick={() => seleccionarDia(dia)}
                title={bloqueo ? bloqueo.motivo : undefined}
              >
                {dia}
              </button>
            );
          })}
        </div>

        {avisoBloqueado && (
          <div className="cal-aviso-bloqueo">
            <span className="cal-aviso-icono">🔒</span>
            <span>{avisoBloqueado.motivo || "Día no disponible"}</span>
            <button className="cal-aviso-cerrar" onClick={() => setAvisoBloqueado(null)}>✕</button>
          </div>
        )}
      </div>

      {fechaSeleccionada && !avisoBloqueado && (
        <div className="slots-section">
          <h3 className="slots-titulo">Horarios disponibles — {formatFecha(fechaSeleccionada)}</h3>
          {loadingSlots ? (
            <div className="slots-loading">Cargando horarios...</div>
          ) : slots.length === 0 ? (
            <p className="slots-vacio">No hay horarios disponibles para este día.</p>
          ) : (
            <div className="slots-grid">
              {slots.map((slot) => (
                <button
                  key={slot.hora}
                  className={`slot-btn ${!slot.disponible ? "ocupado" : ""} ${horaSeleccionada === slot.hora ? "selected" : ""}`}
                  onClick={() => slot.disponible && onSelect(fechaSeleccionada, slot.hora)}
                  disabled={!slot.disponible}
                >
                  {slot.hora}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Datos del cliente ────────────────────────────
function StepDatos({ datos, onChange, camposExtra, isClient }) {
  const campos = [
    { id: "nombre", label: "Nombre completo", tipo: "text", requerido: true, placeholder: "Juan Pérez", readOnly: isClient },
    { id: "email", label: "Email", tipo: "email", requerido: true, placeholder: "juan@email.com", readOnly: isClient },
    { id: "telefono", label: "Teléfono / WhatsApp", tipo: "tel", requerido: false, placeholder: "+54 11 1234-5678" },
    { id: "notas", label: "Notas adicionales", tipo: "textarea", requerido: false, placeholder: "¿Alguna aclaración para el turno?" },
    ...camposExtra,
  ];

  return (
    <div className="step-content">
      <h2 className="step-title">Tus datos</h2>
      {isClient && (
        <div style={{
          background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.2)",
          borderRadius: 10, padding: "10px 16px", marginBottom: 16,
          fontSize: 13, color: "#4338ca", display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>✓</span>
          <span>Datos precargados de tu cuenta. Podés modificarlos desde "Mis Datos".</span>
        </div>
      )}
      <div className="form-campos">
        {campos.map((campo) => (
          <div key={campo.id} className="form-grupo">
            <label className="form-label">
              {campo.label}
              {campo.requerido && <span className="requerido">*</span>}
            </label>
            {campo.tipo === "textarea" ? (
              <textarea
                className="form-input"
                value={datos[campo.id] || ""}
                onChange={e => onChange({ ...datos, [campo.id]: e.target.value })}
                placeholder={campo.placeholder}
                rows={3}
              />
            ) : (
              <input
                className="form-input"
                type={campo.tipo}
                value={datos[campo.id] || ""}
                onChange={e => !campo.readOnly && onChange({ ...datos, [campo.id]: e.target.value })}
                placeholder={campo.placeholder}
                required={campo.requerido}
                readOnly={campo.readOnly}
                style={campo.readOnly ? { opacity: 0.7, cursor: "default" } : undefined}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 5: Confirmación ────────────────────────────────
function StepConfirmacion({ turnoId, servicio, profesional, fecha, hora, datos, isClient }) {
  const { empresa, navigate } = useApp();
  return (
    <div className="step-content confirmacion-step">
      <div className="confirmacion-icono">✓</div>
      <h2 className="confirmacion-titulo">¡Turno confirmado!</h2>
      <p className="confirmacion-sub">Se envió la confirmación a <strong>{datos.email}</strong></p>
      <div className="confirmacion-card">
        <div className="conf-row"><span>Empresa</span><strong>{empresa.nombre}</strong></div>
        <div className="conf-row"><span>Servicio</span><strong>{servicio?.nombre}</strong></div>
        <div className="conf-row"><span>Profesional</span><strong>{profesional?.id === "cualquiera" ? "Sin preferencia" : profesional?.nombre}</strong></div>
        <div className="conf-row"><span>Fecha</span><strong>{formatFecha(fecha)}</strong></div>
        <div className="conf-row"><span>Hora</span><strong>{hora}hs</strong></div>
        <div className="conf-row"><span>Nombre</span><strong>{datos.nombre}</strong></div>
        {turnoId && <div className="conf-row"><span>Nro. turno</span><strong className="turno-id">#{turnoId.slice(-6).toUpperCase()}</strong></div>}
      </div>
      {empresa.contacto.whatsapp && (
        <a
          href={`https://wa.me/${empresa.contacto.whatsapp}?text=Hola! Soy ${datos.nombre}, tengo turno el ${formatFecha(fecha)} a las ${hora}hs para ${servicio?.nombre}`}
          className="btn-whatsapp"
          target="_blank"
          rel="noopener noreferrer"
        >
          💬 Confirmar por WhatsApp
        </a>
      )}
      {isClient ? (
        <button className="btn-nuevo-turno" onClick={() => navigate("mis-turnos")}>
          Ver mis turnos
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
          <button className="btn-nuevo-turno" onClick={() => window.location.reload()}>
            Sacar otro turno
          </button>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
            ¿Querés ver el historial de tus turnos?{" "}
            <button
              style={{ background: "none", border: "none", color: "var(--color-accent)", cursor: "pointer", fontSize: 13, fontFamily: "inherit", padding: 0 }}
              onClick={() => navigate("auth")}
            >
              Creá una cuenta
            </button>
            {" "}y este turno quedará guardado en tu perfil.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────
export default function BookingFlow() {
  const { empresa, navigate, user, isClient } = useApp();
  const [step, setStep] = useState(0);
  const [servicio, setServicio] = useState(null);
  const [profesional, setProfesional] = useState(null);
  const [fecha, setFecha] = useState(null);
  const [hora, setHora] = useState(null);
  const [datosCliente, setDatosCliente] = useState(() => ({
    nombre: user?.displayName || "",
    email: user?.email || "",
  }));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    authService.obtenerPerfil(user.uid).then(perfil => {
      setDatosCliente(d => ({
        ...d,
        nombre: d.nombre || perfil?.nombre || user.displayName || "",
        email:  d.email  || perfil?.email  || user.email || "",
        ...(perfil?.telefono ? { telefono: perfil.telefono } : {}),
      }));
    }).catch(() => {});
  }, [user?.uid]);
  const [turnoId, setTurnoId] = useState(null);
  const [error, setError] = useState(null);
  const [profesionales,       setProfesionales]       = useState([]);
  const [servicios,           setServicios]           = useState([]);
  const [sinPreferencia,      setSinPreferencia]      = useState(true);
  const [loadingProfesionales, setLoadingProfesionales] = useState(true);

  const pasoActual = turnoId ? 4 : step;

  // Cargar profesionales, servicios y config desde Firestore
  useEffect(() => {
    async function cargarDatos() {
      const [profsRes, servsRes, configRes] = await Promise.allSettled([
        profesionalesService.obtenerTodos(),
        serviciosService.obtenerTodos(),
        configuracionService.obtener(),
      ]);
      if (profsRes.status === "fulfilled") {
        const activos = profsRes.value.filter(p => p.activo !== false);
        setProfesionales(activos.length > 0 ? activos : (empresa.profesionales || []));
      } else {
        setProfesionales(empresa.profesionales || []);
      }
      if (servsRes.status === "fulfilled") {
        const activos = servsRes.value.filter(s => s.activo !== false);
        setServicios(activos.length > 0 ? activos : empresa.servicios);
      } else {
        setServicios(empresa.servicios);
      }
      if (configRes.status === "fulfilled") {
        setSinPreferencia(configRes.value.sinPreferencia !== false);
      }
      setLoadingProfesionales(false);
    }
    cargarDatos();
  }, []);

  function puedeAvanzar() {
    if (step === 0) return !!servicio;
    if (step === 1) return !!profesional;
    if (step === 2) return !!fecha && !!hora;
    if (step === 3) {
      const nombreValido = datosCliente.nombre?.trim();
      const emailValido = datosCliente.email?.trim();
      return !!(nombreValido && emailValido);
    }
    return false;
  }

async function confirmar() {
  setLoading(true);
  setError(null);
  try {
    // Validación adicional del email
    const email = datosCliente.email?.trim();
    if (!email) {
      throw new Error("El email es obligatorio");
    }
    
    // Validación de formato
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("El formato del email no es válido");
    }

    const turnoData = {
      clienteNombre: datosCliente.nombre,
      clienteEmail: email,
      clienteTelefono: datosCliente.telefono || "",
      clienteUid: user?.uid || null,
      notas: datosCliente.notas || "",
      servicioId: servicio.id,
      servicioNombre: servicio.nombre,
      profesionalId: profesional.id !== "cualquiera" ? profesional.id : null,
      profesionalNombre: profesional.id !== "cualquiera" ? profesional.nombre : "Sin preferencia",
      fechaISO: fecha,
      horaInicio: hora,
      horaFin: calcularFin(hora, servicio.duracion),
      precio: servicio.precio,
      camposExtra: Object.fromEntries(
        empresa.turnos.camposExtra.map(c => [c.id, datosCliente[c.id] || ""])
      ),
    };
    
    const id = await turnosService.crear(turnoData);
    setTurnoId(id);

    if (user && datosCliente.telefono?.trim()) {
      authService.actualizarPerfil(user.uid, { telefono: datosCliente.telefono.trim() }).catch(() => {});
    }

    if (empresa.notificaciones.emailConfirmacion) {
      await enviarConfirmacion({ ...turnoData, id }, empresa);
    }
  } catch (e) {
    console.error("Error al guardar turno:", e);
    setError(e.message || "Hubo un error al guardar el turno. Intentá de nuevo.");
  } finally {
    setLoading(false);
  }
}

  function calcularFin(horaInicio, duracionMin) {
    const [h, m] = horaInicio.split(":").map(Number);
    const fin = h * 60 + m + duracionMin;
    return `${String(Math.floor(fin / 60)).padStart(2, "0")}:${String(fin % 60).padStart(2, "0")}`;
  }

  return (
    <div className="booking-root">
      {/* Header */}
      <header className="booking-header">
        <div className="header-brand">
          {empresa.logo
            ? <img src={empresa.logo} alt={empresa.nombre} className="brand-logo" />
            : <div className="brand-iniciales">{empresa.iniciales}</div>
          }
          <div>
            <div className="brand-nombre">{empresa.nombre}</div>
            {empresa.slogan && <div className="brand-slogan">{empresa.slogan}</div>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isClient ? (
            <button className="btn-admin-link" onClick={() => navigate("mis-turnos")}>
              Mis turnos
            </button>
          ) : (
            <button className="btn-admin-link" onClick={() => navigate("auth")}>
              Mi cuenta
            </button>
          )}
          <button className="btn-admin-link" onClick={() => navigate("login-admin")}>Admin</button>
        </div>
      </header>

      {/* Progress */}
      {!turnoId && (
        <div className="progress-bar-wrapper">
                      {step === 0 && !turnoId && (
              <div style={{
                background: "linear-gradient(135deg, #ede9fe, #ddd6fe)",
                border: "1.5px solid #a78bfa",
                borderRadius: 12, margin: "16px 28px 0",
                padding: "12px 20px", display: "flex", alignItems: "center", gap: 12
              }}>
                <span style={{fontSize:24}}>🎉</span>
                <div>
                  <strong style={{color:"#5b21b6",fontSize:15}}>¡No necesitás cuenta!</strong>
                  <div style={{fontSize:13,color:"#7c3aed"}}>Podés sacar tu turno sin registrarte. Solo completá tus datos al final.</div>
                </div>
              </div>
            )}
          <div className="progress-steps">
            {STEPS.map((s, i) => (
              <div key={i} className={`progress-step ${i <= step ? "active" : ""} ${i < step ? "done" : ""}`}>
                <div className="step-dot">{i < step ? "✓" : i + 1}</div>
                <span className="step-label">{s}</span>
              </div>
            ))}
          </div>
          <div className="progress-line">
            <div className="progress-fill" style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Contenido del paso */}
      <main className="booking-main">
        {turnoId ? (
          <StepConfirmacion
            turnoId={turnoId}
            servicio={servicio}
            profesional={profesional}
            fecha={fecha}
            hora={hora}
            datos={datosCliente}
            isClient={isClient}
          />
        ) : (
          <>
            {step === 0 && <StepServicio seleccionado={servicio} onSelect={s => { setServicio(s); setStep(1); }} servicios={servicios} />}
            {step === 1 && (
              loadingProfesionales ? (
                <div className="step-content">Cargando profesionales...</div>
              ) : (
                <StepProfesional
                  servicio={servicio}
                  seleccionado={profesional}
                  onSelect={setProfesional}
                  sinPreferencia={sinPreferencia}
                  profesionales={profesionales.filter(
                    p => !servicio || !p.serviciosQueAtiende?.length || p.serviciosQueAtiende.includes(servicio.id)
                  )}
                />
              )
            )}
            {step === 2 && <StepFechaHora servicio={servicio} profesional={profesional} fechaSeleccionada={fecha} horaSeleccionada={hora} onSelect={(f, h) => { setFecha(f); setHora(h); }} />}
            {step === 3 && <StepDatos datos={datosCliente} onChange={setDatosCliente} camposExtra={empresa.turnos.camposExtra} isClient={isClient} />}
          </>
        )}

        {error && <p className="error-msg">{error}</p>}

        {/* Navegación */}
        {!turnoId && (
          <div className="booking-nav">
            {step > 0 && (
              <button className="btn-back" onClick={() => setStep(s => s - 1)}>← Volver</button>
            )}
            {step < 3 && (
              <button className="btn-next" onClick={() => setStep(s => s + 1)} disabled={!puedeAvanzar()}>
                Siguiente →
              </button>
            )}
            {step === 3 && (
              <button className="btn-confirm" onClick={confirmar} disabled={!puedeAvanzar() || loading}>
                {loading ? "Confirmando..." : "✓ Confirmar turno"}
              </button>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="booking-footer">
        {empresa.contacto.telefono && <span>📞 {empresa.contacto.telefono}</span>}
        {empresa.contacto.instagram && <span>📸 {empresa.contacto.instagram}</span>}
        {empresa.contacto.direccion && <span>📍 {empresa.contacto.direccion}</span>}
      </footer>
    </div>
  );
}