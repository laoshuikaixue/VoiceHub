<template>
  <div>
    <div class="flex items-center gap-3">
      <div
        class="w-14 h-14 rounded-xl overflow-hidden border border-border-secondary bg-bg-primary flex items-center justify-center flex-shrink-0"
      >
        <img v-if="modelValue" :src="modelValue" alt="预览" class="w-full h-full object-contain p-1" />
        <ImageIcon v-else :size="20" class="text-text-disabled" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-2 bg-bg-secondary border border-border-secondary hover:border-primary-30 hover:text-primary text-text-secondary text-[11px] font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="disabled"
          @click="fileInput?.click()"
        >
          <Upload :size="13" /> 上传图片
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-2 bg-bg-secondary border border-border-secondary hover:border-primary-30 hover:text-primary text-text-secondary text-[11px] font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="disabled"
          @click="cameraInput?.click()"
        >
          <Camera :size="13" /> 拍照
        </button>
        <button
          v-if="modelValue"
          type="button"
          class="flex items-center gap-1.5 px-3 py-2 bg-bg-secondary border border-border-secondary hover:border-error hover:text-error text-text-secondary text-[11px] font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="disabled"
          @click="emit('update:modelValue', '')"
        >
          <X :size="13" /> 移除
        </button>
      </div>
    </div>
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      :disabled="disabled"
      @change="handleFile"
    />
    <input
      ref="cameraInput"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden"
      :disabled="disabled"
      @change="handleFile"
    />
    <input
      v-if="!modelValue || !String(modelValue).startsWith('data:')"
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="[inputClass, 'mt-2 disabled:cursor-not-allowed disabled:opacity-50']"
      @input="emit('update:modelValue', $event.target.value)"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Upload, Camera, X, Image as ImageIcon } from '@lucide/vue'
import { useToast } from '~/composables/useToast'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  maxSize: { type: Number, default: 384 },
  inputClass: {
    type: String,
    default:
      'w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-30 transition-all placeholder:text-text-primary'
  }
})

const emit = defineEmits(['update:modelValue'])
const toast = useToast()
const fileInput = ref(null)
const cameraInput = ref(null)

// 压缩为最长边 maxSize 的 PNG，保留透明背景并控制存储体积
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, props.maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => reject(new Error('图片读取失败'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

const handleFile = async (event) => {
  const file = event.target.files?.[0]
  if (event.target) event.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.error('请选择图片文件')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    toast.error('图片不能超过 10MB')
    return
  }
  try {
    emit('update:modelValue', await compressImage(file))
  } catch (err) {
    console.error('处理图片失败:', err)
    toast.error('图片处理失败')
  }
}
</script>
