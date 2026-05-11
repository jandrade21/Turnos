import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, getDocs, getDoc,
  doc, updateDoc, deleteDoc, setDoc, query, where,
  orderBy, serverTimestamp, limit, startAfter,
} from "firebase/firestore";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, signOut, onAuthStateChanged, sendPasswordResetEmail,
  reauthenticateWithCredential, EmailAuthProvider, updatePassword,
} from "firebase/auth";

// ─── CREDENCIALES — reemplazar por proyecto ───────────────
const firebaseConfig = {
  apiKey: "AIzaSyDMxeayvU4IPiwBaT_JTr_qZ_uDlbct2K0",
  authDomain: "sistema-fb363.firebaseapp.com",
  databaseURL: "https://sistema-fb363-default-rtdb.firebaseio.com",
  projectId: "sistema-fb363",
  storageBucket: "sistema-fb363.firebasestorage.app",
  messagingSenderId: "1037738713286",
  appId: "1:1037738713286:web:b761dbff94871cba73f7c7"
};

const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// ─── REGLAS DE FIRESTORE ──────────────────────────────────
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null &&
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'admin';
    }
    match /turnos/{turnoId} {
      allow create: if true; // Allow anonymous booking
      allow read: if request.auth != null && (
        resource.data.clienteUid == request.auth.uid ||
        (resource.data.clienteUid == null && resource.data.clienteEmail == request.auth.token.email)
      );
      allow update: if request.auth != null && (
        resource.data.clienteUid == request.auth.uid ||
        (resource.data.clienteUid == null && resource.data.clienteEmail == request.auth.token.email)
      );
      allow read, write: if isAdmin();
    }
    match /profesionales/{profId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /servicios/{servicioId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /configuracion/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /bloqueos/{bloqueoId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /usuarios/{uid} {
      allow read, write: if request.auth.uid == uid;
      allow read: if isAdmin();
    }
  }
}
*/

// ─── AUTH SERVICE ─────────────────────────────────────────
export const authService = {
  loginAdmin: (email, password) =>
    signInWithEmailAndPassword(auth, email, password),

  registrarCliente: async (nombre, email, password) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: nombre });
    await setDoc(doc(db, "usuarios", cred.user.uid), {
      nombre, email, rol: "cliente", creadoEn: serverTimestamp(),
    });
    return cred.user;
  },

  loginCliente: (email, password) =>
    signInWithEmailAndPassword(auth, email, password),

  resetPassword: (email) => sendPasswordResetEmail(auth, email),

  logout: () => signOut(auth),

  getRol: async (uid) => {
    if (!uid) return null;
    const snap = await getDoc(doc(db, "usuarios", uid));
    return snap.exists() ? snap.data().rol : null;
  },

  obtenerPerfil: async (uid) => {
    const snap = await getDoc(doc(db, "usuarios", uid));
    return snap.exists() ? snap.data() : null;
  },

  actualizarPerfil: async (uid, datos) => {
    await updateDoc(doc(db, "usuarios", uid), datos);
  },

  onAuthChange: (callback) => onAuthStateChanged(auth, callback),

  cambiarPassword: async (passwordActual, passwordNueva) => {
    const usuario = auth.currentUser;
    if (!usuario) throw new Error("No hay sesión activa.");
    const credencial = EmailAuthProvider.credential(usuario.email, passwordActual);
    await reauthenticateWithCredential(usuario, credencial);
    await updatePassword(usuario, passwordNueva);
  },
};

