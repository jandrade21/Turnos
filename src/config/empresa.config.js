/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║         ARCHIVO DE CONFIGURACIÓN DE LA EMPRESA           ║
 * ║   Este es el ÚNICO archivo que cambiás para cada cliente ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Pasos para replicar a una nueva empresa:
 * 1. Copiar este archivo
 * 2. Editar los valores de abajo
 * 3. Crear un proyecto Firebase nuevo y pegar las credenciales
 * 4. Deploy a Hostinger / Netlify / Firebase Hosting
 */

export const EMPRESA = {
  // ─── Identidad ────────────────────────────────────────────
  nombre: "Peluquería Nova",
  slogan: "Tu mejor versión, cada día",
  logo: null, // URL de imagen o null para usar las iniciales
  iniciales: "PN", // Se muestra si no hay logo

  // ─── Tema visual ──────────────────────────────────────────
  tema: {
    colorPrimario: "#f8fafc",      // Fondo principal (claro)
    colorSecundario: "#ffffff",    // Fondo secundario (blanco)
    colorAcento: "#e94560",        // Color de acento (botones, highlights)
    colorAcento2: "#475569",       // Acento secundario
    colorTexto: "#0f172a",         // Texto principal (oscuro)
    colorTextoMuted: "#64748b",    // Texto secundario
    fontDisplay: "'Playfair Display', serif",
    fontBody: "'DM Sans', sans-serif",
    borderRadius: "12px",
    modoOscuro: false,
  },

  // ─── Contacto ─────────────────────────────────────────────
  contacto: {
    telefono: "+54 11 2345-6789",
    email: "info@peluquerianova.com",
    instagram: "@peluquerianova",
    direccion: "Av. Corrientes 1234, CABA",
    whatsapp: "5491123456789",
  },

  // ─── Horarios de atención ──────────────────────────────────
  horarios: {
    diasHabiles: [1, 2, 3, 4, 5, 6], // 0=Dom, 1=Lun ... 6=Sab
    horaApertura: "09:00",
    horaCierre: "20:00",
    duracionTurnoMin: 30, // duración mínima de un slot en minutos
    // Días bloqueados (feriados, vacaciones)
    diasBloqueados: ["2025-01-01", "2025-03-24"],
  },

  // ─── Servicios ────────────────────────────────────────────
  servicios: [
    {
      id: "corte",
      nombre: "Corte de cabello",
      descripcion: "Corte clásico o moderno a tu elección",
      duracion: 30, // minutos
      precio: 4500,
      icono: "✂️",
      color: "#e94560",
    },
    {
      id: "color",
      nombre: "Coloración",
      descripcion: "Coloración completa con productos premium",
      duracion: 90,
      precio: 12000,
      icono: "🎨",
      color: "#7c3aed",
    },
    {
      id: "mechas",
      nombre: "Mechas / Balayage",
      descripcion: "Técnica manual para un look natural",
      duracion: 120,
      precio: 18000,
      icono: "🌟",
      color: "#d97706",
    },
    {
      id: "peinado",
      nombre: "Peinado",
      descripcion: "Para eventos especiales",
      duracion: 60,
      precio: 7000,
      icono: "💫",
      color: "#059669",
    },
    {
      id: "tratamiento",
      nombre: "Tratamiento capilar",
      descripcion: "Hidratación y nutrición profunda",
      duracion: 60,
      precio: 8500,
      icono: "💧",
      color: "#0ea5e9",
    },
  ],

  // ─── Profesionales ────────────────────────────────────────
  profesionales: [
    {
      id: "ana",
      nombre: "Ana García",
      especialidad: "Coloración y mechas",
      avatar: null, // URL o null para avatar automático
      serviciosQueAtiende: ["corte", "color", "mechas", "tratamiento"],
      bio: "10 años de experiencia en colorimetría avanzada",
    },
    {
      id: "marcos",
      nombre: "Marcos López",
      especialidad: "Corte moderno",
      avatar: null,
      serviciosQueAtiende: ["corte", "peinado"],
      bio: "Especialista en cortes masculinos y de transición",
    },
    {
      id: "sofia",
      nombre: "Sofía Ruiz",
      especialidad: "Estilismo integral",
      avatar: null,
      serviciosQueAtiende: ["corte", "color", "mechas", "peinado", "tratamiento"],
      bio: "Formada en Buenos Aires y Madrid",
    },
  ],

  // ─── Configuración de notificaciones ──────────────────────
  notificaciones: {
    emailConfirmacion: true,
    emailRecordatorio: true, // 24hs antes
    whatsappConfirmacion: false, // Requiere integración adicional
    emailAdmin: "turnos@peluquerianova.com",
  },

  // ─── Configuración de turnos ──────────────────────────────
  turnos: {
    anticipacionMinDias: 0,      // 0 = puede pedir turno para hoy
    anticipacionMaxDias: 30,     // máximo días hacia adelante
    cancelacionHsMinimas: 2,     // horas mínimas para cancelar
    permitirCancelacion: true,
    mostrarPrecio: true,
    camposExtra: [
      // Podés agregar campos custom al formulario
      // { id: "mascota", label: "Nombre de la mascota", tipo: "text", requerido: true }
    ],
  },
};

/**
 * EJEMPLOS DE CONFIG PARA OTROS RUBROS:
 *
 * Veterinaria:
 *   servicios: [{id:"consulta", nombre:"Consulta general", duracion:30}, ...]
 *   camposExtra: [{id:"mascota", label:"Nombre de la mascota", tipo:"text"}]
 *
 * Centro médico:
 *   profesionales: [{id:"dra-perez", nombre:"Dra. Pérez", especialidad:"Clínica médica"}]
 *   turnos: { anticipacionMinDias: 1 } // no permite turno para el mismo día
 *
 * Spa / Centro de estética:
 *   servicios: [{id:"masaje", nombre:"Masaje relajante", duracion:60}, ...]
 *   horarios: { horaApertura: "10:00", horaCierre: "21:00", diasHabiles: [2,3,4,5,6,0] }
 */
