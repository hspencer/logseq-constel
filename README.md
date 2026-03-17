# LogSeq-Con§tel

**Vista de constelación para LogSeq** — un layout alternativo que divide la pantalla en dos: a la izquierda el grafo de conexiones de la página actual, a la derecha su contenido.

## Qué hace

- **Split 50/50**: grafo interactivo (izquierda) + contenido de la página (derecha)
- **Navegación por grafo**: click en un nodo cambia la página mostrada y recentra el grafo
- **Queries en el grafo**: filtra nodos por texto, tags, propiedades o número de conexiones
- **Grafo local**: muestra la página actual, sus backlinks, forward links, y conexiones entre vecinos (2° grado)
- **Hover**: destaca las conexiones directas de cada nodo
- **Drag & zoom**: nodos arrastrables, zoom con scroll

## Sintaxis de queries

El campo de búsqueda en la esquina superior izquierda acepta:

| Sintaxis | Ejemplo | Descripción |
|---|---|---|
| texto libre | `neural` | Filtra nodos cuyo nombre contenga el texto |
| `#tag` | `#project` | Filtra por tags de la página |
| `key:value` | `status:active` | Filtra por propiedades de la página |
| `degree>N` | `degree>3` | Solo nodos con más de N conexiones |

Se pueden combinar: `#project status:active degree>2 neural`

## Atajos

- **Cmd+Shift+G** (Mac) / **Ctrl+Shift+G**: toggle de la vista Constel
- **Botón en toolbar**: el icono de constelación abre/cierra la vista

## Instalación (desarrollo)

```bash
cd logseq-constel
npm install
npm run build
```

En LogSeq:
1. `Settings` → `Advanced` → activar `Developer mode`
2. `Plugins` → `Load unpacked plugin`
3. Seleccionar la carpeta `logseq-constel`

## Stack

- TypeScript + Vite
- D3.js (force-directed graph)
- LogSeq Plugin API (`@logseq/libs`)
