<template>
  <div class="application"><slot name="header" /><slot name="connection" /><main class="page"><slot /></main></div>
</template>

<style scoped>
.application { height: 100dvh; display: flex; flex-direction: column; }
.page { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: auto; }
</style>
