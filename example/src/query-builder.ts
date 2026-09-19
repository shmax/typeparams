import { buildParams, queryString, QueryString } from '../../src/query-string';
import { TypeParams } from '../../src/type-params';

// TypeParams isn't just for *parsing* incoming query strings — you can also use
// it to *build* type-safe URLs, whether that's on the front end (generating a
// link to navigate to) or the back end (assembling a URL to hand to an API or
// an email). Define your schema once, then build or check query strings with
// `buildParams` and `queryString`, and the compiler keeps every key and value
// honest in both directions.

// Define the type for filters
type Filters = {
    filters: {
        puppies?: boolean;
        toyline: number;
        tags?: Array<string>;
        foo2?: number;
    };
};

// ── Build: serialize a typed object into a query string ──────────────────────
// `buildParams` returns a `QueryString<Filters>` — a string tagged as valid for
// `Filters`. Use it as a return type to mark a function as producing a
// type-safe query string.
function buildProductsUrl(): QueryString<Filters> {
    return buildParams<Filters>({ filters: { toyline: 42, tags: ["foo", "bar"], puppies: true } });
}

const qs = buildProductsUrl();
console.log("built", qs);
// "filters_toyline=42&filters_tags=foo%7Cbar&filters_puppies=true"

// Slap it onto a URL
const url = `https://example.com/products?${qs}`;
console.log("url", url);

// ── Check: validate a hand-written literal at compile time ───────────────────
// `queryString` validates the keys and values of a literal query string and
// returns it tagged as `QueryString<Filters>`.
function legacyProductsUrl() {
    return queryString<Filters>()("?filters_toyline=7&filters_puppies=true");
}

// These would be compile-time errors:
// queryString<Filters>()("?filters_toyline=banana");  // ❌ expected a number
// queryString<Filters>()("?filters_typo=3");          // ❌ invalid key

console.log("checked", legacyProductsUrl());

// Round-trip it back through TypeParams
const params = new TypeParams<Filters>(qs);
console.log("parsed", params.all());
