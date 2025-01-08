import { deserialize, serialize } from "./utils";

import { type ZodSchema } from 'zod';

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

type PathValue<Obj, Path extends string> = Path extends `${infer Key}.${infer Rest}`
  ? Key extends keyof Obj
    ? Obj[Key] extends object
      ? PathValue<Obj[Key], Rest>
      : never
    : never
  : Path extends keyof Obj
    ? Obj[Path]
    : never;

export class TypeParams<T extends object> {
  private params: T;

  constructor(
      searchParams: T | string, // Accept an object or a query string
      schema?: ZodSchema<unknown>
  ) {
    if (typeof searchParams === "string") {
      // Handle query string input
      const rawParams = deserialize(searchParams);
      if (schema) {
        const parsed = schema.safeParse(rawParams);

        if (!parsed.success) {
          console.error("Invalid query params for the provided schema:", rawParams);
          return;
        }

        this.params = parsed.data as T;
      } else {
        this.params = rawParams as T;
      }
    } else {
      // Handle object input
      this.params = searchParams; // TypeScript validates this against T. No need for zod.
    }
  }

  // Overloads for `set`
  set<K extends NestedKeyOf<T>>(path: K, value: PathValue<T, K>): void;
  set(newParams: Partial<T>, merge?: boolean): void;

  set<K extends NestedKeyOf<T>>(
      pathOrObject: K | Partial<T>,
      valueOrMerge?: PathValue<T, K> | boolean,
      merge = true
  ): void {
    if (typeof pathOrObject === "string") {
      // Handle nested key updates
      const value = valueOrMerge as PathValue<T, K>;
      const keys = pathOrObject.split(".") as string[];
      let current = this.params as Record<string, unknown>;

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        current[key] ??= {};
        current = current[key] as Record<string, unknown>;
      }

      const finalKey = keys[keys.length - 1];
      if (value === undefined) {
        delete current[finalKey];
      } else {
        current[finalKey] = value;
      }
    } else {
      // Handle object-level updates
      const newParams = pathOrObject as Partial<T>;
      const shouldMerge = typeof valueOrMerge === "boolean" ? valueOrMerge : merge;

      if (shouldMerge) {
        // Merge newParams into existing params
        this.deepMerge(this.params, newParams);
      } else {
        // Replace params entirely
        Object.assign(this.params, newParams);
      }
    }
  }

// Helper function for deep merging
  private deepMerge<T extends Record<string, unknown>>(
      target: T,
      source: T
  ): void {
    for (const key in source) {
      if (
          source[key] &&
          typeof source[key] === "object" &&
          !Array.isArray(source[key]) &&
          typeof target[key] === "object"
      ) {
        this.deepMerge(
            target[key] as Record<string, unknown>,
            source[key] as Record<string, unknown>
        );
      } else {
        target[key] = source[key];
      }
    }
  }

  get<K extends NestedKeyOf<T>>(path: K): PathValue<T, K> | undefined {
    const keys = path.split(".") as string[];
    let current = this.params as Record<string, unknown>;

    for (const key of keys) {
      if (current[key] === undefined) {
        return undefined;
      }
      current = current[key] as Record<string, unknown>;;
    }

    return current as PathValue<T, K>;
  }

  clear<K extends NestedKeyOf<T>>(path: K): void {
    // We will explicitly handle the deletion case here to avoid type issues.
    const keys = path.split(".") as string[];
    let current = this.params as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] === undefined) {
        // No need to proceed if the path doesn't exist
        return;
      }
      current = current[key] as Record<string, unknown>;;
    }

    // Delete the final key
    const finalKey = keys[keys.length - 1];
    delete current[finalKey];
  }

  toString(): string {
    return serialize(this.params);
  }

  all(): T {
    return this.params;
  }
}