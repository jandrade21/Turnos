/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║         INTEGRACIÓN WHATSAPP — Dos opciones              ║
 * ║                                                          ║
 * ║  OPCIÓN A: Twilio (más fácil, de pago)                   ║
 * ║  OPCIÓN B: Meta Cloud API (gratuito hasta 1000/mes)      ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * IMPORTANTE: Las llamadas a estas APIs deben hacerse desde
 * un backend (Cloud Functions, Express, etc.) para no exponer
 * credenciales en el frontend. Ver instrucciones abajo.
 */

// ═══════════════════════════════════════════════════════════
// OPCIÓN A: TWILIO WHATSAPP
// ═══════════════════════════════════════════════════════════
//
// Pasos:
// 1. Crear cuenta en https://www.twilio.com
// 2. Activar el Sandbox de WhatsApp (gratuito para pruebas)
//    o solicitar número aprobado (para producción)
// 3. Obtener Account SID y Auth Token del dashboard
// 4. Instalar: npm install twilio
//
// Este código va en Firebase Cloud Functions o en tu servidor:

/*
const twilio = require('twilio');

const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'; // número sandbox de Twilio

async function enviarWhatsAppTwilio({ telefono, nombre, servicio, fecha, hora, empresa }) {
  const client = twilio(TWILIO_SID, TWILIO_TOKEN);
  
  const mensaje = `✅ *Turno confirmado — ${empresa}*\n\nHola ${nombre}! 👋\n\nTu turno ha sido reservado:\n📋 *Servicio:* ${servicio}\n📅 *Fecha:* ${fecha}\n⏰ *Hora:* ${hora}hs\n\nSi necesitás cancelar o reprogramar, respondé este mensaje.\n\n_Este es un mensaje automático._`;

  await client.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    to: `whatsapp:+${telefono}`,
    body: mensaje,
  });
}

module.exports = { enviarWhatsAppTwilio };
*/


// ═══════════════════════════════════════════════════════════
// OPCIÓN B: META CLOUD API (WhatsApp Business API oficial)
// ═══════════════════════════════════════════════════════════
//
// Pasos:
// 1. Ir a https://developers.facebook.com
// 2. Crear app → tipo "Business"
// 3. Agregar producto "WhatsApp"
// 4. En WhatsApp > API Setup, obtener:
//    - Phone Number ID
//    - Temporary access token (o crear permanente)
// 5. Crear plantilla de mensaje en WhatsApp Manager
//    (Las plantillas deben ser aprobadas por Meta, tarda ~24hs)
//
// PLANTILLA DE EJEMPLO para crear en Meta Business Manager:
// Nombre: "confirmacion_turno"
// Idioma: Español
// Categoría: UTILITY
// Cuerpo:
//   "Hola {{1}}, tu turno en {{2}} fue confirmado para el {{3}} a las {{4}}hs.
//    Servicio: {{5}}. Ante cualquier duda, comunicate con nosotros."

/*
const META_PHONE_ID = process.env.META_PHONE_ID;
const META_TOKEN = process.env.META_TOKEN;

async function enviarWhatsAppMeta({ telefono, nombre, empresa, fecha, hora, servicio }) {
  const url = `https://graph.facebook.com/v18.0/${META_PHONE_ID}/messages`;
  
  const body = {
    messaging_product: "whatsapp",
    to: telefono,         // formato: "5491123456789" (sin + ni espacios)
    type: "template",
    template: {
      name: "confirmacion_turno",
      language: { code: "es_AR" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: nombre },
            { type: "text", text: empresa },
            { type: "text", text: fecha },
            { type: "text", text: hora },
            { type: "text", text: servicio },
          ]
        }
      ]
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${META_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Meta API error: ${JSON.stringify(err)}`);
  }
  return response.json();
}

module.exports = { enviarWhatsAppMeta };
*/


