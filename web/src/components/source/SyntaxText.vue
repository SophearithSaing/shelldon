<script setup lang="ts">
import type { SyntaxToken } from '../../syntax/highlighter'

defineProps<{ text: string; tokens?: SyntaxToken[] }>()
</script>

<template><template v-if="tokens?.length"><span v-for="(token, index) in tokens" :key="index" class="syntax-token" :class="token.classes">{{ token.text }}</span></template><template v-else>{{ text }}</template></template>

<style>
.syntax-token { font-style: normal; font-weight: inherit; text-decoration: none; }
[data-theme='light'] .syntax-token.light-6a737d { color: #6a737d; }
[data-theme='light'] .syntax-token.light-005cc5 { color: #005cc5; }
[data-theme='light'] .syntax-token.light-6f42c1 { color: #6f42c1; }
[data-theme='light'] .syntax-token.light-24292e { color: #24292e; }
[data-theme='light'] .syntax-token.light-22863a { color: #22863a; }
[data-theme='light'] .syntax-token.light-d73a49 { color: #d73a49; }
[data-theme='light'] .syntax-token.light-032f62 { color: #032f62; }
[data-theme='light'] .syntax-token.light-e36209 { color: #e36209; }
[data-theme='light'] .syntax-token.light-b31d28 { color: #b31d28; }
[data-theme='light'] .syntax-token.light-fafbfc { color: #fafbfc; }
[data-theme='light'] .syntax-token.light-f6f8fa { color: #f6f8fa; }
[data-theme='light'] .syntax-token.light-586069 { color: #586069; }
[data-theme='dark'] .syntax-token.dark-bfbdb6 { color: #bfbdb6; }
[data-theme='dark'] .syntax-token.dark-5a6673 { color: #5a6673; }
[data-theme='dark'] .syntax-token.dark-aad94c { color: #aad94c; }
[data-theme='dark'] .syntax-token.dark-95e6cb { color: #95e6cb; }
[data-theme='dark'] .syntax-token.dark-d2a6ff { color: #d2a6ff; }
[data-theme='dark'] .syntax-token.dark-f07178 { color: #f07178; }
[data-theme='dark'] .syntax-token.dark-39bae6 { color: #39bae6; }
[data-theme='dark'] .syntax-token.dark-ff8f40 { color: #ff8f40; }
[data-theme='dark'] .syntax-token.dark-f29668 { color: #f29668; }
[data-theme='dark'] .syntax-token.dark-bfbdb6b3 { color: #bfbdb6b3; }
[data-theme='dark'] .syntax-token.dark-59c2ff { color: #59c2ff; }
[data-theme='dark'] .syntax-token.dark-ffb454 { color: #ffb454; }
[data-theme='dark'] .syntax-token.dark-39bae680 { color: #39bae680; }
[data-theme='dark'] .syntax-token.dark-e6c08a { color: #e6c08a; }
[data-theme='dark'] .syntax-token.dark-d95757 { color: #d95757; }
[data-theme='dark'] .syntax-token.dark-c594c5 { color: #c594c5; }
[data-theme='dark'] .syntax-token.dark-70bf56 { color: #70bf56; }
[data-theme='dark'] .syntax-token.dark-73b8ff { color: #73b8ff; }
[data-theme='dark'] .syntax-token.dark-f26d78 { color: #f26d78; }
[data-theme='light'] .syntax-token.light-italic, [data-theme='dark'] .syntax-token.dark-italic { font-style: italic; }
[data-theme='light'] .syntax-token.light-bold, [data-theme='dark'] .syntax-token.dark-bold { font-weight: bold; }
[data-theme='light'] .syntax-token.light-underline, [data-theme='dark'] .syntax-token.dark-underline { text-decoration: underline; }
[data-theme='light'] .syntax-token.light-strike, [data-theme='dark'] .syntax-token.dark-strike { text-decoration: line-through; }
</style>
