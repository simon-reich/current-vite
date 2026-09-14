<script setup lang="ts">
import { ref, watch } from 'vue'
import { motion } from 'motion-v'
import { X } from '@lucide/vue'
import { useStorage } from '../composables/useStorage'
import { useThemeStore } from '../stores/theme'
import { activeModal } from '../composables/useModalGuard'
import ColorPicker from '../components/ColorPicker.vue'

const { exportData, importData, exportThemes, importThemes, exportEverything, importEverything } = useStorage()
const themeStore = useThemeStore()

async function handleImport() {
  const confirmed = window.confirm('Import will replace all current data. Continue?')
  if (!confirmed) return
  await importData()
}

async function handleImportEverything() {
  const confirmed = window.confirm('Import will replace all current data, including themes. Continue?')
  if (!confirmed) return
  await importEverything()
}

const pickerBg = ref(themeStore.activeBg)
const pickerGray = ref(themeStore.activeGray)
const themeName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

// Applies live as you drag, same as picking a saved theme does — not just
// a CSS-only preview that reverted to the last *saved* theme on reload or
// on leaving/re-entering Settings. themeStore.apply persists activeBg/
// activeGray (the pinia store is persisted whole), so the color survives
// both. It's still not a *saved* theme, though: it never touches
// savedThemes, so it won't show up in the theme list below or in a
// themes export — "saving" one now only really means giving it a name
// and keeping it around as a preset to come back to.
watch([pickerBg, pickerGray], ([bg, gray]) => {
  themeStore.apply(bg, gray)
})

function saveTheme() {
  themeStore.apply(pickerBg.value, pickerGray.value)
  themeStore.saveTheme(themeName.value)
  themeName.value = ''
  nameInputRef.value?.blur()
}

const deleteThemeConfirm = ref<{ id: string; name: string } | null>(null)

function handleDeleteTheme(id: string, name: string) {
  deleteThemeConfirm.value = { id, name }
}

function confirmDeleteTheme() {
  if (deleteThemeConfirm.value) themeStore.deleteTheme(deleteThemeConfirm.value.id)
  deleteThemeConfirm.value = null
}

watch(deleteThemeConfirm, (open) => {
  activeModal.value = open ? { onCancel: () => { deleteThemeConfirm.value = null }, onConfirm: confirmDeleteTheme } : null
})
</script>

