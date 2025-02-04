<script lang="ts">
	import Header from './Header.svelte';
	import '../app.css';

	let { children, data } = $props();
</script>

<div class="app bg-blue-100 min-h-screen">
	<Header showLogout={data.isLoggedIn} />

	<main>
		{@render children()}
	</main>

	<footer>
	</footer>
</div>
