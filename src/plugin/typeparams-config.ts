export interface TypeparamsConfig {
    /**
     * Directories (relative to the project root) the Babel plugin should scan
     * to build its TypeScript program when resolving `TypeParams<T>` generics.
     * Defaults to `["src"]`. Consumers using Next.js's App Router, for
     * example, will want `["src", "app"]`.
     */
    roots?: string[];

}
