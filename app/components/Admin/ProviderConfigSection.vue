<template>
  <div class="space-y-4 mb-6 pb-6 border-b border-border-secondary">
    <div class="flex items-center justify-between">
      <h4 class="text-xs font-bold text-text-tertiary uppercase tracking-widest">{{ title }}</h4>
      <div class="flex items-center gap-4">
        <a
          v-if="docUrl"
          :href="docUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-[10px] px-2 py-1 bg-primary-10 text-primary hover:bg-primary-20 border border-primary-20 rounded-md transition-colors font-bold flex items-center gap-1"
        >
          {{ docLabel || '查看文档' }}
        </a>
        <button
          v-if="hasEnvConfig"
          type="button"
          class="text-[10px] px-2 py-1 bg-primary-10 text-primary hover:bg-primary-20 border border-primary-20 rounded-md transition-colors font-bold flex items-center gap-1"
          @click="$emit('import-env')"
        >
          <Download :size="12" />
          {{ locale.importEnv }}
        </button>
        <div class="flex items-center gap-2">
          <span
            :class="[
              'text-[10px] font-bold',
              enabled ? 'text-success' : 'text-error'
            ]"
          >
            {{ enabled ? locale.enabled : locale.disabled }}
          </span>
          <input
            :checked="enabled"
            @change="$emit('update:enabled', $event.target.checked)"
            type="checkbox"
            class="w-4 h-4 rounded border-border-secondary bg-bg-secondary accent-green-600 cursor-pointer"
          >
        </div>
      </div>
    </div>

    <div v-if="enabled" class="space-y-4">
      <slot name="before-fields" />

      <div>
        <label :class="labelClass">{{ clientIdLabel }}</label>
        <input
          :value="clientId"
          @input="$emit('update:clientId', $event.target.value)"
          type="text"
          :placeholder="clientIdPlaceholder"
          :class="inputClass"
        >
      </div>

      <div>
        <label :class="labelClass">{{ clientSecretLabel }}</label>
        <div class="flex gap-2">
          <input
            :value="clientSecret"
            @input="$emit('update:clientSecret', $event.target.value)"
            :type="showSecret ? 'text' : 'password'"
            :placeholder="showSecret ? clientSecretPlaceholder : '••••••••••••••••'"
            :class="inputClass"
          >
          <button
            type="button"
            class="px-4 py-2.5 bg-bg-tertiary hover:bg-bg-quaternary text-text-tertiary text-xs font-bold rounded-xl transition-all"
            @click="showSecret = !showSecret"
          >
            {{ showSecret ? locale.hide : locale.show }}
          </button>
        </div>
      </div>

      <slot name="after-fields" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Download } from '@lucide/vue'
import { useLocale } from '~/utils/locale'

const props = defineProps({
  title: String,
  hasEnvConfig: Boolean,
  enabled: Boolean,
  clientId: String,
  clientSecret: String,
  clientIdLabel: String,
  clientIdPlaceholder: String,
  clientSecretLabel: String,
  clientSecretPlaceholder: String,
  docUrl: String,
  docLabel: String,
})

const emit = defineEmits([
  'import-env',
  'update:enabled',
  'update:clientId',
  'update:clientSecret'
])

const showSecret = ref(false)
const { admin } = useLocale()
const locale = computed(() => admin.value?.oauthConfig || {})

const inputClass = 'w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-30 transition-all placeholder:text-text-primary'
const labelClass = 'text-[10px] font-black text-text-disabled uppercase tracking-widest px-1 block mb-2'
</script>
