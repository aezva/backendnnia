import { Router, Request, Response } from 'express';
import { buildPrompt, buildPromptAsync } from '../utils/promptBuilder';
import { askNNIAWithAssistantAPI } from '../services/openai';
import { getClientData, getPublicBusinessData, getAppointments, createAppointment, getAvailability, setAvailability, getAvailabilityAndTypes, updateAppointment, deleteAppointment, getNotifications, createNotification, markNotificationRead } from '../services/supabase';

const router = Router();

// POST /nnia/respond
router.post('/respond', async (req: Request, res: Response) => {
  const { clientId, message, source, visitorId, threadId } = req.body;

  if (!clientId || !message || !source) {
    res.status(400).json({ error: 'Faltan parámetros requeridos.' });
    return;
  }

  try {
    // 1. Obtener información pública del negocio (sin datos confidenciales)
    const businessData = await getPublicBusinessData(clientId);
    // 2. Obtener disponibilidad y tipos de cita
    const availability = await getAvailabilityAndTypes(clientId);

    // 3. Construir prompt personalizado con solo información pública y disponibilidad
    const prompt = await buildPromptAsync({ businessData, message, source, availability });

    // 4. Usar Assistant API con GPT-4
    const nniaResponse = await askNNIAWithAssistantAPI(prompt, threadId);
    let nniaMsg = nniaResponse.message;
    let citaCreada = null;

    // Si Assistant API falló, lanzar error en lugar de usar fallback
    if (nniaResponse.error) {
      throw new Error(`Assistant API falló: ${nniaResponse.error}`);
    }

    // 5. Detectar si NNIA quiere crear una cita
    if (nniaMsg && nniaMsg.trim().startsWith('CREAR_CITA:')) {
      try {
        const citaStr = nniaMsg.replace('CREAR_CITA:', '').trim();
        const citaData = JSON.parse(citaStr);
        // Agregar client_id y origin si falta
        citaData.client_id = clientId;
        if (!citaData.origin) citaData.origin = source === 'client-panel' ? 'panel' : 'web';
        citaCreada = await createAppointment(citaData);
        
        nniaMsg = `✅ Cita agendada correctamente para ${citaCreada.name} el ${citaCreada.date} a las ${citaCreada.time} (${citaCreada.type}). Se ha enviado confirmación a tu panel.`;
      } catch (e) {
        console.error('Error creando cita:', e);
        nniaMsg = 'Ocurrió un error al intentar agendar la cita. Por favor, revisa los datos e inténtalo de nuevo.';
      }
    }

    res.json({
      success: true,
      nnia: nniaMsg,
      cita: citaCreada,
      threadId: nniaResponse.threadId,
      allMessages: nniaResponse.allMessages
    });
  } catch (error: any) {
    console.error('Error en /nnia/respond:', error);
    res.status(500).json({ error: 'Error procesando la solicitud de NNIA', details: error.message });
  }
});

// Análisis de documentos (subida y análisis)
router.post('/analyze-document', async (req: Request, res: Response) => {
  // Aquí se recibiría la URL o el archivo del documento
  // Se analizaría el documento y se guardaría el resumen en Supabase
  // Ejemplo de respuesta:
  res.json({ success: true, summary: 'Resumen del documento (pendiente de integración real)' });
});

// Gestión de citas (actualizar, eliminar)
router.put('/appointments/:id', async (req: Request, res: Response) => {
  try {
    const data = await updateAppointment(req.params.id, req.body);
    res.json({ success: true, appointment: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/appointments/:id', async (req: Request, res: Response) => {
  try {
    await deleteAppointment(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener citas del cliente
router.get('/appointments', async (req: Request, res: Response) => {
  const clientId = req.query.clientId as string;
  
  if (!clientId) {
    res.status(400).json({ error: 'Falta clientId' });
    return;
  }
  try {
    const data = await getAppointments(clientId);
    res.json({ success: true, appointments: Array.isArray(data) ? data : [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message, appointments: [] });
  }
});

// Crear cita
router.post('/appointments', async (req: Request, res: Response) => {
  try {
    const data = await createAppointment(req.body);
    res.json({ success: true, appointment: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener disponibilidad
router.get('/availability', async (req: Request, res: Response) => {
  const clientId = req.query.clientId as string;
  if (!clientId) {
    res.status(400).json({ error: 'Falta clientId' });
    return;
  }
  try {
    const data = await getAvailability(clientId);
    res.json({ success: true, availability: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar disponibilidad
router.post('/availability', async (req: Request, res: Response) => {
  const { clientId, days, hours, types } = req.body;
  if (!clientId) {
    res.status(400).json({ error: 'Falta clientId' });
    return;
  }
  try {
    const data = await setAvailability(clientId, { days, hours, types });
    res.json({ success: true, availability: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener notificaciones de un cliente
router.get('/notifications', async (req: Request, res: Response) => {
  const clientId = req.query.clientId as string;
  if (!clientId) {
    res.status(400).json({ error: 'Falta clientId' });
    return;
  }
  try {
    const data = await getNotifications(clientId);
    res.json({ success: true, notifications: Array.isArray(data) ? data : [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message, notifications: [] });
  }
});

// Crear notificación
router.post('/notifications', async (req: Request, res: Response) => {
  try {
    const data = await createNotification(req.body);
    res.json({ success: true, notification: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Marcar notificación como leída
router.post('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const data = await markNotificationRead(req.params.id);
    res.json({ success: true, notification: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener fecha real de internet
router.get('/real-time', async (req: Request, res: Response) => {
  try {
    // Intentar múltiples servicios para mayor confiabilidad
    const services = [
      'https://worldtimeapi.org/api/ip',
      'https://timeapi.io/api/Time/current/zone?timeZone=UTC',
      'https://api.timezonedb.com/v2.1/get-time-zone?key=demo&format=json&by=zone&zone=UTC'
    ];

    for (const service of services) {
      try {
        const response = await fetch(service, { 
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(3000) // 3 segundos timeout
        });
        
        if (response.ok) {
          const data = await response.json() as any;
          let realDate;
          
          // Parsear según el servicio
          if (service.includes('worldtimeapi')) {
            realDate = new Date(data.utc_datetime);
          } else if (service.includes('timeapi.io')) {
            realDate = new Date(data.dateTime);
          } else if (service.includes('timezonedb')) {
            realDate = new Date(data.formatted);
          }
          
          if (realDate && !isNaN(realDate.getTime())) {
            res.json({
              success: true,
              date: realDate.toISOString(),
              timestamp: Date.now(),
              source: service,
              timezone: data.timezone || 'UTC'
            });
            return;
          }
        }
      } catch (error) {
        console.warn(`Error obteniendo fecha de ${service}:`, error);
        continue;
      }
    }
    
    // Si todos los servicios fallan, usar fecha del servidor
    console.warn('No se pudo obtener fecha de internet, usando fecha del servidor');
    res.json({
      success: true,
      date: new Date().toISOString(),
      timestamp: Date.now(),
      source: 'server',
      timezone: 'UTC'
    });
    
  } catch (error: any) {
    console.error('Error en /real-time:', error);
    res.status(500).json({ 
      error: 'Error obteniendo fecha real',
      date: new Date().toISOString(),
      source: 'server-fallback'
    });
  }
});

export default router; 