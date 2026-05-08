/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║     EJEMPLO: CONFIG PARA VETERINARIA                     ║
 * ║   Copiar este archivo a src/config/empresa.config.js     ║
 * ╚══════════════════════════════════════════════════════════╝
 */

export const EMPRESA = {
  nombre: "Veterinaria San Marcos",
  slogan: "Cuidamos a quienes más querés",
  logo: null,
  iniciales: "VS",

  tema: {
    colorPrimario: "#dde1e7",
    colorSecundario: "#0d2137",
    colorAcento: "#22c55e",       // verde veterinaria
    colorAcento2: "#15803d",
    colorTexto: "#f0fdf4",
    colorTextoMuted: "#86efac",
    fontDisplay: "'Nunito', sans-serif",
    fontBody: "'Nunito Sans', sans-serif",
    borderRadius: "14px",
    modoOscuro: true,
  },

  contacto: {
    telefono: "+54 11 4567-8901",
    email: "turnos@vetsanmarcos.com.ar",
    instagram: "@vetsanmarcos",
    direccion: "Av. Belgrano 456, Berisso",
    whatsapp: "5491145678901",
  },

  horarios: {
    diasHabiles: [1, 2, 3, 4, 5, 6],
    horaApertura: "08:00",
    horaCierre: "20:00",
    duracionTurnoMin: 30,
    diasBloqueados: [],
  },

  servicios: [
    {
      id: "consulta",
      nombre: "Consulta general",
      descripcion: "Revisión clínica completa",
      duracion: 30,
      precio: 6500,
      icono: "🩺",
      color: "#22c55e",
    },
    {
      id: "vacuna",
      nombre: "Vacunación",
      descripcion: "Vacunas y refuerzos anuales",
      duracion: 15,
      precio: 4000,
      icono: "💉",
      color: "#3b82f6",
    },
    {
      id: "peluqueria",
      nombre: "Peluquería canina/felina",
      descripcion: "Baño, corte y secado",
      duracion: 90,
      precio: 8000,
      icono: "✂",
      color: "#a855f7",
    },
    {
      id: "desparasitacion",
      nombre: "Desparasitación",
      descripcion: "Tratamiento interno y externo",
      duracion: 20,
      precio: 3500,
      icono: "🛡",
      color: "#f59e0b",
    },
    {
      id: "cirugia",
      nombre: "Castración / Cirugía",
      descripcion: "Requiere evaluación previa",
      duracion: 120,
      precio: 35000,
      icono: "🏥",
      color: "#ef4444",
    },
    {
      id: "radiografia",
      nombre: "Radiografía / Ecografía",
      descripcion: "Diagnóstico por imágenes",
      duracion: 45,
      precio: 12000,
      icono: "🔬",
      color: "#06b6d4",
    },
  ],

  profesionales: [
    {
      id: "dra-lopez",
      nombre: "Dra. Martina López",
      especialidad: "Clínica general y cirugía",
      avatar: null,
      serviciosQueAtiende: ["consulta", "cirugia", "desparasitacion", "vacuna", "radiografia"],
      bio: "Médica Veterinaria UBA, 8 años de experiencia",
    },
    {
      id: "dr-gomez",
      nombre: "Dr. Roberto Gómez",
      especialidad: "Diagnóstico por imágenes",
      avatar: null,
      serviciosQueAtiende: ["consulta", "radiografia", "vacuna", "desparasitacion"],
      bio: "Especialista en diagnóstico no invasivo",
    },
    {
      id: "peluquera",
      nombre: "Carla Méndez",
      especialidad: "Peluquería canina y felina",
      avatar: null,
      serviciosQueAtiende: ["peluqueria"],
      bio: "Certificada en grooming profesional",
    },
  ],

  notificaciones: {
    emailConfirmacion: true,
    emailRecordatorio: true,
    whatsappConfirmacion: true,
    emailAdmin: "admin@vetsanmarcos.com.ar",
  },

  turnos: {
    anticipacionMinDias: 0,
    anticipacionMaxDias: 21,
    cancelacionHsMinimas: 3,
    permitirCancelacion: true,
    mostrarPrecio: true,

    // CAMPOS EXTRA específicos de veterinaria
    camposExtra: [
      {
        id: "mascota_nombre",
        label: "Nombre de la mascota",
        tipo: "text",
        requerido: true,
        placeholder: "Rex, Michi, Luna...",
      },
      {
        id: "mascota_especie",
        label: "Especie",
        tipo: "select",  // para soportar select, hay que extender StepDatos
        requerido: true,
        opciones: ["Perro", "Gato", "Conejo", "Ave", "Otro"],
        placeholder: "Perro",
      },
      {
        id: "mascota_raza",
        label: "Raza",
        tipo: "text",
        requerido: false,
        placeholder: "Labrador, Siamés, mestizo...",
      },
      {
        id: "mascota_edad",
        label: "Edad aproximada",
        tipo: "text",
        requerido: false,
        placeholder: "2 años",
      },
    ],
  },
};

/**
 * OTROS EJEMPLOS RÁPIDOS:
 *
 * ── CLÍNICA / CONSULTORIO MÉDICO ──────────────────────────
 * colorAcento: "#0ea5e9"  (azul médico)
 * fontDisplay: "'Merriweather', serif"
 * servicios: [
 *   { id: "consulta", nombre: "Consulta clínica", duracion: 30 },
 *   { id: "control", nombre: "Control de rutina", duracion: 20 },
 *   { id: "electrocardiograma", nombre: "ECG", duracion: 45 },
 * ]
 * camposExtra: [
 *   { id: "obra_social", label: "Obra social / Prepaga", tipo: "text" },
 *   { id: "nro_afiliado", label: "Nro. de afiliado", tipo: "text" },
 * ]
 * turnos: { anticipacionMinDias: 1 }  // no permite el mismo día
 *
 * ── SPA / CENTRO DE ESTÉTICA ──────────────────────────────
 * colorAcento: "#d946ef"  (violeta/fucsia)
 * fontDisplay: "'Cormorant Garamond', serif"
 * horarios: { horaApertura: "10:00", horaCierre: "21:00" }
 * servicios: [
 *   { id: "masaje", nombre: "Masaje relajante", duracion: 60 },
 *   { id: "facial", nombre: "Facial con ácidos", duracion: 75 },
 *   { id: "depilacion", nombre: "Depilación láser", duracion: 45 },
 * ]
 *
 * ── ODONTOLOGÍA ───────────────────────────────────────────
 * colorAcento: "#38bdf8"  (celeste)
 * servicios: [
 *   { id: "limpieza", nombre: "Limpieza dental", duracion: 45 },
 *   { id: "consulta", nombre: "Consulta inicial", duracion: 30 },
 *   { id: "blanqueamiento", nombre: "Blanqueamiento", duracion: 90 },
 * ]
 * turnos: { anticipacionMinDias: 1, anticipacionMaxDias: 60 }
 *
 * ── PSICÓLOGO / TERAPEUTA ─────────────────────────────────
 * servicios: [
 *   { id: "sesion", nombre: "Sesión individual", duracion: 50 },
 *   { id: "pareja", nombre: "Terapia de pareja", duracion: 60 },
 * ]
 * profesionales: [{ id: "lic-ruiz", nombre: "Lic. Paula Ruiz" }]
 * turnos: { mostrarPrecio: false }  // muchos prefieren no mostrar
 */
