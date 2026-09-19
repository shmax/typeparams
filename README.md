# TypeParams

TypeParams is a TypeScript-first replacement for `URLSearchParams` that brings type discipline to query parameters — safe reads, safe writes, and automatic type coercion (no more `parseInt`). It does this two ways:

- **At compile time**, literal query strings are checked against your schema — wrong keys and wrong values are red squiggles before anything runs.
- **At build time**, a Zod validation schema is generated from your types and embedded into the compiled code, so values from a live URL are coerced to their declared types automatically.

Either way, the TypeScript interface you already wrote is the single source of truth.

## Features

- **Type-safe reads and writes** — wrong key or wrong value type is a compile error
- **Compile-time string checking** — literal query strings are validated against your schema, keys *and* values, before anything runs
- **Automatic type coercion** — values from the URL are parsed according to your TypeScript types (for example, `"25"` becomes `25` when the schema says `number`)
- **Always in sync** — the schema is derived fresh from your TypeScript types on every compile
- **Zero config** — no separate build step, no schemas to maintain

---

## Installation

```bash
yarn add @shmax-org/typeparams
```

For automatic runtime coercion, add the Babel plugin to your config (`.babelrc`, `babel.config.js`, or the Babel section of your bundler config):

```json
{
  "presets": ["@babel/preset-env", "@babel/preset-typescript"],
  "plugins": ["@shmax-org/typeparams/plugin"]
}
```

The Babel plugin only powers runtime coercion. Compile-time string checking (below) works with plain TypeScript — no plugin required.

---

## Compile-time query string checking

When your query string is a literal, the `typeParams` factory checks it against your schema — **both the keys and the values**. Only a valid sequence compiles; everything else is a red squiggle before it ever runs.

```ts
import { typeParams } from "@shmax-org/typeparams";

type Filters = {
  filters: {
    toyline: number;
    tags?: string[];
    puppies?: boolean;
  };
};

const params = typeParams<Filters>()(
  "?filters_toyline=3&filters_tags=foo|bar&filters_puppies=true"
);

// Reading, writing, and serializing work exactly like TypeParams
params.get("filters.toyline");            // number
params.get("filters.tags");               // string[] | undefined
params.set("filters.toyline", 1257);
params.set({ filters: { toyline: 6 } });  // deep-merges by default

const url = `?${params}`;                 // ?filters_toyline=6&...
```

An invalid sequence is rejected at compile time, with the offending key or value spelled out:

```ts
typeParams<Filters>()("?filters_typo=3");          // ❌ 'Invalid query string key: "filters_typo"'
typeParams<Filters>()("?filters_toyline=foo");     // ❌ '"filters_toyline": expected a number, got "foo"'
typeParams<Filters>()("?filters_puppies=banana");  // ❌ '"filters_puppies": expected "true" or "false", got "banana"'
```

`typeParams` returns a normal `TypeParams<T>`, so `.get()`, `.set()`, and `toString()` all work the same — the Babel plugin injects the Zod schema for runtime coercion.

If you only need the validated string (not a `TypeParams` instance), use `queryString` — it returns the literal unchanged with zero runtime cost:

```ts
const url = queryString<Filters>()("?filters_toyline=3&filters_puppies=true"); // ✅ string
queryString<Filters>()("?filters_toyline=foo");                                // ❌ value error
```

And `toQueryString` does the reverse — serialize a typed object back into a query string:

```ts
toQueryString<Filters>({ filters: { toyline: 3, puppies: true } }); // "filters_toyline=3&filters_puppies=true"
```

**Why the double call?** TypeScript can't infer a second type argument once you supply `T` explicitly, so the generic is split across two calls: `typeParams<Filters>()("...")`.

Strings that aren't known until runtime (a plain `string` like `location.search`) pass through unchecked — the embedded Zod schema still validates them at runtime.

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

### 2. Wrap your params

For a runtime string, `new TypeParams` is a drop-in for `URLSearchParams`:

```ts
import { TypeParams } from "@shmax-org/typeparams";

const params = new TypeParams<ProductsUrlSchema>(location.search);
```

It also accepts an already-parsed query object — the shape Next.js App Router's `searchParams` and WHATWG `URLSearchParams` produce (each value a `string`, `string[]`, or `undefined`):

```ts
const params = new TypeParams<ProductsUrlSchema>(searchParams);
```

Flat `_`-delimited keys from a parsed object are nested and coerced exactly like the string form, so `filters_toyline=355` becomes `{ filters: { toyline: 355 } }`.

For a *literal* query string you write yourself, use the `typeParams` factory instead — it checks every key and value at compile time (see [Compile-time query string checking](#compile-time-query-string-checking)).

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

## How it works

The Babel plugin intercepts every `new TypeParams<YourSchema>(...)` and `typeParams<YourSchema>()(...)` call during compilation. It spins up the TypeScript compiler, walks the type of `YourSchema` (including any imported or cross-file types), generates a Zod validation schema, and splices it in as a second argument — all before the browser ever sees the code.

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

const params = typeParams<Schema>()("?tags=foo|bar|baz");
params.get("tags"); // ["foo", "bar", "baz"]
```

Supported element types: `string[]` and `number[]`.

---

## Requirements

- Node.js 14+
- TypeScript 4.1+
- Babel (with `@babel/preset-typescript`) — for the automatic coercion plugin

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

**Q: Can I use `typeParams` multiple times in the same file with different types?**  
A: Yes. Each `typeParams<T>()(...)` call gets its own schema. Two calls, two schemas, zero drama.

**Q: Can I use this on the server side?**  
A: Yes — it's runtime code, so it works anywhere Node runs. It's a natural fit for Next.js App Router, where `searchParams` is already a parsed (and awaited) object. Just pass it straight in:

```ts
// app/products/page.tsx
import { typeParams } from "@shmax-org/typeparams";
import { type ProductsUrlSchema } from "./Products";

const ProductsPage = async ({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) => {
  const params = typeParams<ProductsUrlSchema>()(await searchParams);

  const filters = params.get("filters");  // fully typed, coerced
  const p = params.get("p") ?? 1;         // number, not string

  return <Products initialParams={params.all()} />;
};
```

On the server the input is the flat `searchParams` object; on the client `typeParams` takes `location.search` or a typed object. The schema is embedded at build time either way, so the same interface drives both.

---

## License

MIT
