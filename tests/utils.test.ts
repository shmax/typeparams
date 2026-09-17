import { deserialize, nestFlatObject, serialize } from "../src/utils";

describe("deserialize", () => {
    it("should handle single values as strings", () => {
        const input = "?filters_toyline=355";
        const expected = {
            filters: {
                toyline: "355",
            },
        };
        expect(deserialize(input)).toEqual(expected);
    });
});

describe("nestFlatObject", () => {
    it("should nest flat \"_\"-delimited keys", () => {
        const input = {
            filters_toyline: "355",
            limit: "25",
        };
        const expected = {
            filters: {
                toyline: "355",
            },
            limit: "25",
        };
        expect(nestFlatObject(input)).toEqual(expected);
    });

    it("should preserve array values as-is", () => {
        const input = {
            filters_tags: ["Walmart", "Dollar Store"],
        };
        const expected = {
            filters: {
                tags: ["Walmart", "Dollar Store"],
            },
        };
        expect(nestFlatObject(input)).toEqual(expected);
    });

    it("should skip undefined values", () => {
        const input = {
            filters_toyline: "355",
            p: undefined,
        };
        const expected = {
            filters: {
                toyline: "355",
            },
        };
        expect(nestFlatObject(input)).toEqual(expected);
    });
});

describe("serialize", () => {
    it("should convert arrays into pipe-delimited values with proper encoding", () => {
        const input = {
            filters: {
                tags: ["Walmart", "Dollar Store"],
            },
        };
        const expected = "filters_tags=Walmart%7CDollar%20Store"; // Proper encoding
        expect(serialize(input)).toBe(expected);
    });

    it("should convert single values into query string format with proper encoding", () => {
        const input = {
            filters: {
                toyline: "355",
            },
        };
        const expected = "filters_toyline=355"; // No special characters, so no additional encoding
        expect(serialize(input)).toBe(expected);
    });

    it("should handle mixed keys and arrays with proper encoding", () => {
        const input = {
            filters: {
                tags: ["Walmart", "Dollar Store"],
                toyline: "355",
            },
        };
        const expected = "filters_tags=Walmart%7CDollar%20Store&filters_toyline=355"; // Proper encoding
        expect(serialize(input)).toBe(expected);
    });
});

