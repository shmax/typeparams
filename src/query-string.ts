import { TypeParams } from "./type-params";

import { type ZodSchema } from "zod";

/**
 * The union of valid, "flattened" query-string keys for a nested type `T`,
 * using `_` as the nesting delimiter (matching `serialize`/`deserialize`).
 *
 * e.g. `{ filters: { toyline: number; tags: string[] } }` →
 * `"filters_toyline" | "filters_tags"`.
 */
export type QueryStringKeys<T extends object> = {
  [Key in keyof T & string]: NonNullable<T[Key]> extends ReadonlyArray<unknown>
    ? Key
    : NonNullable<T[Key]> extends object
      ? `${Key}_${QueryStringKeys<NonNullable<T[Key]>>}`
      : Key;
}[keyof T & string];

type StripQuestionMark<S extends string> = S extends `?${infer R}` ? R : S;

type SplitAmp<S extends string> =
  S extends "" ? never :
    S extends `${infer H}&${infer T}` ? H | SplitAmp<T> :
      S;

/**
 * Resolves a flattened (`_`-delimited) key directly to its leaf type, treating
 * optional intermediate objects as defined. e.g. `filters_toyline` → `number`.
 */
type LeafByFlat<T extends object, F extends string> =
  F extends `${infer K}_${infer Rest}`
    ? K extends keyof T
      ? NonNullable<T[K]> extends object
        ? LeafByFlat<NonNullable<T[K]>, Rest>
        : never
      : never
    : F extends keyof T
      ? T[F]
      : never;

/** Validates a single (non-array) value against the target type `E`. */
type CheckScalar<E, Val extends string> =
  [E] extends [boolean]
    ? Val extends "true" | "false" ? never : `expected "true" or "false", got "${Val}"` :
    [E] extends [number]
      ? Val extends `${number}` ? never : `expected a number, got "${Val}"` :
      [E] extends [string]
        ? string extends E ? never : (Val extends E ? never : `expected "${E}", got "${Val}"`) :
        never;

/** Validates a pipe-delimited array value, checking each `|`-separated element. */
type CheckArrayValue<E, Val extends string> =
  Val extends "" ? never :
    Val extends `${infer H}|${infer T}` ? CheckScalar<E, H> | CheckArrayValue<E, T> :
      CheckScalar<E, Val>;

/** Validates `Val` (a literal string) against the leaf type `V`. */
type CheckValue<V, Val extends string> =
  NonNullable<V> extends ReadonlyArray<unknown>
    ? CheckArrayValue<NonNullable<V>[number], Val>
    : CheckScalar<NonNullable<V>, Val>;

/** Validates one `key=value` segment; `never` if valid, otherwise an error string. */
type CheckSegment<T extends object, Seg extends string> =
  Seg extends `${infer K}=${infer Val}`
    ? K extends QueryStringKeys<T>
      ? CheckValue<LeafByFlat<T, K>, Val> extends infer E
        ? [E] extends [never] ? never : `"${K}": ${E & string}`
        : never
      : `Invalid query string key: "${K}"`
    : Seg extends QueryStringKeys<T>
      ? never
      : `Invalid query string key: "${Seg}"`;

/**
 * The union of problems (invalid keys or values) found in the query string `S`.
 * Resolves to `never` when every key and value is valid.
 */
export type QueryStringErrors<T extends object, S extends string> =
  SplitAmp<StripQuestionMark<S>> extends infer Seg
    ? Seg extends string ? CheckSegment<T, Seg> : never
    : never;

/**
 * `S` when the literal query string is valid for `T`, otherwise a descriptive
 * string naming the offending keys/values (surfaced as a compile error).
 */
export type ValidateQueryString<T extends object, S extends string> =
  [QueryStringErrors<T, S>] extends [never] ? S : QueryStringErrors<T, S>;

/**
 * Type-checks a literal query string against the shape `T` at compile time.
 *
 * Because TypeScript cannot infer a second type argument once `T` is supplied
 * explicitly (`typeParams<Filters>("...")` is not valid), the generic is split
 * across two calls:
 *
 * ```ts
 * const params = typeParams<Filters>()("?filters_toyline=3&filters_puppies=true");
 * ```
 *
 * Both keys and values are validated: `?yo_mama=3` and `?filters_toyline=banana`
 * are compile-time errors. For dynamic strings (whose contents are not known
 * statically) use `new TypeParams<T>(str)`.
 */
export function typeParams<T extends object>() {
  return function parse<S extends string>(
      queryString: S extends string ? ValidateQueryString<T, S> : never,
      schema?: ZodSchema<unknown>
  ): TypeParams<T> {
    return new TypeParams<T>(queryString, schema);
  };
}