<template>
  <motion.div
    class="settings-view"
    :initial="{ opacity: 0, scale: 0.96 }"
    :animate="{ opacity: 1, scale: 1 }"
    :transition="{ type: 'spring', stiffness: 380, damping: 26, mass: 0.8 }"
  >

    <!-- Appearance -->
    <section class="section">
      <h2 class="section-title">colors</h2>

      <div class="color-picker-group">
        <div class="color-row">
          <div class="color-field">
            <span class="color-label">background</span>
            <ColorPicker v-model="pickerBg" />
          </div>
          <div class="color-field">
            <span class="color-label">ink</span>
            <ColorPicker v-model="pickerGray" />
          </div>
        </div>

        <input
          ref="nameInputRef"
          v-model="themeName"
          class="name-input"
          placeholder="theme name + enter"
          maxlength="32"
          @keydown.enter="saveTheme"
        />
      </div>

      <div v-if="themeStore.savedThemes.length" class="themes-list">
        <button
          v-for="t in themeStore.savedThemes"
          :key="t.id"
          class="btn-outline theme-chip"
          :class="{ active: t.bg === themeStore.activeBg && t.gray === themeStore.activeGray }"
          @click="themeStore.loadTheme(t); pickerBg = t.bg; pickerGray = t.gray"
        >
          <span class="chip-swatches">
            <span class="swatch" :style="{ background: t.bg }" />
            <span class="swatch" :style="{ background: t.gray }" />
          </span>
          {{ t.name }}
          <span class="chip-delete" role="button" @click.stop="handleDeleteTheme(t.id, t.name)">
            <X :size="14" />
          </span>
        </button>
      </div>

      <!-- Daily random theme, picked from the saved themes above. -->
      <div class="daily-shuffle-row">
        <span class="color-label daily-shuffle-label">daily shuffle</span>
        <button
          type="button"
          class="switch"
          role="switch"
          :aria-checked="themeStore.dailyThemeRotationEnabled"
          :class="{ on: themeStore.dailyThemeRotationEnabled }"
          @click="themeStore.toggleDailyThemeRotation()"
        >
          <span class="switch-knob" />
        </button>
      </div>
    </section>

    <!-- Corner style + Drop shadow -->
    <div class="section-row">
      <section class="section">
        <h2 class="section-title">corners</h2>
        <div class="option-row">
          <button class="btn-outline" :class="{ active: !themeStore.rounded }" @click="themeStore.rounded && themeStore.toggleRounded()">square</button>
          <button class="btn-outline" :class="{ active: themeStore.rounded }" @click="themeStore.rounded || themeStore.toggleRounded()">rounded</button>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">drop shadow</h2>
        <div class="option-row">
          <button class="btn-outline" :class="{ active: themeStore.priorityShadow === 'mono' }" @click="themeStore.priorityShadow !== 'mono' && themeStore.togglePriorityShadow()">mono</button>
          <button class="btn-outline" :class="{ active: themeStore.priorityShadow === 'dark' }" @click="themeStore.priorityShadow !== 'dark' && themeStore.togglePriorityShadow()">dark</button>
        </div>
      </section>
    </div>

    <!-- Checks + Tags -->
    <div class="section-row">
      <section class="section">
        <h2 class="section-title">checks</h2>
        <div class="option-row">
          <button class="btn-outline" :class="{ active: themeStore.checksEnabled }" @click="themeStore.checksEnabled || themeStore.toggleChecks()">on</button>
          <button class="btn-outline" :class="{ active: !themeStore.checksEnabled }" @click="themeStore.checksEnabled && themeStore.toggleChecks()">off</button>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">tags</h2>
        <div class="option-row">
          <button class="btn-outline" :class="{ active: themeStore.tagsEnabled }" @click="themeStore.tagsEnabled || themeStore.toggleTags()">on</button>
          <button class="btn-outline" :class="{ active: !themeStore.tagsEnabled }" @click="themeStore.tagsEnabled && themeStore.toggleTags()">off</button>
        </div>
      </section>
    </div>

    <!-- Celebrations + Subs -->
    <div class="section-row">
      <section class="section">
        <h2 class="section-title">celebrations</h2>
        <div class="option-row">
          <button class="btn-outline" :class="{ active: themeStore.celebrationsEnabled }" @click="themeStore.celebrationsEnabled || themeStore.toggleCelebrations()">on</button>
          <button class="btn-outline" :class="{ active: !themeStore.celebrationsEnabled }" @click="themeStore.celebrationsEnabled && themeStore.toggleCelebrations()">off</button>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">subs</h2>
        <div class="option-row">
          <button class="btn-outline" :class="{ active: themeStore.subsEnabled }" @click="themeStore.subsEnabled || themeStore.toggleSubs()">on</button>
          <button class="btn-outline" :class="{ active: !themeStore.subsEnabled }" @click="themeStore.subsEnabled && themeStore.toggleSubs()">off</button>
        </div>
      </section>
    </div>

    <!-- Date lists -->
    <div class="section-row">
      <section class="section">
        <h2 class="section-title">date lists</h2>
        <div class="option-row">
          <button class="btn-outline" :class="{ active: themeStore.dateListsEnabled }" @click="themeStore.dateListsEnabled || themeStore.toggleDateLists()">on</button>
          <button class="btn-outline" :class="{ active: !themeStore.dateListsEnabled }" @click="themeStore.dateListsEnabled && themeStore.toggleDateLists()">off</button>
        </div>
      </section>
    </div>

    <!-- Data -->
    <section class="section">
      <h2 class="section-title">data</h2>
      <div class="btn-row">
        <button class="btn-outline" @click="exportData">export todos</button>
        <button class="btn-outline" @click="handleImport">import todos</button>
      </div>
      <div class="btn-row">
        <button class="btn-outline" @click="exportThemes">export themes</button>
        <button class="btn-outline" @click="importThemes">import themes</button>
      </div>
      <div class="btn-row">
        <button class="btn-outline" @click="exportEverything">export everything all at once</button>
        <button class="btn-outline" @click="handleImportEverything">import everything all at once</button>
      </div>
    </section>

  </motion.div>

  <template v-if="deleteThemeConfirm">
    <div class="modal-backdrop" @click="deleteThemeConfirm = null" />
    <div class="modal-box" role="dialog">
      <p class="modal-text">delete theme <strong>{{ deleteThemeConfirm.name }}</strong>?</p>
      <div class="modal-actions">
        <button class="modal-btn modal-btn--cancel" @click="deleteThemeConfirm = null">cancel</button>
        <button class="modal-btn modal-btn--delete" @click="confirmDeleteTheme">delete</button>
      </div>
    </div>
  </template>
</template>

