import { serialize } from "./utils";

/**
 * A `string` tagged as a valid query string for schema `T`. Produced by
 * `buildParams`, so anything carrying this type is guaranteed (at the type
 * level) to have been built from a `T`-shaped object. Use it as a return type
 * to mark a function as returning a type-safe query string.
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
