import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

console.log('DEBUG SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('DEBUG SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '[PRESENTE]' : '[VACÍA]');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getClientData(clientId: string) {
  // Ejemplo: obtener datos del cliente desde la tabla 'clients'
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  if (error) throw error;
  return data;
}

export async function getPublicBusinessData(clientId: string) {
  // Obtener business_name desde clients
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, business_name')
    .eq('id', clientId)
    .single();
  if (clientError) throw clientError;

  // Obtener información pública del negocio desde business_info
  const { data: businessInfo, error: businessError } = await supabase
    .from('business_info')
    .select('*')
    .eq('client_id', clientId)
    .single();
  if (businessError) throw businessError;

  // Combinar los datos, EXCLUYENDO el id del businessInfo para evitar confusión
  const { id, ...businessInfoWithoutId } = businessInfo;
  const combined = {
    business_name: client.business_name,
    // NO incluir business_info_id para evitar que el Assistant API lo use incorrectamente
    ...businessInfoWithoutId
  };

  // Filtrar campos vacíos o nulos para limpiar la respuesta
  const cleanData = Object.fromEntries(
    Object.entries(combined).filter(([_, value]) => 
      value !== null && value !== undefined && value !== ''
    )
  );

  return cleanData;
}

// Obtener citas de un cliente
export async function getAppointments(clientId: string) {
  console.log('🔍 getAppointments - clientId:', clientId);
  
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    
    if (error) {
      console.error('❌ Error en getAppointments:', error);
      throw error;
    }
    
    console.log('✅ getAppointments - citas encontradas:', data?.length || 0);
    return data;
  } catch (error) {
    console.error('❌ Error completo en getAppointments:', error);
    throw error;
  }
}

// Helper para limpiar notificación antes de insertar
function cleanNotificationInput(notification: any) {
  const { id, read, created_at, ...rest } = notification;
  return {
    ...rest,
    data: typeof rest.data === 'object' && rest.data !== null ? rest.data : {},
  };
}

// Función de validación profesional para client_id
async function validateClientId(clientId: string): Promise<boolean> {
  console.log('🔍 validateClientId - Iniciando validación para:', clientId);
  
  if (!clientId || typeof clientId !== 'string') {
    console.log('❌ validateClientId: clientId inválido o vacío');
    return false;
  }

  try {
    console.log('🔍 validateClientId - Consultando tabla clients para:', clientId);
    
    // Verificar que el client_id existe en la tabla clients
    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    console.log('🔍 validateClientId - Resultado de consulta:', { data, error });

    if (error) {
      console.log('❌ validateClientId: Error verificando client_id:', error.message);
      return false;
    }

    if (!data) {
      console.log('❌ validateClientId: client_id no encontrado en tabla clients');
      return false;
    }

    console.log('✅ validateClientId: client_id válido:', clientId);
    return true;
  } catch (error) {
    console.error('❌ validateClientId: Error inesperado:', error);
    return false;
  }
}

// Crear notificación con validación profesional
export async function createNotification(notification: any) {
  console.log('🔍 createNotification - datos recibidos:', notification);
  console.log('🔍 createNotification - stack trace:', new Error().stack);
  
  // Validar client_id antes de crear la notificación
  const isValidClientId = await validateClientId(notification.client_id);
  if (!isValidClientId) {
    const error = new Error(`client_id inválido: ${notification.client_id}. Debe ser un ID válido de la tabla clients.`);
    console.error('❌ createNotification - Validación fallida:', error.message);
    throw error;
  }
  
  // Mapear campos al formato correcto de la tabla notifications
  const cleanNotification = {
    client_id: notification.client_id,
    type: notification.type,
    title: notification.title,
    body: notification.message || notification.body,  // usar 'body' en lugar de 'message'
    data: typeof notification.data === 'string' ? notification.data : JSON.stringify(notification.data || {})
  };
  
  console.log('🔍 createNotification - datos mapeados:', cleanNotification);
  
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([cleanNotification])
      .select();
    
    if (error) {
      console.error('❌ Error en createNotification:', error);
      throw error;
    }
    
    console.log('✅ createNotification - notificación creada:', data[0]);
    return data[0];
  } catch (error) {
    console.error('❌ Error completo en createNotification:', error);
    throw error;
  }
}

// Helper para obtener el id de business_info a partir de client_id
async function getBusinessInfoIdByClientId(clientId: string) {
  const { data, error } = await supabase
    .from('business_info')
    .select('id')
    .eq('client_id', clientId)
    .single();
  if (error) throw error;
  return data.id;
}

// Función para validar y limpiar datos de cita antes de insertar
function validateAppointmentData(appointment: any) {
  // Campos que SÍ existen en la tabla appointments
  const validFields = ['client_id', 'name', 'email', 'type', 'date', 'time', 'status', 'origin'];
  
  const cleanData: any = {};
  
  // Solo incluir campos válidos
  validFields.forEach(field => {
    if (appointment[field] !== undefined && appointment[field] !== null) {
      cleanData[field] = appointment[field];
    }
  });
  
  // Valores por defecto
  if (!cleanData.status) cleanData.status = 'pending';
  if (!cleanData.origin) cleanData.origin = 'web';
  
  return cleanData;
}

