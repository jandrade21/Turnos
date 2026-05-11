/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║              INTEGRACIÓN EMAILJS                         ║
 * ║   Envío de emails desde el frontend, sin backend         ║
 * ║   Gratis hasta 200 emails/mes                            ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import emailjs from "@emailjs/browser";


// ─── Configuración ────────────────────────────────────────
const EMAILJS_CONFIG = {
  serviceId: "service_3upnsxe",      // ← Reemplazar
  templateConfirmId: "template_d4r6b0q", // ← Reemplazar
  templateRecordId: "template_0qq34tz",  // ← Reemplazar (opcional)
  publicKey: "pYn0SKB7kXPH7EdE0",      // ← Reemplazar
};

// ─── Inicializar (llamar una vez al arrancar la app) ──────
export function initEmailJS() {
  emailjs.init(EMAILJS_CONFIG.publicKey);
}

// ─── Enviar email de confirmación ─────────────────────────
// ─── Enviar email de confirmación ─────────────────────────
export async function enviarConfirmacion(turno, empresa) {
  // VALIDACIÓN: Verificar que el email del cliente exista
  const clienteEmail = turno.clienteEmail?.trim();
  if (!clienteEmail) {
    console.error("Error: No se puede enviar correo - email del cliente está vacío");
    throw new Error("El email del cliente es obligatorio para enviar la confirmación");
  }

  const params = {
    // Datos de la empresa
    empresa_nombre: empresa.nombre,
    empresa_telefono: empresa.contacto.telefono || "",
    empresa_email: empresa.contacto.email || "",
    empresa_instagram: empresa.contacto.instagram || "",
    empresa_direccion: empresa.contacto.direccion || "",

    // Datos del turno
    cliente_nombre: turno.clienteNombre,
    servicio_nombre: turno.servicioNombre,
    profesional_nombre: turno.profesionalNombre || "A confirmar",
    fecha: formatFechaLarga(turno.fechaISO),
    hora: turno.horaInicio,
    precio: turno.precio
      ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(turno.precio)
      : "",
    turno_id: turno.id?.slice(-6).toUpperCase() || "",
    notas: turno.notas || "—",

    // ¡ESTO ES CRUCIAL! Nombre exacto para que funcione con cuenta gratuita
    to_email: clienteEmail,
    to_name: turno.clienteNombre,

    // Email del admin para copia oculta
    bcc_email: empresa.notificaciones?.emailAdmin || "",

    // Lógica condicional preprocesada
    precio_row: turno.precio
      ? `<div class="turno-row"><span>Precio</span><strong>${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(turno.precio)}</strong></div>`
      : "",
    notas_row: turno.notas
      ? `<div class="turno-row"><span>Notas</span><em>${turno.notas}</em></div>`
      : "",
    whatsapp_link: empresa.contacto.whatsapp
      ? `https://wa.me/${empresa.contacto.whatsapp.replace(/\D/g, '')}`
      : "",
  };

  try {
    console.log("Enviando correo a:", clienteEmail);
    console.log("Parámetros completos:", params);
    
    return await emailjs.send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID,
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
      params,
      import.meta.env.VITE_EMAILJS_PUBLIC_KEY
    );
  } catch (error) {
    console.error("Error al enviar correo:", {
      status: error.status,
      text: error.text,
      message: error.message,
      params: {
        to_email: params.to_email,
        clienteEmail: turno.clienteEmail
      }
    });
    
    throw new Error(`No se pudo enviar el correo de confirmación: ${error.text || error.message}`);
  }
}
// ─── Enviar recordatorio 24hs antes ──────────────────────
export async function enviarRecordatorio(turno, empresa) {
  const params = {
    empresa_nombre: empresa.nombre,
    cliente_nombre: turno.clienteNombre,
    to_email: turno.clienteEmail,
    to_name: turno.clienteNombre,
    servicio_nombre: turno.servicioNombre,
    fecha: formatFechaLarga(turno.fechaISO),
    hora: turno.horaInicio,
    empresa_telefono: empresa.contacto.telefono || "",
    empresa_whatsapp: empresa.contacto.whatsapp
      ? `https://wa.me/${empresa.contacto.whatsapp}`
      : "",
  };

  return emailjs.send(
    import.meta.env.VITE_EMAILJS_SERVICE_ID,
    import.meta.env.VITE_EMAILJS_TEMPLATE_RECORD_ID,
    params,
    import.meta.env.VITE_EMAILJS_PUBLIC_KEY
  );
}

