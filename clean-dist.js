import fs from 'node:fs';
import path from 'node:path';

// Укажите папку, куда ваш адаптер SvelteKit собирает билд 
// (Обычно это '.svelte-kit/output' или 'build' в зависимости от адаптера)
const BUILD_DIR = path.join(process.cwd(), '.svelte-kit', 'output');

function deleteOriginals(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    
    if (fs.statSync(fullPath).isDirectory()) {
      deleteOriginals(fullPath); // Рекурсивно заходим в папки
    } else {
      // Если для JS или CSS файла существует сжатая .gz или .br копия
      if (file.endsWith('.js') || file.endsWith('.css')) {
        const hasGz = fs.existsSync(`${fullPath}.gz`);
        const hasBr = fs.existsSync(`${fullPath}.br`);
        
        if (hasGz || hasBr) {
          fs.unlinkSync(fullPath);
          console.log(`🗑️  Удален оригинал: ${file}`);
        }
      }
    }
  }
}

console.log('🚀 Запуск очистки оригинальных файлов...');
deleteOriginals(BUILD_DIR);
console.log('✅ Очистка завершена!');