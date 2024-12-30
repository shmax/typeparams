export * from "./typeparams-config"; // Named exports

import * as t from "@babel/types";
import { NodePath, PluginPass } from "@babel/core";
import * as ts from "typescript";
import * as fs from "fs";
import path from "path";
import crypto from "crypto";
import { register } from "ts-node";
import { TypeparamsConfig } from "./typeparams-config";

// Ensure TypeScript support
register();

const schemaMap: Record<string, string> = {};

// Define a custom state interface to extend Babel.PluginPass
interface CustomState {
    typeChecker?: ts.TypeChecker;
    sourceFile?: ts.SourceFile;
}

type PluginState = PluginPass & CustomState;

let sharedProgram: ts.Program;
let sharedChecker: ts.TypeChecker | null = null;

function generateHash(input: string): string {
    return crypto.createHash("md5").update(input).digest("hex");
}

export function generateZodSchema(type: ts.Type, checker: ts.TypeChecker): string {
    if (type.isStringLiteral()) return `z.literal("${type.value}")`;
    if (type.flags & ts.TypeFlags.String) return "z.string()";
    if (type.flags & ts.TypeFlags.Number) return "z.coerce.number()";
    if (type.flags & ts.TypeFlags.Boolean) return "z.boolean()";
    if (type.flags & ts.TypeFlags.Any) return "z.any()";
    if (type.flags & ts.TypeFlags.Null) return "z.null()";
    if (type.flags & ts.TypeFlags.Undefined) return "z.undefined()";

    if (type.isUnion()) {
        return `z.union([${type.types.map((t) => generateZodSchema(t, checker)).join(", ")}])`;
    }

    if (type.isIntersection()) {
        return `z.intersection([${type.types.map((t) => generateZodSchema(t, checker)).join(", ")}])`;
    }

    if (checker.isArrayType(type)) {
        const elementType = checker.getTypeArguments(type as ts.TypeReference)[0];
        return `z.array(${generateZodSchema(elementType, checker)})`;
    }

    const symbol = type.getSymbol();
    if (symbol) {
        const properties = checker.getPropertiesOfType(type);
        if (properties.length > 0) {
            const zodProps = properties
                .map((prop) => {
                    const propType = checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);
                    const isOptional = prop.flags & ts.SymbolFlags.Optional;
                    return `${prop.getName()}: ${isOptional ? `${generateZodSchema(propType, checker)}.optional()` : generateZodSchema(propType, checker)}`;
                })
                .join(", ");
            return `z.object({ ${zodProps} })`;
        }
    }

    return "z.any()"; // Fallback for unsupported or unknown types
}

function findTsNodeAtLocation(sourceFile: ts.SourceFile, loc: t.SourceLocation | null): ts.Node | undefined {
    if (!loc) return undefined;

    const start = sourceFile.getPositionOfLineAndCharacter(loc.start.line - 1, loc.start.column);
    const end = sourceFile.getPositionOfLineAndCharacter(loc.end.line - 1, loc.end.column);

    function find(node: ts.Node): ts.Node | undefined {
        if (node.getStart() <= start && node.getEnd() >= end) {
            return ts.forEachChild(node, find) || node;
        }
        return undefined;
    }

    return find(sourceFile);
}

export default async function typeparamsPlugin() {
    const appRoot = process.cwd();

    const tsConfigPath = path.resolve(appRoot, "tsconfig.json");

    // Parse the tsconfig.json
    const tsConfig = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
    if (tsConfig.error) {
        throw new Error("Error reading tsconfig.json: " + tsConfig.error.messageText);
    }

    // Resolve files using tsconfig.json settings
    const parsedConfig = ts.parseJsonConfigFileContent(
        tsConfig.config,
        ts.sys,
        appRoot
    );

    const allFiles = parsedConfig.fileNames;

    const configPath = path.resolve(appRoot, "typeparams.config.ts");

    let configModule: { default: TypeparamsConfig | undefined } = { default: undefined };
    try {
        configModule = await import(configPath);
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "MODULE_NOT_FOUND") {
            console.warn("TypeParams: No typeparams.config.ts file found. Using default settings.");
        } else {
            throw error; // Rethrow if it's another kind of error
        }
    }

    sharedProgram = ts.createProgram(allFiles, {
        strict: true,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
    });

    sharedChecker = sharedProgram.getTypeChecker();


    const config = configModule.default as TypeparamsConfig;

    const SCHEMAS_FILE = config?.outputDir
        ? path.resolve(config.outputDir, "index.ts")
        : path.resolve(process.cwd(), ".generated-schemas/index.ts");

    function ensureSchemasFile() {
        if (!fs.existsSync(SCHEMAS_FILE)) {
            fs.mkdirSync(path.dirname(SCHEMAS_FILE), { recursive: true });
            fs.writeFileSync(SCHEMAS_FILE, "// Zod schemas\n\nexport const schemas = {};");
        }
    }

    return {
        post() {
            ensureSchemasFile();
            const formattedEntries = Object.entries(schemaMap)
                .map(([hashId, schema]) => `  '${hashId}': ${schema}`)
                .join(",\n");

            const rawContent = `// Zod schemas\n\nimport { z } from 'zod';\n\nexport const schemas = {\n${formattedEntries}\n};`;
            fs.writeFileSync(SCHEMAS_FILE, rawContent);
        },
        visitor: {
            Program(path: NodePath<t.Program>, state: PluginState) {
                const filename = state.filename;

                if (!filename) throw new Error("Babel plugin: Missing filename in state.");

                const sourceFile = sharedProgram.getSourceFile(filename);

                if (filename === SCHEMAS_FILE) {
                    // ignore the generated schema file itself if it comes through here
                    return;
                }

                if (!sourceFile) {
                    throw new Error(`Unable to find source file: ${filename}`);
                }

                state.typeChecker = sharedChecker!;
                state.sourceFile = sourceFile;

                const hasSchemasImport = path.node.body.some(
                    (node) => t.isImportDeclaration(node) && node.source.value === SCHEMAS_FILE
                );

                if (!hasSchemasImport) {
                    const importDeclaration = t.importDeclaration(
                        [t.importSpecifier(t.identifier("schemas"), t.identifier("schemas"))],
                        t.stringLiteral(SCHEMAS_FILE)
                    );
                    path.node.body.unshift(importDeclaration);
                }
            },
            NewExpression(path: NodePath<t.NewExpression>, state: PluginState) {
                const callee = path.node.callee as t.Identifier;

                if (
                    t.isIdentifier(callee) &&
                    callee.name === "UrlStructuredSearchParams" &&
                    path.node.typeParameters
                ) {
                    const checker = state.typeChecker!;
                    const sourceFile = state.sourceFile!;
                    const genericType = path.node.typeParameters.params[0];

                    const tsNode = findTsNodeAtLocation(sourceFile, genericType.loc ?? null);
                    if (!tsNode) {
                        console.error("Failed to map Babel node to TypeScript node.");
                        return;
                    }

                    const resolvedType = checker.getTypeAtLocation(tsNode);
                    const zodSchema = generateZodSchema(resolvedType, checker);

                    const hashId = generateHash(zodSchema);

                    path.node.arguments = [
                        path.node.arguments[0],
                        t.memberExpression(t.identifier("schemas"), t.stringLiteral(hashId), true),
                    ];

                    schemaMap[hashId] = zodSchema;
                }
            }
        },
    };
}
