import { buildParams } from "../src";

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
});
