/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              SCRIPT DE INICIALIZACIÓN                        ║
 * ║                                                              ║
 * ║  Crea en Firestore:                                          ║
 * ║    ✓ colección "usuarios"   → documento del admin            ║
 * ║    ✓ colección "profesionales" → los 3 profesionales         ║
 * ║    ✓ colección "turnos"     → vacía (con doc de ejemplo)     ║
 * ║    ✓ colección "bloqueos"   → vacía                          ║
 * ║                                                              ║
 * ║  CÓMO USARLO:                                                ║
 * ║    1. Completar los 4 valores de CONFIGURACIÓN abajo         ║
 * ║    2. npm install (en esta carpeta)                          ║
 * ║    3. node seed.js                                           ║
 * ║    4. ¡Listo! No volver a correrlo nunca más                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

// ═══════════════════════════════════════════════════════════
//  ★ PASO 1: COMPLETAR ESTOS 4 VALORES
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  // Email y contraseña del admin que se va a crear
  adminEmail:    "admin@tuempresa.com",    // ← cambiar
  adminPassword: "MiClave2024!",           // ← cambiar (mín. 6 caracteres)
  adminNombre:   "Administrador",          // ← cambiar

  // Ruta al archivo de credenciales de Firebase Admin SDK
  // (Ver instrucciones abajo para obtenerlo)
  serviceAccountPath: "./serviceAccountKey.json",  // ← no cambiar esto
};

// ═══════════════════════════════════════════════════════════
//  CÓMO OBTENER serviceAccountKey.json
//
//  1. Ir a Firebase Console → tu proyecto
//  2. Click en el engranaje ⚙ → "Project settings"
//  3. Pestaña "Service accounts"
//  4. Click "Generate new private key"
//  5. Guardar el archivo como "serviceAccountKey.json"
//     EN ESTA MISMA CARPETA (junto a seed.js)
//  6. NUNCA subir ese archivo a Git (ya está en .gitignore)
// ═══════════════════════════════════════════════════════════

// ─── Datos que se van a crear (tomados de empresa.config.js) ─
const PROFESIONALES = [
  {
    nombre: "Ana García",
    especialidad: "Coloración y mechas",
    bio: "10 años de experiencia en colorimetría avanzada",
    serviciosQueAtiende: ["corte", "color", "mechas", "tratamiento"],
    activo: true,
  },
  {
    nombre: "Marcos López",
    especialidad: "Corte moderno",
    bio: "Especialista en cortes masculinos y de transición",
    serviciosQueAtiende: ["corte", "peinado"],
    activo: true,
  },
  {
    nombre: "Sofía Ruiz",
    especialidad: "Estilismo integral",
    bio: "Formada en Buenos Aires y Madrid",
    serviciosQueAtiende: ["corte", "color", "mechas", "peinado", "tratamiento"],
    activo: true,
  },
];

// ─── Ejecución ────────────────────────────────────────────
async function main() {
  console.log("\n🚀 Iniciando setup de Firebase...\n");

  // Cargar service account
  let serviceAccount;
  try {
    serviceAccount = require(CONFIG.serviceAccountPath);
  } catch (e) {
    console.error("❌  No se encontró serviceAccountKey.json");
    console.error("   Seguí las instrucciones del archivo para obtenerlo.");
    process.exit(1);
  }

  // Inicializar Firebase Admin
  initializeApp({ credential: cert(serviceAccount) });
  const db   = getFirestore();
  const auth = getAuth();

  // ── 1. Crear usuario admin en Firebase Auth ──────────────
  console.log("👤 Creando usuario admin...");
  let adminUid;
  try {
    const user = await auth.createUser({
      email:         CONFIG.adminEmail,
      password:      CONFIG.adminPassword,
      displayName:   CONFIG.adminNombre,
      emailVerified: true,
    });
    adminUid = user.uid;
    console.log(`   ✓ Usuario creado: ${CONFIG.adminEmail} (uid: ${adminUid})`);
  } catch (e) {
    if (e.code === "auth/email-already-exists") {
      // Si ya existe, obtener el UID
      const existing = await auth.getUserByEmail(CONFIG.adminEmail);
      adminUid = existing.uid;
      console.log(`   ℹ  El usuario ya existía. UID: ${adminUid}`);
    } else {
      console.error("❌  Error al crear usuario:", e.message);
      process.exit(1);
    }
  }

  // ── 2. Crear documento del admin en "usuarios" ───────────
  console.log("\n📁 Creando colección 'usuarios'...");
  await db.collection("usuarios").doc(adminUid).set({
    nombre:    CONFIG.adminNombre,
    email:     CONFIG.adminEmail,
    rol:       "admin",
    creadoEn:  FieldValue.serverTimestamp(),
  });
  console.log(`   ✓ Documento admin creado con UID: ${adminUid}`);
  console.log(`   ✓ rol: "admin" asignado`);

  // ── 3. Crear colección "profesionales" ───────────────────
  console.log("\n📁 Creando colección 'profesionales'...");
  const batch = db.batch();
  for (const prof of PROFESIONALES) {
    const ref = db.collection("profesionales").doc();
    batch.set(ref, { ...prof, creadoEn: FieldValue.serverTimestamp() });
    console.log(`   ✓ ${prof.nombre}`);
  }
  await batch.commit();

  // ── 4. Crear colección "turnos" (vacía con placeholder) ──
  console.log("\n📁 Creando colección 'turnos'...");
  const turnoRef = db.collection("turnos").doc("_placeholder");
  await turnoRef.set({ _init: true, creadoEn: FieldValue.serverTimestamp() });
  // Borrarlo inmediatamente — solo sirve para que la colección exista
  await turnoRef.delete();
  console.log("   ✓ Colección creada (vacía)");

  // ── 5. Crear colección "bloqueos" (vacía) ────────────────
  console.log("\n📁 Creando colección 'bloqueos'...");
  const bloqueoRef = db.collection("bloqueos").doc("_placeholder");
  await bloqueoRef.set({ _init: true, creadoEn: FieldValue.serverTimestamp() });
  await bloqueoRef.delete();
  console.log("   ✓ Colección creada (vacía)");

  // ── Resumen ───────────────────────────────────────────────
  console.log("\n✅  Setup completado exitosamente!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Colecciones creadas:");
  console.log("    • usuarios       (1 documento - el admin)");
  console.log("    • profesionales  (3 documentos)");
  console.log("    • turnos         (vacía, lista para usar)");
  console.log("    • bloqueos       (vacía, lista para usar)");
  console.log("\n  Credenciales del admin:");
  console.log(`    Email:      ${CONFIG.adminEmail}`);
  console.log(`    Contraseña: ${CONFIG.adminPassword}`);
  console.log("\n  Próximo paso:");
  console.log("    Ingresar al panel en: tuapp.com/#/login-admin");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  process.exit(0);
}

main().catch((e) => {
  console.error("\n❌  Error inesperado:", e.message);
  process.exit(1);
});
