import fetch from 'node-fetch';

// Función para obtener la fecha real de internet (UTC)
async function getRealDateFromInternet() {
  const services = [
    'https://worldtimeapi.org/api/ip',
    'https://timeapi.io/api/Time/current/zone?timeZone=UTC',
    'https://api.timezonedb.com/v2.1/get-time-zone?key=demo&format=json&by=zone&zone=UTC'
  ];
  for (const service of services) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(service, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (response.ok) {
        const data: any = await response.json();
        let realDate;
        if (service.includes('worldtimeapi')) {
          realDate = new Date(data.utc_datetime);
        } else if (service.includes('timeapi.io')) {
          realDate = new Date(data.dateTime);
        } else if (service.includes('timezonedb')) {
          realDate = new Date(data.formatted);
        }
        if (realDate && !isNaN(realDate.getTime())) {
          return realDate;
        }
      }
    } catch (error) {
      continue;
    }
  }
  // Si todos fallan, usar fecha local
  return new Date();
}

export async function buildPromptAsync({ businessData, message, source, availability }: { businessData: any, message: string, source: string, availability?: any }) {
  // Determinar el rol de NNIA según el canal/source
  let rol = '';
  if (source === 'client-panel') {
    rol = 'Eres la asistente personal del usuario, dueña o dueño del negocio. Responde de forma profesional, proactiva y con información interna del negocio.';
  } else {
    rol = 'Eres la asistente de ventas y atención al cliente del negocio. Atiendes a visitantes y potenciales clientes en la web o redes sociales. Solo usa información pública del negocio.';
  }

  // Construir contexto del negocio con solo información pública
  const businessContext = {
    nombre: businessData.business_name,
    descripcion: businessData.description,
    tipo: businessData.business_type,
    direccion: businessData.address,
    telefono: businessData.phone,
    email: businessData.email,
    sitio_web: businessData.website,
    horarios: businessData.opening_hours,
    servicios: businessData.services,
    productos: businessData.products,
    slogan: businessData.slogan,
    mision: businessData.mission,
    valores: businessData.values,
    redes_sociales: businessData.social_media,
    sobre_nosotros: businessData.about,
    preguntas_frecuentes: businessData.faq,
    testimonios: businessData.testimonials,
    equipo: businessData.team,
    premios: businessData.awards,
    certificaciones: businessData.certifications,
    politicas: businessData.policies,
    informacion_contacto: businessData.contact_info
  };

  // Añadir disponibilidad y tipos de cita al contexto
  const citaContext = availability ? {
    disponibilidad_citas: availability.days,
    horarios_citas: availability.hours,
    tipos_cita: availability.types
  } : {};

  // Obtener la fecha real actual (preferentemente de internet)
  const today = await getRealDateFromInternet();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const exampleDate = `${yyyy}-${mm}-${dd}`;

  // Instrucción especial para agendar citas
  const citaInstruccion = `Si en la conversación tienes todos los datos para agendar una cita (nombre, email, tipo, día y hora), responde SOLO con la frase: CREAR_CITA: seguido de los datos en formato JSON, por ejemplo: CREAR_CITA: {"name":"Juan Pérez","email":"juan@email.com","type":"phone","date":"${exampleDate}","time":"10:00","origin":"web"}`;

  // Solo retornar el mensaje del usuario, el contexto debe estar en la configuración del Assistant
  return [
    {
      role: 'user',
      content: `Información del negocio: ${JSON.stringify(businessContext)}. Configuración de citas: ${JSON.stringify(citaContext)}. Canal: ${source}. ${rol}\n${citaInstruccion}\n\nMensaje del usuario: ${message}`,
    },
  ];
} 