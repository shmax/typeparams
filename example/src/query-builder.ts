import { buildParams } from '../../src/query-string';
import { TypeParams } from '../../src/type-params';

// TypeParams isn't just for *parsing* incoming query strings — you can also use
// it to *build* type-safe URLs, whether that's on the front end (generating a
// link to navigate to) or the back end (assembling a URL to hand to an API or
// an email). Define your schema once, then build a query string from a typed
// object with `buildParams`, and the compiler keeps every key and value honest
// in both directions.

// Define the type for filters
type Filters = {
    filters: {
        puppies?: boolean;
        toyline: number;
        tags?: Array<string>;
        foo2?: number;
    };
};

// Build a query string from a typed object
const qs = buildParams<Filters>({ filters: { toyline: 42, tags: ["foo", "bar"], puppies: true } });
console.log("built", qs);
// "filters_toyline=42&filters_tags=foo%7Cbar&filters_puppies=true"

// Slap it onto a URL
const url = `https://example.com/products?${qs}`;
console.log("url", url);

// Round-trip it back through TypeParams
const params = new TypeParams<Filters>(qs);
console.log("parsed", params.all());
