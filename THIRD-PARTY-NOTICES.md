# Third-party notices

## PlantUML engine

`main.js` bundles the TeaVM-compiled PlantUML engine distributed as
[`@plantuml/core`](https://www.npmjs.com/package/@plantuml/core) and its theme
table.

- Copyright (c) PlantUML / Arnaud Roques
- License: MIT

## Viz.js / Graphviz

`main.js` bundles Viz.js 3.24.0 as the Smetana layout runtime.

- Viz.js: Copyright (c) Michael Daines, MIT
- Graphviz: Copyright (c) AT&T / Graphviz contributors, EPL-1.0 (compiled to
  JavaScript in this distribution)

## Render core

`vendor/plantuml-core/core.js` is the shared render core used by both this
plugin and the DSH PlantUML plugin. Its rendering pipeline is derived from the
MIT-licensed DSH plugin by dlutcat, restructured into a host-agnostic module.
