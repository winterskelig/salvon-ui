# @salvon/ui

A React component library written from scratch: accessible components that ship
with a default look, where every part of that look is easy to override.
Think "MUI, but much simpler": no theme object, no spacing multipliers, no
style callbacks.

## Principles

- **React is the only runtime dependency.** It is a peer dependency (`>=19`).
  Nothing goes in `dependencies`. Do not add packages without asking.
- **One package, one component set.** No separate unstyled and styled libraries.
  Each component owns its behaviour and its default template.
- **Accessibility is the product.** Follow the WAI-ARIA Authoring Practices for
  roles, keyboard interaction and focus management.
- **Plain data over magic.** Styles and templates are plain serializable
  objects. Numbers are pixels. State is exposed through data attributes.
- **Low tooling overhead.** npm only, no workspaces, no monorepo tools.

## Stack

| Purpose | Tool |
|---|---|
| Package manager | npm (not pnpm, not Yarn) |
| Build | tsdown (ESM only, with type declarations) |
| Local development | Vite playground in `playground/` |
| Tests | Vitest (jsdom, globals) + Testing Library + user-event |
| Language | TypeScript, strict |

## Commands

```bash
npm run dev          # playground with hot reload, reads src/ directly
npm test             # Vitest in watch mode
npx vitest run       # tests once
npm run typecheck    # tsc --noEmit
npm run build        # tsdown -> dist/, then copies the tokens CSS to dist/styles.css
npm pack --dry-run   # check what would be published
```

Installing packages: always use
`npm install --min-release-age=14 --ignore-scripts -D <name>`.
Everything is a dev dependency.

## Layout

```
src/
├─ index.ts         # public API: components, UIProvider, public types
├─ esixs/           # styling engine: sx object -> class name + CSS text
├─ system/          # templates: Template types, UIProvider, useTemplate
├─ components/      # one folder per component (component, template, test)
├─ utils/           # shared hooks and helpers (useControllableState, ...)
└─ styles/          # design tokens as CSS variables
playground/         # dev-only app, never published
```

**Import direction (strict):**
- `esixs` imports nothing from the rest of the repo (it may become its own package).
- `system` imports `esixs`.
- `components` import `system` and `utils`.

## Public entry points

| Import | Source | Contents |
|---|---|---|
| `@salvon/ui` | `src/index.ts` | Components, `UIProvider`, types |
| `@salvon/ui/esixs` | `src/esixs/index.ts` | The styling engine on its own |
| `@salvon/ui/styles.css` | `src/styles/` | Token CSS variables |

The package name must match in four places: `package.json` (`name`),
`tsconfig.json` (`paths`), `vite.config.ts` (aliases), and playground imports.
The playground imports the package by name, exactly as a consumer would.

## How components are built

- **Controlled and uncontrolled.** Every stateful component accepts
  `value` / `onValueChange` and `defaultValue` (named per component, e.g.
  `pressed` / `onPressedChange`). Use `useControllableState`.
- **State as data attributes.** Emit `data-state`, `data-disabled`, and so on.
  Styling hooks onto these; no state-dependent style functions.
- **Compound components** for multi-part widgets (`Dialog.Root`,
  `Dialog.Trigger`, `Dialog.Popup`), sharing state through context.
- **Pass through** `className`, `ref` (plain prop in React 19) and remaining
  props to the root element. Call the user's event handlers first and respect
  `event.defaultPrevented`.
- **Tests assert behaviour through roles and keyboard**, not implementation details.

## How styling works (overview)

Consumers customize at three levels, from broadest to narrowest:

1. **Tokens.** CSS variables named `--sv-<category>-<name>`; override them on
   `:root` or any subtree.
2. **Templates.** Each component's default look is a plain object
   (`slots` -> `base` + `variants`, plus `defaultVariants`). Consumers override
   or replace it for every instance via `<UIProvider templates={...}>`.
3. **`sx` prop.** Per-instance style object, MUI-like, with nesting
   (`'&:hover'`), media queries and responsive values.

Precedence: default template < provider override < variant < instance `sx`.
Everything for one element is merged into a single object, so each element gets
one generated class.

esixs turns the merged object into a hashed class and CSS text, and React 19's
`<style href precedence>` hoists and deduplicates it. No Emotion, no
styled-components, no build plugin.

Rules worth remembering:
- A number is pixels (`p: 16` -> `padding:16px`), except unitless properties.
  There is no spacing scale.
- Token names resolve to CSS variables (`color: 'accent'`); other strings pass through.
- The `sv` prefix is defined once, in `src/system/esixs.ts`.

## Roadmap

1. Project scaffold with an unstyled Toggle (done).
2. esixs serializer, then `merge` and the React binding.
3. Template system: `UIProvider`, `useTemplate`.
4. Toggle as the reference styled component.
5. Tabs (roving focus, keyboard navigation).
6. Dialog (portal, focus trap, dismissal, scroll lock).
7. First publish: test the `npm pack` tarball in a separate app, including a
   Next.js app, before `npm publish --access public`.

## Do not

- Add runtime dependencies, or put React in `dependencies`.
- Introduce pnpm, Yarn, workspaces, or a monorepo tool.
- Add a CSS-in-JS library, a spacing multiplier, or a JavaScript theme object.
- Put functions inside templates.
- Break the import direction between `esixs`, `system` and `components`.
- Use `npm link` for consumer testing (it duplicates React); use `npm pack`.
- Ship CommonJS output.
