<script>
  export let options = []; // [{id, label}]
  export let value;
  
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  function select(id) {
    value = id;
    dispatch('change', id);
  }
</script>

<div class="flex border-2 border-[var(--border-color)] bg-[var(--bg-surface)] w-full max-w-sm">
  {#each options as opt, i}
    <button 
      on:click={() => select(opt.id)}
      class="flex-1 py-1.5 text-[9px] font-black italic transition-all relative
             {i !== options.length - 1 ? 'border-r-2 border-[var(--border-color)]' : ''}
             {value === opt.id 
               ? 'bg-[var(--border-color)] text-[var(--bg-main)]' 
               : 'text-[var(--text-primary)] hover:bg-[var(--bg-main)]/50'}"
    >
      {opt.label}
      {#if value === opt.id}
        <div class="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--bg-main)]/20"></div>
      {/if}
    </button>
  {/each}
</div>
