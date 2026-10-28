"use client";

import { useCallback, useRef, useState } from "react";
import { isVersionConflict } from "./save-version";

/**
 * The version of the record a form is built on (`updatedAt`), sent with each save. `set` it when the form loads,
 * reloads silently and after each successful save. A refused save (`refused`) turns `conflicted` on, for the one
 * notice; `overwrite` (Save mine anyway) takes the version the server reported, so the next save goes through.
 */
export function useSaveVersion(initial?: string | null) {
	const base = useRef<string | null | undefined>(initial);
	const [conflict, setConflict] = useState<string | null | undefined>(undefined);

	/** what the next save sends; undefined = not known, no check */
	const current = useCallback(() => base.current, []);
	const set = useCallback((version: string | null | undefined) => {
		base.current = version;
		setConflict(undefined);
	}, []);
	/** true when `result` is a refused save (and shows the notice) */
	const refused = useCallback((result: unknown) => {
		if (!isVersionConflict(result)) return false;
		setConflict(result.current);
		return true;
	}, []);
	const overwrite = useCallback(() => {
		if (conflict !== undefined) base.current = conflict;
		setConflict(undefined);
	}, [conflict]);

	return { current, set, refused, overwrite, conflicted: conflict !== undefined };
}

export type SaveVersion = ReturnType<typeof useSaveVersion>;
