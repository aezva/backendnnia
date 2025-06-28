import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import nniaRoutes from './routes/nnia';
import { setupAssistant } from './services/openai';

dotenv.config();
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'CARGADA' : 'VACÍA');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'CARGADA' : 'VACÍA');
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'CARGADA' : 'VACÍA');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/nnia', nniaRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Inicializar Assistant al arrancar
async function initializeAssistant() {
  try {
    console.log('🚀 Inicializando NNIA Assistant...');
    const assistant = await setupAssistant();
    console.log('✅ Assistant inicializado:', assistant.id);
    console.log('⚠️  IMPORTANTE: Actualiza OPENAI_ASSISTANT_ID en Railway con:', assistant.id);
  } catch (error) {
    console.error('❌ Error inicializando Assistant:', error);
    console.log('ℹ️  El servidor continuará sin el Assistant actualizado');
  }
}

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`Servidor NNIA escuchando en puerto ${PORT}`);
  
  // Inicializar Assistant después de que el servidor esté listo
  await initializeAssistant();
}); 