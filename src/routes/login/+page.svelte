<script lang="ts">
	let error = '';
</script>

<div id="header">
	<h1>ATGuilds</h1>
	<p>Login to the Atmosphere.</p>
</div>
<div class="container">
	<form action="/login" method="post" class="login-form">
		<input
			type="text"
			name="handle"
			placeholder="Enter your handle (eg alice.bsky.social)"
			required
		/>
		<button type="submit">Log in</button>
		{#if error}
			<p>Error: <i>{error}</i></p>
		{/if}
	</form>
	<div class="signup-cta">
		Don't have an account on the Atmosphere?
		<a href="https://bsky.app">Sign up for Bluesky</a> to create one now!
	</div>
</div>