// ─── Helper ───────────────────────────────────────────────
function formatFechaLarga(iso) {
  if (!iso) return iso;
  const [y, m, d] = iso.split("-");
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Plantillas HTML corregidas ────────────────────────────
export const TEMPLATE_CONFIRMACION_HTML = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .header { background: #1a1a2e; padding: 32px 40px; text-align: center; }
    .header h1 { color: #fff; font-size: 22px; margin: 0; font-weight: 600; }
    .header p { color: #9ca3af; font-size: 14px; margin: 4px 0 0; }
    .check { width: 64px; height: 64px; background: #10b981; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 28px; }
    .body { padding: 32px 40px; }
    .greeting { font-size: 17px; color: #1a1a2e; margin-bottom: 20px; }
    .turno-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
    .turno-row { display: flex; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .turno-row:last-child { border-bottom: none; }
    .turno-row span { color: #6b7280; }
    .turno-row strong { color: #1a1a2e; }
    .turno-id { font-family: monospace; background: #fef2f2; color: #e94560; padding: 2px 8px; border-radius: 4px; font-size: 13px; }
    .cta { text-align: center; margin-bottom: 24px; }
    .btn { display: inline-block; background: #e94560; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; }
    .footer { background: #f9fafb; padding: 20px 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
    .footer a { color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="check">✓</div>
      <h1>{{empresa_nombre}}</h1>
      <p>Confirmación de turno</p>
    </div>
    <div class="body">
      <p class="greeting">Hola <strong>{{cliente_nombre}}</strong>, tu turno fue confirmado exitosamente.</p>
      <div class="turno-card">
        <div class="turno-row"><span>Servicio</span><strong>{{servicio_nombre}}</strong></div>
        <div class="turno-row"><span>Profesional</span><strong>{{profesional_nombre}}</strong></div>
        <div class="turno-row"><span>Fecha</span><strong>{{fecha}}</strong></div>
        <div class="turno-row"><span>Hora</span><strong>{{hora}}hs</strong></div>
        {{{precio_row}}}
        {{{notas_row}}}
        <div class="turno-row"><span>Nro. de turno</span><span class="turno-id">#{{turno_id}}</span></div>
      </div>
      {{#if whatsapp_link}}
      <div class="cta">
        <a class="btn" href="{{whatsapp_link}}">Consultar por WhatsApp</a>
      </div>
      {{/if}}
      <p style="font-size:13px;color:#6b7280;text-align:center;">
        Para cancelar o reprogramar, contactanos con al menos 2 horas de anticipación.<br>
        📞 {{empresa_telefono}} &nbsp;|&nbsp; 📍 {{empresa_direccion}}
      </p>
    </div>
    <div class="footer">
      Este email fue enviado automáticamente por el sistema de turnos de <strong>{{empresa_nombre}}</strong>.<br>
      No respondas este email directamente.
    </div>
  </div>
</body>
</html>
`;

export const TEMPLATE_RECORDATORIO_HTML = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; }
    .header { background: #0f3460; padding: 28px 40px; text-align: center; }
    .header h1 { color: #fff; font-size: 20px; margin: 0; }
    .body { padding: 28px 40px; font-size: 15px; color: #1a1a2e; }
    .turno-card { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 16px 20px; margin: 20px 0; }
    .turno-card p { margin: 4px 0; font-size: 14px; color: #0c4a6e; }
    .footer { background: #f9fafb; padding: 16px 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>⏰ Recordatorio de turno</h1></div>
    <div class="body">
      <p>Hola <strong>{{cliente_nombre}}</strong>,</p>
      <p>Te recordamos que mañana tenés turno en <strong>{{empresa_nombre}}</strong>:</p>
      <div class="turno-card">
        <p>📋 <strong>Servicio:</strong> {{servicio_nombre}}</p>
        <p>📅 <strong>Fecha:</strong> {{fecha}}</p>
        <p>⏰ <strong>Hora:</strong> {{hora}}hs</p>
      </div>
      <p>Si necesitás reprogramar, contactanos:</p>
      <p>📞 {{empresa_telefono}}</p>
    </div>
    <div class="footer">{{empresa_nombre}} — Sistema de turnos automático</div>
  </div>
</body>
</html>
`;