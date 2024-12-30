export function decodeUnderscores(queryString: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Remove the leading '?' if it exists and parse the query string
    const query = queryString.startsWith("?")
        ? queryString.slice(1)
        : queryString;
    const params = new URLSearchParams(query);

    for (const [key, value] of params.entries()) {
        const keys = key.split("_"); // Split keys by underscores
        let current: Record<string, unknown> = result;

        keys.forEach((k, index) => {
            if (index === keys.length - 1) {
                current[k] = value; // Assign value at the deepest level
            } else {
                if (typeof current[k] !== "object" || current[k] === null) {
                    current[k] = {}; // Ensure the intermediate object exists
                }
                current = current[k] as Record<string, unknown>;
            }
        });
    }

    return result;
}

export function param(obj: Record<string, unknown>): string {
    const params = new URLSearchParams();

    const flatten = (nested: Record<string, unknown>, prefix = ""): void => {
        for (const [key, value] of Object.entries(nested)) {
            const newKey = prefix ? `${prefix}_${key}` : key;

            if (value && typeof value === "object" && !Array.isArray(value)) {
                // Recurse for nested objects
                flatten(value as Record<string, unknown>, newKey);
            } else {
                // Add key-value pair to params
                params.append(newKey, String(value));
            }
        }
    };

    flatten(obj);
    return `?${params.toString()}`;
}
