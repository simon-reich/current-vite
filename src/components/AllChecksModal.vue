<script setup lang="ts">
import { Pencil } from '@lucide/vue'
import { useChecksStore, type Check } from '../stores/checks'
import { registerModalGuard } from '../composables/useModalGuard'

const emit = defineEmits<{ close: []; edit: [check: Check] }>()

const store = useChecksStore()

function close() {
  emit('close')
}

function edit(check: Check) {
  emit('edit', check)
}

// Same app-wide modal guard every other overlay uses — Escape closes this,
// no Enter action (there's no single primary action here, just browsing),
// same as e.g. the delete-tag confirm not needing one either.
registerModalGuard({ onCancel: close })
</script>

<template>
  <div class="modal-backdrop" @click="close" />
  <div class="modal-box all-checks-box" role="dialog" @click.stop>
    <h2 class="all-checks-title">checks</h2>

    <!-- Every check, not just today's due ones (see Current.vue's own
         checksStore.todayChecks row) — this is the only place a check
         that isn't currently due can be reached to edit or delete at all.
         Clicking a row reuses CheckModal (Current.vue swaps this overlay for
         it), which already has both Save and Delete — no need to
         duplicate either action here. -->
    <div v-if="store.activeChecks.length" class="all-checks-list">
      <button
        v-for="check in store.activeChecks"
        :key="check.id"
        type="button"
        class="all-checks-row"
        @click="edit(check)"
      >
        <span class="all-checks-row-title">{{ check.title }}</span>
        <Pencil :size="14" />
      </button>
    </div>
    <p v-else class="all-checks-empty">No checks yet.</p>

    <div class="modal-actions">
      <button class="modal-btn modal-btn--cancel" @click="close">close</button>
    </div>
  </div>
</template>

<style scoped>
.all-checks-box {
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

@media (min-width: 701px) {
  .all-checks-box {
    width: 380px;
  }
}

@media (max-width: 700px) {
  .all-checks-box {
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
  }
}

.all-checks-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--ink-dark);
  font-family: var(--font-mono, monospace);
}

.all-checks-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 50vh;
  overflow-y: auto;
  scrollbar-width: none;
}

.all-checks-list::-webkit-scrollbar {
  display: none;
}

.all-checks-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: none;
  border: none;
  padding: 2px;
  color: var(--ink);
  font-family: var(--font-mono, monospace);
  font-size: 15px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.1s;
}

@media (hover: hover) {
  .all-checks-row:hover {
    opacity: 1;
  }
}

.all-checks-row-title {
  min-width: 0;
  word-break: break-word;
}

.all-checks-row svg {
  flex-shrink: 0;
  opacity: 0.6;
}

.all-checks-empty {
  font-size: 14px;
  color: var(--ink);
  opacity: 0.6;
}
</style>
