# bishrant-portfolio

Custom scripts for **bishrant.com** (Webflow site `66d46ff703091f83e3abce17`). The page layout and styles
live in Webflow. This repo holds the motion and interaction code: page transitions, the cursor, specular
buttons, the Home peel and 3D hero, the case study animations.

## How the site loads this code

Webflow custom code loads each file from jsDelivr, pinned to a git tag:

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/RoshitShrestha/bishrant-portfolio@1.8.1/cursor.js" defer></script>
```

`tools/webflow-map.json` lists every page and file (the site footer plus 9 page footers). Everything
the site loads is pinned to the same version. A release changes only that version number.

Conventions that keep the site working:
- Plain ES modules, no build step. Relative imports only (`./home/speel/main.js`).
- GSAP, ScrollTrigger, SplitText and jQuery are **globals from Webflow**. Do not import them.
- `three` comes from the importmap in the Home and Ncell head code (`three@0.182.0`).
- Elements are found by `data-*` attributes set in Webflow (`data-case-anim`, `data-transition-page-block`, ...).
  Rename one here only together with Webflow.

## Workflow

One-time: `cd tools && npm install`.

1. **Edit locally.**
2. **Preview on the real site:** `cd tools && npm run preview -- /about`. This opens bishrant.com with your
   local files in place of the jsDelivr ones. Webflow does not change, and only that window sees your
   edits. Reload after saving.
3. **Check every page:** `npm run check` (files exist, imports resolve, everything parses), then
   `npm run smoke` (runs each mapped page headless with local files and reports errors).
4. **Commit to main.** Pushing main does not change the live site, which is pinned to a tag.
5. **Release:** `npm run release` (or `npm run release -- 1.9.0`). It checks, pushes, tags the next
   version, and waits until jsDelivr serves every file byte for byte.
6. **Point Webflow at the new tag:** the release prints the exact old and new URL prefixes. Replace them
   in the 10 blocks in `webflow-map.json` and nothing else. Update `liveCdnBase`/`liveVersion` there,
   then publish. To roll back, set the old prefix again.

Releases use `1.8.1`-style tags. The old `v1.0.x` tags are ignored.

The repo must stay **public**: jsDelivr cannot read private repos (tried 1 Nov 2026, every new tag
returned 404). It moved from `RoshitShrestha` to `bishrant-personal`. Webflow still loads the old name at
`1.8.1`, but new tags only resolve under `bishrant-personal`, so the first release switches the prefix.
`1.8.2` was tagged by mistake while the repo was private. It only adds `tools/`; its site files are the same as `1.8.1`.
