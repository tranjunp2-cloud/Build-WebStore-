/**
 * Ambient module shim for `psl` (Public Suffix List).
 *
 * The upstream `psl` package ships TypeScript types at `node_modules/psl/types/index.d.ts`,
 * but its `package.json` `exports` field does not declare a `types` condition — so
 * the TypeScript resolver can't follow the main entry to those types under `moduleResolution: "bundler"`.
 *
 * This local declaration mirrors only the subset of psl we consume in
 * `src/app/(dashboard)/settings/domains/actions.ts` — `parse()`. If we start using
 * more of the psl API, extend here.
 */
declare module 'psl' {
    export type ParsedDomain = {
        input: string;
        tld: string | null;
        sld: string | null;
        domain: string | null;
        subdomain: string | null;
        listed: boolean;
    };

    export type ErrorResult = {
        input: string;
        error: {
            code: string;
            message: string;
        };
    };

    export function parse(input: string): ParsedDomain | ErrorResult;
    export function get(domain: string): string | null;
    export function isValid(domain: string): boolean;

    const psl: {
        parse: typeof parse;
        get: typeof get;
        isValid: typeof isValid;
    };
    export default psl;
}
