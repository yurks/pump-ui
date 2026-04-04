// vite.nearby-mock.ts
import fs from 'node:fs';
import path from 'node:path';

import { loadEnv, type Plugin } from 'vite';

export function viteNearbyMock(): Plugin {
	let enabled = false;

	return {
		name: 'vite-nearby-mock',
		enforce: 'pre',
		apply: 'serve',

		// Read env once at startup.
		config(_, { mode }) {
			const env = loadEnv(mode, process.cwd(), '');
			enabled = env.NEARBY_MOCKS === 'true';
		},

		async resolveId(source, importer) {
			if (!enabled || !importer) return null;
			if (source[0] === '\0' || source.startsWith('virtual:')) return null;

			// Let Vite resolve aliases, extensionless imports, index files, etc.
			const resolved = await this.resolve(source, importer, { skipSelf: true });
			if (!resolved || resolved.external) return null;

			const id = resolved.id;

			// Ignore already-mocked ids and anything that is not a real file path.
			if (id.includes('.mock.')) return null;
			if (!path.isAbsolute(id)) return null;

			const { dir, name, ext } = path.parse(id);

			// Skip files without a normal extension.
			if (!ext) return null;

			const mockId = path.join(dir, `${name}.mock${ext}`);
			if (!fs.existsSync(mockId)) return null;

			console.log(`[vite-nearby-mock] ${id} -> ${mockId}`);

			return mockId;
		}
	};
}
