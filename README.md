# TypeParams

TypeParams is a TypeScript-first replacement for `URLSearchParams` that brings type discipline to query parameters — safe reads, safe writes, and automatic type coercion (no more `parseInt`). It's a drop-in: hand it a query string or a parsed query object, and it hands back a typed, coerced object.

Under the hood, a Zod validation schema is generated from your TypeScript types at build time and embedded into the compiled code, so values from a live URL are coerced to their declared types automatically. The TypeScript interface you already wrote is the single source of truth.

## Features

- **Type-safe reads and writes** — wrong key or wrong value type is a compile error
- **Automatic type coercion** — values from the URL are parsed according to your TypeScript types (for example, `"25"` becomes `25` when the schema says `number`)
- **Type-safe URL building** — `queryString` builds a query string from a typed object and returns a `QueryString<T>`
- **Compile-time string checking** — `queryString` also validates a literal query string's keys and values
- **Always in sync** — the schema is derived fresh from your TypeScript types on every compile
- **Zero config** — no separate build step, no schemas to maintain

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

### 2. Wrap a query string

`new TypeParams` is a drop-in for `URLSearchParams`:

```ts
import { TypeParams } from "@shmax-org/typeparams";

const params = new TypeParams<ProductsUrlSchema>(location.search);
```

It also accepts an already-parsed query object — the shape Next.js App Router's `searchParams` and WHATWG `URLSearchParams` produce (each value a `string`, `string[]`, or `undefined`):

```ts
const params = new TypeParams<ProductsUrlSchema>(searchParams);
```

Flat `_`-delimited keys from a parsed object are nested and coerced exactly like the string form, so `filters_toyline=355` becomes `{ filters: { toyline: 355 } }`.

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

### 6. Build a query string from a typed object

`queryString` builds a `_`-delimited query string from a typed object (handy for constructing URLs). It returns a `QueryString<T>` — a string tagged as valid for `T` — so you can use it as a return type:

```ts
import { queryString, QueryString } from "@shmax-org/typeparams";

function productsUrl(): QueryString<ProductsUrlSchema> {
  return queryString<ProductsUrlSchema>()({ limit: 25, filters: { tags: ["foo", "bar"] } });
}

const url = `https://example.com/products?${productsUrl()}`;
```

### 7. Check a literal query string at compile time

When you write a query string by hand, `queryString` validates its keys and values at compile time and returns it tagged as a `QueryString<T>`:

```ts
import { queryString, QueryString } from "@shmax-org/typeparams";

function legacyUrl(): QueryString<ProductsUrlSchema> {
  return queryString<ProductsUrlSchema>()("?limit=25&sort_dir=asc");
}

queryString<ProductsUrlSchema>()("?limit=banana");  // ❌ expected a number, got "banana"
queryString<ProductsUrlSchema>()("?whammy=1");      // ❌ invalid query string key
```

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

The TypeScript generic is erased as normal. The schema is embedded directly into the compiled output.

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

## Requirements

- Node.js 14+
- TypeScript 4.1+
- Babel (with `@babel/preset-typescript`)

---

## FAQ

**Q: Do I need any extra setup or build step?**  
A: No. Add the Babel plugin and you are done. It figures everything out at compile time and inlines the schema directly. You write the interface; the universe handles the rest.

**Q: What if my schema interface is defined in another file?**  
A: Works fine. The plugin runs the full TypeScript compiler under the hood, so it resolves imports and cross-file types exactly the same way `tsc` does. Spread your types across as many files as you like.

**Q: What happens if I add a `debugger` statement above my `TypeParams` call?**  
A: Nothing. Genuinely nothing. Go wild.

**Q: Does this work with non-TypeScript projects?**  
A: No — TypeParams needs TypeScript type information to do its thing. If you're not using TypeScript, you're also presumably fine with `parseInt` everywhere, and we wish you well.

**Q: Why Zod? Can't TypeScript just do this at compile time?**  
A: TypeScript can't inspect the *contents* of a runtime `string` like `location.search`, and it can't change a value's runtime type. Zod (via the injected schema) is what actually coerces `"25"` into `25`, turns `"true"` into `true`, and rejects malformed or unknown keys arriving from a real URL. Type checking protects your code; Zod protects you from the data.

**Q: Can I use `TypeParams` multiple times in the same file with different types?**  
A: Yes. Each `new TypeParams<T>(...)` call gets its own schema. Two calls, two schemas, zero drama.

**Q: Can I use this on the server side?**  
A: Yes — it's runtime code, so it works anywhere Node runs. It's a natural fit for Next.js App Router, where `searchParams` is already a parsed (and awaited) object. Just pass it straight in:

```ts
// app/products/page.tsx
import { TypeParams } from "@shmax-org/typeparams";
import { type ProductsUrlSchema } from "./Products";

const ProductsPage = async ({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) => {
  const params = new TypeParams<ProductsUrlSchema>(await searchParams);

  const filters = params.get("filters");  // fully typed, coerced
  const p = params.get("p") ?? 1;         // number, not string

  return <Products initialParams={params.all()} />;
};
```

On the server the input is the flat `searchParams` object; on the client the same class takes `location.search` or a typed object. The schema is embedded at build time either way, so the same interface drives both.

---

## License

MIT
