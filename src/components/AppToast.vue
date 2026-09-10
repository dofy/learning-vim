<script setup lang="ts">
withDefaults(defineProps<{
  message: string
  kind?: 'info' | 'success' | 'error'
  actionLabel?: string
}>(), {
  kind: 'info',
  actionLabel: '',
})

defineEmits<{ action: [] }>()
</script>

<template>
  <div class="app-toast" :class="`toast-${kind}`" :role="kind === 'error' ? 'alert' : 'status'">
    <svg v-if="kind === 'success'" class="toast-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5 10 3 3 7-7" />
    </svg>
    <svg v-else-if="kind === 'error'" class="toast-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 5v6m0 3v.1" />
    </svg>
    <svg v-else class="toast-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 9v6m0-10v.1" />
    </svg>
    <span>{{ message }}</span>
    <button v-if="actionLabel" type="button" @click="$emit('action')">{{ actionLabel }}</button>
  </div>
</template>
