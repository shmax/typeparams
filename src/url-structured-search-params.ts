import { parse } from "query-string";
import { decodeUnderscores, param } from "./utils/query-utils";

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

class UrlStructuredSearchParams<T extends object> {
  private params: T;

  constructor(searchString: string) {
    const parsed = parse(searchString);
    this.params = decodeUnderscores(parsed) as T;
  }

  // Overloads for `set`
  set<K extends NestedKeyOf<T>>(path: K, value: PathValue<T, K>): void;
  set(newParams: Partial<T>): void;

  set<K extends NestedKeyOf<T>>(pathOrObject: K | Partial<T>, value?: PathValue<T, K>): void {
    if (typeof pathOrObject === "string") {
      // Handle nested key updates
      const keys = pathOrObject.split(".") as string[];
      let current = this.params;

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] === undefined) {
          current[key] = {};
        }
        current = current[key];
      }

      const finalKey = keys[keys.length - 1];
      if (value === undefined) {
        delete current[finalKey];
      } else {
        current[finalKey] = value;
      }
    } else {
      // Handle setting whole objects
      Object.assign(this.params, pathOrObject);
    }
  }

  get<K extends NestedKeyOf<T>>(path: K): PathValue<T, K> | undefined {
    const keys = path.split(".") as string[];
    let current = this.params;

    for (const key of keys) {
      if (current[key] === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current as PathValue<T, K>;
  }

  clear<K extends NestedKeyOf<T>>(path: K): void {
    // We will explicitly handle the deletion case here to avoid type issues.
    const keys = path.split(".") as string[];
    let current = this.params;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] === undefined) {
        // No need to proceed if the path doesn't exist
        return;
      }
      current = current[key];
    }

    // Delete the final key
    const finalKey = keys[keys.length - 1];
    delete current[finalKey];
  }

  toString(): string {
    return param(this.params);
  }

  all(): T {
    return this.params;
  }
}

export default UrlStructuredSearchParams;