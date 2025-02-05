<script lang="ts">
	import Header from './Header.svelte';
	import '../app.css';

	let { children } = $props();
</script>

<div class="app bg-blue-100 min-h-screen">
	<Header />

	<main>
		{@render children()}
	</main>

	<footer>
	</footer>
</div>
