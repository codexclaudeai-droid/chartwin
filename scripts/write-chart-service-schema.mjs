import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { renderChartServicePostgresSchema } from '../src/server/chart-service/database-schema.ts';

const outputPath = resolve(process.argv[2] ?? 'docs/02-design/features/chart-service-schema.sql');

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, renderChartServicePostgresSchema(), 'utf8');

console.log(`Wrote chart service schema to ${outputPath}`);
