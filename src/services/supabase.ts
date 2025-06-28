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

  // Combinar los datos
  const combined = {
    business_name: client.business_name,
    ...businessInfo
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
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });
    
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

// Crear notificación
export async function createNotification(notification: any) {
  const clean = cleanNotificationInput(notification);
  const { data, error } = await supabase
    .from('notifications')
    .insert([clean])
    .select();
  if (error) throw error;
  return data[0];
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

// En createAppointment, obtener el id de business_info y usarlo en la notificación
export async function createAppointment(appointment: any) {
  console.log('🔍 createAppointment - datos recibidos:', appointment);
  
  // Mapear campos del formato NNIA al formato de la base de datos
  const citaData = {
    client_id: appointment.client_id,
    client_name: appointment.name,
    client_email: appointment.email,
    service_name: appointment.type,
    appointment_date: appointment.date,
    appointment_time: appointment.time,
    status: appointment.status || 'pending',
    origin: appointment.origin || 'web',
    notes: appointment.notes || ''
  };

  console.log('🔍 createAppointment - datos mapeados:', citaData);

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
        await createNotification({
          client_id: cita.client_id,
          type: 'appointment_created',
          title: 'Nueva cita agendada',
          message: `Se ha agendado una cita para ${cita.client_name} el ${cita.appointment_date} a las ${cita.appointment_time}`,
          data: JSON.stringify(cita)
        });
        console.log('✅ Notificación creada exitosamente');
      } catch (notifError) {
        console.error('❌ Error creando notificación:', notifError);
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
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
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