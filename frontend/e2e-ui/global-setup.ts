// Runs once before the suite: gives the run its own name prefix and checks that the admin used
// to set up test data can sign in, so a wrong URL or password fails fast with a clear message
// instead of every test failing on its own.
import { randomBytes } from "node:crypto";

import { request, type FullConfig } from "@playwright/test";

import { adminCredentials, signInByApi } from "./fixtures";

export default async function globalSetup(config: FullConfig): Promise<void> {
	// Workers start after this and inherit the environment, so every test sees the same prefix.
	process.env.UI_E2E_RUN_ID ??= `e2e-${randomBytes(3).toString("hex")}`;

	const baseURL = config.projects[0]?.use.baseURL;
	const { username, password } = adminCredentials();
	const api = await request.newContext({ baseURL });
	try {
		await signInByApi(api, username, password);
	} catch (error) {
		throw new Error(
			`The test admin '${username}' could not sign in at ${baseURL}. The backend must start with an empty ` +
				`database and RBS_ADMIN_USERNAME/RBS_ADMIN_PASSWORD set to the same values as ` +
				`UI_E2E_ADMIN_USERNAME/UI_E2E_ADMIN_PASSWORD.\n${String(error)}`
		);
	} finally {
		await api.dispose();
	}
}
