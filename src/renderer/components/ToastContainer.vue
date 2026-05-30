<script setup lang="ts">
import { useToastStore } from '../stores/toastStore'
import ToastItem from './ToastItem.vue'
const toastStore = useToastStore()
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <ToastItem
        v-for="t in toastStore.toasts"
        :key="t.id"
        :message="t.message"
        :type="t.type"
        @close="toastStore.remove(t.id)"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1000;
}
.toast-enter-active { transition: all 0.2s ease-out; }
.toast-leave-active { transition: all 0.15s ease-in; }
.toast-enter-from { opacity: 0; transform: translateX(40px); }
.toast-leave-to { opacity: 0; transform: translateX(40px); }
</style>
