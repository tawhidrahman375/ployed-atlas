/**
 * Thrown by stubbed integrations so an agent fails loud instead of pretending
 * to have done something it didn't. Replace the call site with a real
 * implementation once the credential in envVar is set.
 */
export function notWired(agent: string, service: string, envVar: string): never {
  throw new Error(
    `[${agent}] ${service} isn't wired up yet. Set ${envVar} in .env, then implement the call in src/agents/${agent.toLowerCase()}.ts.`
  );
}
