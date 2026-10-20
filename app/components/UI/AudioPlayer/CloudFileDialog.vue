<template>
  <Teleport to="body">
    <div v-if="pendingSelection" class="cloud-file-overlay" :style="{ zIndex }" role="dialog" aria-modal="true" :aria-label="t('cloudSelectTitle')" @keydown.esc="chooseFile()">
      <div class="cloud-file-dialog">
        <h3>{{ t('cloudSelectTitle') }}</h3>
        <p>{{ t('cloudSelectHint') }}</p>
        <CustomSelect v-model="selectedKey" :options="options" :placeholder="t('cloudSelectPlaceholder')" />
        <div class="cloud-file-actions">
          <button type="button" @click="chooseFile()">{{ t('cloudCancel') }}</button>
          <button type="button" :disabled="!selectedKey" @click="chooseFile(selectedKey)">{{ t('cloudPlay') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useNeteaseCloudPlayback } from '~/composables/useNeteaseCloudPlayback'
import { useLocale } from '~/utils/locale'
import { useLocaleText } from '~/composables/useLocaleText'
import { cloudFileLabel } from '~/utils/neteaseCloud'
import { usePopupZIndex } from '~/composables/useZIndex'

const { pendingSelection, chooseFile } = useNeteaseCloudPlayback()
const { audioPlayer } = useLocale()
const { t } = useLocaleText(audioPlayer)
const selectedKey = ref('')
const { zIndex, onOpenChange } = usePopupZIndex()
const options = computed(() => (pendingSelection.value?.files || []).map(file => ({ value: file.key, label: cloudFileLabel(file) })))
watch(pendingSelection, value => { selectedKey.value = ''; onOpenChange(!!value) }, { immediate: true })
</script>

<style scoped>
.cloud-file-overlay { position: fixed; inset: 0; z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--mask-60); }
.cloud-file-dialog { width: min(100%, 480px); padding: 24px; border: 1px solid var(--border-secondary); border-radius: 20px; background: var(--bg-secondary); color: var(--text-primary); }
h3 { margin-bottom: 12px; font-size: 18px; }
p { margin-bottom: 20px; color: var(--text-secondary); overflow-wrap: anywhere; }
.cloud-file-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; }
button { border-radius: 8px; padding: 8px 16px; background: var(--bg-tertiary); }
button:disabled { opacity: .5; cursor: not-allowed; }
</style>
