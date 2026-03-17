# Con§tel

**Interactive constellation graph for LogSeq** — a split-view layout with a force-directed graph on the left and LogSeq's native editor on the right.

![Con§tel screenshot](./src/constel.png)

## Features

- **Split view**: interactive D3 graph (left) + native LogSeq editor (right), resizable via drag handle
- **Graph navigation**: click any node to navigate — the graph recenters and LogSeq opens the page
- **Page search**: autocomplete search bar to jump to any page in your graph
- **Navigation history**: pill-based breadcrumbs tracking your visited pages, with orange ring indicators on graph nodes
- **Property filters**: toggle switches for page properties that filter the visible graph
- **Dark mode**: automatically detects LogSeq's theme
- **Local graph**: shows the current page, its backlinks, forward links, and 2nd-degree connections
- **Hover highlight**: dims unconnected nodes to reveal direct relationships
- **Drag & zoom**: draggable nodes, scroll to zoom

## Keyboard shortcut

- **Cmd+Ctrl+C** (Mac) / **Ctrl+Ctrl+C**: toggle Con§tel view
- **Esc**: close the view
- Toolbar button: the **§** icon in LogSeq's toolbar

## Settings

| Setting | Default | Description |
|---|---|---|
| Graph depth | 2 | Degrees of separation (1 = direct only) |
| Repulsion force | -200 | More negative = more spread out |
| Link distance | 80px | Ideal distance between connected nodes |

## Installation

### From marketplace

Search for **Con§tel** in LogSeq's plugin marketplace.

### Manual (development)

```bash
git clone https://github.com/hspencer/logseq-constel.git
cd logseq-constel
npm install
npm run build
```

In LogSeq:
1. `Settings` > `Advanced` > enable `Developer mode`
2. `Plugins` > `Load unpacked plugin`
3. Select the `logseq-constel` folder

## Stack

- TypeScript + Vite
- D3.js v7 (force-directed graph)
- LogSeq Plugin API (`@logseq/libs`)

## License

MIT
