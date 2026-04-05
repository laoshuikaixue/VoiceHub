<template>
  <div class="space-y-4 mb-6 pb-6 border-b border-zinc-800">
    <div class="flex items-center justify-between">
      <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest">{{ title }}</h4>
      <div class="flex items-center gap-4">
        <button
          v-if="hasEnvConfig"
          type="button"
          class="text-[10px] px-2 py-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/20 rounded-md transition-colors font-bold flex items-center gap-1"
          @click="$emit('import-env')"
        >
          <Download :size="12" />
          导入环境配置
        </button>
        <div class="flex items-center gap-2">
          <span
            :class="[
              'text-[10px] font-bold',
              enabled ? 'text-green-500' : 'text-red-500'
            ]"
          >
            {{ enabled ? '已启用' : '未启用' }}
          </span>
          <input
            :checked="enabled"
            @change="$emit('update:enabled', $event.target.checked)"
            type="checkbox"
            class="w-4 h-4 rounded border-zinc-800 bg-zinc-900 accent-green-600 cursor-pointer"
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
            class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all"
            @click="showSecret = !showSecret"
          >
            {{ showSecret ? '隐藏' : '显示' }}
          </button>
        </div>
      </div>

      <slot name="after-fields" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Download } from 'lucide-vue-next'

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
})

const emit = defineEmits([
  'import-env',
  'update:enabled',
  'update:clientId',
  'update:clientSecret'
])

const showSecret = ref(false)

const inputClass = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all placeholder:text-zinc-800'
const labelClass = 'text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1 block mb-2'
</script>
