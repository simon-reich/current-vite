<script lang="ts">
// Cmd (macOS) / Ctrl (elsewhere) held → links show as clickable, like VS
// Code's "follow link". One shared listener for every instance, toggling a
// class on <html> instead of a per-instance ref, so the CSS alone decides
// the hover look.
let modifierListenerInstalled = false
function installModifierListener() {
  if (modifierListenerInstalled) return
  modifierListenerInstalled = true
  const root = document.documentElement
  const sync = (e: KeyboardEvent | MouseEvent) => root.classList.toggle('link-mod-held', e.metaKey || e.ctrlKey)
  // Capture phase: card/input keydown handlers stopPropagation, which would
  // otherwise leave the class stuck on/off.
  window.addEventListener('keydown', sync, true)
  window.addEventListener('keyup', sync, true)
  window.addEventListener('mousemove', sync, { passive: true, capture: true })
  window.addEventListener('blur', () => root.classList.remove('link-mod-held'))
}

// http(s)://… or www.… up to the next whitespace; trailing punctuation
// (".", ",", ")" …) is left out so "see https://x.com." links just the URL.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]*[^\s<>".,;:!?)\]}'’]/gi

type Segment = { text: string; href?: string }

function splitLinks(text: string): Segment[] {
  const segments: Segment[] = []
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index!
    if (start > last) segments.push({ text: text.slice(last, start) })
    const url = match[0]
    segments.push({ text: url, href: /^https?:\/\//i.test(url) ? url : `https://${url}` })
    last = start + url.length
  }
  if (last < text.length) segments.push({ text: text.slice(last) })
  return segments
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { ExternalLink } from '@lucide/vue'

const props = defineProps<{ text: string }>()

installModifierListener()

const segments = computed(() => splitLinks(props.text))

// Plain click falls through to the surrounding element's own handler
// (title/sub click → edit), only Cmd/Ctrl+click follows the link.
function onLinkClick(e: MouseEvent, href: string) {
  e.preventDefault()
  if (!(e.metaKey || e.ctrlKey)) return
  e.stopPropagation()
  openLink(href)
}

function openLink(href: string) {
  window.open(href, '_blank', 'noopener,noreferrer')
}
</script>

<template><template v-for="(seg, i) in segments" :key="i"><a
  v-if="seg.href"
  class="linkified"
  :href="seg.href"
  draggable="false"
  title="cmd/ctrl + click to open"
  @click="onLinkClick($event, seg.href)"
>{{ seg.text }}</a><button
  v-if="seg.href"
  type="button"
  class="link-open-btn"
  title="open link"
  @pointerdown.stop
  @click.stop="openLink(seg.href)"
><ExternalLink /></button><template v-if="!seg.href">{{ seg.text }}</template></template></template>

<style scoped>
.linkified {
  color: inherit;
  -webkit-touch-callout: none;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  cursor: inherit;
}

/* Not :global(.link-mod-held) .linkified — Vue's scoped compiler turns a
   :global() selector into *only* its argument, dropping the .linkified part. */
:root.link-mod-held .linkified {
  cursor: pointer;
  text-decoration-thickness: 2px;
}

.link-open-btn {
  display: none;
  vertical-align: -0.1em;
  margin-left: 0.25em;
  padding: 0;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.link-open-btn svg {
  width: 0.95em;
  height: 0.95em;
}

/* Touch has no Cmd/Ctrl, so every link gets a small tap target behind it on
   the phone/tablet breakpoint (same 1024px as the rest of the app) or any
   hover-less device — wherever Cmd/Ctrl+click isn't the expected gesture. */
@media (max-width: 1024px), (hover: none) {
  .link-open-btn {
    display: inline-block;
  }
}
</style>
