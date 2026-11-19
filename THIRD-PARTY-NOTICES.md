# Third-party notices

## PlantUML engine

`main.js` bundles the TeaVM-compiled PlantUML engine distributed as
[`@plantuml/core`](https://www.npmjs.com/package/@plantuml/core), including its
Smetana layout runtime (`viz-global.js`) and theme table (`themes.js`).

- Copyright (c) PlantUML / Arnaud Roques
- License: MIT

## PlantUML standard library

`stdlib/` and the embedded name -> source map are taken from
[plantuml-stdlib](https://github.com/plantuml/plantuml-stdlib). Each file
embeds its own `PLANTUML_STDLIB_INFO` record with author and license. The
bundled set is limited to permissively licensed entries:

- C4 (`c4.min.js`, `classy-c4.min.js`): MIT
- ArchiMate (`archimate.min.js`): MIT
- Domain Story (`domainstory.min.js`): MIT
- Azure, GCP, Kubernetes, Cloud Insight, Cloudogu, Elastic, EIP, EDGY, OSA2,
  Classy, emoji and OpenIconic sets: as declared upstream.

The GPL-licensed AdaML library (`adaml.min.js`) is deliberately **not**
bundled.

## Render core

`vendor/plantuml-core/core.js` is the shared render core used by both this
plugin and the DSH PlantUML plugin. Its rendering pipeline is derived from the
MIT-licensed DSH plugin by dlutcat, restructured into a host-agnostic module.
