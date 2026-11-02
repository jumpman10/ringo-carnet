#!/usr/bin/env node
import { dbService, getTargetDecemberYear } from '../server/db.js';

// Parse optional --year argument (e.g. node scripts/purge-non-december.js --year=2026)
let targetYear = null;
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--year=')) {
    targetYear = Number(arg.split('=')[1]);
  } else if (!isNaN(Number(arg))) {
    targetYear = Number(arg);
  }
}

if (!targetYear) {
  targetYear = getTargetDecemberYear();
}

console.log(`\n======================================================`);
console.log(`🧹 Depuración de socios - Diciembre ${targetYear}`);
console.log(`======================================================\n`);

const preview = dbService.previewPurgeMembersExceptDecember(targetYear);

console.log(`Total de socios actuales: ${preview.totalCount}`);
console.log(`Socios a conservar (ingresaron o pagaron en Dic ${targetYear}): ${preview.keptCount}`);
console.log(`Socios a eliminar: ${preview.deletedCount}`);

if (preview.deletedCount === 0) {
  console.log(`\n✅ No hay socios para eliminar con el criterio de Diciembre ${targetYear}.`);
  process.exit(0);
}

console.log(`\nEjecutando depuración y creando copia de seguridad automática...`);
const result = dbService.purgeMembersExceptDecember(targetYear);

console.log(`\n🎉 Operación completada con éxito:`);
console.log(`- Socios conservados: ${result.keptCount}`);
console.log(`- Socios eliminados: ${result.deletedCount}`);
console.log(`- Año de diciembre evaluado: ${result.targetYear}\n`);

