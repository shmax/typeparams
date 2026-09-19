import { serialize } from "./utils";

/**
 * A `string` tagged as a valid query string for schema `T`. Produced by
 * `buildParams` and `queryString`, so anything carrying this type is guaranteed
 * (at the type level) to have been built or checked against `T`. Use it as a
 * return type to mark a function as returning a type-safe query string.
 */
export type QueryString<T extends object> = string & { readonly __typeParams: T };

/**
 * Builds a `_`-delimited query string from a typed object (the inverse of
 * `TypeParams`'s string/object parsing). No leading `?` is added, matching
 * `TypeParams#toString`.
 *
 * ```ts
 * function url(): QueryString<Filters> {
 *     return buildParams<Filters>({ filters: { toyline: 3, tags: ["foo"] } });
 * }
 * ```
 */
export function buildParams<T extends object>(params: T): QueryString<T> {
    return serialize(params) as QueryString<T>;
}

// ── Compile-time literal checking ─────────────────────────────────────────────
// The type-level machinery behind `queryString`, which validates the keys and
// values of a literal query string against `T` at compile time.

type QueryStringKeys<T extends object> = {
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

/** Resolves a flattened (`_`-delimited) key to its leaf type, treating optional intermediates as defined. */
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

/** The union of problems (invalid keys or values) in `S`, or `never` if valid. */
type QueryStringErrors<T extends object, S extends string> =
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
 * Checks a literal query string against `T` at compile time and returns it
 * tagged as a `QueryString<T>`. Both keys and values are validated:
 *
 * ```ts
 * queryString<Filters>()("?filters_toyline=3");          // ✅
 * queryString<Filters>()("?filters_toyline=banana");     // ❌ value error
 * queryString<Filters>()("?yo_mama=3");                  // ❌ key error
 * ```
 *
 * Because TypeScript can't infer a second type argument once `T` is supplied,
 * the generic is split across two calls: `queryString<Filters>()("...")`.
 */
export function queryString<T extends object>() {
    return function validate<S extends string>(
        qs: S extends string ? ValidateQueryString<T, S> : never
    ): QueryString<T> {
        return qs as QueryString<T>;
    };
}
