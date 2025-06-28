import fetch from 'node-fetch';

// Función simplificada para obtener fecha actual
async function getCurrentDate(): Promise<string> {
  try {
    // Intentar obtener fecha de internet
    const response = await fetch('https://worldtimeapi.org/api/ip');
    if (response.ok) {
      const data = await response.json();
      const date = new Date(data.datetime);
      console.log('🌐 Fecha obtenida de internet:', date.toLocaleDateString('es-ES'));
      return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  } catch (error) {
    console.log('⚠️ No se pudo obtener fecha de internet, usando fecha local');
  }
  
  // Fallback a fecha local
  const localDate = new Date();
  console.log('📅 Usando fecha local:', localDate.toLocaleDateString('es-ES'));
  return localDate.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
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

  // Obtener la fecha real actual
  const currentDate = await getCurrentDate();
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const exampleDate = `${yyyy}-${mm}-${dd}`;

  // Instrucción especial para agendar citas
  const citaInstruccion = `Si en la conversación tienes todos los datos para agendar una cita (nombre, email, tipo, día y hora), responde SOLO con la frase: CREAR_CITA: seguido de los datos en formato JSON, por ejemplo: CREAR_CITA: {"name":"Juan Pérez","email":"juan@email.com","type":"phone","date":"${exampleDate}","time":"10:00","origin":"web"}`;

  // Incluir la fecha actual en el contexto para que NNIA siempre la use
  return [
    {
      role: 'user',
      content: `FECHA ACTUAL: ${currentDate} (${exampleDate})

Información del negocio: ${JSON.stringify(businessContext)}. 
Configuración de citas: ${JSON.stringify(citaContext)}. 
Canal: ${source}. 

${rol}

INSTRUCCIONES IMPORTANTES:
1. SIEMPRE usa la fecha actual real (${currentDate}) para cualquier referencia temporal
2. Si te preguntan por la fecha, responde con la fecha actual real
3. Para citas futuras, usa fechas posteriores a ${exampleDate}

${citaInstruccion}

Mensaje del usuario: ${message}`,
    },
  ];
}

// Función simplificada para compatibilidad
export async function buildPrompt(clientId: string, message: string, source: string): Promise<string> {
  const currentDate = await getCurrentDate();
  
  return `Eres NNIA, un asistente virtual inteligente y amigable para un negocio local. 

INFORMACIÓN ACTUAL:
- Fecha actual: ${currentDate}
- Cliente: ${clientId}
- Origen: ${source}

CAPACIDADES:
- Puedes acceder a internet para obtener información actualizada
- Tienes memoria de conversaciones previas
- Puedes agendar citas y recordatorios
- Puedes responder preguntas sobre el negocio
- Puedes proporcionar información sobre servicios y horarios

INSTRUCCIONES:
1. SIEMPRE usa la fecha actual real (${currentDate}) para cualquier referencia temporal
2. Sé amigable, profesional y útil
3. Si te preguntan por la fecha, responde con la fecha actual real
4. Si te preguntan por el clima, puedes buscar información actualizada
5. Para agendar citas, solicita: nombre, servicio, fecha y hora preferida
6. Mantén un tono conversacional y natural

Mensaje del usuario: ${message}

Responde de manera natural y útil, usando siempre la fecha actual real.`;
} 