import { z } from "zod";
import { pipeDelimitedArray } from "../src/pipe-delimited-array";
import { queryString, toQueryString, typeParams, TypeParams } from "../src";

interface Shape {
    filters?: {
        toyline?: string;
        tags?: string[];
    };
    limit?: number;
    p?: number;
    sort?: {
        dir: "asc" | "desc";
        type: string;
    };
}

interface ValueShape {
    count?: number;
    enabled?: boolean;
    numbers?: Array<number>;
    mode?: "asc" | "desc";
}

const schema = z.object({
    filters: z
        .object({
            toyline: z.string().optional(),
            tags: pipeDelimitedArray(z.string()).optional(),
        })
        .optional(),
    limit: z.coerce.number().optional(),
    p: z.coerce.number().optional(),
    sort: z
        .object({
            dir: z.union([z.literal("asc"), z.literal("desc")]),
            type: z.string(),
        })
        .optional(),
});

describe("typeParams", () => {
    it("should parse a valid literal query string", () => {
        const params = typeParams<Shape>()(
            "?filters_toyline=355&limit=25&sort_dir=asc&sort_type=name",
            schema
        );

        expect(params).toBeInstanceOf(TypeParams);
        expect(params.get("limit")).toBe(25);
        expect(params.get("sort")).toEqual({ dir: "asc", type: "name" });
    });

    it("should reject unknown keys at compile time", () => {
        // @ts-expect-error - "yo_mama" is not a valid QueryStringKeys<Shape>
        typeParams<Shape>()("?yo_mama=3&filters_tags=foo|bar");
        // @ts-expect-error - "sort_typo" is not a valid QueryStringKeys<Shape>
        typeParams<Shape>()("?limit=25&sort_typo=name");
    });

    it("should reject invalid values at compile time", () => {
        // @ts-expect-error - "banana" is not a valid number for `limit`
        typeParams<Shape>()("?limit=banana");
        // @ts-expect-error - "up" is not "asc" | "desc" for `sort.dir`
        typeParams<Shape>()("?sort_dir=up");
        // @ts-expect-error - "banana" is not "true" | "false" for `enabled`
        typeParams<ValueShape>()("?enabled=banana");
        // @ts-expect-error - "x" is not a number for `numbers`
        typeParams<ValueShape>()("?numbers=1|x");
    });

    it("should accept valid values at compile time", () => {
        typeParams<ValueShape>()("?count=-3.5&enabled=false&numbers=1|2|-4&mode=desc");
    });

    it("should accept dynamic strings without a cast", () => {
        const dynamic: string = "?limit=25&sort_dir=asc&sort_type=name";
        const params = typeParams<Shape>()(dynamic, schema);

        expect(params.get("limit")).toBe(25);
        expect(params.get("sort")).toEqual({ dir: "asc", type: "name" });
    });

    it("should validate a literal and return it unchanged", () => {
        const url = queryString<ValueShape>()("?count=3&enabled=true");
        expect(url).toBe("?count=3&enabled=true");

        // @ts-expect-error - "banana" is not a valid number for `count`
        queryString<ValueShape>()("?count=banana");
    });

    it("should accept a typed object", () => {
        const params = typeParams<ValueShape>()({ count: 3, enabled: true });

        expect(params).toBeInstanceOf(TypeParams);
        expect(params.get("count")).toBe(3);
        expect(params.get("enabled")).toBe(true);
    });

    it("should accept a flat parsed object", () => {
        const params = typeParams<Shape>()(
            { filters_toyline: "355", limit: "25" },
            schema
        );

        expect(params.get("limit")).toBe(25);
        expect(params.get("filters")).toEqual({ toyline: "355" });
    });

    it("should serialize a typed object to a query string", () => {
        const qs = toQueryString<ValueShape>({ count: 3, enabled: true, numbers: [1, 2], mode: "asc" });
        expect(qs).toBe("count=3&enabled=true&numbers=1%7C2&mode=asc");
    });
});
