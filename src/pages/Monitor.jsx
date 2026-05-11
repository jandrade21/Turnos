import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection, query, where, onSnapshot, getDocs,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useApp } from "../App";
import "../styles/monitor.css";

// ── Constantes de free tier ────────────────────────────────
const FB = {
  readsDay:   50_000,
  writesDay:  20_000,
  storageMB:  1024,
};
const DIAS_MES = 30;
const FB_READS_MES  = FB.readsDay  * DIAS_MES;   // 1 500 000
const FB_WRITES_MES = FB.writesDay * DIAS_MES;   //   600 000

const EJ_PLANES = [
  { nombre: "Free",         precio: 0,  limite:  200   },
  { nombre: "Personal",     precio: 9,  limite:  2000  },
  { nombre: "Professional", precio: 15, limite:  5000  },
  { nombre: "Business",     precio: 40, limite: 200000 },
];

// ── Helpers ───────────────────────────────────────────────
function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function inicioMesISO() {
  const h = new Date(); return toISO(new Date(h.getFullYear(), h.getMonth(), 1));
}
function inicioSemanaISO() {
  const h = new Date(), d = new Date(h);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff); return toISO(d);
}
function pct(val, total) { return total > 0 ? Math.min(100, (val / total) * 100) : 0; }
function barClass(p) { return p >= 85 ? "danger" : p >= 60 ? "warn" : "safe"; }
function badgeClass(p) { return p >= 85 ? "danger" : p >= 60 ? "warn" : "ok"; }
function fmtNum(n) { return n >= 1_000_000 ? `${(n/1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n); }
function fmtTs(d) {
  return d ? d.toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit", second:"2-digit" }) : "—";
}

function ultimos7ISOList() {
  const hoy = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() - (6 - i));
    return toISO(d);
  });
}

// ── Niveles de tráfico ────────────────────────────────────
function nivelTrafico(promedioDiario) {
  if (promedioDiario >= 150) return "alto";
  if (promedioDiario >= 50)  return "moderado";
  return "bajo";
}

const NIVEL_INFO = {
  bajo: {
    icono: "🟢",
    titulo: "Tráfico bajo — todo dentro del free tier",
    desc: "Menos de 50 turnos/día. Firebase y EmailJS gratuitos. Sin costo operativo.",
    costoEstim: "~$0/mes",
    accion: null,
  },
  moderado: {
    icono: "🟡",
    titulo: "Tráfico moderado — EmailJS necesita plan pago",
    desc: "Entre 50 y 150 turnos/día. Firebase sigue en free tier. EmailJS requiere plan Personal ($9/mes) para no quedar sin envíos.",
    costoEstim: "~$9–11/mes",
    accion: "Actualizá EmailJS al plan Personal antes de que se corte el envío.",
  },
  alto: {
    icono: "🔴",
    titulo: "Tráfico alto — revisá ambos servicios",
    desc: "Más de 150 turnos/día. EmailJS requiere plan Professional ($15/mes). Firebase puede comenzar a generar costos.",
    costoEstim: "~$17–23/mes",
    accion: "Actualizá EmailJS al plan Professional y activá alertas de presupuesto en Firebase Console.",
  },
};

// ── Alertas activas ───────────────────────────────────────
function generarAlertas({ nivel, promedioDiario, pReads, pWrites, pEmailJS, planActual, planSig, ejEmailsMes, turnosProyectados, emailsProyectados }) {
  const alertas = [];

  if (nivel === "alto") {
    alertas.push({
      tipo: "danger", icono: "🚨",
      titulo: "Tráfico ALTO — acción requerida",
      msg: `Promedio de ${Math.round(promedioDiario)} turnos/día. EmailJS en plan ${planActual.nombre} puede no alcanzar. Proyección fin de mes: ${turnosProyectados} turnos y ${emailsProyectados} emails.`,
    });
  } else if (nivel === "moderado") {
    alertas.push({
      tipo: "warn", icono: "⚠️",
      titulo: "Tráfico MODERADO — revisar plan EmailJS",
      msg: `Promedio de ${Math.round(promedioDiario)} turnos/día. Con plan Free de EmailJS (200 emails/mes) los emails de confirmación se cortarán. Actualizá al plan Personal ($9/mes).`,
    });
  }

  if (pEmailJS >= 90) {
    alertas.push({
      tipo: "danger", icono: "🚨",
      titulo: `EmailJS: ${pEmailJS.toFixed(0)}% del límite — CAMBIÁ DE PLAN YA`,
      msg: `${ejEmailsMes} de ${planActual.limite.toLocaleString()} emails del plan ${planActual.nombre}. ${planSig ? `Actualizá URGENTE al plan ${planSig.nombre} ($${planSig.precio}/mes) para no perder envíos.` : "Contactá a EmailJS para un plan Enterprise."}`,
    });
  } else if (pEmailJS >= 70) {
    alertas.push({
      tipo: "warn", icono: "⚠️",
      titulo: `EmailJS: ${pEmailJS.toFixed(0)}% del plan ${planActual.nombre} — próximo cambio de plan`,
      msg: planSig
        ? `Quedan ${(planActual.limite - ejEmailsMes).toLocaleString()} emails disponibles este mes. Considerá subir al plan ${planSig.nombre} ($${planSig.precio}/mes) antes de agotar el límite.`
        : "Estás usando más del 70% del plan máximo. Revisá el uso real en emailjs.com.",
    });
  } else if (pEmailJS >= 50 && planActual.precio === 0) {
    alertas.push({
      tipo: "warn", icono: "⚠️",
      titulo: "EmailJS: más de la mitad del plan Free usado",
      msg: `Usaste ${ejEmailsMes} de 200 emails gratis. Si superás el límite, los emails se bloquean sin aviso. Con el ritmo actual proyectás ${emailsProyectados} emails este mes.`,
    });
  }

  if (pReads >= 85) {
    alertas.push({
      tipo: "danger", icono: "🚨",
      titulo: `Firebase Reads: ${pReads.toFixed(0)}% del free tier`,
      msg: "Reads muy cercanos al límite gratuito (1.5M/mes). Revisá Firebase Console → Usage → Firestore y optimizá consultas. Activá alerta de presupuesto.",
    });
  } else if (pReads >= 60) {
    alertas.push({
      tipo: "warn", icono: "⚠️",
      titulo: `Firebase Reads: ${pReads.toFixed(0)}% del free tier`,
      msg: "Reads en zona amarilla. Monitoreá el crecimiento durante los próximos días. El free tier es 50K reads/día.",
    });
  }

  if (pWrites >= 85) {
    alertas.push({
      tipo: "danger", icono: "🚨",
      titulo: `Firebase Writes: ${pWrites.toFixed(0)}% del free tier`,
      msg: "Writes cercanos al límite (600K/mes). Revisá si hay escrituras redundantes o innecesarias en el código.",
    });
  } else if (pWrites >= 60) {
    alertas.push({
      tipo: "warn", icono: "⚠️",
      titulo: `Firebase Writes: ${pWrites.toFixed(0)}% del free tier`,
      msg: "Writes en zona amarilla. El free tier cubre 20K writes/día.",
    });
  }

  if (emailsProyectados > planActual.limite) {
    const planNecesario = EJ_PLANES.find(p => emailsProyectados <= p.limite);
    alertas.push({
      tipo: "danger", icono: "📧",
      titulo: `Proyección: necesitás cambiar al plan ${planNecesario?.nombre ?? "superior"} de EmailJS`,
      msg: planNecesario
        ? `Con el ritmo actual proyectás ${emailsProyectados} emails, superando el límite del plan ${planActual.nombre} (${planActual.limite.toLocaleString()}). Necesitás el plan ${planNecesario.nombre} ($${planNecesario.precio}/mes) para cubrir el mes.`
        : `Proyectás ${emailsProyectados} emails este mes, superando todos los planes estándar. Contactá a EmailJS.`,
    });
  }

  if (alertas.length === 0) {
    alertas.push({
      tipo: "ok", icono: "✅",
      titulo: "Todo en orden",
      msg: "Todos los consumos están dentro de los límites seguros. No se requiere acción.",
    });
  }

  return alertas;
}

// ── SVG: Donut de estados ─────────────────────────────────
function DonutChart({ confirmados, cancelados }) {
  const total = confirmados + cancelados;
  if (total === 0) return <div className="mon-chart-empty">Sin datos este mes</div>;

  const r = 40, cx = 55, cy = 55, circ = 2 * Math.PI * r;
  const pConf = confirmados / total;
  const pCanc = cancelados / total;

  const arcConf = pConf * circ;
  const arcCanc = pCanc * circ;

  return (
    <div className="mon-donut-wrap">
      <svg viewBox="0 0 110 110" className="mon-donut-svg">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={13} />
        {confirmados > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke="#10b981" strokeWidth={13}
            strokeDasharray={`${arcConf} ${circ - arcConf}`}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray .7s cubic-bezier(.4,0,.2,1)" }}
          />
        )}
        {cancelados > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke="#ef4444" strokeWidth={13}
            strokeDasharray={`${arcCanc} ${circ - arcCanc}`}
            strokeLinecap="butt"
            transform={`rotate(${-90 + pConf * 360} ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray .7s cubic-bezier(.4,0,.2,1)" }}
          />
        )}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#e2e8f0"
          style={{ fontSize: 18, fontWeight: 700, fontFamily: "inherit" }}>{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#64748b"
          style={{ fontSize: 9, fontFamily: "inherit" }}>turnos</text>
      </svg>
      <div className="mon-donut-legend">
        <div className="mon-donut-leg-item">
          <span className="mon-donut-dot" style={{ background: "#10b981" }} />
          <span>Confirmados</span>
          <strong>{confirmados}</strong>
        </div>
        <div className="mon-donut-leg-item">
          <span className="mon-donut-dot" style={{ background: "#ef4444" }} />
          <span>Cancelados</span>
          <strong>{cancelados}</strong>
        </div>
        <div className="mon-donut-leg-item" style={{ marginTop: 4, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 8 }}>
          <span className="mon-donut-dot" style={{ background: "#64748b" }} />
          <span>Tasa cancel.</span>
          <strong style={{ fontSize: 14 }}>
            {total > 0 ? `${Math.round((cancelados / total) * 100)}%` : "0%"}
          </strong>
        </div>
      </div>
    </div>
  );
}

