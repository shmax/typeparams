
export function deserialize(queryString: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    const query = queryString.startsWith("?")
        ? queryString.slice(1)
        : queryString;
    const params = query.split("&");

    for (const param of params) {
        const [rawKey, rawValue] = param.split("=");
        const key = decodeURIComponent(rawKey); // Decode the key
        const value = decodeURIComponent(rawValue); // Decode the value

        const keys = key.split("_");
        let current: Record<string, unknown> = result;

        keys.forEach((k, index) => {
            if (index === keys.length - 1) {
                // Handle pipe-delimited arrays
                current[k] = value.includes("|") ? value.split("|") : value;
            } else {
                if (typeof current[k] !== "object" || current[k] === null) {
                    current[k] = {};
                }
                current = current[k] as Record<string, unknown>;
            }
        });
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


