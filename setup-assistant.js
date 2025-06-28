const dotenv = require('dotenv');
const { setupAssistant } = require('./dist/services/openai.js');

dotenv.config();

async function main() {
  try {
    console.log('🔧 Configurando NNIA Assistant...');
    
    const assistant = await setupAssistant();
    
    console.log('✅ Assistant configurado exitosamente!');
    console.log('📋 Detalles del Assistant:');
    console.log(`   ID: ${assistant.id}`);
    console.log(`   Nombre: ${assistant.name}`);
    console.log(`   Modelo: ${assistant.model}`);
    
    if (!process.env.OPENAI_ASSISTANT_ID) {
      console.log('\n⚠️  IMPORTANTE: Agrega la siguiente variable de entorno:');
      console.log(`   OPENAI_ASSISTANT_ID=${assistant.id}`);
    } else {
      console.log('\n✅ Assistant ID ya configurado en variables de entorno');
    }
    
    console.log('\n🚀 NNIA está listo para usar Assistant API!');
    
  } catch (error) {
    console.error('❌ Error configurando assistant:', error);
    process.exit(1);
  }
}

main(); 