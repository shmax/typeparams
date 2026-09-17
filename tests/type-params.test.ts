import { z } from "zod";
import { pipeDelimitedArray } from "../src/pipe-delimited-array";
import { TypeParams } from "../src/type-params";

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

describe("TypeParams", () => {
    it("should parse a flat searchParams object with a schema", () => {
        const params = new TypeParams<Shape>(
            {
                filters_toyline: "355",
                filters_tags: "foo|bar",
                limit: "25",
                p: "2",
                sort_dir: "asc",
                sort_type: "name",
            },
            schema
        );

        expect(params.get("filters")).toEqual({ toyline: "355", tags: ["foo", "bar"] });
        expect(params.get("limit")).toBe(25);
        expect(params.get("p")).toBe(2);
        expect(params.get("sort")).toEqual({ dir: "asc", type: "name" });
    });

    it("should still parse a query string with a schema", () => {
        const params = new TypeParams<Shape>(
            "?filters_toyline=355&limit=25&sort_dir=asc&sort_type=name",
            schema
        );

        expect(params.get("filters")).toEqual({ toyline: "355" });
        expect(params.get("limit")).toBe(25);
        expect(params.get("sort")).toEqual({ dir: "asc", type: "name" });
    });

    it("should store a typed object as-is when no schema is provided", () => {
        const params = new TypeParams<Shape>({ limit: 25, p: 1 });

        expect(params.get("limit")).toBe(25);
        expect(params.get("p")).toBe(1);
    });
});
