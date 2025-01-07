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
        .map(([filePath, schemaMap]) => {
            const schemaEntries = Object.entries(schemaMap as Record<string,string>)
                .map(([position, schema]) => `    "${position}": ${schema}`)
                .join(",\n");
            return `  "${filePath}": {\n${schemaEntries}\n  }`;
        })
        .join(",\n");

    const content = `// Auto-generated file. Do not edit manually.
import { z } from 'zod';

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
                schemas[positionKey] = generateZodSchema(type, checker);
            }
        }

        ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
    return schemas;
}

// Generate Zod schemas for TypeScript types
function generateZodSchema(type: ts.Type, checker: ts.TypeChecker): string {
    if (type.isStringLiteral()) return `z.literal('${type.value}')`;
    if (type.flags & ts.TypeFlags.String) return "z.string()";
    if (type.flags & ts.TypeFlags.Number) return "z.number()";
    if (type.flags & ts.TypeFlags.Boolean) return "z.boolean()";

    if (type.isUnion()) {
        return `z.union([${type.types.map(t => generateZodSchema(t, checker)).join(", ")}])`;
    }

    if (checker.isArrayType(type)) {
        const elementType = checker.getTypeArguments(type as ts.TypeReference)[0];
        return `z.array(${generateZodSchema(elementType, checker)})`;
    }

    const symbol = type.getSymbol();
    if (symbol) {
        const properties = checker.getPropertiesOfType(type);
        const zodProps = properties.map(prop => {
            const propType = checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);
            const isOptional = prop.flags & ts.SymbolFlags.Optional;
            return `${prop.getName()}: ${isOptional ? `${generateZodSchema(propType, checker)}.optional()` : generateZodSchema(propType, checker)}`;
        });
        return `z.object({ ${zodProps.join(", ")} })`;
    }

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
