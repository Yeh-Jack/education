<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from '@/utils/markdown';

const props = defineProps<{
  content: string;
}>();

const rendered = computed(() => renderMarkdown(props.content));
</script>

<template>
  <div class="markdown-body" v-html="rendered" />
</template>

<style scoped>
.markdown-body {
  @apply text-sm leading-relaxed break-words text-learning-text-primary;
}
.markdown-body :deep(p) {
  @apply my-1;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  @apply font-semibold text-learning-text-primary mt-3 mb-1;
}
.markdown-body :deep(h1) {
  @apply text-lg;
}
.markdown-body :deep(h2) {
  @apply text-base;
}
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  @apply text-sm;
}
.markdown-body :deep(ul) {
  @apply list-disc pl-5 my-1;
}
.markdown-body :deep(ol) {
  @apply list-decimal pl-5 my-1;
}
.markdown-body :deep(li) {
  @apply my-0.5;
}
.markdown-body :deep(code) {
  @apply px-1 py-0.5 rounded bg-learning-bg-tertiary/50 text-learning-accent-secondary font-mono text-xs;
}
.markdown-body :deep(pre) {
  @apply my-2 p-3 rounded-lg bg-learning-bg-secondary overflow-x-auto;
}
.markdown-body :deep(pre code) {
  @apply p-0 bg-transparent text-learning-text-primary;
}
.markdown-body :deep(blockquote) {
  @apply border-l-4 border-learning-accent-tertiary pl-3 my-2 text-learning-text-secondary italic;
}
.markdown-body :deep(a) {
  @apply text-learning-accent-secondary underline underline-offset-2;
}
.markdown-body :deep(table) {
  @apply w-full my-2 text-xs border-collapse;
}
.markdown-body :deep(th) {
  @apply px-2 py-1 text-left font-semibold border-b border-learning-bg-tertiary text-learning-text-primary;
}
.markdown-body :deep(td) {
  @apply px-2 py-1 border-b border-learning-bg-tertiary/50;
}
.markdown-body :deep(hr) {
  @apply my-2 border-learning-bg-tertiary;
}
</style>
