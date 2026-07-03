import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { compression } from 'vite-plugin-compression2';

import { viteNearbyMock } from './vite.nearby-mock.ts';

export default defineConfig({
	plugins: [
		viteNearbyMock(),
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['cookie', 'baseLocale']
		}),
		compression({
			algorithms: ['gzip'],
			//deleteOriginalAssets: true,
			include: [/\.(js)$/, /\.(css)$/, /\.(html)$/]
		})
	]
});
