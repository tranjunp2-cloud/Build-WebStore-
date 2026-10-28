import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		include: ["src/**/*.spec.ts"],
		exclude: ["node_modules/**", "dist/**"],
		env: {
			AI_PLATFORM_DATABASE_URL: "postgres://test:test@localhost:5432/ai_platform_test",
			AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
		},
	},
	plugins: [
		swc.vite({
			module: { type: "es6" },
			jsc: {
				parser: { syntax: "typescript", decorators: true },
				transform: { legacyDecorator: true, decoratorMetadata: true },
			},
		}),
	],
});
