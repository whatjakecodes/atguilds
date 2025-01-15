<script lang="ts">
	const { data } = $props();
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Portable ATProtocol Guilds" />
</svelte:head>

<section>
	<h1>
		ATGuilds
	</h1>

	{#if data.profile}
		<p>Logged in as: <span>{data.profile.displayName}</span></p>
	{/if}
</section>

<style>
    section {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        flex: 0.6;
    }

    h1 {
        width: 100%;
    }
</style>
