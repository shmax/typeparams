import { serialize } from "./utils";

/**
 * Serializes a typed object into a `_`-delimited query string (the inverse of
 * `TypeParams`'s string/object parsing). No leading `?` is added, matching
 * `TypeParams#toString`.
 *
 * ```ts
 * toQueryString<Filters>({ filters: { toyline: 3, tags: ["foo", "bar"] } });
 * // "filters_toyline=3&filters_tags=foo%7Cbar"
 * ```
 */
export function toQueryString<T extends object>(params: T): string {
    return serialize(params);
}
