<script lang="ts">
	import { page } from '$app/state';
	import github from '$lib/images/github.svg';

	const { showLogout } = $props();
</script>

<header class="flex justify-between">
	<div class="w-12 h-12"></div>

	<nav class="flex justify-center">
		<ul class="flex items-center justify-center h-12 bg-white/70 m-0 p-0 list-none">
			<li class="relative h-full" aria-current={page.url.pathname === '/' ? 'page' : undefined}>
				<a href="/"
					 class={`flex items-center h-full px-2 font-bold text-sm uppercase tracking-wider transition-colors
           ${page.url.pathname === '/' ? 'text-blue-500' : 'hover:text-blue-400'}`}>
					Home
				</a>
			</li>
			<li class="relative h-full" aria-current={page.url.pathname === '/about' ? 'page' : undefined}>
				<a href="/about"
					 class={`flex items-center h-full px-2 font-bold text-sm uppercase tracking-wider transition-colors
           ${page.url.pathname === '/about' ? 'text-blue-500' : 'hover:text-blue-400'}`}>
					About
				</a>
			</li>
			{#if showLogout}
				<li class="relative h-full">
					<form method="POST" action="/login?/logout" class="flex h-full">
						<button type="submit"
										class="flex items-center h-full px-2 font-bold text-sm uppercase tracking-wider transition-colors">
							Logout
						</button>
					</form>
				</li>
			{/if}
		</ul>
	</nav>

	<div class="w-12 h-12">
		<a href="https://github.com/whatjakecodes/atguilds"
			 class="flex items-center justify-center w-full h-full">
			<img src={github} alt="GitHub" class="w-8 h-8 object-contain" />
		</a>
	</div>
</header>

<h1 class="text-3xl font-bold mb-8 text-center mt-5">ATGuilds</h1>

<style>
    /* Keep only the active page indicator style since it uses custom properties */
    li[aria-current='page']::before {
        --size: 6px;
        content: '';
        width: 0;
        height: 0;
        position: absolute;
        top: 0;
        left: calc(50% - var(--size));
        border: var(--size) solid transparent;
        border-top: var(--size) solid var(--color-theme-1);
    }
</style>