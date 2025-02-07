#!/usr/bin/env node
import * as ts from "typescript";
import chokidar from "chokidar";
import path from "path";
import fs from "fs";

let GENERATED_SCHEMAS_FILE: string = path.resolve(".generated-schemas", "index.ts");
const SRC_DIR = path.resolve("src");

// Check for `typeparams-config.ts` and read `outputDir` if available
async function getOutputDir(): Promise<string> {
    const configPath = path.resolve("typeparams-config.ts");
    if (fs.existsSync(configPath)) {
        try {
            const config = await import(configPath);
            if (config?.default?.outputDir) {
                return path.resolve(config.default.outputDir, "index.ts");
            }
        } catch (err) {
            console.error(
                "Failed to load typeparams-config.ts. Falling back to default output directory.",
                err
            );
        }
    }
    return GENERATED_SCHEMAS_FILE;
}

// Update `GENERATED_SCHEMAS_FILE` based on configuration
(async () => {
    GENERATED_SCHEMAS_FILE = await getOutputDir();
})();

// Utility to write schemas to the output file
function writeSchemas(schemas: Record<string, Record<string, string>>) {
    const entries = Object.entries(schemas)
        .filter(([, schemaMap]) => Object.keys(schemaMap).length > 0)
        .map(([filePath, schemaMap]) => {
            const schemaEntries = Object.entries(schemaMap as Record<string,string>)
                .map(([position, schema]) => `    "${position}": ${schema}`)
                .join(",\n");
            return `  "${filePath}": {\n${schemaEntries}\n  }`;
        })
        .join(",\n");

    const content = `// Auto-generated file. Do not edit manually.
import { z } from 'zod';

function pipeDelimitedArray(elementSchema: any) {
  return z.preprocess((val) => {
    if (typeof val === 'string') {
      // Split on "|" unless the string is empty => []
      return val === '' ? [] : val.split('|');
    }
    return val;
  }, z.array(elementSchema));
}

export const schemas = {
${entries}
};`;

    fs.mkdirSync(path.dirname(GENERATED_SCHEMAS_FILE), { recursive: true });
    fs.writeFileSync(GENERATED_SCHEMAS_FILE, content);
    console.log(`Updated schemas at ${GENERATED_SCHEMAS_FILE}`);
}

