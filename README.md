# TypeParams

TypeParams is a TypeScript-first replacement for `URLSearchParams` that brings type discipline to query parameters — safe reads, safe writes, and automatic type coercion (no more `parseInt`). It works by embedding a Zod validation schema directly into your compiled code at build time, derived entirely from the TypeScript interface you already wrote.

## Features

- **Zero config** — no generated files, no separate build step, no schemas to maintain
- **Automatic type coercion** — `"25"` from the URL becomes `25` (number) automatically
- **Type-safe reads and writes** — wrong key or wrong value type is a compile error
- **Always in sync** — the schema is derived fresh from your TypeScript types on every compile

---

## How it works

The Babel plugin intercepts every `new TypeParams<YourSchema>(...)` call during compilation. It spins up the TypeScript compiler, walks the type of `YourSchema` (including any imported or cross-file types), generates a Zod validation schema, and splices it in as a second argument — all before the browser ever sees the code.

```ts
// What you write:
const params = new TypeParams<{ limit?: number; p?: number; sort?: string }>(location.search);

// What gets bundled:
const params = new TypeParams(location.search, z.object({
  limit: z.coerce.number().optional(),
  p: z.coerce.number().optional(),
  sort: z.string().optional(),
}));
```

The TypeScript generic is erased as normal. There are no generated files on disk.

---

## Installation

```bash
yarn add @shmax-org/typeparams
```

Add the Babel plugin to your config (`.babelrc`, `babel.config.js`, or the Babel section of your bundler config):

```json
{
  "presets": ["@babel/preset-env", "@babel/preset-typescript"],
  "plugins": ["@shmax-org/typeparams/plugin"]
}
```

That's it. No other setup required.

---

## Usage

### 1. Define your URL schema as a TypeScript interface

```ts
interface ProductsUrlSchema {
  filters?: {
    toyline?: number;
    tags?: string[];
  };
  limit?: number;
  p?: number;
  sort?: {
    dir: "asc" | "desc";
    type: string;
  };
}
```

Types can reference other interfaces, imported types, and cross-file definitions — the TypeScript compiler resolves them all.

### 2. Pass it as a generic argument to `TypeParams`

```ts
import { TypeParams } from "@shmax-org/typeparams";

const params = new TypeParams<ProductsUrlSchema>(location.search);
```

### 3. Values are automatically coerced to their declared types

```ts
const limit = params.get("limit"); // number, not string — even if it came from the URL
const p = params.get("p");         // number
```

### 4. Reads and writes are type-safe

```ts
params.get("limit");               // ✅ number | undefined
params.get("sort.dir");            // ✅ "asc" | "desc" | undefined
params.get("sort.whammy");         // ❌ TS error — "whammy" doesn't exist

params.set("limit", 25);           // ✅
params.set("limit", "25");         // ❌ TS error — expects number
```

### 5. Clear values and serialize back to a string

```ts
params.clear("filters");
navigate(`?${params}`);            // ?limit=25&p=1
```

---

## Array fields

Arrays are serialized as pipe-delimited strings in the URL:

```ts
interface Schema {
  tags?: string[];
}

const params = new TypeParams<Schema>("?tags=foo|bar|baz");
params.get("tags"); // ["foo", "bar", "baz"]
```

Supported element types: `string[]` and `number[]`.

---

## Standalone schema generation (optional)

The `typeparams-gen` CLI tool is still available if you want to generate a static snapshot of your schemas for inspection or debugging:

```sh
typeparams-gen          # generate once
typeparams-gen --watch  # regenerate on file changes
```

This is entirely optional — the Babel plugin works independently and does not depend on any generated files.

---

## Requirements

- Node.js 14+
- TypeScript 4.0+
- Babel (with `@babel/preset-typescript`)

---

## FAQ

**Q: Do I need to run any code generation step?**  
A: No. There is no `yarn generate-schemas`, no `.generated-schemas` directory, no cron job, no vibes-based manual step. The Babel plugin figures everything out at compile time and inlines the schema directly. You write the interface; the universe handles the rest.

**Q: What if my schema interface is defined in another file?**  
A: Works fine. The plugin runs the full TypeScript compiler under the hood, so it resolves imports and cross-file types exactly the same way `tsc` does. Spread your types across as many files as you like.

**Q: What happens if I add a `debugger` statement above my `TypeParams` call?**  
A: Nothing. Genuinely nothing. Go wild.

**Q: Does this work with non-TypeScript projects?**  
A: No — TypeParams needs TypeScript type information to do its thing. If you're not using TypeScript, you're also presumably fine with `parseInt` everywhere, and we wish you well.

**Q: Can I use `TypeParams` multiple times in the same file with different types?**  
A: Yes. Each `new TypeParams<T>(...)` call gets its own independently generated schema. Two calls, two schemas, zero drama.

---

## License

MIT