// ─── TURNOS SERVICE ───────────────────────────────────────
export const turnosService = {
  async crear(datos) {
    const docRef = await addDoc(collection(db, "turnos"), {
      ...datos, estado: "confirmado",
      creadoEn: serverTimestamp(), recordatorioEnviado: false,
    });
    return docRef.id;
  },

  async obtenerPorFecha(fecha) {
    const q = query(
      collection(db, "turnos"),
      where("fechaISO", "==", fecha),
      where("estado", "!=", "cancelado")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async obtenerPorRango(desde, hasta) {
    const q = query(
      collection(db, "turnos"),
      where("fechaISO", ">=", desde),
      where("fechaISO", "<=", hasta)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async obtenerTodos(filtros = {}) {
    const constraints = [orderBy("fechaISO", "desc")];
    if (filtros.estado) constraints.push(where("estado", "==", filtros.estado));
    if (filtros.profesionalId) constraints.push(where("profesionalId", "==", filtros.profesionalId));
    const snap = await getDocs(query(collection(db, "turnos"), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async obtenerTodosPage(filtros = {}, pageSize = 20, cursor = null) {
    const constraints = [orderBy("fechaISO", "desc"), limit(pageSize + 1)];
    if (filtros.estado) constraints.push(where("estado", "==", filtros.estado));
    if (filtros.profesionalId) constraints.push(where("profesionalId", "==", filtros.profesionalId));
    if (cursor) constraints.push(startAfter(cursor));
    const snap = await getDocs(query(collection(db, "turnos"), ...constraints));
    const pageDocs = snap.docs.slice(0, pageSize);
    return {
      items: pageDocs.map((d) => ({ id: d.id, ...d.data() })),
      nextCursor: snap.docs.length > pageSize ? pageDocs[pageDocs.length - 1] : null,
      hayMas: snap.docs.length > pageSize,
    };
  },

  async obtenerDelCliente(uid, email) {
    const queries = [
      getDocs(query(collection(db, "turnos"), where("clienteUid", "==", uid), orderBy("fechaISO", "desc"), limit(50))),
    ];
    if (email) {
      queries.push(
        getDocs(query(collection(db, "turnos"), where("clienteEmail", "==", email), where("clienteUid", "==", null), orderBy("fechaISO", "desc"), limit(50)))
      );
    }
    const results = await Promise.allSettled(queries);
    const vistos = new Set();
    return results
      .filter(r => r.status === "fulfilled")
      .flatMap(r => r.value.docs.map(d => ({ id: d.id, ...d.data() })))
      .filter(t => { if (vistos.has(t.id)) return false; vistos.add(t.id); return true; })
      .sort((a, b) => b.fechaISO.localeCompare(a.fechaISO));
  },

  async actualizar(id, datos) {
    await updateDoc(doc(db, "turnos", id), datos);
  },

  async cancelar(id, motivo = "") {
    await updateDoc(doc(db, "turnos", id), {
      estado: "cancelado", motivoCancelacion: motivo,
      canceladoEn: serverTimestamp(),
    });
  },

  async obtenerUno(id) {
    const snap = await getDoc(doc(db, "turnos", id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async vincularPorEmail(email, uid) {
    const q = query(
      collection(db, "turnos"),
      where("clienteEmail", "==", email),
      where("clienteUid", "==", null)
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;
    await Promise.all(snap.docs.map(d => updateDoc(doc(db, "turnos", d.id), { clienteUid: uid })));
    return snap.docs.length;
  },
};

// ─── SERVICIOS SERVICE ───────────────────────────────────
export const serviciosService = {
  async obtenerTodos() {
    const snap = await getDocs(query(collection(db, "servicios"), orderBy("nombre")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async crear(datos) {
    const docRef = await addDoc(collection(db, "servicios"), { ...datos, activo: true, creadoEn: serverTimestamp() });
    return docRef.id;
  },
  async importarDesdeConfig(servicios) {
    for (const s of servicios) {
      await setDoc(doc(db, "servicios", s.id), {
        nombre: s.nombre, descripcion: s.descripcion || "", duracion: s.duracion,
        precio: s.precio, icono: s.icono || "", color: s.color || "#e94560",
        activo: true, creadoEn: serverTimestamp(),
      }, { merge: true });
    }
  },
  async actualizar(id, datos) { await updateDoc(doc(db, "servicios", id), datos); },
  async activar(id) { await updateDoc(doc(db, "servicios", id), { activo: true }); },
  async desactivar(id) { await updateDoc(doc(db, "servicios", id), { activo: false }); },
  async eliminar(id) { await deleteDoc(doc(db, "servicios", id)); },
};

// ─── CONFIGURACION SERVICE ────────────────────────────────
export const configuracionService = {
  async obtener() {
    const snap = await getDoc(doc(db, "configuracion", "general"));
    return snap.exists() ? snap.data() : { sinPreferencia: true };
  },
  async actualizar(datos) {
    await setDoc(doc(db, "configuracion", "general"), datos, { merge: true });
  },
};

// ─── PROFESIONALES SERVICE ────────────────────────────────
export const profesionalesService = {
  async obtenerTodos() {
    const snap = await getDocs(query(collection(db, "profesionales"), orderBy("nombre")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async crear(datos) {
    const docRef = await addDoc(collection(db, "profesionales"), {
      ...datos, activo: true, creadoEn: serverTimestamp(),
    });
    return docRef.id;
  },
  async actualizar(id, datos) {
    await updateDoc(doc(db, "profesionales", id), datos);
  },
  async desactivar(id) {
    await updateDoc(doc(db, "profesionales", id), { activo: false });
  },
  async activar(id) {
    await updateDoc(doc(db, "profesionales", id), { activo: true });
  },
  async eliminar(id) {
    await deleteDoc(doc(db, "profesionales", id));
  },
};

// ─── BLOQUEOS SERVICE ─────────────────────────────────────
export const bloqueosService = {
  // Crear un nuevo bloqueo
  async crear(datos) {
    try {
      const docRef = await addDoc(collection(db, "bloqueos"), {
        ...datos,
        creadoEn: serverTimestamp(), // Marca de tiempo de creación
      });
      return docRef.id; // Retorna el ID del documento creado
    } catch (error) {
      console.error("Error al crear bloqueo:", error);
      throw new Error("No se pudo crear el bloqueo. Intenta de nuevo.");
    }
  },

  // Obtener bloqueos por fecha específica (incluye bloques recurrentes del día de semana)
  async obtenerPorFecha(fecha) {
    try {
      const [y, m, d] = fecha.split("-").map(Number);
      const diaSemana = new Date(y, m - 1, d).getDay();

      const [snap1, snap2] = await Promise.all([
        getDocs(query(collection(db, "bloqueos"), where("fecha", "==", fecha))),
        getDocs(query(collection(db, "bloqueos"), where("tipo", "==", "diaRepetido"), where("diaSemana", "==", diaSemana))),
      ]);

      return [
        ...snap1.docs.map((d) => ({ id: d.id, ...d.data() })),
        ...snap2.docs.map((d) => ({ id: d.id, ...d.data() })),
      ];
    } catch (error) {
      console.error("Error al obtener bloqueos por fecha:", error);
      throw new Error("No se pudieron obtener los bloqueos. Intenta de nuevo.");
    }
  },

  // Obtener bloqueos dentro de un rango de fechas
  async obtenerPorRango(desde, hasta) {
    try {
      const q = query(
        collection(db, "bloqueos"),
        where("fecha", ">=", desde), // Fecha inicial del rango
        where("fecha", "<=", hasta) // Fecha final del rango
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })); // Retorna los datos de los documentos
    } catch (error) {
      console.error("Error al obtener bloqueos por rango:", error);
      throw new Error("No se pudieron obtener los bloqueos. Intenta de nuevo.");
    }
  },

  // Obtener todos los bloqueos
  async obtenerTodos() {
    try {
      const snap = await getDocs(collection(db, "bloqueos"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error("Error al obtener todos los bloqueos:", error);
      throw new Error("No se pudieron obtener los bloqueos. Intenta de nuevo.");
    }
  },

  // Eliminar un bloqueo por su ID
  async eliminar(id) {
    try {
      await deleteDoc(doc(db, "bloqueos", id));
    } catch (error) {
      console.error("Error al eliminar bloqueo:", error);
      throw new Error("No se pudo eliminar el bloqueo. Intenta de nuevo.");
    }
  },
};

// ─── GENERADOR DE SLOTS ───────────────────────────────────
export function generarSlots(horaApertura, horaCierre, duracionMin, turnosExistentes = [], bloqueos = []) {
  const slots = [];
  const [hA, mA] = horaApertura.split(":").map(Number); // Hora de apertura en minutos
  const [hC, mC] = horaCierre.split(":").map(Number);   // Hora de cierre en minutos
  let minutos = hA * 60 + mA;                          // Convierte la hora de apertura a minutos
  const cierre = hC * 60 + mC;                         // Convierte la hora de cierre a minutos

  while (minutos + duracionMin <= cierre) {
    const horaStr = `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`; // Formato HH:mm
    const finMin = minutos + duracionMin;
    const horaFinStr = `${String(Math.floor(finMin / 60)).padStart(2, "0")}:${String(finMin % 60).padStart(2, "0")}`; // Hora de fin del slot

    // Verifica si el slot está ocupado por un turno existente o un bloqueo
    const ocupado =
      turnosExistentes.some((t) => t.horaInicio === horaStr) || // Turnos existentes
      bloqueos.some((b) => (!b.horaInicio || (horaStr >= b.horaInicio && horaStr < b.horaFin))); // Bloqueos

    // Agrega el slot a la lista
    slots.push({ hora: horaStr, horaFin: horaFinStr, disponible: !ocupado });
    minutos += duracionMin; // Incrementa los minutos para el siguiente slot
  }

  return slots; // Retorna la lista de slots generados
}

// ─── UTILIDADES DE FECHA ──────────────────────────────────
// Retorna la fecha actual en formato ISO (YYYY-MM-DD)
export function hoyISO() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
}

// Suma `n` días a una fecha ISO
export function sumarDias(iso, n) {
  const [y, m, d] = iso.split("-").map(Number); // Extrae año, mes y día
  const f = new Date(y, m - 1, d + n);         // Crea una nueva fecha sumando `n` días
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

// Retorna el lunes de la semana correspondiente a una fecha ISO
export function getLunesDe(iso) {
  const [y, m, d] = iso.split("-").map(Number); // Extrae año, mes y día
  const f = new Date(y, m - 1, d);             // Crea una nueva fecha
  const diff = f.getDay() === 0 ? -6 : 1 - f.getDay(); // Calcula la diferencia hasta el lunes
  return sumarDias(iso, diff);                  // Retorna la fecha del lunes
}

// Formatea una fecha ISO en formato largo (ej.: "lunes, 24 de abril de 2026")
export function formatFechaLarga(iso) {
  if (!iso) return ""; // Si no hay fecha, retorna cadena vacía
  const [y, m, d] = iso.split("-"); // Extrae año, mes y día
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// Formatea una fecha ISO en formato corto (ej.: "24/04/2026")
export function formatFechaCorta(iso) {
  if (!iso) return ""; // Si no hay fecha, retorna cadena vacía
  const [y, m, d] = iso.split("-"); // Extrae año, mes y día
  return `${d}/${m}/${y}`;          // Retorna en formato DD/MM/YYYY
}