<template>
  <div class="relative" :class="className" ref="containerRef">
    <div 
      @click="isOpen = !isOpen"
      class="flex items-center gap-2 px-3 py-2 bg-zinc-950 border rounded-xl transition-all cursor-pointer select-none"
      :class="[
        isOpen ? 'border-blue-500/50 bg-blue-600/5 shadow-lg' : 'border-zinc-800 hover:border-zinc-700'
      ]"
    >
      <div class="flex flex-col flex-1 min-w-0">
        <span v-if="label" 
          class="text-[8px] font-black uppercase tracking-widest leading-none mb-0.5 transition-colors"
          :class="isOpen ? 'text-blue-400' : 'text-zinc-600'"
        >
          {{ label }}
        </span>
        <span class="text-[11px] font-bold text-zinc-300 truncate">{{ value }}</span>
      </div>
      <div class="transition-transform duration-200" :class="{ 'rotate-180': isOpen }">
        <ChevronDown :size="12" :class="isOpen ? 'text-blue-400' : 'text-zinc-700'" />
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div 
        v-if="isOpen"
        class="absolute left-0 right-0 top-full mt-1 z-50 p-1 bg-[#0c0c0e] border border-zinc-800 rounded-xl shadow-2xl backdrop-blur-xl"
      >
        <div class="max-h-[200px] overflow-y-auto custom-scrollbar">
          <button
            v-for="option in options"
            :key="option"
            @click="selectOption(option)"
            class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-bold transition-all"
            :class="[
              value === option ? 'bg-blue-600/10 text-blue-400' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40'
            ]"
          >
            <span class="truncate">{{ option }}</span>
            <Check v-if="value === option" :size="12" class="shrink-0" />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

const props = defineProps({
  label: String,
  modelValue: String,
  value: String,
  options: {
    type: Array,
    required: true
  },
  className: String
})

const emit = defineEmits(['update:modelValue', 'update:value', 'change'])

const isOpen = ref(false)
const containerRef = ref(null)

const displayValue = computed(() => {
  return props.modelValue !== undefined ? props.modelValue : props.value
})

const selectOption = (option) => {
  emit('update:modelValue', option)
  emit('update:value', option)
  emit('change', option)
  isOpen.value = false
}

const handleClickOutside = (event) => {
  if (containerRef.value && !containerRef.value.contains(event.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}
</style>
