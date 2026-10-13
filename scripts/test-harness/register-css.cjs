// The structural CLI reads schemas through the block registry, which eagerly
// imports React components. Node has no CSS loader; styles are irrelevant here.
// Browser rendering keeps its real Next.js CSS pipeline (do not import this there).
const Module = require('node:module')
Module._extensions['.css'] ??= module => { module.exports = {} }
