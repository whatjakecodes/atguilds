<script lang="ts">
	let error = '';
</script>

<form method="POST" action="/login?/login" class="bg-white shadow-md rounded-lg px-8 pt-6 pb-8 mb-4">
	<div class="text-center mb-8">
		<p class="text-gray-600">Login to the Atmosphere to see & create your guilds.</p>
	</div>
	<div class="mb-6">
		<label for="handle" class="block text-sm font-medium text-gray-700 mb-1">
			Enter your handle:
		</label>
		<input
			type="text"
			id="handle"
			name="handle"
			placeholder="e.g. alice.bsky.social"
			required
			class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors placeholder-gray-400"
		/>
	</div>

	<button
		type="submit"
		class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
	>
		Log in
	</button>

	{#if error}
		<p class="mt-4 text-red-600 text-sm">
			Error: <span class="italic">{error}</span>
		</p>
	{/if}
</form>

<div class="text-center text-gray-600">
	Don't have an account on the Atmosphere?
	<a
		href="https://bsky.app"
		class="text-blue-600 hover:text-blue-800 hover:underline ml-1"
	>
		Sign up for Bluesky
	</a>
	to create one now!
</div>