import { serialize } from "./utils";

/**
 * Builds a `_`-delimited query string from a typed object (the inverse of
 * `TypeParams`'s string/object parsing). No leading `?` is added, matching
 * `TypeParams#toString`.
 *
 * ```ts
 * buildParams<Filters>({ filters: { toyline: 3, tags: ["foo", "bar"] } });
 * // "filters_toyline=3&filters_tags=foo%7Cbar"
 * ```
 */
export function buildParams<T extends object>(params: T): string {
    return serialize(params);
}
