import { z, type ZodTypeAny } from "zod";

/**
 * Deserializes a pipe-delimited URL param string into an array.
 * e.g. "foo|bar|baz" → ["foo", "bar", "baz"]
 *
 * Exported so the Babel plugin can inject
 * `import { pipeDelimitedArray } from '@shmax-org/typeparams'`
 * into files whose TypeParams schema includes array fields.
 */
export const pipeDelimitedArray = (elementSchema: ZodTypeAny) =>
    z.preprocess(
        (val) => {
            if (typeof val === "string") {
                return val === "" ? [] : val.split("|");
            }
            return val;
        },
        z.array(elementSchema)
    );

