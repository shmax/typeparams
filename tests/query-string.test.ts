import { buildParams, QueryString } from "../src";

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