// ═══════════════════════════════════════════════════════════
// FIREBASE CLOUD FUNCTION — Trigger al crear un turno
// ═══════════════════════════════════════════════════════════
//
// Archivo: functions/index.js
// Instalar: npm install firebase-functions firebase-admin twilio
//
// Este Cloud Function se dispara automáticamente cuando se
// crea un turno nuevo en Firestore.

/*
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const twilio = require('twilio');

admin.initializeApp();

exports.onTurnoCreado = functions.firestore
  .document('turnos/{turnoId}')
  .onCreate(async (snap, context) => {
    const turno = snap.data();
    
    // Solo enviar si tiene teléfono
    if (!turno.clienteTelefono) return null;

    // Limpiar número: sacar todo excepto dígitos
    const tel = turno.clienteTelefono.replace(/\D/g, '');
    
    try {
      await enviarWhatsAppTwilio({
        telefono: tel,
        nombre: turno.clienteNombre,
        servicio: turno.servicioNombre,
        fecha: turno.fechaISO,
        hora: turno.horaInicio,
        empresa: 'Peluquería Nova', // o leer de config
      });
      
      // Marcar como enviado
      await snap.ref.update({ whatsappEnviado: true });
    } catch (err) {
      console.error('Error enviando WhatsApp:', err);
    }
    
    return null;
  });

// Recordatorio 24hs antes (Cloud Scheduler)
exports.recordatoriosDiarios = functions.pubsub
  .schedule('every day 09:00')
  .timeZone('America/Argentina/Buenos_Aires')
  .onRun(async (context) => {
    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);
    const fechaISO = mañana.toISOString().split('T')[0];
    
    const snap = await admin.firestore()
      .collection('turnos')
      .where('fechaISO', '==', fechaISO)
      .where('estado', '==', 'confirmado')
      .where('recordatorioEnviado', '==', false)
      .get();
    
    const promesas = snap.docs.map(async doc => {
      const turno = doc.data();
      if (!turno.clienteTelefono) return;
      
      const tel = turno.clienteTelefono.replace(/\D/g, '');
      
      // Mensaje de recordatorio
      const client = twilio(
        process.env.TWILIO_SID,
        process.env.TWILIO_TOKEN
      );
      await client.messages.create({
        from: 'whatsapp:+14155238886',
        to: `whatsapp:+${tel}`,
        body: `🔔 *Recordatorio de turno*\n\nHola ${turno.clienteNombre}! Mañana tenés turno en Peluquería Nova:\n📅 ${turno.fechaISO}\n⏰ ${turno.horaInicio}hs\n📋 ${turno.servicioNombre}\n\n¡Te esperamos!`,
      });
      
      await doc.ref.update({ recordatorioEnviado: true });
    });
    
    await Promise.all(promesas);
    console.log(`Recordatorios enviados: ${promesas.length}`);
  });
*/


// ═══════════════════════════════════════════════════════════
// SOLUCIÓN SIMPLE SIN BACKEND: Link de WhatsApp directo
// ═══════════════════════════════════════════════════════════
//
// Si no querés backend, podés generar un link que abre
// WhatsApp con el mensaje pre-cargado. El cliente lo envía
// manualmente. Ideal para empezar.

export function generarLinkWhatsApp(turno, empresa) {
  const mensaje = encodeURIComponent(
    `Hola! Soy *${turno.clienteNombre}* y quiero confirmar mi turno en *${empresa.nombre}*:\n` +
    `📋 Servicio: ${turno.servicioNombre}\n` +
    `📅 Fecha: ${turno.fechaISO}\n` +
    `⏰ Hora: ${turno.horaInicio}hs`
  );
  return `https://wa.me/${empresa.contacto.whatsapp}?text=${mensaje}`;
}

// Uso en el componente de confirmación:
// <a href={generarLinkWhatsApp(turno, empresa)} target="_blank">
//   Confirmar por WhatsApp
// </a>
