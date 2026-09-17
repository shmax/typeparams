function setNestedValue(
    target: Record<string, unknown>,
    key: string,
    value: unknown
): void {
    // Construct nested objects by splitting on "_"
    const keys = key.split("_");
    let current: Record<string, unknown> = target;

    keys.forEach((k, index) => {
        if (index === keys.length - 1) {
            // Final key, assign the value
            current[k] = value;
        } else {
            if (typeof current[k] !== "object" || current[k] === null) {
                current[k] = {};
            }
            current = current[k] as Record<string, unknown>;
        }
    });
}

export function deserialize(queryString: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (!queryString || queryString.trim() === "") {
        return result;
    }

    const query = queryString.startsWith("?")
        ? queryString.slice(1)
        : queryString;
    const params = query.split("&");

    for (const param of params) {
        const [rawKey, rawValue = ""] = param.split("=");
        const key = decodeURIComponent(rawKey);
        const value = decodeURIComponent(rawValue);

        setNestedValue(result, key, value);
    }

    return result;
}

/**
 * Nests a flat, already-parsed query string object into a nested raw object,
 * using the same "_" key delimiter as deserialize. Unlike deserialize it takes
 * an already URL-decoded object — the shape Next.js App Router's `searchParams`
 * and WHATWG `URLSearchParams` produce — rather than a raw query string.
 *
 * e.g. { "filters_toyline": "355" } → { filters: { toyline: "355" } }
 */
export function nestFlatObject(
    flat: Record<string, string | string[] | undefined>
): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(flat)) {
        if (value === undefined) {
            continue;
        }
        setNestedValue(result, key, value);
    }

    return result;
}

export function serialize(obj: object): string {
    const parts: string[] = [];

    const flatten = (nested: object, prefix = ""): void => {
        for (const [key, value] of Object.entries(nested)) {
            const newKey = prefix ? `${prefix}_${key}` : key;

            if (Array.isArray(value)) {
                // Join array values with a pipe and encode the result
                parts.push(`${encodeURIComponent(newKey)}=${encodeURIComponent(value.join("|"))}`);
            } else if (value && typeof value === "object") {
                flatten(value as Record<string, unknown>, newKey);
            } else {
                // Encode both key and value
                parts.push(`${encodeURIComponent(newKey)}=${encodeURIComponent(String(value))}`);
            }
        }
    };

    flatten(obj);
    return parts.join("&");
}
