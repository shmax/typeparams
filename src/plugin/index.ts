import * as t from "@babel/types";
import path from "path";
import fs from "fs";
import { NodePath } from "@babel/core";

// Define the shape of the schemas object
type SchemasType = {
    [filePath: string]: {
        [positionKey: string]: any; // Zod schema objects
    };
};

type PluginState = {
    file: {
        opts: {
            filename: string;
        };
    };
};

export default function typeparamsBabelPlugin() {
    const SCHEMAS_FILE = path.resolve(
        process.cwd(),
        ".generated-schemas",
        "index.ts"
    );

    function ensureImport(path: NodePath<t.Program>) {
        const importExists = path.node.body.some(
            (node) =>
                t.isImportDeclaration(node) &&
                node.source.value === SCHEMAS_FILE.replace(/\\/g, "/")
        );

        if (!importExists) {
            const importDeclaration = t.importDeclaration(
                [t.importSpecifier(t.identifier("schemas"), t.identifier("schemas"))],
                t.stringLiteral(SCHEMAS_FILE.replace(/\\/g, "/"))
            );
            path.node.body.unshift(importDeclaration);
        }
    }

    let schemas: SchemasType = {};

    function loadSchemas() {
        delete require.cache[require.resolve(SCHEMAS_FILE)];
        try {
            schemas = require(SCHEMAS_FILE).schemas;
        } catch (err) {
            console.error(
                `Failed to load schemas from ${SCHEMAS_FILE}. Ensure the schema generator has run.`,
                err
            );
            schemas = {};
        }
    }

    return {
        pre() {
            loadSchemas();
        },

        visitor: {
            Program(path: NodePath<t.Program>) {
                ensureImport(path);
            },
            NewExpression(path: NodePath<t.NewExpression>, state: PluginState) {
                const callee = path.node.callee;
                if (
                    t.isIdentifier(callee) &&
                    callee.name === "TypeParams" &&
                    path.node.arguments.length > 0
                ) {
                    const filePath = state.file.opts.filename.replace(/\\/g, "/");
                    const { line, column } = path.node.loc!.start;
                    const positionKey = `${line}:${column}`;

                    const fileSchemas = schemas[filePath] || {};
                    const schema = fileSchemas[positionKey];

                    if (schema) {
                        const schemaReference = t.memberExpression(
                            t.identifier("schemas"),
                            t.stringLiteral(positionKey),
                            true
                        );

                        path.node.arguments.push(schemaReference);
                    } else {
                        console.warn(
                            `No schema found for TypeParams at ${filePath}:${positionKey}. Check the schema generator.`
                        );
                    }
                }
            },
        },
    };
}
