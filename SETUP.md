# ⚙️ Cómo configurar Firebase por primera vez

Hay **dos opciones**. Usá la que te resulte más cómoda — hacen exactamente lo mismo.

---

## OPCIÓN A — Desde el navegador (más fácil, recomendada)

No necesitás terminal. Solo necesitás tener la app corriendo.

### 1. Completar credenciales Firebase
En `src/firebase/firebase.js`, reemplazar el objeto `firebaseConfig` con las
credenciales de tu proyecto Firebase.

Para obtenerlas:
1. Ir a [console.firebase.google.com](https://console.firebase.google.com)
2. Crear nuevo proyecto (o usar uno existente)
3. Ir a **Configuración del proyecto** (engranaje ⚙)
4. Pestaña **General** → sección **Tus apps** → click en **Agregar app** → Web
5. Copiar el objeto `firebaseConfig`

También activar en Firebase Console:
- **Authentication → Sign-in method → Email/Password → Habilitar**
- **Firestore Database → Crear base de datos → Modo producción**

### 2. Correr la app y abrir la página de setup
```bash
npm install
npm run dev
```
Abrir en el navegador: `http://localhost:5173/#/setup`

La página te guía en 3 pasos:
1. Verifica que Firebase esté conectado
2. Crea el usuario administrador (email + contraseña que vos elegís)
3. Carga los profesionales de `empresa.config.js` a Firestore

Listo. Después entrás a `/#/login-admin` con las credenciales que creaste.

---

## OPCIÓN B — Script de terminal (para devs)

### 1. Ir a la carpeta setup
```bash
cd setup
npm install
```

### 2. Obtener la clave del servidor (Service Account)
1. Firebase Console → Configuración del proyecto ⚙
2. Pestaña **Service accounts**
3. Click **Generate new private key**
4. Guardar el archivo como `serviceAccountKey.json` **dentro de la carpeta setup/**

### 3. Editar seed.js
Abrir `setup/seed.js` y cambiar estos tres valores:
```js
adminEmail:    "admin@tuempresa.com",   // ← tu email
adminPassword: "TuClave2024!",          // ← tu contraseña
adminNombre:   "Administrador",         // ← tu nombre
```

### 4. Correr el script
```bash
node seed.js
```

El script imprime en consola qué creó y con qué credenciales.

---

## Reglas de Firestore

Después de cualquiera de las dos opciones, ir a **Firestore → Rules** y pegar:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null &&
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'admin';
    }
    match /turnos/{turnoId} {
      allow create: if request.auth != null;
      allow read, update: if request.auth != null &&
        resource.data.clienteUid == request.auth.uid;
      allow read, write: if isAdmin();
    }
    match /profesionales/{profId} {
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
```

Click **Publish**.

---

## Para cada nueva empresa

Repetir desde el paso 1 con un proyecto Firebase distinto y las
credenciales correspondientes. El script y la página de setup funcionan
igual para cualquier empresa.
