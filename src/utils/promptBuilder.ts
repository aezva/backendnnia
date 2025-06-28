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