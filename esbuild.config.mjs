import esbuild from "esbuild";

const production = process.argv.includes("production");
const watch = process.argv.includes("--watch");

const context = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
	format: "cjs",
	target: "es2022",
	logLevel: "info",
	sourcemap: production ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
});

if (watch) {
	await context.watch();
} else {
	await context.rebuild();
	await context.dispose();
}
