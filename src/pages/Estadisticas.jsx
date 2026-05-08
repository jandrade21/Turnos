import React, { useState, useEffect } from "react";
import { useApp } from "../App";
import { turnosService, serviciosService } from "../firebase/firebase";

// ─── Helpers ──────────────────────────────────────────────
function formatPrecio(n) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(n);
}

function hoyISO() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
}

function mesActualISO() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
}

function diasUltimos30() {
  const dias = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dias.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dias;
}

// ─── Mini barra horizontal ────────────────────────────────
function BarraHorizontal({ label, valor, max, color, formato = "numero" }) {
  const pct = max > 0 ? Math.round((valor / max) * 100) : 0;
  const display = formato === "precio" ? formatPrecio(valor) : valor;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
        <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{display}</span>
      </div>
      <div style={{ height: 6, background: "rgba(0,0,0,.08)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: color || "var(--color-accent)",
          borderRadius: 3, transition: "width .6s ease",
        }} />
      </div>
    </div>
  );
}

// ─── Tarjeta de métrica ───────────────────────────────────
function MetricCard({ label, valor, sub, color, icono }) {
  return (
    <div style={{
      background: "var(--color-secondary)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "18px 20px",
      boxShadow: "0 1px 4px rgba(0,0,0,.07)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icono}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || "var(--color-text)" }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Gráfico de barras SVG simple ─────────────────────────
function GraficoBarra({ datos, color = "#e94560" }) {
  if (!datos || datos.length === 0) return null;
  const max = Math.max(...datos.map(d => d.valor), 1);
  const W = 580, H = 100, BAR_W = Math.max(4, Math.floor(W / datos.length) - 2);
  const step = W / datos.length;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{ overflow: "visible" }}>
      {datos.map((d, i) => {
        const h = Math.round((d.valor / max) * H);
        const x = Math.round(i * step + step / 2 - BAR_W / 2);
        const y = H - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={BAR_W} height={h} rx={2}
              fill={d.valor > 0 ? color : "rgba(0,0,0,.08)"} opacity={d.esHoy ? 1 : 0.6} />
            {d.esHoy && (
              <rect x={x - 1} y={y - 1} width={BAR_W + 2} height={h + 2} rx={3}
                fill="none" stroke={color} strokeWidth={1.5} />
            )}
            {i % 5 === 0 && (
              <text x={x + BAR_W / 2} y={H + 14} textAnchor="middle"
                style={{ fontSize: 9, fill: "var(--color-text-muted)" }}>{d.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────
export default function Estadisticas() {
  const { empresa } = useApp();
  const [turnos,      setTurnos]      = useState([]);
  const [serviciosMap, setServiciosMap] = useState({});
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.allSettled([
      turnosService.obtenerTodos(),
      serviciosService.obtenerTodos(),
    ]).then(([turnosRes, servsRes]) => {
      if (turnosRes.status === "fulfilled") setTurnos(turnosRes.value);
      if (servsRes.status === "fulfilled") {
        const map = {};
        servsRes.value.forEach(s => { map[s.id] = s; });
        // Fallback: also map from empresa.servicios
        empresa.servicios.forEach(s => { if (!map[s.id]) map[s.id] = s; });
        setServiciosMap(map);
      } else {
        const map = {};
        empresa.servicios.forEach(s => { map[s.id] = s; });
        setServiciosMap(map);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ textAlign: "center", padding: 48, color: "var(--color-text-muted)" }}>
      Cargando estadísticas...
    </div>
  );

  const hoy = hoyISO();
  const mesActual = mesActualISO();

  // ── Métricas básicas ──
  const turnosHoy = turnos.filter(t => t.fechaISO === hoy && t.estado !== "cancelado");
  const turnosMes = turnos.filter(t => t.fechaISO?.startsWith(mesActual) && t.estado !== "cancelado");
  const cancelados = turnos.filter(t => t.estado === "cancelado");
  const completados = turnos.filter(t => t.estado === "completado");
  const ingresosMes = turnosMes.reduce((acc, t) => acc + (t.precio || 0), 0);
  const ingresosTotal = completados.reduce((acc, t) => acc + (t.precio || 0), 0);
  const tasaCancelacion = turnos.length > 0
    ? Math.round((cancelados.length / turnos.length) * 100)
    : 0;

  // ── Turnos por servicio ──
  const porServicio = {};
  empresa.servicios.forEach(s => { porServicio[s.id] = { nombre: s.nombre, color: s.color, count: 0, ingresos: 0 }; });
  turnos.filter(t => t.estado !== "cancelado").forEach(t => {
    if (porServicio[t.servicioId]) {
      porServicio[t.servicioId].count++;
      porServicio[t.servicioId].ingresos += t.precio || 0;
    }
  });
  const serviciosOrdenados = Object.values(porServicio).sort((a, b) => b.count - a.count);
  const maxServ = Math.max(...serviciosOrdenados.map(s => s.count), 1);

  // ── Turnos por profesional ──
  const porProf = {};
  empresa.profesionales.forEach(p => { porProf[p.id] = { nombre: p.nombre, count: 0 }; });
  turnos.filter(t => t.estado !== "cancelado" && t.profesionalId !== "cualquiera").forEach(t => {
    if (porProf[t.profesionalId]) porProf[t.profesionalId].count++;
  });
  const profsOrdenados = Object.values(porProf).sort((a, b) => b.count - a.count);
  const maxProf = Math.max(...profsOrdenados.map(p => p.count), 1);

  // ── Gráfico últimos 30 días ──
  const dias30 = diasUltimos30();
  const datosDias = dias30.map(fecha => {
    const count = turnos.filter(t => t.fechaISO === fecha && t.estado !== "cancelado").length;
    const [, , d] = fecha.split("-");
    return { label: d, valor: count, esHoy: fecha === hoy };
  });

  // ── Próximos turnos ──
  const proximos = turnos
    .filter(t => t.fechaISO >= hoy && t.estado !== "cancelado")
    .sort((a, b) => a.fechaISO.localeCompare(b.fechaISO) || a.horaInicio.localeCompare(b.horaInicio))
    .slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Métricas principales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        <MetricCard label="Hoy" valor={turnosHoy.length} sub="turnos activos" icono="📅" color="#e94560" />
        <MetricCard label="Este mes" valor={turnosMes.length} sub="turnos" icono="📊" />
        <MetricCard label="Ingresos del mes" valor={formatPrecio(ingresosMes)} sub="estimado" icono="💰" color="#10b981" />
        <MetricCard label="Cancelaciones" valor={`${tasaCancelacion}%`} sub={`${cancelados.length} cancelados`} icono="✕" color={tasaCancelacion > 20 ? "#ef4444" : "var(--color-text)"} />
        <MetricCard label="Completados" valor={completados.length} sub="histórico" icono="✓" color="#6366f1" />
        <MetricCard label="Ingresos totales" valor={formatPrecio(ingresosTotal)} sub="facturado" icono="📈" color="#f59e0b" />
      </div>

      {/* Gráfico de actividad */}
      <div style={{ background: "var(--color-secondary)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 14 }}>
          Turnos — últimos 30 días
        </div>
        <GraficoBarra datos={datosDias} color="#e94560" />
      </div>

      {/* Por servicio y por profesional */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "var(--color-secondary)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 14 }}>
            Por servicio
          </div>
          {serviciosOrdenados.map(s => (
            <BarraHorizontal key={s.nombre} label={s.nombre} valor={s.count} max={maxServ} color={s.color} />
          ))}
        </div>
        <div style={{ background: "var(--color-secondary)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 14 }}>
            Por profesional
          </div>
          {profsOrdenados.map((p, i) => (
            <BarraHorizontal key={p.nombre} label={p.nombre} valor={p.count} max={maxProf}
              color={["#e94560", "#6366f1", "#10b981", "#f59e0b"][i % 4]} />
          ))}
        </div>
      </div>

      {/* Próximos turnos */}
      <div style={{ background: "var(--color-secondary)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 14 }}>
          Próximos turnos
        </div>
        {proximos.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>No hay turnos próximos.</p>
        ) : proximos.map(t => (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "10px 0", borderBottom: "1px solid var(--border)",
          }}>
            <div style={{ textAlign: "center", minWidth: 44 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-accent)" }}>{t.horaInicio}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{t.clienteNombre}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{t.servicioNombre} · {t.profesionalNombre}</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", textAlign: "right" }}>
              {t.fechaISO === hoy ? "Hoy" : t.fechaISO}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
