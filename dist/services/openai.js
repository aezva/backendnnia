"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.askNNIAWithModel = askNNIAWithModel;
exports.askNNIAWithAssistantAPI = askNNIAWithAssistantAPI;
exports.setupAssistant = setupAssistant;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const openai_1 = __importDefault(require("openai"));
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
const assistantId = process.env.OPENAI_ASSISTANT_ID || '';
// Función para chat directo con modelo (sin Assistant API) - MANTENER PARA COMPATIBILIDAD
async function askNNIAWithModel(messages, model = 'gpt-3.5-turbo') {
    const formattedMessages = messages.map(m => ({ role: m.role, content: m.content }));
    const completion = await openai.chat.completions.create({
        model,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 1024,
    });
    return {
        message: completion.choices[0]?.message?.content || '',
        allMessages: completion.choices,
    };
}
// NUEVA: Función mejorada con Assistant API
async function askNNIAWithAssistantAPI(messages, threadId) {
    try {
        console.log('🔧 Intentando usar Assistant API...');
        console.log('Assistant ID:', assistantId);
        if (!assistantId) {
            console.error('❌ No hay OPENAI_ASSISTANT_ID configurado');
            throw new Error('Assistant ID no configurado');
        }
        // 1. Si no hay thread, crear uno nuevo
        let thread = threadId;
        if (!thread) {
            console.log('📝 Creando nuevo thread...');
            const threadRes = await openai.beta.threads.create();
            thread = threadRes.id;
            console.log('✅ Thread creado:', thread);
        }
        else {
            console.log('📝 Usando thread existente:', thread);
        }
        // 2. Solo añadir mensajes de usuario (no system)
        const userMsg = messages.find(m => m.role === 'user');
        if (userMsg) {
            console.log('💬 Agregando mensaje de usuario...');
            await openai.beta.threads.messages.create(thread, {
                role: 'user',
                content: userMsg.content,
            });
        }
        // 3. Ejecutar el assistant
        console.log('🤖 Ejecutando assistant...');
        const run = await openai.beta.threads.runs.create(thread, {
            assistant_id: assistantId
        });
        console.log('✅ Run iniciado:', run.id);
        // 4. Esperar a que el run termine (polling mejorado)
        let runStatus = run.status;
        let runResult = run;
        let attempts = 0;
        const maxAttempts = 150; // 60 segundos máximo
        console.log('⏳ Esperando que el run termine...');
        while ((runStatus === 'queued' || runStatus === 'in_progress') && attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 400));
            runResult = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread });
            runStatus = runResult.status;
            attempts++;
            if (attempts % 10 === 0) {
                console.log(`⏳ Run status: ${runStatus} (intento ${attempts})`);
            }
            // Si requiere acción del usuario, manejar aquí
            if (runStatus === 'requires_action') {
                console.log('⚠️ Assistant requiere acción del usuario');
                break;
            }
        }
        console.log(`🏁 Run finalizado con status: ${runStatus}`);
        // 5. Verificar si el run fue exitoso
        if (runStatus !== 'completed') {
            console.error('❌ Run no completado:', runStatus);
            throw new Error(`Run failed with status: ${runStatus}`);
        }
        // 6. Obtener los mensajes finales del thread
        console.log('📨 Obteniendo respuesta del assistant...');
        const messagesFinales = await openai.beta.threads.messages.list(thread);
        const lastMessage = messagesFinales.data.find((msg) => msg.role === 'assistant');
        let assistantText = '';
        if (lastMessage && lastMessage.content && Array.isArray(lastMessage.content)) {
            const textBlock = lastMessage.content.find((block) => block.type === 'text');
            if (textBlock && 'text' in textBlock && textBlock.text && 'value' in textBlock.text) {
                assistantText = textBlock.text.value;
            }
        }
        console.log('✅ Assistant API funcionando correctamente');
        console.log('💬 Respuesta:', assistantText.substring(0, 100) + '...');
        return {
            threadId: thread,
            run: runResult,
            message: assistantText,
            allMessages: messagesFinales.data,
        };
    }
    catch (error) {
        console.error('❌ Error en Assistant API:', error);
        console.log('�� Usando fallback al modelo directo...');
        // Fallback al modelo directo si Assistant API falla
        const fallbackResponse = await askNNIAWithModel(messages);
        return {
            threadId: threadId || 'fallback',
            message: fallbackResponse.message,
            allMessages: fallbackResponse.allMessages,
            error: 'assistant_api_failed'
        };
    }
}
// Función para crear o actualizar el Assistant con configuración completa
async function setupAssistant() {
    try {
        const assistantConfig = {
            name: "NNIA Assistant",
            instructions: `Eres NNIA, una asistente de inteligencia artificial profesional y proactiva para negocios.

CARACTERÍSTICAS PRINCIPALES:
- Eres proactiva y útil
- Puedes agendar citas cuando tengas todos los datos necesarios
- Eres profesional pero amigable
- SIEMPRE usas la fecha que se te proporciona en el contexto del mensaje

FECHA ACTUAL:
- En cada mensaje recibirás la fecha actual real
- SIEMPRE usa esa fecha para cualquier referencia temporal
- Si te preguntan por la fecha, responde con la fecha que se te proporciona
- NUNCA uses fechas hardcodeadas o del pasado

PARA AGENDAR CITAS:
Si tienes todos los datos (nombre, email, tipo, fecha, hora), responde SOLO con:
CREAR_CITA: {"name":"Nombre","email":"email@ejemplo.com","type":"phone","date":"YYYY-MM-DD","time":"HH:MM","origin":"web"}

IMPORTANTE:
- La fecha que recibes en el contexto es la fecha actual real
- Usa esa fecha para todas las referencias temporales
- Para citas futuras, sugiere fechas posteriores a la fecha actual
- Sé específica y útil en tus respuestas
- Mantén un tono profesional pero cercano`,
            model: "gpt-4"
        };
        let assistant;
        if (assistantId) {
            // Actualizar assistant existente
            assistant = await openai.beta.assistants.update(assistantId, assistantConfig);
            console.log('Assistant actualizado:', assistant.id);
        }
        else {
            // Crear nuevo assistant
            assistant = await openai.beta.assistants.create(assistantConfig);
            console.log('Nuevo assistant creado:', assistant.id);
            console.log('⚠️  IMPORTANTE: Agrega OPENAI_ASSISTANT_ID=' + assistant.id + ' a tus variables de entorno');
        }
        return assistant;
    }
    catch (error) {
        console.error('Error configurando assistant:', error);
        throw error;
    }
}
// Export para CommonJS (para el script de configuración)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        askNNIAWithModel,
        askNNIAWithAssistantAPI,
        setupAssistant
    };
}
