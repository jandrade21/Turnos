# 🚀 Guía de Deploy Paso a Paso

## OPCIÓN A — Firebase Hosting (gratuito, recomendado)

### 1. Instalar Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### 2. Inicializar el proyecto
```bash
cd turnos-app
firebase init hosting
```
Responder:
- "Use an existing project" → elegir el proyecto que creaste
- Public directory: `dist`
- Configure as single-page app: `Yes`
- Set up automatic builds with GitHub: `No` (por ahora)

### 3. Build y deploy
```bash
npm run build
firebase deploy --only hosting
```
URL resultante: `https://tu-proyecto.web.app`

### 4. Deploy de Cloud Functions (para WhatsApp/recordatorios)
```bash
cd functions
npm install
firebase deploy --only functions
```

---

## OPCIÓN B — Hostinger (hosting compartido)

### 1. Build
```bash
npm run build
```
Se genera la carpeta `/dist` con los archivos estáticos.

### 2. Subir por FTP o File Manager
1. Ingresar al panel de Hostinger
2. Ir a **File Manager** o usar **FTP** (FileZilla)
3. Navegar a `public_html`
4. Subir todo el contenido de la carpeta `dist/`

### 3. Configurar redirects para SPA
Crear el archivo `.htaccess` en `public_html/`:
```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QR,L]
```
Esto es NECESARIO para que las rutas `#/admin`, `#/login` funcionen.

### 4. Configurar dominio personalizado
En Hostinger → Domains → apuntar al hosting.
O en Firebase → Hosting → Custom Domain.

---

## OPCIÓN C — Netlify (muy fácil, gratis)

### 1. Build y deploy directo
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

### 2. O conectar con GitHub (CI/CD automático)
1. Subir el código a GitHub
2. En Netlify: New site → Import from Git
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Cada `git push` hace deploy automático

### 3. Archivo `netlify.toml` (ya incluido en el proyecto)
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## REPLICAR A UNA NUEVA EMPRESA

```bash
# 1. Clonar el prototipo
git clone https://github.com/tu-usuario/turnos-app nuevo-empresa

# 2. Editar config
nano nuevo-empresa/src/config/empresa.config.js

# 3. Crear proyecto Firebase nuevo
# (En console.firebase.google.com)

# 4. Pegar credenciales Firebase
nano nuevo-empresa/src/firebase/firebase.js

# 5. Build y deploy
cd nuevo-empresa
npm install
npm run build
firebase use --add   # asociar al nuevo proyecto Firebase
firebase deploy
```

Tiempo estimado por nueva empresa: **15-20 minutos**.

---

## VARIABLES DE ENTORNO (para producción)

Crear `.env.local` en la raíz del proyecto:
```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000:web:xxxxx

VITE_EMAILJS_SERVICE_ID=service_xxxxx
VITE_EMAILJS_TEMPLATE_ID=template_xxxxx
VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxx
```

En `firebase.js`, reemplazar los valores hardcodeados:
```js
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // ...etc
};
```

**Nunca subir `.env.local` a Git.** Ya está en `.gitignore`.

---

## CREAR USUARIO ADMINISTRADOR

En Firebase Console → Authentication → Users → Add user:
- Email: `admin@tuempresa.com`
- Password: (elegir contraseña segura)

Esto permite ingresar al panel `/admin` con esas credenciales.
Podés crear múltiples admins para el mismo negocio.

---

## CHECKLIST PRE-LAUNCH

- [ ] `firebaseConfig` actualizado en `firebase.js`
- [ ] `empresa.config.js` completo con datos reales
- [ ] Usuario admin creado en Firebase Auth
- [ ] Reglas de Firestore configuradas
- [ ] EmailJS configurado y template testeado
- [ ] Enviar turno de prueba y verificar email
- [ ] Probar login de admin
- [ ] Probar en mobile (Chrome / Safari iOS)
- [ ] Dominio personalizado configurado (opcional)
- [ ] Google Analytics conectado (opcional)
