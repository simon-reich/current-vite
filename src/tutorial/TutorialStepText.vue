<script setup lang="ts">
import { Check } from '@lucide/vue'
import type { TutorialStep } from './types'

// A step's text block on the coach card — title, body and the "now you"
// hint. Its own component because TutorialCoach.vue renders it twice: the
// visible one, and invisible copies of every step in the stage that size
// the card (see .tutorial-stage there).
defineProps<{ step: TutorialStep; done?: boolean }>()
</script>

<template>
  <div class="tutorial-content">
    <h2 class="tutorial-title">{{ step.title }}</h2>
    <p class="tutorial-body">{{ step.body }}</p>
    <p v-if="step.hint" class="tutorial-hint" :class="{ 'tutorial-hint--done': done }">
      <!-- Takes no room until done, then opens up in front of the text
           while the check stamps down into it. -->
      <span class="tutorial-stamp-slot">
        <Check v-if="done" class="tutorial-stamp" :size="20" :stroke-width="3.5" />
      </span>
      <span>{{ step.hint }}</span>
    </p>
  </div>
</template>

<style scoped>
.tutorial-title {
  font-family: var(--font-playful, sans-serif);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.15;
  margin: 2px 0 0;
}

.tutorial-body {
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
}

/* The "now you" line — what to do in the app for this step. No box in
   front (it read as something to click); a check pops in once done. */
.tutorial-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tutorial-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0 0;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.tutorial-hint--done {
  opacity: 1;
}

.tutorial-stamp-slot {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 0;
  margin-right: -8px;
  transition: width 0.18s ease-out, margin-right 0.18s ease-out;
}

.tutorial-hint--done .tutorial-stamp-slot {
  width: 20px;
  margin-right: 0;
}

/* Like a stamp: comes down from big and see-through, hits its spot with a
   small overshoot and a slight tilt that settles. */
.tutorial-stamp {
  animation: tutorial-stamp 0.42s cubic-bezier(0.2, 0.8, 0.3, 1.2) both;
}

@keyframes tutorial-stamp {
  0% { opacity: 0; scale: 2.4; rotate: -18deg; }
  55% { opacity: 1; scale: 0.88; rotate: 4deg; }
  75% { scale: 1.08; rotate: -2deg; }
  100% { opacity: 1; scale: 1; rotate: 0deg; }
}

@media (max-width: 700px) {
  .tutorial-title {
    font-size: 19px;
  }

  .tutorial-body {
    font-size: 13px;
  }
}
</style>
