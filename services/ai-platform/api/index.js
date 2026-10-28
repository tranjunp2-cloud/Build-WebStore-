// Vercel function entry. The app itself is built by tsup (`pnpm build:vercel`) into dist/;
// this file only re-exports its handler so Vercel traces dist/ and its npm dependencies.
// Every path is rewritten here by vercel.json.
import handler from "../dist/vercel-handler.js";

export default handler;
