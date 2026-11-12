import { defineConfig } from "tsup";

// Bundles the service into dist/. Workspace packages (`@ech/*`) ship raw TS,
// so they are inlined; npm deps stay external. tsup switches to swc for files
// with decorators because tsconfig enables emitDecoratorMetadata (Nest DI).
// `vercel-handler` is the serverless entry that api/index.js re-exports.
export default defineConfig({
	entry: {
		main: "src/main.ts",
		"vercel-handler": "src/vercel-handler.ts",
		migrate: "src/migrate.ts",
		"usage-report": "src/usage-report.ts",
	},
	format: ["esm"],
	platform: "node",
	target: "node22",
	outDir: "dist",
	sourcemap: true,
	clean: true,
	splitting: false,
	removeNodeProtocol: false,
	noExternal: [/^@ech\//],
});
