import path from 'node:path';

import prettier from 'eslint-config-prettier';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import { configs, parser } from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';
import { importX, createNodeResolver } from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';

import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,

	// import-x
	importX.flatConfigs.recommended,
	importX.flatConfigs.typescript,

	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		settings: {
			'import-x/resolver-next': [
				createTypeScriptImportResolver({
					project: ['./tsconfig.json', './.svelte-kit/tsconfig.json'],
					alwaysTryTypes: true
				}),
				createNodeResolver({
					extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.d.ts', '.svelte']
				})
			],
			'import-x/core-modules': [
				'$app/environment',
				'$app/forms',
				'$app/navigation',
				'$app/paths',
				'$app/server',
				'$app/state',
				'$app/stores',
				'$app/types',
				'$env/dynamic/private',
				'$env/dynamic/public',
				'$env/static/private',
				'$env/static/public',
				'$service-worker'
			]
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',

			// import-x
			'import-x/no-unresolved': 'error',
			'import-x/named': 'off',
			'import-x/no-duplicates': 'warn',
			'import-x/order': [
				'warn',
				{
					groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
					'newlines-between': 'always'
				}
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: parser,
				svelteConfig
			}
		}
	},
	{
		plugins: {
			'unused-imports': unusedImports
		},
		rules: {
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'unused-imports/no-unused-imports': 'error',
			'unused-imports/no-unused-vars': [
				'warn',
				{
					vars: 'all',
					varsIgnorePattern: '^_',
					args: 'after-used',
					argsIgnorePattern: '^_'
				}
			]
		}
	}
);