// ── SVG: Barras últimos 7 días ────────────────────────────
function BarChart7Dias({ datos }) {
  if (!datos || datos.every(d => d.valor === 0)) {
    return <div className="mon-chart-empty">Sin actividad en los últimos 7 días</div>;
  }

  const max = Math.max(...datos.map(d => d.valor), 1);
  const W = 420, H = 90, padTop = 20, barW = 38, gap = (W - datos.length * barW) / (datos.length + 1);

  const DIAS_ES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

  return (
    <svg viewBox={`0 0 ${W} ${H + padTop + 28}`} className="mon-chart-svg">
      {datos.map((d, i) => {
        const x = Math.round(gap + i * (barW + gap));
        const barH = d.valor === 0 ? 3 : Math.max(6, (d.valor / max) * H);
        const y = padTop + H - barH;
        const fill = d.esHoy ? "#e94560" : "#3b82f6";
        const opacity = d.esHoy ? 1 : d.valor === 0 ? 0.2 : 0.65;

        return (
          <g key={d.fecha}>
            <rect x={x} y={y} width={barW} height={barH} rx={5}
              fill={fill} opacity={opacity}
              style={{ transition: "height .5s cubic-bezier(.4,0,.2,1)" }}
            />
            {d.valor > 0 && (
              <text x={x + barW / 2} y={y - 5} textAnchor="middle"
                fill={d.esHoy ? "#e94560" : "#94a3b8"}
                style={{ fontSize: 10, fontWeight: d.esHoy ? 700 : 500, fontFamily: "inherit" }}>
                {d.valor}
              </text>
            )}
            <text x={x + barW / 2} y={padTop + H + 14} textAnchor="middle"
              fill={d.esHoy ? "#e94560" : "#64748b"}
              style={{ fontSize: 10, fontWeight: d.esHoy ? 700 : 400, fontFamily: "inherit" }}>
              {DIAS_ES[new Date(d.fecha + "T12:00:00").getDay()]}
            </text>
            <text x={x + barW / 2} y={padTop + H + 26} textAnchor="middle"
              fill={d.esHoy ? "#e94560" : "#374151"}
              style={{ fontSize: 9, fontFamily: "inherit" }}>
              {d.fecha.slice(8)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── SVG: Gauge semicircular ───────────────────────────────
function Gauge({ pct: p, label, colorFill }) {
  const safeP = Math.min(100, Math.max(0, p));
  const r = 38, cx = 60, cy = 55;
  const circ = Math.PI * r; // semicírculo
  const fill = (safeP / 100) * circ;
  const color = colorFill || (safeP >= 85 ? "#ef4444" : safeP >= 60 ? "#f59e0b" : "#10b981");

  return (
    <div className="mon-gauge-wrap">
      <svg viewBox="0 0 120 65" className="mon-gauge-svg">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={11} strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke={color} strokeWidth={11} strokeLinecap="round"
          strokeDasharray={`${fill} ${circ - fill}`}
          style={{ transition: "stroke-dasharray .7s cubic-bezier(.4,0,.2,1)" }}
        />
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#e2e8f0"
          style={{ fontSize: 14, fontWeight: 700, fontFamily: "inherit" }}>
          {safeP.toFixed(1)}%
        </text>
      </svg>
      <div className="mon-gauge-label">{label}</div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────
export default function Monitor() {
  const { isAdmin, navigate } = useApp();

  const [cargando,    setCargando]    = useState(true);
  const [lastUpdate,  setLastUpdate]  = useState(null);
  const [stats,       setStats]       = useState(null);
  const [emailsXturno, setEmailsXturno] = useState(1);
  const unsubRef = useRef(null);

  const [colecciones, setColecciones] = useState(null);
  const cargarColecciones = useCallback(async () => {
    const [profs, servs, bloqueos, usuarios] = await Promise.allSettled([
      getDocs(query(collection(db, "profesionales"))),
      getDocs(query(collection(db, "servicios"))),
      getDocs(collection(db, "bloqueos")),
      getDocs(collection(db, "usuarios")),
    ]);
    const safe = (r) => r.status === "fulfilled" ? r.value.docs : [];

    const profsDocs    = safe(profs);
    const servsDocs    = safe(servs);
    const bloqueosDocs = safe(bloqueos);
    const usuariosDocs = safe(usuarios);

    setColecciones({
      profesionales: { total: profsDocs.length, activos: profsDocs.filter(d => d.data().activo !== false).length },
      servicios:     { total: servsDocs.length,  activos: servsDocs.filter(d => d.data().activo !== false).length },
      bloqueos:      { total: bloqueosDocs.length },
      usuarios:      { total: usuariosDocs.length, admins: usuariosDocs.filter(d => d.data().rol === "admin").length },
    });
  }, []);

  const suscribir = useCallback((xt) => {
    if (unsubRef.current) unsubRef.current();

    const hoyISO    = toISO(new Date());
    const mesISO    = inicioMesISO();
    const semanaISO = inicioSemanaISO();
    const dias7     = ultimos7ISOList();

    const q = query(collection(db, "turnos"), where("fechaISO", ">=", mesISO));

    unsubRef.current = onSnapshot(q, (snap) => {
      const todos   = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const hoy     = todos.filter(t => t.fechaISO === hoyISO);
      const semana  = todos.filter(t => t.fechaISO >= semanaISO);
      const mesTotal = todos.length;

      const estados = todos.reduce((acc, t) => {
        acc[t.estado || "confirmado"] = (acc[t.estado || "confirmado"] || 0) + 1;
        return acc;
      }, {});

      const xServicio = {};
      todos.forEach(t => {
        const k = t.servicioNombre || t.servicioId || "Sin servicio";
        xServicio[k] = (xServicio[k] || 0) + 1;
      });

      const xProf = {};
      todos.forEach(t => {
        const k = t.profesionalNombre || t.profesionalId || "Sin asignar";
        xProf[k] = (xProf[k] || 0) + 1;
      });

      // Últimos 7 días
      const datos7dias = dias7.map(fecha => ({
        fecha,
        valor: todos.filter(t => t.fechaISO === fecha && t.estado !== "cancelado").length,
        esHoy: fecha === hoyISO,
      }));

      const turnosConf  = todos.filter(t => t.estado !== "cancelado").length;
      const estimReads  = (mesTotal * 15) + (turnosConf * 5) + (40 * 50);
      const estimWrites = mesTotal * 8;
      const totalDocs   = mesTotal + 200;
      const estimStorage = (totalDocs * 1.5) / 1024;
      const emailsEstim  = turnosConf * xt;

      setStats({
        turnos: {
          hoy: hoy.length,
          semana: semana.length,
          mes: mesTotal,
          confirmados: estados.confirmado || 0,
          cancelados:  estados.cancelado  || 0,
        },
        datos7dias,
        xServicio,
        xProf,
        firebase: { estimReads, estimWrites, estimStorage },
        emailjs:  { emailsEstim },
      });
      setLastUpdate(new Date());
      setCargando(false);
    }, (err) => {
      console.warn("Monitor onSnapshot:", err);
      setCargando(false);
    });
  }, []);

  useEffect(() => {
    suscribir(emailsXturno);
    cargarColecciones();
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []); // eslint-disable-line

  const refrescar = () => {
    setCargando(true);
    suscribir(emailsXturno);
    cargarColecciones();
  };

  // ── Guard: solo admin ──────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="mon-root" style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div className="mon-alert danger" style={{ maxWidth: 360, marginTop: 80 }}>
          <span>🔒</span>
          <span>Acceso restringido. Necesitás sesión de administrador para ver el monitor.</span>
        </div>
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="mon-root">
        <div className="mon-loading">
          <div className="mon-spinner" />
          <span>Conectando con Firebase en tiempo real...</span>
        </div>
      </div>
    );
  }

  const { turnos, datos7dias, xServicio, xProf, firebase, emailjs } = stats;
  const col = colecciones || {};

  const pReads   = pct(firebase.estimReads,   FB_READS_MES);
  const pWrites  = pct(firebase.estimWrites,  FB_WRITES_MES);
  const pStorage = pct(firebase.estimStorage, FB.storageMB);

  const ejEmailsMes = emailjs.emailsEstim;
  const planActual  = EJ_PLANES.find(p => ejEmailsMes <= p.limite) || EJ_PLANES[EJ_PLANES.length - 1];
  const planSig     = EJ_PLANES[EJ_PLANES.indexOf(planActual) + 1];
  const pEmailJS    = pct(ejEmailsMes, planActual.limite);

  const hoyDate           = new Date();
  const diasTranscurridos = hoyDate.getDate();
  const diasEnMes         = new Date(hoyDate.getFullYear(), hoyDate.getMonth() + 1, 0).getDate();
  const promedioDiario    = diasTranscurridos > 0 ? turnos.mes / diasTranscurridos : 0;
  const turnosProyectados  = Math.round(promedioDiario * diasEnMes);
  const emailsProyectados  = Math.round(turnosProyectados * emailsXturno);
  const readsProyectados   = Math.round(turnosProyectados * 15 + 40 * 50);
  const costoFBProy        = Math.max(0, (readsProyectados - FB_READS_MES)) * 0.0000006;
  const planNecesarioProy  = EJ_PLANES.find(p => emailsProyectados <= p.limite) || EJ_PLANES[EJ_PLANES.length - 1];
  const costoEJProy        = planNecesarioProy.precio;
  const costoTotalProy     = costoFBProy + costoEJProy;

  const nivel    = nivelTrafico(promedioDiario);
  const nivelCfg = NIVEL_INFO[nivel];
  const alertas  = generarAlertas({ nivel, promedioDiario, pReads, pWrites, pEmailJS, planActual, planSig, ejEmailsMes, turnosProyectados, emailsProyectados });

  const topServicio = Object.entries(xServicio).sort((a,b) => b[1]-a[1]).slice(0,6);
  const topProf     = Object.entries(xProf).sort((a,b) => b[1]-a[1]).slice(0,6);
  const maxS = topServicio[0]?.[1] || 1;
  const maxP = topProf[0]?.[1] || 1;

  const alertasCriticas = alertas.filter(a => a.tipo === "danger").length;

  return (
    <div className="mon-root">

      {/* ── HEADER ─────────────────────────────────────── */}
      <div className="mon-header">
        <div className="mon-header-left">
          <div className="mon-dot" />
          <div>
            <div className="mon-title">
              ⚡ Monitor del Sistema
              {alertasCriticas > 0 && (
                <span style={{
                  marginLeft: 10, background: "#ef4444", color: "#fff",
                  fontSize: 10, fontWeight: 700, borderRadius: 10,
                  padding: "2px 7px", verticalAlign: "middle",
                }}>
                  {alertasCriticas} alerta{alertasCriticas > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="mon-subtitle">Firebase & EmailJS — datos en tiempo real · solo visible para admins</div>
          </div>
        </div>
        <div className="mon-header-right">
          <span className="mon-ts">Actualizado: {fmtTs(lastUpdate)}</span>
          <button className="mon-btn" onClick={refrescar}>↺ Refrescar</button>
          <button className="mon-btn mon-btn-back" onClick={() => navigate("admin")}>← Panel admin</button>
        </div>
      </div>

      <div className="mon-body">

        {/* ── ESTADO GENERAL ──────────────────────────── */}
        <div className={`mon-status-banner ${nivel}`}>
          <div className="mon-status-icon">{nivelCfg.icono}</div>
          <div className="mon-status-body">
            <div className={`mon-status-nivel ${nivel}`}>
              {nivel === "bajo" ? "🟢 Tráfico bajo" : nivel === "moderado" ? "🟡 Tráfico moderado" : "🔴 Tráfico alto"}
              &nbsp;·&nbsp; {Math.round(promedioDiario)} turnos/día promedio
            </div>
            <div className="mon-status-titulo">{nivelCfg.titulo}</div>
            <div className="mon-status-desc">{nivelCfg.desc}</div>
            {nivelCfg.accion && (
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: nivel === "alto" ? "#f87171" : "#fbbf24" }}>
                → {nivelCfg.accion}
              </div>
            )}
          </div>
          <div className="mon-status-right">
            <div className="mon-status-costo-label">Costo estimado</div>
            <div className={`mon-status-costo ${nivel}`}>{nivelCfg.costoEstim}</div>
            <div className="mon-status-costo-sub">Firebase + EmailJS / mes</div>
          </div>
        </div>

        {/* ── ALERTAS ACTIVAS ─────────────────────────── */}
        <div className="mon-section">
          <div className="mon-section-title">
            Alertas activas
            {alertasCriticas > 0 && (
              <span style={{ marginLeft: 8, color: "#f87171" }}>
                — {alertasCriticas} crítica{alertasCriticas > 1 ? "s" : ""}, revisá de inmediato
              </span>
            )}
          </div>
          <div className="mon-alert-list">
            {alertas.map((a, i) => (
              <div key={i} className={`mon-alert-item ${a.tipo}`}>
                <span className="mon-alert-icon">{a.icono}</span>
                <div className="mon-alert-text">
                  <strong>{a.titulo}</strong>
                  {a.msg}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RESUMEN RÁPIDO ──────────────────────────── */}
        <div className="mon-section">
          <div className="mon-section-title">Resumen del mes actual</div>
          <div className="mon-cards">
            <div className="mon-card accent-blue">
              <div className="mon-card-icon">🗓️</div>
              <div className="mon-card-label">Turnos hoy</div>
              <div className="mon-card-value">{turnos.hoy}</div>
              <div className="mon-card-sub">{turnos.semana} esta semana</div>
            </div>
            <div className="mon-card accent-green">
              <div className="mon-card-icon">✅</div>
              <div className="mon-card-label">Confirmados (mes)</div>
              <div className="mon-card-value">{turnos.confirmados}</div>
              <div className="mon-card-sub">{turnos.mes} totales este mes</div>
            </div>
            <div className="mon-card accent-red">
              <div className="mon-card-icon">❌</div>
              <div className="mon-card-label">Cancelados (mes)</div>
              <div className="mon-card-value">{turnos.cancelados}</div>
              <div className="mon-card-sub">
                {turnos.mes > 0 ? Math.round((turnos.cancelados / turnos.mes) * 100) : 0}% del total
              </div>
            </div>
            <div className="mon-card accent-purple">
              <div className="mon-card-icon">📧</div>
              <div className="mon-card-label">Emails estimados (mes)</div>
              <div className="mon-card-value">{ejEmailsMes}</div>
              <div className="mon-card-sub">Plan: {planActual.nombre}{planActual.precio > 0 ? ` ($${planActual.precio}/mes)` : " (Gratis)"}</div>
            </div>
            <div className="mon-card accent-cyan">
              <div className="mon-card-icon">👥</div>
              <div className="mon-card-label">Profesionales activos</div>
              <div className="mon-card-value">{col.profesionales?.activos ?? "—"}</div>
              <div className="mon-card-sub">{col.profesionales?.total ?? "—"} en total</div>
            </div>
            <div className="mon-card accent-orange">
              <div className="mon-card-icon">🔥</div>
              <div className="mon-card-label">Reads Firestore est.</div>
              <div className="mon-card-value">{fmtNum(firebase.estimReads)}</div>
              <div className="mon-card-sub">de {fmtNum(FB_READS_MES)} gratis/mes</div>
            </div>
          </div>
        </div>

        {/* ── GRÁFICO 7 DÍAS ──────────────────────────── */}
        <div className="mon-section">
          <div className="mon-section-title">Actividad últimos 7 días (turnos no cancelados)</div>
          <BarChart7Dias datos={datos7dias} />
        </div>

        {/* ── GAUGES ─────────────────────────────────── */}
        <div className="mon-section">
          <div className="mon-section-title">Consumo actual — visión rápida</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px,1fr))", gap:16 }}>
            <Gauge pct={pReads}   label="Firebase Reads" />
            <Gauge pct={pWrites}  label="Firebase Writes" />
            <Gauge pct={pStorage} label="Storage Firestore" />
            <Gauge pct={pEmailJS} label={`EmailJS (Plan ${planActual.nombre})`} />
          </div>
        </div>

        <div className="mon-grid-2">

          {/* ── FIREBASE ──────────────────────────────── */}
          <div className="mon-section">
            <div className="mon-section-title">🔥 Firebase — consumo estimado</div>
            <div className="mon-progress-list">

              <div className="mon-progress-item">
                <div className="mon-progress-header">
                  <span className="mon-progress-label">Reads Firestore</span>
                  <span className="mon-progress-values">
                    <strong>{fmtNum(firebase.estimReads)}</strong> / {fmtNum(FB_READS_MES)} free
                    &nbsp;<span className={`mon-badge ${badgeClass(pReads)}`}>{pReads.toFixed(1)}%</span>
                  </span>
                </div>
                <div className="mon-bar-track">
                  <div className={`mon-bar-fill ${barClass(pReads)}`} style={{ width: `${pReads}%` }} />
                </div>
                <div className="mon-progress-note">50K/día gratis · excedente: $0.06 / 100K reads</div>
              </div>

              <div className="mon-progress-item">
                <div className="mon-progress-header">
                  <span className="mon-progress-label">Writes Firestore</span>
                  <span className="mon-progress-values">
                    <strong>{fmtNum(firebase.estimWrites)}</strong> / {fmtNum(FB_WRITES_MES)} free
                    &nbsp;<span className={`mon-badge ${badgeClass(pWrites)}`}>{pWrites.toFixed(1)}%</span>
                  </span>
                </div>
                <div className="mon-bar-track">
                  <div className={`mon-bar-fill ${barClass(pWrites)}`} style={{ width: `${pWrites}%` }} />
                </div>
                <div className="mon-progress-note">20K/día gratis · excedente: $0.18 / 100K writes</div>
              </div>

              <div className="mon-progress-item">
                <div className="mon-progress-header">
                  <span className="mon-progress-label">Storage Firestore</span>
                  <span className="mon-progress-values">
                    <strong>{firebase.estimStorage.toFixed(2)} MB</strong> / {FB.storageMB} MB free
                    &nbsp;<span className={`mon-badge ${badgeClass(pStorage)}`}>{pStorage.toFixed(2)}%</span>
                  </span>
                </div>
                <div className="mon-bar-track">
                  <div className={`mon-bar-fill ${barClass(pStorage)}`} style={{ width: `${pStorage}%` }} />
                </div>
                <div className="mon-progress-note">1 GB gratis total · ~1.5 KB por documento</div>
              </div>
            </div>

            {pReads >= 60 && (
              <div className={`mon-alert ${pReads >= 85 ? "danger" : "warn"}`}>
                <span>{pReads >= 85 ? "🚨" : "⚠️"}</span>
                <span>
                  {pReads >= 85
                    ? "Reads cercanos al límite del free tier. Revisá Firebase Console y optimizá consultas."
                    : "Reads en zona amarilla. Monitoreá durante los próximos días."}
                </span>
              </div>
            )}

            <div className="mon-alert info" style={{ marginTop: 12 }}>
              <span>ℹ️</span>
              <span>
                Valores <strong>estimados</strong> basados en la cantidad de turnos del mes.
                Para datos exactos: Firebase Console → Usage → Firestore.
              </span>
            </div>
          </div>

          {/* ── EMAILJS ───────────────────────────────── */}
          <div className="mon-section">
            <div className="mon-section-title">📧 EmailJS — consumo estimado</div>

            <div className="mon-progress-item" style={{ marginBottom: 14 }}>
              <div className="mon-progress-header">
                <span className="mon-progress-label">Emails por turno confirmado</span>
                <div style={{ display:"flex", gap:6 }}>
                  {[1,2,3].map(n => (
                    <button key={n} onClick={() => { setEmailsXturno(n); suscribir(n); }}
                      className="mon-btn"
                      style={{ padding:"3px 10px",
                        background: emailsXturno===n ? "#e94560" : undefined,
                        color: emailsXturno===n ? "#fff" : undefined,
                        borderColor: emailsXturno===n ? "#e94560" : undefined }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mon-progress-note">
                1 = solo confirmación · 2 = confirmación + recordatorio · 3 = +cancelación
              </div>
            </div>

            <div className="mon-progress-list" style={{ marginBottom: 14 }}>
              <div className="mon-progress-item">
                <div className="mon-progress-header">
                  <span className="mon-progress-label">Plan {planActual.nombre} ({planActual.precio === 0 ? "Gratis" : `$${planActual.precio}/mes`})</span>
                  <span className="mon-progress-values">
                    <strong>{ejEmailsMes}</strong> / {planActual.limite.toLocaleString()} emails
                    &nbsp;<span className={`mon-badge ${badgeClass(pEmailJS)}`}>{pEmailJS.toFixed(1)}%</span>
                  </span>
                </div>
                <div className="mon-bar-track">
                  <div className={`mon-bar-fill ${barClass(pEmailJS)}`} style={{ width: `${pEmailJS}%` }} />
                </div>
                <div className="mon-progress-note">
                  {planActual.precio === 0 ? "⚠️ Plan Free: bloquea al agotar el límite sin aviso previo" : "Actualizá con anticipación para evitar interrupciones"}
                </div>
              </div>
            </div>

            <table className="mon-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Precio</th>
                  <th>Límite</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {EJ_PLANES.map(p => {
                  const esCurrent = p.nombre === planActual.nombre;
                  const esProy    = p.nombre === planNecesarioProy.nombre && p.nombre !== planActual.nombre;
                  const suficiente = ejEmailsMes <= p.limite;
                  return (
                    <tr key={p.nombre} style={esCurrent ? { background:"rgba(233,69,96,0.06)" } : esProy ? { background:"rgba(245,158,11,0.05)" } : {}}>
                      <td>
                        <strong style={esCurrent ? { color:"#e94560" } : {}}>
                          {p.nombre}
                          {esCurrent && <span style={{ fontWeight: 400, fontSize: 10, marginLeft: 6, color: "#e94560" }}>← actual</span>}
                          {esProy && <span style={{ fontWeight: 400, fontSize: 10, marginLeft: 6, color: "#f59e0b" }}>← proyectado</span>}
                        </strong>
                      </td>
                      <td>{p.precio === 0 ? "Gratis" : `$${p.precio}/mes`}</td>
                      <td>{p.limite.toLocaleString()}</td>
                      <td>
                        <span className={`mon-badge ${suficiente ? (esCurrent ? "info" : "ok") : "danger"}`}>
                          {suficiente ? (esCurrent ? "✓ Usando" : "Disponible") : "Insuficiente"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {pEmailJS >= 80 && (
              <div className={`mon-alert ${pEmailJS >= 90 ? "danger" : "warn"}`} style={{ marginTop: 12 }}>
                <span>{pEmailJS >= 90 ? "🚨" : "⚠️"}</span>
                <span>
                  {planSig
                    ? `Subí al plan ${planSig.nombre} ($${planSig.precio}/mes) antes de llegar al límite para no perder envíos.`
                    : "Estás en el plan máximo. Si superás el límite contactá a EmailJS para Enterprise."}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── PROYECCIÓN FIN DE MES ──────────────────── */}
        <div className="mon-section">
          <div className="mon-section-title">
            Proyección fin de mes — {Math.round(promedioDiario)} turnos/día promedio · {diasTranscurridos} de {diasEnMes} días transcurridos
          </div>
          <div className="mon-proj-grid">
            <div className="mon-proj-item highlight">
              <div className="mon-proj-label">Turnos proyectados</div>
              <div className="mon-proj-value">{turnosProyectados.toLocaleString()}</div>
              <div className="mon-proj-note">al ritmo actual</div>
            </div>
            <div className="mon-proj-item highlight">
              <div className="mon-proj-label">Emails proyectados</div>
              <div className="mon-proj-value">{emailsProyectados.toLocaleString()}</div>
              <div className="mon-proj-note">{emailsXturno} email{emailsXturno > 1 ? "s" : ""} por turno</div>
            </div>
            <div className={`mon-proj-item ${emailsProyectados > planActual.limite ? "danger-proj" : emailsProyectados > planActual.limite * 0.7 ? "warn-proj" : ""}`}>
              <div className="mon-proj-label">Plan EmailJS necesario</div>
              <div className="mon-proj-value">{planNecesarioProy.nombre}</div>
              <div className="mon-proj-note">
                {planNecesarioProy.precio === 0 ? "Gratis" : `$${planNecesarioProy.precio}/mes`}
                {emailsProyectados > planActual.limite ? " ← debés subir de plan" : ""}
              </div>
            </div>
            <div className={`mon-proj-item ${costoFBProy > 0 ? "warn-proj" : ""}`}>
              <div className="mon-proj-label">Costo Firebase (proy.)</div>
              <div className="mon-proj-value">{costoFBProy === 0 ? "$0" : `$${costoFBProy.toFixed(2)}`}</div>
              <div className="mon-proj-note">{costoFBProy === 0 ? "dentro del free tier" : "excedente estimado"}</div>
            </div>
            <div className="mon-proj-item">
              <div className="mon-proj-label">Costo EmailJS (proy.)</div>
              <div className="mon-proj-value">{costoEJProy === 0 ? "$0" : `$${costoEJProy}`}</div>
              <div className="mon-proj-note">plan {planNecesarioProy.nombre}</div>
            </div>
            <div className={`mon-proj-item ${costoTotalProy === 0 ? "" : costoTotalProy >= 15 ? "danger-proj" : "warn-proj"}`}>
              <div className="mon-proj-label">Costo total proyectado</div>
              <div className="mon-proj-value">{costoTotalProy === 0 ? "$0" : `$${costoTotalProy.toFixed(2)}`}</div>
              <div className="mon-proj-note">Firebase + EmailJS / mes</div>
            </div>
          </div>
        </div>

        {/* ── DESGLOSE DE TURNOS ─────────────────────── */}
        <div className="mon-section">
          <div className="mon-section-title">Desglose de turnos del mes</div>
          <div className="mon-grid-3">

            {/* Donut de estados */}
            <div className="mon-card" style={{ paddingTop: 14 }}>
              <div className="mon-card-label">Estados</div>
              <DonutChart confirmados={turnos.confirmados} cancelados={turnos.cancelados} />
              <div style={{ marginTop: 10, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="mon-mini-row">
                  <span className="mon-mini-key" style={{ fontSize: 12 }}>Esta semana</span>
                  <span className="mon-mini-val" style={{ fontSize: 16 }}>{turnos.semana}</span>
                </div>
                <div className="mon-mini-row">
                  <span className="mon-mini-key" style={{ fontSize: 12 }}>Hoy</span>
                  <span className="mon-mini-val" style={{ fontSize: 16 }}>{turnos.hoy}</span>
                </div>
              </div>
            </div>

            <div className="mon-card" style={{ paddingTop: 14 }}>
              <div className="mon-card-label">Por servicio (top 6)</div>
              <div className="mon-hbar-list">
                {topServicio.length === 0
                  ? <span style={{ color:"#475569", fontSize:11 }}>Sin datos</span>
                  : topServicio.map(([nombre, cant]) => (
                  <div className="mon-hbar-item" key={nombre}>
                    <span className="mon-hbar-label" title={nombre}>{nombre}</span>
                    <div className="mon-hbar-track">
                      <div className="mon-hbar-fill" style={{ width: `${pct(cant,maxS)}%` }} />
                    </div>
                    <span className="mon-hbar-val">{cant}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mon-card" style={{ paddingTop: 14 }}>
              <div className="mon-card-label">Por profesional (top 6)</div>
              <div className="mon-hbar-list">
                {topProf.length === 0
                  ? <span style={{ color:"#475569", fontSize:11 }}>Sin datos</span>
                  : topProf.map(([nombre, cant], idx) => (
                  <div className="mon-hbar-item" key={nombre}>
                    <span className="mon-hbar-label" title={nombre}>{nombre}</span>
                    <div className="mon-hbar-track">
                      <div className="mon-hbar-fill"
                        style={{
                          width: `${pct(cant,maxP)}%`,
                          background: ["#8b5cf6","#3b82f6","#06b6d4","#10b981","#f59e0b","#f97316"][idx % 6]
                        }} />
                    </div>
                    <span className="mon-hbar-val">{cant}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── COLECCIONES FIRESTORE ──────────────────── */}
        <div className="mon-section">
          <div className="mon-section-title">Colecciones Firestore</div>
          <table className="mon-table">
            <thead>
              <tr>
                <th>Colección</th>
                <th>Total docs</th>
                <th>Activos</th>
                <th>Storage est.</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {[
                { nombre: "turnos",        total: turnos.mes, activos: turnos.confirmados, extra: " (mes actual)" },
                { nombre: "profesionales", total: col.profesionales?.total, activos: col.profesionales?.activos },
                { nombre: "servicios",     total: col.servicios?.total,     activos: col.servicios?.activos },
                { nombre: "bloqueos",      total: col.bloqueos?.total,      activos: null },
                { nombre: "usuarios",      total: col.usuarios?.total,      activos: col.usuarios?.admins, activosLabel: "admins" },
              ].map(({ nombre, total, activos, activosLabel, extra }) => (
                <tr key={nombre}>
                  <td><strong>/{nombre}</strong>{extra ? <span style={{ color:"#475569", fontSize:10, marginLeft:4 }}>{extra}</span> : null}</td>
                  <td>{total ?? <span style={{ color:"#475569" }}>cargando…</span>}</td>
                  <td>{activos != null ? `${activos} ${activosLabel ?? "activos"}` : "—"}</td>
                  <td>{total != null ? `~${((total * 1.5)/1024).toFixed(2)} MB` : "—"}</td>
                  <td><span className="mon-badge ok">OK</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── ACCESOS RÁPIDOS ────────────────────────── */}
        <div className="mon-section">
          <div className="mon-section-title">Accesos rápidos (datos oficiales)</div>
          <div className="mon-links">
            <a className="mon-link" href="https://console.firebase.google.com" target="_blank" rel="noreferrer">
              🔥 Firebase Console — Usage
            </a>
            <a className="mon-link" href="https://console.firebase.google.com" target="_blank" rel="noreferrer">
              📊 Firebase Console — Firestore
            </a>
            <a className="mon-link" href="https://app.emailjs.com" target="_blank" rel="noreferrer">
              📧 EmailJS Dashboard
            </a>
            <a className="mon-link" href="https://console.firebase.google.com" target="_blank" rel="noreferrer">
              💰 Firebase — Billing & Alerts
            </a>
          </div>

          <div className="mon-disclaimer" style={{ marginTop: 16 }}>
            <strong>Sobre los valores mostrados:</strong> Los consumos de Firebase son <strong>estimaciones</strong> calculadas
            en base a la cantidad de turnos del mes actual (~15 reads y ~8 writes por turno).
            Los valores exactos están disponibles en Firebase Console → Firestore → Usage.
            El consumo de EmailJS se calcula multiplicando los turnos confirmados por la cantidad de emails por turno seleccionada.
            El número real se ve en emailjs.com → Dashboard → Usage.
          </div>
        </div>

      </div>
    </div>
  );
}
