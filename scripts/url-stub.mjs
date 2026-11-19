/**
 * Browser stub for Node's `url` module.
 *
 * Viz.js contains a Node-only `require("url").pathToFileURL(__filename)` branch
 * that is dead code in a renderer (`document` exists), but the bundler still
 * has to resolve the import. The stub keeps the browser bundle buildable and
 * is never called.
 */
export function pathToFileURL(path) {
  return { href: String(path) }
}
