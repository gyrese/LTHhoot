import esbuild from "esbuild"

export const config = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  minify: true,
  platform: "node",
  outfile: "dist/index.cjs",
  sourcemap: true,
  external: ["sharp"],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
}

esbuild.build(config)
