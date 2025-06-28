"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.getClientData = getClientData;
exports.getPublicBusinessData = getPublicBusinessData;
exports.getAppointments = getAppointments;
exports.createNotification = createNotification;
exports.createAppointmentNotification = createAppointmentNotification;
exports.createAppointment = createAppointment;
exports.getAvailability = getAvailability;
exports.setAvailability = setAvailability;
exports.getAvailabilityAndTypes = getAvailabilityAndTypes;
exports.updateAppointment = updateAppointment;
exports.deleteAppointment = deleteAppointment;
exports.getNotifications = getNotifications;
exports.markNotificationRead = markNotificationRead;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
console.log('DEBUG SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('DEBUG SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '[PRESENTE]' : '[VACÍA]');
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
async function getClientData(clientId) {
    // Ejemplo: obtener datos del cliente desde la tabla 'clients'
    const { data, error } = await exports.supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
    if (error)
        throw error;
    return data;
}
async function getPublicBusinessData(clientId) {
    // Obtener business_name desde clients
    const { data: client, error: clientError } = await exports.supabase
        .from('clients')
        .select('id, business_name')
        .eq('id', clientId)
        .single();
    if (clientError)
        throw clientError;
    // Obtener información pública del negocio desde business_info
    const { data: businessInfo, error: businessError } = await exports.supabase
        .from('business_info')
        .select('*')
        .eq('client_id', clientId)
        .single();
    if (businessError)
        throw businessError;
    // Combinar los datos, EXCLUYENDO el id del businessInfo para evitar confusión
    const { id, ...businessInfoWithoutId } = businessInfo;
    const combined = {
        business_name: client.business_name,
        // NO incluir business_info_id para evitar que el Assistant API lo use incorrectamente
        ...businessInfoWithoutId
    };
    // Filtrar campos vacíos o nulos para limpiar la respuesta
    const cleanData = Object.fromEntries(Object.entries(combined).filter(([_, value]) => value !== null && value !== undefined && value !== ''));
    return cleanData;
}
// Obtener citas de un cliente
async function getAppointments(clientId) {
    console.log('🔍 getAppointments - clientId:', clientId);
    try {
        const { data, error } = await exports.supabase
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
    }
    catch (error) {
        console.error('❌ Error completo en getAppointments:', error);
        throw error;
    }
}
// Helper para limpiar notificación antes de insertar
function cleanNotificationInput(notification) {
    const { id, read, created_at, ...rest } = notification;
    return {
        ...rest,
        data: typeof rest.data === 'object' && rest.data !== null ? rest.data : {},
    };
}
// Función de validación profesional para client_id
async function validateClientId(clientId) {
    if (!clientId || typeof clientId !== 'string') {
        return false;
    }
    try {
        // Verificar que el client_id existe en la tabla clients
        const { data, error } = await exports.supabase
            .from('clients')
            .select('id')
            .eq('id', clientId)
            .single();
        if (error) {
            console.error('Error validando client_id:', error.message);
            return false;
        }
        if (!data) {
            return false;
        }
        return true;
    }
    catch (error) {
        console.error('Error inesperado validando client_id:', error);
        return false;
    }
}
// Crear notificación con validación profesional
async function createNotification(notification) {
    // Validar client_id antes de crear la notificación
    const isValidClientId = await validateClientId(notification.client_id);
    if (!isValidClientId) {
        const error = new Error(`client_id inválido: ${notification.client_id}. Debe ser un ID válido de la tabla clients.`);
        console.error('Validación fallida en createNotification:', error.message);
        throw error;
    }
    // Mapear campos al formato correcto de la tabla notifications
    const cleanNotification = {
        client_id: notification.client_id,
        type: notification.type,
        title: notification.title,
        body: notification.message || notification.body, // usar 'body' en lugar de 'message'
        data: typeof notification.data === 'string' ? notification.data : JSON.stringify(notification.data || {})
    };
    try {
        const { data, error } = await exports.supabase
            .from('notifications')
            .insert([cleanNotification])
            .select();
        if (error) {
            console.error('Error en createNotification:', error);
            throw error;
        }
        return data[0];
    }
    catch (error) {
        console.error('Error completo en createNotification:', error);
        throw error;
    }
}
// Función para validar y limpiar datos de cita antes de insertar
function validateAppointmentData(appointment) {
    // Campos que SÍ existen en la tabla appointments
    const validFields = ['client_id', 'name', 'email', 'type', 'date', 'time', 'status', 'origin'];
    const cleanData = {};
    // Solo incluir campos válidos
    validFields.forEach(field => {
        if (appointment[field] !== undefined && appointment[field] !== null) {
            cleanData[field] = appointment[field];
        }
    });
    // Valores por defecto
    if (!cleanData.status)
        cleanData.status = 'pending';
    if (!cleanData.origin)
        cleanData.origin = 'web';
    return cleanData;
}
// Función helper específica para crear notificaciones de citas
async function createAppointmentNotification(appointmentData) {
    try {
        // Obtener el client_id correcto de la cita
        const clientId = appointmentData.client_id;
        if (!clientId) {
            console.error('No hay client_id en los datos de la cita');
            return null;
        }
        // Validar que el client_id existe
        const isValidClient = await validateClientId(clientId);
        if (!isValidClient) {
            console.error('client_id inválido, no se crea notificación');
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
        const { data, error } = await exports.supabase
            .from('notifications')
            .insert([notificationData])
            .select()
            .single();
        if (error) {
            console.error('Error creando notificación de cita:', error);
            return null;
        }
        return data;
    }
    catch (error) {
        console.error('Error inesperado en createAppointmentNotification:', error);
        return null;
    }
}
// En createAppointment, obtener el id de business_info y usarlo en la notificación
async function createAppointment(appointment) {
    // Validar y limpiar datos antes de insertar
    const citaData = validateAppointmentData(appointment);
    try {
        const { data, error } = await exports.supabase
            .from('appointments')
            .insert([citaData])
            .select();
        if (error) {
            console.error('Error en createAppointment:', error);
            throw error;
        }
        const cita = data[0];
        // Intentar crear notificación asociada, pero no fallar si hay error
        if (cita && cita.client_id) {
            try {
                await createAppointmentNotification(cita);
            }
            catch (notifError) {
                console.error('Error creando notificación:', notifError);
                // NO lanzar error aquí - la cita ya se creó correctamente
            }
        }
        return cita;
    }
    catch (error) {
        console.error('Error completo en createAppointment:', error);
        throw error;
    }
}
// Obtener disponibilidad de un cliente
async function getAvailability(clientId) {
    const { data, error } = await exports.supabase
        .from('business_info')
        .select('appointment_days, appointment_hours, appointment_types')
        .eq('client_id', clientId)
        .single();
    if (error && error.code !== 'PGRST116')
        throw error; // PGRST116 = no rows found
    // Adaptar a formato esperado por el frontend
    return data ? {
        days: data.appointment_days ? data.appointment_days.split(',') : [],
        hours: data.appointment_hours || '',
        types: data.appointment_types ? data.appointment_types.split(',') : []
    } : { days: [], hours: '', types: [] };
}
// Guardar o actualizar disponibilidad
async function setAvailability(clientId, availability) {
    const { data, error } = await exports.supabase
        .from('business_info')
        .update({
        appointment_days: availability.days,
        appointment_hours: availability.hours,
        appointment_types: availability.types
    })
        .eq('client_id', clientId)
        .select();
    if (error)
        throw error;
    return data && data[0] ? {
        days: data[0].appointment_days ? data[0].appointment_days.split(',') : [],
        hours: data[0].appointment_hours || '',
        types: data[0].appointment_types ? data[0].appointment_types.split(',') : []
    } : { days: [], hours: '', types: [] };
}
// Obtener disponibilidad y tipos de cita de un cliente (helper para NNIA)
async function getAvailabilityAndTypes(clientId) {
    const { data, error } = await exports.supabase
        .from('business_info')
        .select('appointment_days, appointment_hours, appointment_types')
        .eq('client_id', clientId)
        .single();
    if (error && error.code !== 'PGRST116')
        throw error;
    return data ? {
        days: data.appointment_days ? data.appointment_days.split(',') : [],
        hours: data.appointment_hours || '',
        types: data.appointment_types ? data.appointment_types.split(',') : []
    } : { days: [], hours: '', types: [] };
}
// Actualizar una cita
async function updateAppointment(id, updates) {
    const { data, error } = await exports.supabase
        .from('appointments')
        .update(updates)
        .eq('id', id)
        .select();
    if (error)
        throw error;
    return data && data[0];
}
// Eliminar una cita
async function deleteAppointment(id) {
    const { error } = await exports.supabase
        .from('appointments')
        .delete()
        .eq('id', id);
    if (error)
        throw error;
    return { success: true };
}
// Obtener notificaciones de un cliente
async function getNotifications(clientId) {
    console.log('🔍 getNotifications - clientId recibido:', clientId);
    const { data, error } = await exports.supabase
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
async function markNotificationRead(id) {
    const { data, error } = await exports.supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .select();
    if (error)
        throw error;
    return data[0];
}
