// Checks, before Playwright starts, that the stack at UI_E2E_BASE_URL is up and that the test
// admin can sign in, so run.sh can tell a setup failure (exit 3) from failing tests. The
// password comes from the environment, never the command line.
const { UI_E2E_BASE_URL: baseUrl, UI_E2E_ADMIN_USERNAME: username, UI_E2E_ADMIN_PASSWORD: password } = process.env;

try {
	const response = await fetch(new URL("/api/auth/login", baseUrl), {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ username, password }),
	});
	if (!response.ok) {
		console.error(`Signing in as ${username} returned HTTP ${response.status}`);
		process.exitCode = 1;
	}
} catch (error) {
	console.error(`Could not reach ${baseUrl}: ${String(error.cause ?? error)}`);
	process.exitCode = 1;
}