// Analyze a single file for TypeParams usages
function analyzeFile(filePath: string, program: ts.Program): Record<string, string> {
    const sourceFile = program.getSourceFile(filePath);
    const checker = program.getTypeChecker();
    if (!sourceFile) return {};

    const schemas: Record<string, string> = {};

    function visit(node: ts.Node) {
        if (ts.isNewExpression(node) && node.expression.getText() === "TypeParams") {
            const { line, character } = sourceFile!.getLineAndCharacterOfPosition(node.getStart());
            const positionKey = `${line + 1}:${character}`;

            const typeNode = node.typeArguments?.[0];
            if (typeNode) {
                const type = checker.getTypeAtLocation(typeNode);
                schemas[positionKey] = generateZodSchema(type, checker, node);
            }
        }

        ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
    return schemas;
}

function throwUnsupportedArrayError(
    type: ts.Type,
    checker: ts.TypeChecker,
    node?: ts.Node
): never {
    const symbol = type.getSymbol();
    const typeName = symbol?.getName() ?? checker.typeToString(type);
    // If `node` is provided, we can find the file & line info
    let fileInfo = "";
    if (node) {
        const sourceFile = node.getSourceFile();
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        fileInfo = ` in ${sourceFile.fileName} at line ${line + 1}, col ${character + 1}`;
    }

    throw new Error(
        `Unsupported array element type (“${typeName}”)${fileInfo}. ` +
        `Only string[] and number[] are automatically wrapped with pipeDelimitedArray.`
    );
}

function isStringLiteralUnion(type: ts.Type): boolean {
    if (!type.isUnion()) return false;
    // Check if *every* subtype is a string literal
    return type.types.every((t) => t.isStringLiteral());
}

export function generateZodSchema(type: ts.Type, checker: ts.TypeChecker, node?: ts.Node): string {
    if (type.isStringLiteral()) return `z.literal("${type.value}")`;
    if (type.flags & ts.TypeFlags.String) return "z.string()";
    if (type.flags & ts.TypeFlags.Number) return "z.coerce.number()";
    if (type.flags & ts.TypeFlags.Boolean) return "z.boolean()";
    if (type.flags & ts.TypeFlags.Any) return "z.any()";
    if (type.flags & ts.TypeFlags.Null) return "z.null()";
    if (type.flags & ts.TypeFlags.Undefined) return "z.undefined()";

    // Handle Union types
    if (type.isUnion()) {
        return `z.union([${type.types.map((t) => generateZodSchema(t, checker, node)).join(", ")}])`;
    }

    // Handle Intersection types
    if (type.isIntersection()) {
        const objectSchemas = type.types.map((t) => generateZodSchema(t, checker, node));
        // Use `.merge()` for merging objects, if all components are objects
        const mergedSchemas = objectSchemas.reduce((acc, schema) => {
            if (acc) return `${acc}.merge(${schema})`;
            return schema;
        });
        return mergedSchemas;
    }

    // Handle Array types
    if (checker.isArrayType(type)) {
        const [elementType] = checker.getTypeArguments(type as ts.TypeReference);

        // Figure out if it's string[], number[], or something else.
        // One simplistic approach is to check type flags:
        const isStringLike = (elementType.flags & ts.TypeFlags.StringLike) !== 0;
        const isNumberLike = (elementType.flags & ts.TypeFlags.NumberLike) !== 0;
        const isStringLiteralUnionType = isStringLiteralUnion(elementType);

        if (isStringLike || isStringLiteralUnionType) {
            // We'll rely on the existing logic to generate the element's schema
            // But typically you'd want "z.string()"
            // Or you can skip the generator call and just do "z.string()" directly
            return `pipeDelimitedArray(z.string())`;
        } else if (isNumberLike) {
            // Coerce numbers from strings
            return `pipeDelimitedArray(z.coerce.number())`;
        } else {
            // For anything else (objects, booleans, unions, etc.), throw an error
            throwUnsupportedArrayError(elementType, checker, node);
        }
    }

    // Handle Object-like types
    const symbol = type.getSymbol();
    if (symbol) {
        const properties = checker.getPropertiesOfType(type);
        if (properties.length > 0) {
            const zodProps = properties
                .map((prop) => {
                    const propType = checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);
                    const isOptional = prop.flags & ts.SymbolFlags.Optional;
                    return `${prop.getName()}: ${isOptional ? `${generateZodSchema(propType, checker, node)}.optional()` : generateZodSchema(propType, checker, node)}`;
                })
                .join(", ");
            return `z.object({ ${zodProps} })`;
        }
    }

    // Fallback for unsupported or unknown types
    return "z.any()";
}

// Main logic for schema generation
function generateSchemas() {
    const files = ts.sys.readDirectory(SRC_DIR, [".ts", ".tsx"]);
    const program = ts.createProgram(files, { target: ts.ScriptTarget.ESNext });

    const allSchemas: Record<string, Record<string,string>> = {};
    for (const file of files) {
        allSchemas[file] = analyzeFile(file, program);
    }

    writeSchemas(allSchemas);
}

// Watcher setup
function setupWatcher() {
    chokidar.watch(SRC_DIR, { ignoreInitial: false }).on("all", (event, filePath) => {
        if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
            console.log(`${event} detected for ${filePath}. Regenerating schemas...`);
            generateSchemas();
        }
    });
}

// Initialize
const isWatchMode = process.argv.includes("--watch");

if (isWatchMode) {
    console.log("Starting in watch mode...");
    setupWatcher();
} else {
    console.log("Generating schemas...");
    generateSchemas();
}
