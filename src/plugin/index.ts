import * as t from "@babel/types";
import * as babelParser from "@babel/parser";
import path from "path";
import { type NodePath } from "@babel/core";
import * as ts from "typescript";
import { generateZodSchema } from "../zod-schema-generator";

// ── TypeScript program cache ──────────────────────────────────────────────────
// One program is shared across all files compiled in the same rspack run.
// We rebuild incrementally (passing the old program) at most once every
// CACHE_TTL_MS milliseconds so a rapid burst of saves doesn't spin up
// multiple compiler instances. Incremental rebuilds only re-parse changed
// files, so after the first cold build they are very fast.

let cachedProgram: ts.Program | null = null;
let lastBuildTime = 0;
const CACHE_TTL_MS = 500;

function getProgram(): ts.Program {
    const now = Date.now();
    if (cachedProgram && now - lastBuildTime < CACHE_TTL_MS) {
        return cachedProgram;
    }
    const srcDir = path.resolve(process.cwd(), "src");
    const files = ts.sys.readDirectory(srcDir, [".ts", ".tsx"]);
    cachedProgram = ts.createProgram(
        files,
        { target: ts.ScriptTarget.ESNext, strict: false, skipLibCheck: true, noEmit: true },
        undefined,
        cachedProgram ?? undefined   // enables incremental rebuild
    );
    lastBuildTime = now;
    return cachedProgram;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureNamedImport(
    programPath: NodePath<t.Program>,
    specifier: string,
    source: string
): void {
    const exists = programPath.node.body.some(
        (node) =>
            t.isImportDeclaration(node) &&
            node.source.value === source &&
            node.specifiers.some(
                (s) =>
                    t.isImportSpecifier(s) &&
                    t.isIdentifier(s.local) &&
                    s.local.name === specifier
            )
    );
    if (!exists) {
        programPath.node.body.unshift(
            t.importDeclaration(
                [t.importSpecifier(t.identifier(specifier), t.identifier(specifier))],
                t.stringLiteral(source)
            )
        );
    }
}

// ── Plugin ────────────────────────────────────────────────────────────────────

type PluginState = {
    needsZImport: boolean;
    needsPipeDelimitedArrayImport: boolean;
    file: { opts: { filename: string } };
};

export default function typeparamsBabelPlugin() {
    return {
        pre(this: PluginState) {
            this.needsZImport = false;
            this.needsPipeDelimitedArrayImport = false;
        },

        visitor: {
            Program: {
                exit(programPath: NodePath<t.Program>, state: PluginState) {
                    // Inject runtime imports for whatever the inlined schema needs.
                    // These are unshifted in reverse dependency order so the final
                    // order in the file is: z first, pipeDelimitedArray second.
                    if (state.needsPipeDelimitedArrayImport) {
                        ensureNamedImport(programPath, "pipeDelimitedArray", "@shmax-org/typeparams");
                    }
                    if (state.needsZImport) {
                        ensureNamedImport(programPath, "z", "zod");
                    }
                },
            },

            NewExpression(nodePath: NodePath<t.NewExpression>, state: PluginState) {
                const callee = nodePath.node.callee;

                // Only care about `new TypeParams(firstArg)` — skip if already
                // injected (has 2 args) or has no arguments at all.
                if (
                    !t.isIdentifier(callee) ||
                    callee.name !== "TypeParams" ||
                    nodePath.node.arguments.length !== 1
                ) {
                    return;
                }

                const filename = state.file.opts.filename.replace(/\\/g, "/");
                const babelLoc = nodePath.node.loc?.start;
                if (!babelLoc) return;

                // ── Build / reuse the cached TS program ───────────────────────
                let program: ts.Program;
                try {
                    program = getProgram();
                } catch (err) {
                    console.error("[TypeParams] Failed to build TS program:", err);
                    return;
                }

                const sourceFile = program.getSourceFile(filename);
                if (!sourceFile) {
                    // File might be outside src/ — skip silently.
                    return;
                }

                const checker = program.getTypeChecker();

                // ── Find the matching TypeParams call in the TS AST ───────────
                // Babel line is 1-based; TS line is 0-based. Column (character)
                // is 0-based in both. Because we're analysing the SAME source
                // file at the SAME compilation moment, positions always match.
                let schemaStr: string | null = null;

                function visitTs(node: ts.Node) {
                    if (schemaStr !== null) return;
                    if (
                        ts.isNewExpression(node) &&
                        node.expression.getText(sourceFile) === "TypeParams"
                    ) {
                        const { line, character } =
                            sourceFile!.getLineAndCharacterOfPosition(node.getStart(sourceFile));
                        if (line + 1 === babelLoc!.line && character === babelLoc!.column) {
                            const typeArg = node.typeArguments?.[0];
                            if (typeArg) {
                                const type = checker.getTypeAtLocation(typeArg);
                                schemaStr = generateZodSchema(type, checker, node);
                            }
                        }
                    }
                    ts.forEachChild(node, visitTs);
                }

                visitTs(sourceFile);

                if (schemaStr === null) {
                    // No type argument — nothing to inject.
                    return;
                }

                // TypeScript can't narrow through the visitTs closure mutation,
                // so we use an explicit cast here.
                const resolvedSchema = schemaStr as string;

                // ── Parse the schema string into a Babel AST node ─────────────
                let schemaExpr: t.Expression;
                try {
                    schemaExpr = babelParser.parseExpression(resolvedSchema, {
                        plugins: ["typescript"],
                    });
                } catch (err) {
                    throw new Error(
                        `[TypeParams] Could not parse generated schema for ${filename}:` +
                        `${babelLoc.line}:${babelLoc.column}\n` +
                        `Schema string was: ${resolvedSchema}\n${err}`
                    );
                }

                // Inject the schema as the second argument
                nodePath.node.arguments.push(schemaExpr);

                state.needsZImport = true;
                if (resolvedSchema.includes("pipeDelimitedArray")) {
                    state.needsPipeDelimitedArrayImport = true;
                }
            },
        },
    };
}
