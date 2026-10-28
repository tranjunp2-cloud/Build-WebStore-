import type { AgentGateway } from "@ech/agent-transport";
import { createContext, type ReactNode, useContext, useEffect } from "react";

const GatewayContext = createContext<AgentGateway | null>(null);

export interface AgentProviderProps {
	gateway: AgentGateway;
	children: ReactNode;
}

/**
 * Mount once per app (or per embedded surface). Swap FixtureGateway →
 * HttpGateway here; nothing downstream changes.
 */
export function AgentProvider({ gateway, children }: AgentProviderProps) {
	useEffect(() => () => gateway.close(), [gateway]);
	return <GatewayContext.Provider value={gateway}>{children}</GatewayContext.Provider>;
}

export function useGateway(): AgentGateway {
	const gateway = useContext(GatewayContext);
	if (!gateway) throw new Error("useGateway must be used inside <AgentProvider>");
	return gateway;
}

/** The gateway when an AgentProvider is mounted (agent on), else null — for surfaces that work without it. */
export function useOptionalGateway(): AgentGateway | null {
	return useContext(GatewayContext);
}
