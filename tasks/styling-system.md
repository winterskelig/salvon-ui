# Task: build the styling system for @salvon/ui

## Context

@salvon/ui is a React component library written from scratch. Its only runtime
dependency is React (peer, >=19). Components ship with a default look that
consumers can override in three ways: CSS variables (tokens), per-component
templates supplied through a provider, and a per-instance style prop called
**`esx`** (similar to MUI's `sx`).

The styling engine is called **esixs**. It lives in `src/esixs/` and must not
import anything from outside that folder, because it may be published as a
standalone package later.

Read the repository and `CLAUDE.md` before writing code. Existing setup: npm
(no workspaces), tsdown for the build with two entries (`src/index.ts`,
`src/esixs/index.ts`), a Vite playground in `playground/`, Vitest with jsdom
and globals, strict TypeScript. `src/components/toggle/` contains a working
unstyled Toggle with a test. `src/esixs/index.ts` and `src/system/index.ts`
are empty placeholders.

Import direction, which you must keep:
- `src/esixs` imports nothing from the rest of the repo.
- `src/system` imports `src/esixs`.
- `src/components` import `src/system` and `src/utils`.

## Naming

- The style prop on every component is `esx`. Never name a prop `sx`.
- The style object type is `EsxObject`.
- The engine is `esixs`; the React helper is `renderEsx`.

## Global constraints

- Do not add any package to `dependencies` or `peerDependencies`. Do not
  install new packages at all without asking.
- Strict TypeScript, no `any` in public APIs.
- Work in five phases, in order. After each phase run `npm run typecheck` and
  `npx vitest run`; do not start the next phase until both pass.
- Write tests first in every phase.
- Class and CSS-variable prefix is `sv`. It appears in exactly one place: the
  config object created in `src/system/esixs.ts` (Phase 3). Never hard-code it
  elsewhere.

---

# Phase 1: esixs serializer (pure core)

## Goal

Convert a style object into a class name plus CSS text:

```ts
{ p: 16, color: 'accent', '&:hover': { opacity: 0.8 } }
```

becomes

```ts
{
  className: 'sv-1k9x2f',
  css: '.sv-1k9x2f{padding:16px;color:var(--sv-color-accent);&:hover{opacity:0.8;}}'
}
```

The function must not care when it runs: at build time in a Node script (to
pre-extract static styles later) or at render time on server or client.

## Constraints for core files

- No imports from `react` or `react-dom` except type-only imports
  (`import type { CSSProperties } from 'react'`).
- No DOM, `window`, `document`, or Node-only APIs.
- Pure and deterministic: same input and config always give byte-identical
  output. No randomness, counters, or timestamps.
- Never mutate input objects.

## Public API

```ts
export interface EsixsConfig {
  prefix: string                              // class and CSS variable prefix
  breakpoints: Record<string, number>         // e.g. { xs: 0, sm: 600, md: 900, lg: 1200 } in px
  tokens: Record<TokenCategory, readonly string[]>  // known token names per category
  layer?: string                              // if set, wrap every rule in `@layer ${layer}{...}`
}

export interface SerializedStyle {
  className: string     // `${prefix}-${hash}`, or '' when there is no CSS
  css: string           // complete rule, or ''
}

export interface Esixs {
  config: EsixsConfig
  serialize(esx: EsxObject): SerializedStyle
  merge(...parts: ReadonlyArray<EsxObject | null | undefined | false>): EsxObject  // Phase 2
  /** Dedupe by className and join into one stylesheet string. */
  toStyleSheet(styles: readonly SerializedStyle[]): string
}

export function createEsixs(config: EsixsConfig): Esixs
```

## Input grammar

An `EsxObject` is a plain object. Classify each entry in this order:

1. **Skipped**: value is `null`, `undefined`, or `false`.
2. **At-rule block**: key starts with `@` and value is a plain object.
   Emit `key{...}` and recurse.
3. **Responsive value**: value is a plain object whose keys are all names from
   `config.breakpoints` (at least one key). The entry key is a CSS property or
   shorthand.
4. **Nested selector**: value is any other plain object. If the key does not
   contain `&`, treat it as a descendant selector and emit `& ${key}`.
   Recurse to any depth.
5. **Declaration**: value is a string or number.

Anything else (arrays, functions, `true`, symbols) is an error: throw in
development, skip in production. Detect development with a guard that does not
crash where `process` is undefined.

## Declaration rules, applied in order

**1. Shorthand expansion** (one key to one property):

| Key | Property |
|---|---|
| `p`, `pt`, `pr`, `pb`, `pl` | `padding`, `padding-top`, ... |
| `px`, `py` | `padding-inline`, `padding-block` |
| `m`, `mt`, `mr`, `mb`, `ml` | `margin`, `margin-top`, ... |
| `mx`, `my` | `margin-inline`, `margin-block` |
| `bg` | `background` |
| `w`, `h` | `width`, `height` |
| `minW`, `maxW`, `minH`, `maxH` | `min-width`, ... |

**2. Property name**
- Keys starting with `--` are custom properties: emit key and value unchanged.
- Otherwise camelCase to kebab-case.
- `WebkitFoo` / `MozFoo` become `-webkit-foo` / `-moz-foo`; `msFoo` becomes `-ms-foo`.

**3. Value resolution**
- *Numbers are pixels.* Append `px` unless the property is unitless (at minimum:
  opacity, z-index, font-weight, line-height, flex, flex-grow, flex-shrink,
  order, aspect-ratio, scale, zoom, column-count, fill-opacity, stroke-opacity,
  grid-row, grid-column, grid-area and their start/end variants,
  animation-iteration-count, tab-size, orphans, widows). `0` is always `0`.
  Negative numbers are allowed. There is no spacing scale or multiplier:
  `p: 16` means `padding:16px`.
- *Strings* pass through unchanged (`'1rem'`, `'0 auto'`, `'100%'`), except on
  token properties.
- *Token properties*: map property to category (color, background,
  background-color, border-color, outline-color, fill, stroke -> `color`;
  border-radius -> `radius`; font-size -> `font-size`; font-weight ->
  `font-weight`; box-shadow -> `shadow`; z-index -> `z-index`). If the string
  value is a known token name in that category, emit
  `var(--${prefix}-${category}-${name})`, with dots in the name replaced by
  hyphens (`primary.500` -> `--sv-color-primary-500`). Unknown strings pass
  through, so `'red'` and `'#fff'` still work. Numbers are never looked up as
  tokens.

**4. Sanitization.** Output goes into a `<style>` element, so values and keys
are untrusted. In a value, reject `{`, `}`, and `;` outside quotes or
parentheses, and any `<`. In a selector or at-rule key, reject `{`, `}`, `<`.
On rejection: throw in development, drop the entry in production.

## Responsive values

`{ p: { xs: 8, md: 16 } }` is mobile-first. A breakpoint of width `0` emits a
plain declaration; every other breakpoint emits
`@media (min-width:${width}px){...}`. Each value goes through the declaration
rules. Add a development warning when a nested-selector key is a bare
identifier and its parent key is a known CSS property or shorthand (likely a
misspelled breakpoint).

## Emission order within every block

1. Plain declarations, in insertion order.
2. Responsive media blocks, ascending by width, all properties for one
   breakpoint merged into one `@media` block.
3. Nested selectors and at-rule blocks, in insertion order.

## Output format

- Native CSS nesting; do not flatten selectors.
- Minified: no whitespace, every declaration ends with `;`.
- Omit empty blocks. No CSS at all returns `{ className: '', css: '' }`.
- `&-suffix` keys are unsupported: throw in development.
- If `config.layer` is set, the final `css` is `@layer ${layer}{.cls{...}}`.

## Hashing and caching

- Hash the serialized body (text inside the outer braces), so equivalent inputs
  share a class. Inline 32-bit non-cryptographic hash (FNV-1a or MurmurHash2),
  base 36. The class name must always be a valid CSS identifier.
- `WeakMap<object, SerializedStyle>` keyed by input identity. `esx` objects are
  treated as immutable. No unbounded string-keyed cache.

## Types

`EsxObject` gives autocomplete and checking for: every key of React's
`CSSProperties` (normal value, token name where applicable, or a responsive
object); the shorthand keys (`number | string` or responsive); custom
properties; selector and at-rule keys mapping to a nested `EsxObject`.

## Phase 1 tests

- every shorthand; camelCase, vendor-prefixed and custom-property names
- numbers to px on all non-unitless properties including padding, margin, gap;
  unitless stay bare; `0`; negatives; string pass-through
- token hit, miss, dotted names, each category; numbers not treated as tokens
- nesting three levels; selector without `&`; attribute and pseudo-element
  selectors; `@media`, `@supports`, `@container` with nested selectors inside
- responsive: zero-width breakpoint, ordering, merging into one media block,
  responsive value inside a nested selector
- emission order with declarations, responsive values and nested blocks interleaved
- skipping of `null` / `undefined` / `false`; empty object; empty nested object
- determinism; equivalent inputs share a class; different styles differ
- input not mutated (deep-freeze it); cache returns same result for same reference
- sanitization: `</style>`, stray braces, `;` injection in values and keys;
  `;` inside `url("...")` or quotes is allowed
- `layer` option wraps output; `toStyleSheet` dedupes in first-seen order
- type tests with `expectTypeOf`

---

# Phase 2: esixs merge and React binding

## `merge(...parts)`

Deep-merges style objects; later parts win. Rules:

- Skip `null`, `undefined`, `false` parts. Never mutate inputs; return a new object.
- Normalize keys before merging so equivalents collide: shorthand keys to their
  canonical camelCase property (`p` -> `padding`, `px` -> `paddingInline`), and
  selector keys without `&` to `& ${key}`.
- Declaration over declaration: later replaces.
- Nested selector or at-rule on both sides (same normalized key): merge recursively.
- Responsive object on both sides: merge per breakpoint. Responsive on one side
  and a plain value on the other: later replaces entirely.
- A value of `null` / `undefined` / `false` in a later part does not remove an
  earlier value; it is ignored.
- **Ordering:** whenever a later part sets a key, that key moves to the end of
  the result's insertion order. This makes later parts win in the cascade even
  when a shorthand and a longhand overlap (`padding` then `paddingTop`).

Tests: each rule above, three-way merges, key-order assertions, inputs frozen.

## `renderEsx` (the only esixs file that imports React)

File: `src/esixs/react.tsx`, exported from `src/esixs/index.ts`.

```ts
export function renderEsx(
  esixs: Esixs,
  esx: EsxObject | null | undefined | false,
): { className: string; styleElement: ReactNode }
```

- Calls `esixs.serialize`. If there is no CSS, returns
  `{ className: '', styleElement: null }`.
- Otherwise `styleElement` is
  `<style href={className} precedence={esixs.config.prefix}>{css}</style>`.
  React 19 hoists this into `<head>` and deduplicates by `href`, on the server
  and the client.
- It is a plain function, not a hook: no hooks, no context.

Tests (Testing Library): rendering a component that uses `renderEsx` puts the
rule in `document.head` once even when 50 instances render the same `esx`;
different values produce two rules; an empty `esx` renders no style element.

---

# Phase 3: engine instance and the `Div` primitive

## Engine instance

`src/system/esixs.ts` creates the single esixs instance used by the library:
prefix `sv`, layer `salvon`, default breakpoints, and the token lists.
Update the tokens CSS file in `src/styles/` so it defines every token as
`--sv-${category}-${name}` on `:root`, and keep the two in sync with a test
that parses the CSS file and compares names against the config.

## `Div`

File: `src/components/div/Div.tsx`. This is the library's base layout
primitive, comparable to MUI's `Box`: an element with the `esx` prop built in
and the ability to render as a different element or component. It has no
default styles and no template.

```tsx
<Div esx={{ display: 'flex', gap: 8, p: 16 }}>...</Div>
<Div as="section" esx={{ maxW: 960, mx: 'auto' }} />
<Div as="a" href="/docs" esx={{ color: 'accent' }} />
<Div as={RouterLink} to="/docs" esx={{ fontWeight: 600 }} />
```

Requirements:

- **`as` prop** switches what is rendered. Default `'div'`. Accepts any
  intrinsic element name or any component that accepts `className`.
- **Polymorphic typing.** Props are inferred from `as`: `href` is valid with
  `as="a"` and a type error on the default `div`; a custom component's own
  props are required and checked. Suggested shape:

  ```ts
  type DivOwnProps<E extends ElementType> = {
    as?: E
    esx?: EsxObject | null | false
    className?: string
  }
  export type DivProps<E extends ElementType = 'div'> =
    DivOwnProps<E> & Omit<ComponentPropsWithRef<E>, keyof DivOwnProps<E>>
  ```

- **`ref`** is a plain prop (React 19) and reaches the rendered element with
  the correct element type.
- **Styling.** Calls `renderEsx` with the system esixs instance. Renders the
  `styleElement` followed by the element, inside a fragment.
- **Class names.** Generated class first, then the user's `className`, joined
  with a space. With no `esx` (or an empty one) the element gets only the
  user's `className`, and no `class` attribute at all if there is none.
- `as` and `esx` are never forwarded to the DOM or to the rendered component.
- All other props pass through untouched.
- No hooks and no context inside `Div`.
- Set `displayName` to `'Div'`.

Export `Div` and `DivProps` from `src/index.ts`.

## Phase 3 tests

- renders a `div` by default; renders each of several intrinsic elements via `as`
- renders a custom component via `as` and passes its props through
- `as` and `esx` do not appear as DOM attributes
- `ref` points at the rendered element
- class joining in all four cases (esx only, className only, both, neither)
- `esx` with nested selectors and responsive values produces the expected rule
  in `document.head`
- many `Div`s with the same `esx` produce one rule
- type tests: `href` accepted on `as="a"`, rejected on default; `ref` type
  follows `as`; missing required prop of a custom component is an error;
  unknown token and wrong value types in `esx` are errors
- tokens CSS file and token config stay in sync

---

# Phase 4: templates (`src/system/`)

## Template shape

```ts
export interface SlotTemplate {
  base?: EsxObject
  variants?: Record<string, Record<string, EsxObject>>   // variant prop -> value -> styles
}

export interface Template<Slots extends string = 'root'> {
  slots: Record<Slots, SlotTemplate>
  defaultVariants?: Record<string, string>
}

export function defineTemplate<const T extends Template<string>>(t: T): T  // identity, for inference
```

Templates are plain serializable data. No functions inside them; component
state is styled through data attributes (`&[data-state="on"]`).

## Registry typing

`src/system/types.ts` declares an empty `interface TemplateRegistry {}`.
Each component augments it from its own template file, mapping its name to its
template type. `UIProvider`'s prop type is derived from the registry:

```ts
type TemplateOverrides = {
  [K in keyof TemplateRegistry]?: DeepPartial<TemplateRegistry[K]> & { replace?: boolean }
}
```

Overrides may add new variant values that the default does not have.
`Div` has no template and is not in the registry.

## `UIProvider`

```tsx
<UIProvider templates={{ Toggle: { slots: { root: { base: { borderRadius: 0 } } } } }}>
```

A context provider holding the overrides object. Nested providers merge with
the parent (inner wins). No provider at all must work: components fall back to
their defaults.

## `useTemplate`

```ts
function useTemplate<T extends Template<string>>(
  name: keyof TemplateRegistry,
  defaults: T,
  variantProps: Record<string, string | undefined>,
  esx?: EsxObject | null | false,
): Record<keyof T['slots'], { className: string; styleElement: ReactNode }>
```

Resolution:
1. Effective template: if the override has `replace: true`, use the override
   alone; otherwise merge onto defaults slot by slot (`base` with `esixs.merge`,
   each variant value with `esixs.merge`, `defaultVariants` shallowly).
   Cache the effective template in a `WeakMap` keyed by the override object.
2. Per slot: `esixs.merge(base, ...selectedVariantStyles, esxForThisSlot)`,
   where selected variants are taken in the order the variant keys are
   declared, each using the prop value or else `defaultVariants`. The `esx`
   argument applies to the `root` slot only.
3. Pass the merged object to `renderEsx`.

Performance: when `esx` is not provided, cache the merged per-slot object by
effective template plus the variant-value combination, so repeat renders hit
the serializer's identity cache. When `esx` is provided, recompute.

Unknown variant value: development warning, then ignore it.

## Phase 4 tests

- defaults with no provider; provider override merges; `replace: true` discards defaults
- adding a new variant value through the provider
- `defaultVariants` override; nested providers
- precedence: default < provider override < variant < instance `esx`
- one class per slot element; identical instances share one rule in `<head>`

---

# Phase 5: wire up Toggle as the reference styled component

- Add `src/components/toggle/toggle.template.ts` using `defineTemplate`, with a
  `root` slot, a sensible `base`, variants `variant: solid | outline` and
  `size: sm | md | lg`, `defaultVariants`, and `&[data-state="on"]`,
  `&:focus-visible`, `&[disabled]` styling. Use tokens for colors and radius,
  pixel numbers for sizes. Augment `TemplateRegistry`.
- `Toggle` gains `variant`, `size` and `esx` props, calls `useTemplate`, renders
  the `styleElement` next to the button, and joins the generated class with any
  `className` prop. Existing behaviour and the existing test must not change.
- Export from `src/index.ts`: `Div`, `Toggle`, `UIProvider`, `defineTemplate`,
  and the public types (`EsxObject`, `Template`, `TemplateRegistry`,
  `DivProps`, `ToggleProps`).
- `"use client"`: the system code and Toggle use context and state, so the
  built `dist/index.js` must begin with the `"use client"` directive, and
  `dist/esixs.js` must not have it. Bundlers drop per-file directives, so check
  the current tsdown documentation for the supported way to do this; do not
  guess option names. Add a test or script that asserts both conditions after
  `npm run build`.
- Update `playground/main.tsx` to show: a layout built from `Div` (including
  `as` and a responsive `esx`), a default Toggle, each variant and size, a
  Toggle instance with `esx`, and a subtree wrapped in `UIProvider` with an
  override.
- Update `CLAUDE.md`: the style prop is `esx`, and `Div` is the base primitive.

---

# Out of scope (do not build)

- Spacing scales, theme multipliers, any unit conversion other than number -> px
- Theme objects in JavaScript, theme callback functions (`esx={(theme) => ...}`)
- Functions inside templates, `ownerState`-style callbacks, `esx` arrays
- Style props directly on `Div` (`<Div p={16}>`); styles go through `esx` only
- Per-slot `esx` props or `slotProps`
- Atomic CSS, selector flattening, vendor auto-prefixing, keyframes helpers
- Build-time extraction of default templates into a static CSS file
- A bundler plugin or any source-code transformation
- Any component other than `Div` and `Toggle`

# Definition of done

- `npm run typecheck`, `npx vitest run` and `npm run build` all pass.
- `package.json` has no new `dependencies` or `peerDependencies`.
- The import-direction rule holds (add a test that greps `src/esixs` for
  imports leaving the folder).
- No prop named `sx` exists anywhere in `src/`.
- Final report: files created per phase, every rule you found ambiguous and how
  you resolved it, and the gzipped size of `dist/esixs.js` and `dist/index.js`.