<style scoped>
.settings-view {
  width: 100%;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: 52px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Paired sections (Corners+Drop shadow, Celebrations+Tags) side by side on
   tablet/desktop — the default/unqualified rule here, since Desktop is the
   unqualified base breakpoint (see base.css's breakpoint convention) and
   Tablet only differs by the app shell, not this view. Stacked back to a
   single column below 701px (Mobile), matching every other top-level
   .settings-view child. */
.section-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 12px;
}

@media (max-width: 700px) {
  .section-row {
    grid-template-columns: 1fr;
    gap: 52px;
  }
}

.section-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--ink-dark);
  text-align: center;
}

/* Only the themes list below (see .themes-list) should benefit from
   .settings-view's wider cap — the pickers and save field stay at the
   original 480px reading width instead of stretching along with it. */
.color-picker-group {
  width: 100%;
  max-width: 480px;
  align-self: center;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.color-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.color-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 160px;
}

.color-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}

.name-input {
  width: 100%;
  padding: 9px 12px;
  border: 2px solid var(--ink);
  border-radius: var(--radius);
  background: transparent;
  color: var(--ink-dark);
  font-size: 15px;
  outline: none;
}

.name-input:focus { border-color: var(--ink-dark); }
.name-input::placeholder { color: var(--ink); }

.themes-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
  margin-bottom: 18px;
  justify-content: center;
}

.daily-shuffle-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}

/* Tablet + Mobile: centered instead of right-aligned — matches how the
   rest of this section (pickers, themes list) is already centered at
   these widths, right-aligning just this row read as misplaced. */
@media (max-width: 1024px) {
  .daily-shuffle-row {
    justify-content: center;
  }
}

.daily-shuffle-label {
  font-size: 18px;
  font-weight: 600;
}

.switch {
  position: relative;
  flex-shrink: 0;
  width: 42px;
  height: 24px;
  padding: 0;
  border: 2px solid var(--ink);
  border-radius: var(--radius);
  background: transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.switch:hover {
  border-color: var(--ink-dark);
}

.switch.on {
  background: var(--ink);
}

.switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: max(0px, calc(var(--radius) - 2px));
  background: var(--ink);
  opacity: 0.35;
  transition: transform 0.15s, background 0.15s, opacity 0.15s;
}

.switch.on .switch-knob {
  background: var(--bg);
  opacity: 1;
  transform: translateX(18px);
}

/* Shared outlined-pill look for every plain button in Settings (corners,
   drop shadow, data import/export, theme import/export) plus the base for
   .theme-chip below — must come before .theme-chip so its smaller
   padding/font-size override this rule's, not the other way round. */
.btn-outline {
  padding: 10px 20px;
  border: 2px solid var(--ink);
  border-radius: var(--radius);
  background: transparent;
  color: var(--ink);
  font-size: 15px;
  cursor: pointer;
  box-shadow: 4px 4px 0 var(--ink);
  transition: background 0.12s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
}

.btn-outline:hover {
  border-color: var(--ink-dark);
  color: var(--ink-dark);
  box-shadow: 4px 4px 0 var(--ink-dark);
}

.btn-outline.active {
  background: var(--ink);
  color: var(--bg);
  border-color: var(--ink);
  box-shadow: 4px 4px 0 var(--priority-shadow);
}

/* theme-chip only needs to override the sizing/layout bits below — the
   border/background/color/shadow/hover/active look comes from .btn-outline
   above, shared with every other outlined button here. */
.theme-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px 7px 10px;
  font-size: 14px;
  font-weight: 600;
}

.theme-chip.active .chip-delete {
  color: var(--bg);
  opacity: 0.6;
}

.theme-chip.active .chip-delete:hover {
  opacity: 1;
}

.chip-swatches {
  display: flex;
  gap: 2px;
}

.swatch {
  display: inline-block;
  width: 13px;
  height: 13px;
  border-radius: 2px;
  border: 1px solid rgba(0,0,0,0.1);
}

.chip-delete {
  display: flex;
  align-items: center;
  margin-left: 2px;
  color: var(--ink);
  cursor: pointer;
  transition: color 0.1s;
}

.chip-delete:hover { color: var(--ink-dark); }

/* Same equal-width-without-stretch trick as .btn-row/.theme-chip above —
   but that only equalizes buttons within their own row (Square/Rounded to each
   other, On/Off to each other, etc.), not across all four option-rows.
   Buttons are mono font (see base.css), so every character is a fixed
   width — "Rounded" (7 chars) is the longest label of the bunch, so a
   shared fixed width sized to fit it pins every option-row button
   (Square/Rounded, Mono/Dark, both On/Off pairs) to the exact same size,
   overriding each row's own content-based 1fr sizing. */
.option-row {
  display: inline-grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 10px;
  align-self: center;
}

.option-row .btn-outline {
  width: 112px;
  text-align: center;
}

.btn-row {
  display: inline-grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 10px;
  align-self: center;
}

</style>
