export async function load({ locals }) {
	return {
		isLoggedIn: !!locals.session
	};
}

