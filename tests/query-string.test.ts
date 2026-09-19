import { buildParams, queryString, QueryString } from "../src";

interface ValueShape {
    count?: number;
    enabled?: boolean;
    numbers?: Array<number>;
    mode?: "asc" | "desc";
}

describe("buildParams", () => {
    it("should serialize a typed object to a query string", () => {
        const qs = buildParams<ValueShape>({ count: 3, enabled: true, numbers: [1, 2], mode: "asc" });
        expect(qs).toBe("count=3&enabled=true&numbers=1%7C2&mode=asc");
    });

    it("should return a QueryString<T> that is still a string", () => {
        const qs = buildParams<ValueShape>({ count: 3 });

        // A QueryString<T> is assignable to string...
        const asString: string = qs;
        expect(asString).toBe("count=3");

        // ...but a plain string is not a QueryString<T>.
        // @ts-expect-error - a raw string has not been built from a ValueShape
        const forged: QueryString<ValueShape> = "count=3";
    });
});

describe("queryString", () => {
    it("should validate a literal and return it tagged as QueryString<T>", () => {
        const qs: QueryString<ValueShape> = queryString<ValueShape>()("?count=3&enabled=true");

        expect(qs).toBe("?count=3&enabled=true");
    });

    it("should reject invalid keys and values at compile time", () => {
        // @ts-expect-error - "banana" is not a valid number for `count`
        queryString<ValueShape>()("?count=banana");
        // @ts-expect-error - "nope" is not a valid key
        queryString<ValueShape>()("?nope=3");
        // @ts-expect-error - "up" is not "asc" | "desc" for `mode`
        queryString<ValueShape>()("?mode=up");
    });
});
