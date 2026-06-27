export function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing env var ${name}. Copy .env.test.example to .env.test and fill it in.`);
	}
	return value;
}

export const USER1_HANDLE = requireEnv('TEST_USER1_HANDLE');
export const USER1_PASSWORD = requireEnv('TEST_USER1_PASSWORD');
export const USER2_HANDLE = requireEnv('TEST_USER2_HANDLE');
export const USER2_PASSWORD = requireEnv('TEST_USER2_PASSWORD');
