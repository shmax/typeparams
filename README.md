
# TypeParams Plugin

TypeParams Plugin is a TypeScript-first replacement for UrlSearchParams that allows you to apply type discipline to your query parameters such that reads and writes are safely protected. Furthermore, thanks to a Babel plugin, it will even coerce values for you automatically (ie, no need for `parseInt`).

## Features

- Automatically generates validation schemas based on TypeScript types.
- Automatic type coercion (eg. string "3" -> integer 3)
- Lightweight integration with minimal configuration.
- Works seamlessly with URL query strings.

---

## Installation

Install the plugin via your package manager:

```bash
yarn add @shmax/typeparams
```

---

## Configuration

Create a `typeparams.config.ts` file in the root of your project:

```ts
export default {
  outputDir: ".generated-schemas", // Directory for generated schema files
};
```

Add the plugin to your Babel configuration (e.g., `.babelrc` or Babel section in `package.json`):

```json
{
  "presets": ["@babel/preset-env", "@babel/preset-typescript"],
  "plugins": ["@shmax/typeparams/plugin"]
}
```

---

## Usage


### 1. Define Your Url schema as a TypeScript interface

```ts
type Filters = {
  filters: {
    toyline: number;
    tags: string[];
    metadata: {
      createdBy: string;
      active: boolean;
    };
  };
};
```

### 2. Feed it to an instance of the `TypeParams` Class as a generic argument

```ts
import { TypeParams } from "typeparams-plugin/shared/url-structured-search-params";

const params = new TypeParams<Filters>("?filters_toyline=3&filters_tags=toy1,toy2");

// Safely get a value by its key path
const toyline = params.get("filters.toyline"); // OK
const brand = params.get("filters.brand"); // TS error! property "brand" doesn't exist on "filters"' 

```
### 3. Any values you retrieve are automatically coerced into the expected type

```ts
console.log(typeof toyline, toyline); // number 3
```

### 4. Set values with the same type discipline
```ts
// Set a value safely
params.set("filters.toyline", 3); // OK
params.set("filters.toyline", "3"); // TS error! Property "toyline" expects a number
params.set("filters.whammy", true); // TS error! Property "whammy" doesn't exist
```

### 5. Can also clear values
```ts
// Clear a key
params.clear("filters.tags");
```

// Serialize back to a string
```ts
navigate(`?${params}`) // ?filters_toyline=3&filters_tags=toy1,toy2
```
---

## Example Output

When running your project, the plugin generates schema files in `.generated-schemas` (or the directory you specify in `typeparams.config.ts`). These schemas are automatically used during runtime for validation.

---

## Requirements

- Node.js 14+ 
- TypeScript 4.0+

---

## FAQ

**Q: Do I need to configure anything else?**  
A: Nope! Just add the plugin to your Babel setup and define your types. The plugin handles the rest. Oh, and you may want to add the name of the generated schema directory to your .gitignore

**Q: Does this work with non-TypeScript projects?**  
A: No, this plugin is designed specifically for TypeScript-first projects.

---

## License

MIT
