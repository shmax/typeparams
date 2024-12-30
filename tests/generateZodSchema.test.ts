import * as ts from "typescript";
import { generateZodSchema } from "../src/plugin";

import * as fs from "fs";
import * as path from "path";

function createTypeFromText(sourceText: string, typeName: string): { type: ts.Type; checker: ts.TypeChecker } {
    const options: ts.CompilerOptions = {
        strict: true,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.CommonJS,
    };

    const fileName = "test.ts";
    const filePath = path.resolve(fileName);

    // Write the test file
    fs.writeFileSync(filePath, sourceText);

    const host = ts.createCompilerHost(options);
    const program = ts.createProgram([filePath], options, host);
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(filePath);

    if (!sourceFile) throw new Error("Unable to parse test source");

    const typeNode = sourceFile.statements.find((node) => {
        if (ts.isInterfaceDeclaration(node) && node.name.text === typeName) {
            return true;
        }
        if (ts.isTypeAliasDeclaration(node) && node.name.text === typeName) {
            return true;
        }
        return false;
    });

    if (!typeNode) throw new Error(`Type ${typeName} not found in source`);

    const type = checker.getTypeAtLocation(typeNode);

    // Return type and checker for testing
    return { type, checker };
}



describe("generateZodSchema", () => {
    afterAll(() => {
        const fileName = "test.ts";
        const filePath = path.resolve(fileName);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath); // Delete the file
        }
    });

    it("should generate schema for primitive types", () => {
        const source = `
            type Test = {
                str: string;
                num: number;
                bool: boolean;
            };
        `;

        const { type, checker } = createTypeFromText(source, "Test");
        const schema = generateZodSchema(type, checker);

        expect(schema).toBe(
            "z.object({ str: z.string(), num: z.coerce.number(), bool: z.boolean() })"
        );
    });

    it("should generate schema for arrays", () => {
        const source = `
            type Test = {
                list: string[];
            };
        `;

        const { type, checker } = createTypeFromText(source, "Test");
        const schema = generateZodSchema(type, checker);

        expect(schema).toBe("z.object({ list: z.array(z.string()) })");
    });

    it("should handle unions", () => {
        const source = `
            type Test = {
                value: string | number;
            };
        `;

        const { type, checker } = createTypeFromText(source, "Test");
        const schema = generateZodSchema(type, checker);

        expect(schema).toBe(
            "z.object({ value: z.union([z.string(), z.coerce.number()]) })"
        );
    });

    it("should handle intersections", () => {
        const source = `
            type Test = {
                a: { name: string } & { age: number };
            };
        `;

        const { type, checker } = createTypeFromText(source, "Test");
        const schema = generateZodSchema(type, checker);

        expect(schema).toBe(
            "z.object({ a: z.intersection([z.object({ name: z.string() }), z.object({ age: z.coerce.number() })]) })"
        );
    });

    it("should handle null and undefined", () => {
        const source = `
            type Test = {
                nullable: string | null;
                optional?: number;
            };
        `;

        const { type, checker } = createTypeFromText(source, "Test");
        const schema = generateZodSchema(type, checker);

        expect(schema).toBe(
            "z.object({ nullable: z.union([z.null(), z.string()]), optional: z.union([z.undefined(), z.coerce.number()]).optional() })"
        );
    });
});