# 🗓️ Sistema de Turnos — Prototipo Reutilizable

App React + Firebase para gestión de turnos autoasistida.
Diseñada para replicarse a cualquier empresa cambiando **un solo archivo**.

---

## ⚡ Inicio rápido

```bash
npm install
npm run dev
```

---

## 🏗️ Estructura del proyecto

```
src/
├── config/
│   └── empresa.config.js   ← ⭐ EL ÚNICO ARCHIVO QUE CAMBIÁS POR EMPRESA
├── firebase/
│   └── firebase.js          ← Credenciales + lógica de datos
├── pages/
│   ├── BookingFlow.jsx      ← Flujo de reserva para clientes (4 pasos)
│   ├── AdminPanel.jsx       ← Panel de gestión para el negocio
│   └── LoginAdmin.jsx       ← Login con Firebase Auth
├── styles/
│   ├── global.css
│   ├── booking.css
│   ├── admin.css
│   └── login.css
└── App.jsx                  ← Router y contexto global
```

---

## 📋 Para replicar a una nueva empresa

### 1. Clonar o copiar el proyecto
```bash
cp -r turnos-app nuevo-cliente
cd nuevo-cliente
```

### 2. Editar `src/config/empresa.config.js`
Cambiar solo los valores de:
- `nombre`, `slogan`, `iniciales`
- `tema` → colores, fuentes
- `contacto` → teléfono, email, Instagram, WhatsApp
- `horarios` → días hábiles, apertura, cierre
- `servicios` → lista de servicios con precio y duración
- `profesionales` → personal del negocio

### 3. Crear un nuevo proyecto Firebase
1. Ir a [console.firebase.google.com](https://console.firebase.google.com)
2. Crear nuevo proyecto (ej: `peluqueria-nova`)
3. Agregar app Web → copiar `firebaseConfig`
4. Pegar en `src/firebase/firebase.js`
5. Activar **Firestore Database** (modo producción)
6. Activar **Authentication → Email/Password**
7. Crear usuario admin en Authentication → Users
8. Configurar reglas de Firestore (ver abajo)

### 4. Deploy

**Opción A — Hostinger / cualquier hosting estático:**
```bash
npm run build
# Subir la carpeta /dist completa al hosting
```

**Opción B — Firebase Hosting (gratuito):**
```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # apuntar a carpeta 'dist'
npm run deploy:firebase
```

---

## 🔒 Reglas de Firestore recomendadas

Copiar en Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /turnos/{turnoId} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
    match /bloqueos/{bloqueoId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 📱 Convertir a app móvil (PWA / Capacitor)

### PWA (el más fácil — ya incluido)
La app ya funciona como PWA. El usuario puede "Agregar a la pantalla de inicio" desde el navegador móvil. No requiere App Store.

### App nativa con Capacitor
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init "Nombre App" com.empresa.turnos
npm run build
npx cap add android
npx cap add ios
npx cap sync
npx cap open android   # abre Android Studio
npx cap open ios       # abre Xcode
```

---

## 📧 Emails de confirmación (opcional)

La app incluye el hook para enviar emails. Para activarlo:

1. Registrarse en [EmailJS](https://www.emailjs.com) (gratis hasta 200/mes)
2. Crear un template de email
3. En `BookingFlow.jsx`, descomentar la integración con EmailJS:

```js
import emailjs from '@emailjs/browser';

async function enviarEmailConfirmacion(turno, empresa) {
  await emailjs.send(
    'SERVICE_ID',    // tu Service ID de EmailJS
    'TEMPLATE_ID',  // tu Template ID
    {
      to_email: turno.clienteEmail,
      nombre: turno.clienteNombre,
      empresa: empresa.nombre,
      servicio: turno.servicioNombre,
      fecha: turno.fechaISO,
      hora: turno.horaInicio,
    },
    'PUBLIC_KEY'     // tu Public Key de EmailJS
  );
}
```

---

## 🔧 Personalización avanzada

### Agregar campos extra al formulario
En `empresa.config.js`:
```js
turnos: {
  camposExtra: [
    { id: "mascota", label: "Nombre de la mascota", tipo: "text", requerido: true },
    { id: "raza", label: "Raza", tipo: "text", requerido: false },
  ]
}
```

### Cambiar colores en tiempo real
Editar el objeto `tema` en `empresa.config.js`. Soporta cualquier color CSS válido.

### Cambiar fuentes
Reemplazar los nombres en `fontDisplay` y `fontBody` con cualquier fuente de Google Fonts. El sistema las carga automáticamente.

---

## 🗂️ Ejemplos de configuración por rubro

Ver comentarios al final de `empresa.config.js` para ejemplos de:
- 🐾 Veterinaria
- 🏥 Centro médico / consultorio
- 💆 Spa / centro de estética
- 🦷 Odontología

---

## 📦 Tecnologías

| Tecnología | Uso |
|---|---|
| React 18 | UI y estado |
| Firebase Firestore | Base de datos en tiempo real |
| Firebase Auth | Login de administradores |
| Vite | Build tool |
| vite-plugin-pwa | Soporte PWA / instalable |
| Capacitor (opcional) | App nativa iOS/Android |

---

## 🤝 Soporte

El sistema está diseñado para ser autosuficiente.
El archivo `empresa.config.js` documenta cada opción con comentarios.
