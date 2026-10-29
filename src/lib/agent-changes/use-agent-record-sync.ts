"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentChanges } from "./use-agent-changes";

/**
 * An open form for one record, while the assistant changes that same record. Without unsaved edits the form is loaded
 * again silently (`reload`); with unsaved edits nothing is overwritten and `stale` turns on, for the one notice.
 * Reload fetches and resets the form; Keep mine only dismisses (saving is still protected by the record's own checks).
 */
export function useAgentRecordSync({
	kind,
	id,
	dirty,
	reload,
}: {
	kind: string;
	/** the open record; no id (a new record) = nothing to follow */
	id: string | undefined;
	/** the form has edits that are not saved */
	dirty: boolean;
	reload: () => void | Promise<void>;
}): { stale: boolean; reloadNow: () => void; keepMine: () => void } {
	const [stale, setStale] = useState(false);
	const dirtyRef = useRef(dirty);
	dirtyRef.current = dirty;
	const reloadRef = useRef(reload);
	reloadRef.current = reload;

	useAgentChanges({ kinds: [kind], ids: id ? [id] : undefined, enabled: Boolean(id) }, () => {
		if (dirtyRef.current) setStale(true);
		else void reloadRef.current();
	});

	// saved, or moved to another record: the notice no longer applies
	useEffect(() => {
		if (!dirty) setStale(false);
	}, [dirty, id]);

	const reloadNow = useCallback(() => {
		setStale(false);
		void reloadRef.current();
	}, []);
	const keepMine = useCallback(() => setStale(false), []);
	return { stale, reloadNow, keepMine };
}
