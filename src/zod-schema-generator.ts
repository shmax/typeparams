import * as ts from "typescript";

function throwUnsupportedArrayError(
    type: ts.Type,
    checker: ts.TypeChecker,
    node?: ts.Node
): never {
    const symbol = type.getSymbol();
    const typeName = symbol?.getName() ?? checker.typeToString(type);
    let fileInfo = "";
    if (node) {
        const sourceFile = node.getSourceFile();
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        fileInfo = ` in ${sourceFile.fileName} at line ${line + 1}, col ${character + 1}`;
    }
    throw new Error(
        `Unsupported array element type ("${typeName}")${fileInfo}. ` +
        `Only string[] and number[] are automatically wrapped with pipeDelimitedArray.`
    );
}

function isStringLiteralUnion(type: ts.Type): boolean {
    if (!type.isUnion()) return false;
    return type.types.every((t) => t.isStringLiteral());
}

export function generateZodSchema(type: ts.Type, checker: ts.TypeChecker, node?: ts.Node): string {
    if (type.isStringLiteral()) return `z.literal("${type.value}")`;
    if (type.flags & ts.TypeFlags.String) return "z.string()";
    if (type.flags & ts.TypeFlags.Number) return "z.coerce.number()";
    if (type.flags & ts.TypeFlags.Boolean) return "z.coerce.boolean()";
    if (type.flags & ts.TypeFlags.Any) return "z.any()";
    if (type.flags & ts.TypeFlags.Null) return "z.null()";
    if (type.flags & ts.TypeFlags.Undefined) return "z.undefined()";

    if (type.isUnion()) {
        return `z.union([${type.types.map((t) => generateZodSchema(t, checker, node)).join(", ")}])`;
    }

    if (type.isIntersection()) {
        return type.types
            .map((t) => generateZodSchema(t, checker, node))
            .reduce((acc, schema) => (acc ? `${acc}.merge(${schema})` : schema));
    }

    if (checker.isArrayType(type)) {
        const [elementType] = checker.getTypeArguments(type as ts.TypeReference);
        const isStringLike = (elementType.flags & ts.TypeFlags.StringLike) !== 0;
        const isNumberLike = (elementType.flags & ts.TypeFlags.NumberLike) !== 0;
        const isStringLiteralUnionType = isStringLiteralUnion(elementType);

        if (isStringLike || isStringLiteralUnionType) {
            return `pipeDelimitedArray(z.string())`;
        } else if (isNumberLike) {
            return `pipeDelimitedArray(z.coerce.number())`;
        } else {
            throwUnsupportedArrayError(elementType, checker, node);
        }
    }

    const symbol = type.getSymbol();
    if (symbol) {
        const properties = checker.getPropertiesOfType(type);
        if (properties.length > 0) {
            const zodProps = properties
                .map((prop) => {
                    const propType = checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);
                    const isOptional = prop.flags & ts.SymbolFlags.Optional;
                    const schema = generateZodSchema(propType, checker, node);
                    return `${prop.getName()}: ${isOptional ? `${schema}.optional()` : schema}`;
                })
                .join(", ");
            return `z.object({ ${zodProps} })`;
        }
    }

    return "z.any()";
}

