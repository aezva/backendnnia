const dotenv = require('dotenv');
const { setupAssistant } = require('./dist/services/openai.js');

dotenv.config();

async function main() {
  try {
    console.log('🔄 Actualizando NNIA Assistant con capacidades de internet...');
    
    const assistant = await setupAssistant();
    
    console.log('✅ Assistant actualizado exitosamente!');
    console.log('📋 Detalles del Assistant:');
    console.log(`   ID: ${assistant.id}`);
    console.log(`   Nombre: ${assistant.name}`);
    console.log(`   Modelo: ${assistant.model}`);
    console.log('🌐 Capacidades: Acceso a internet para información real y actualizada');
    
    console.log('\n🚀 NNIA ahora puede:');
    console.log('   - Obtener fecha y hora actual real');
    console.log('   - Consultar clima y condiciones meteorológicas');
    console.log('   - Buscar información actualizada sobre cualquier tema');
    console.log('   - Proporcionar respuestas basadas en información real');
    
    console.log('\n✅ ¡NNIA está listo con acceso completo a internet!');
    
  } catch (error) {
    console.error('❌ Error actualizando assistant:', error);
    process.exit(1);
  }
}

main(); 