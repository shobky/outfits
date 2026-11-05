import { isListedEmail } from "./access";
import type { Repo } from "./data/repo";

/** The owner's addresses, and anyone on their own machine in local mode. Decided here, never by the browser. */
export const isDeveloper = (repo: Repo) => repo.mode === "demo" || isListedEmail(repo.email);
