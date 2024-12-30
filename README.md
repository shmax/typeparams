
# TypeParams Plugin

TypeParams Plugin is a powerful Babel plugin designed to validate and serialize URL query strings based on TypeScript type definitions. It automatically generates validation schemas during build time, allowing for seamless runtime validation with minimal setup.

## Features

- Automatically generates validation schemas based on TypeScript types.
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
  files: ["src/**/*.ts"], // Glob pattern for files to include
  outputDir: ".generated-schemas", // Directory for generated schema files
};
```

---

## Usage

### 1. Setup Babel

Add the plugin to your Babel configuration (e.g., `.babelrc` or Babel section in `package.json`):

```json
{
  "presets": ["@babel/preset-env", "@babel/preset-typescript"],
  "plugins": ["@shmax/typeparams/plugin"]
}
```

### 2. Define Your Url schema as a TypeScript interface

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

### 3. Use the `UrlStructuredSearchParams` Class

```ts
import { UrlStructuredSearchParams } from "typeparams-plugin/shared/url-structured-search-params";

const params = new UrlStructuredSearchParams<Filters>("?filters_toyline=3&filters_tags=toy1,toy2");

// Get a value by its key path
const toyline = params.get("filters.toyline");
console.log(typeof toyline, toyline); // number 3

// Set a value
params.set("filters.metadata.active", true);

// Clear a key
params.clear("filters.tags");

// Serialize back to a string
console.log(params.toString());
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
A: Nope! Just add the plugin to your Babel setup and define your types. The plugin handles the rest.

**Q: Does this work with non-TypeScript projects?**  
A: No, this plugin is designed specifically for TypeScript-first projects.

---

## License

MIT
