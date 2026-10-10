# Duel Spirits — Ciudad Batalla

Juego fan de Yu-Gi-Oh! en mundo abierto, con la estructura de un Pokémon clásico: pueblo inicial, tres barajas para elegir, rival, espíritus de duelo en la hierba alta y duelistas en la ruta. Los duelos usan las reglas oficiales completas.

**Jugar:** https://dantevvv.github.io/duel-spirits/

Funciona en PC y en celular, con Chrome, Edge, Firefox o Safari actualizados. La partida se guarda en el navegador de cada dispositivo.

**Controles:** flechas o WASD para moverte · Z, Espacio o Enter = A · X o Shift = B (mantener para correr) · Esc o M = menú. En el celular aparecen botones táctiles; conviene jugar con el teléfono acostado. En el duelo se juega con el mouse o tocando.

## Avisos

Proyecto fan sin fines de lucro, en desarrollo. No está afiliado a Konami ni cuenta con su aprobación. Yu-Gi-Oh!, sus personajes, cartas e ilustraciones pertenecen a Kazuki Takahashi, Shueisha y Konami.

## Créditos y licencia

- Motor de reglas: [ygopro-core](https://github.com/edo9300/ygopro-core) de Project Ignis, compilado a WebAssembly (`engine/ocgcore.wasm`). El puente y el script de compilación están en `fuente-motor/`.
- Efectos de las cartas: [CardScripts](https://github.com/ProjectIgnis/CardScripts) de Project Ignis (`data/scripts.json`).
- Protocolo de mensajes: portado de ocgcore-wasm (MIT).
- Mundo: [Phaser 3](https://phaser.io) (MIT).

El código de este repositorio se distribuye bajo AGPL-3.0, la licencia del motor (ver `fuente-motor/LICENSE-ygopro-core` y `data/COPYING-CardScripts`).
