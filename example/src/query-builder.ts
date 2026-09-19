import { toQueryString } from '../../src/query-string';
import { TypeParams } from '../../src/type-params';

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
const qs = toQueryString<Filters>({ filters: { toyline: 42, tags: ["foo", "bar"], puppies: true } });
console.log("built", qs);
// "filters_toyline=42&filters_tags=foo%7Cbar&filters_puppies=true"

// Slap it onto a URL
const url = `https://example.com/products?${qs}`;
console.log("url", url);

// Round-trip it back through TypeParams
const params = new TypeParams<Filters>(qs);
console.log("parsed", params.all());
