import * as babel from "@babel/core";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import plugin from "../src/plugin";

describe("typeparamsBabelPlugin", () => {
    let tmpDir: string;
    const originalCwd = process.cwd();

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "typeparams-"));
        process.chdir(tmpDir);
    });

    afterEach(() => {
        process.chdir(originalCwd);
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function transform(code: string): string {
        const filename = path.join(tmpDir, "fixture.ts");
        fs.writeFileSync(filename, code);
        fs.writeFileSync(
            path.join(tmpDir, "typeparams-config.json"),
            JSON.stringify({ roots: ["."] })
        );

        const result = babel.transformSync(code, {
            filename,
            configFile: false,
            babelrc: false,
            parserOpts: { plugins: ["typescript"] },
            plugins: [plugin],
        });

        return result!.code!;
    }

    it("injects a schema into both new TypeParams<T>() and typeParams<T>()()", () => {
        const code = `type Filters = { filters: { toyline: number; tags?: string[] } };
const a = new TypeParams<Filters>("?filters_toyline=3");
const b = typeParams<Filters>()("?filters_toyline=3&filters_tags=foo|bar");
`;

        const output = transform(code);

        // Two call sites → each gets a schema with the number coercion + array pipe.
        expect((output.match(/z\.coerce\.number\(\)/g) || []).length).toBe(2);
        expect((output.match(/pipeDelimitedArray\(/g) || []).length).toBe(2);
        expect(output).toContain('import { z } from "zod"');
        expect(output).toContain('import { pipeDelimitedArray } from "@shmax-org/typeparams"');
    });
});