// Función helper específica para crear notificaciones de citas
export async function createAppointmentNotification(appointmentData: any) {
  console.log('🔔 createAppointmentNotification - Iniciando con datos:', appointmentData);
  
  try {
    // Obtener el client_id correcto de la cita
    const clientId = appointmentData.client_id;
    console.log('🔔 createAppointmentNotification - client_id de la cita:', clientId);
    
    if (!clientId) {
      console.log('❌ createAppointmentNotification: No hay client_id en los datos de la cita');
      return null;
    }

    // Validar que el client_id existe
    const isValidClient = await validateClientId(clientId);
    console.log('🔔 createAppointmentNotification - Validación de client_id:', isValidClient);
    
    if (!isValidClient) {
      console.log('❌ createAppointmentNotification: client_id inválido, no se crea notificación');
      return null;
    }

    // Crear la notificación
    const notificationData = {
      client_id: clientId,
      type: 'appointment_created',
      title: 'Nueva cita agendada',
      message: `Se ha agendado una cita para ${appointmentData.name} el ${appointmentData.date} a las ${appointmentData.time}`,
      read: false,
      created_at: new Date().toISOString()
    };

    console.log('🔔 createAppointmentNotification - Datos de notificación a crear:', notificationData);

    const { data, error } = await supabase
      .from('notifications')
      .insert([notificationData])
      .select()
      .single();

    console.log('🔔 createAppointmentNotification - Resultado de inserción:', { data, error });

    if (error) {
      console.error('❌ createAppointmentNotification: Error creando notificación:', error);
      return null;
    }

    console.log('✅ createAppointmentNotification: Notificación creada exitosamente:', data);
    return data;
  } catch (error) {
    console.error('❌ createAppointmentNotification: Error inesperado:', error);
    return null;
  }
}

// En createAppointment, obtener el id de business_info y usarlo en la notificación
export async function createAppointment(appointment: any) {
  console.log('🔍 createAppointment - datos recibidos:', appointment);
  
  // Validar y limpiar datos antes de insertar
  const citaData = validateAppointmentData(appointment);
  
  console.log('🔍 createAppointment - datos validados y mapeados:', citaData);

  try {
    const { data, error } = await supabase
      .from('appointments')
      .insert([citaData])
      .select();
    
    if (error) {
      console.error('❌ Error en createAppointment:', error);
      throw error;
    }
    
    const cita = data[0];
    console.log('✅ createAppointment - cita creada:', cita);
    
    // Intentar crear notificación asociada, pero no fallar si hay error
    if (cita && cita.client_id) {
      try {
        console.log('🔍 Debug - cita.client_id:', cita.client_id);
        console.log('🔍 Debug - appointment.client_id original:', appointment.client_id);
        
        await createAppointmentNotification(cita);
        console.log('✅ Notificación creada exitosamente');
      } catch (notifError) {
        console.error('❌ Error creando notificación:', notifError);
        // NO lanzar error aquí - la cita ya se creó correctamente
      }
    }
    return cita;
  } catch (error) {
    console.error('❌ Error completo en createAppointment:', error);
    throw error;
  }
}

// Obtener disponibilidad de un cliente
export async function getAvailability(clientId: string) {
  const { data, error } = await supabase
    .from('business_info')
    .select('appointment_days, appointment_hours, appointment_types')
    .eq('client_id', clientId)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found
  // Adaptar a formato esperado por el frontend
  return data ? {
    days: data.appointment_days ? data.appointment_days.split(',') : [],
    hours: data.appointment_hours || '',
    types: data.appointment_types ? data.appointment_types.split(',') : []
  } : { days: [], hours: '', types: [] };
}

// Guardar o actualizar disponibilidad
export async function setAvailability(clientId: string, availability: { days: string, hours: string, types: string }) {
  const { data, error } = await supabase
    .from('business_info')
    .update({
      appointment_days: availability.days,
      appointment_hours: availability.hours,
      appointment_types: availability.types
    })
    .eq('client_id', clientId)
    .select();
  if (error) throw error;
  return data && data[0] ? {
    days: data[0].appointment_days ? data[0].appointment_days.split(',') : [],
    hours: data[0].appointment_hours || '',
    types: data[0].appointment_types ? data[0].appointment_types.split(',') : []
  } : { days: [], hours: '', types: [] };
}

// Obtener disponibilidad y tipos de cita de un cliente (helper para NNIA)
export async function getAvailabilityAndTypes(clientId: string) {
  const { data, error } = await supabase
    .from('business_info')
    .select('appointment_days, appointment_hours, appointment_types')
    .eq('client_id', clientId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? {
    days: data.appointment_days ? data.appointment_days.split(',') : [],
    hours: data.appointment_hours || '',
    types: data.appointment_types ? data.appointment_types.split(',') : []
  } : { days: [], hours: '', types: [] };
}

// Actualizar una cita
export async function updateAppointment(id: string, updates: any) {
  const { data, error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', id)
    .select();
  if (error) throw error;
  return data && data[0];
}

// Eliminar una cita
export async function deleteAppointment(id: string) {
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { success: true };
}

// Obtener notificaciones de un cliente
export async function getNotifications(clientId: string) {
  console.log('🔍 getNotifications - clientId recibido:', clientId);
  
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ getNotifications - error:', error);
    throw error;
  }
  
  console.log('🔍 getNotifications - notificaciones encontradas:', data?.length || 0);
  console.log('🔍 getNotifications - datos completos:', data);
  
  return data;
}

// Marcar notificación como leída
export async function markNotificationRead(id: string) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .select();
  if (error) throw error;
  return data[0];
} 