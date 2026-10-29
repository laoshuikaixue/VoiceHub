<template>
  <Teleport to="body">
    <Transition name="app-modal">
      <div
        v-if="show"
        :style="{ zIndex }"
        class="app-modal"
        @click.self="handleOverlayClick"
      >
        <div
          ref="panelRef"
          :aria-labelledby="title ? titleId : undefined"
          aria-modal="true"
          :class="['app-modal__panel', panelClass]"
          :data-size="size"
          role="dialog"
          tabindex="-1"
        >
          <header v-if="title || $slots.header" class="app-modal__header">
            <slot name="header" :title-id="titleId">
              <div class="app-modal__heading">
                <slot name="icon" />
                <div class="min-w-0">
                  <h2 :id="titleId" class="app-modal__title">{{ title }}</h2>
                  <p v-if="description" class="app-modal__description">{{ description }}</p>
                </div>
              </div>
            </slot>
            <button
              v-if="!hideClose"
              :aria-label="resolvedCloseLabel"
              class="app-modal__close"
              type="button"
              @click="close"
            >
              <Icon name="x" :size="18" />
            </button>
          </header>

          <div :class="['app-modal__body', bodyClass]">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="app-modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, useId, watch } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import { useFocusTrap } from '~/composables/useFocusTrap'
import { useLocale } from '~/utils/locale'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  size: {
    type: String,
    default: 'lg',
    validator: (value) => ['sm', 'md', 'lg', 'xl', '2xl', 'full'].includes(value)
  },
  closeOnOverlay: { type: Boolean, default: true },
  closeOnEsc: { type: Boolean, default: true },
  persistent: { type: Boolean, default: false },
  hideClose: { type: Boolean, default: false },
  closeLabel: { type: String, default: '' },
  panelClass: { type: [String, Object, Array], default: '' },
  bodyClass: { type: [String, Object, Array], default: '' }
})

const emit = defineEmits(['update:show', 'close'])

const { common } = useLocale()
const panelRef = ref(null)
const titleId = `app-modal-title-${useId()}`

const resolvedCloseLabel = computed(
  () => props.closeLabel || common.value?.close || 'Close'
)

const modalStack = []
const instanceId = Symbol('app-modal')
const zIndex = ref(500)

watch(
  () => props.show,
  (show) => {
    if (show) {
      if (!modalStack.includes(instanceId)) modalStack.push(instanceId)
      zIndex.value = 500 + modalStack.indexOf(instanceId) * 10
    } else {
      const index = modalStack.indexOf(instanceId)
      if (index >= 0) modalStack.splice(index, 1)
    }
  },
  { immediate: true }
)

const close = () => {
  if (props.persistent) return
  emit('update:show', false)
  emit('close')
}

const handleOverlayClick = () => {
  if (props.closeOnOverlay) close()
}

useFocusTrap(panelRef, computed(() => props.show), {
  onEscape: () => {
    if (props.closeOnEsc) close()
  }
})
</script>

<style scoped>
.app-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--modal-backdrop, rgba(0, 0, 0, 0.7));
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.app-modal__panel {
  display: flex;
  width: 100%;
  max-height: min(92dvh, 860px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-secondary);
  border-radius: 16px;
  background: var(--bg-secondary);
  box-shadow: 0 24px 64px var(--mask-30);
}

.app-modal__panel[data-size='sm'] {
  max-width: 24rem;
}

.app-modal__panel[data-size='md'] {
  max-width: 28rem;
}

.app-modal__panel[data-size='lg'] {
  max-width: 32rem;
}

.app-modal__panel[data-size='xl'] {
  max-width: 42rem;
}

.app-modal__panel[data-size='2xl'] {
  max-width: 56rem;
}

.app-modal__panel[data-size='full'] {
  max-width: 72rem;
}

.app-modal__header {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--border-secondary);
  padding: 20px;
}

.app-modal__heading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 12px;
}

.app-modal__title {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.app-modal__description {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-tertiary);
}

.app-modal__close {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bg-primary-50);
  color: var(--text-tertiary);
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.app-modal__close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.app-modal__body {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  overscroll-behavior: contain;
}

.app-modal__footer {
  flex-shrink: 0;
  border-top: 1px solid var(--border-secondary);
  padding: 16px 20px;
  background: var(--bg-secondary-50);
}

.app-modal-enter-active {
  transition: opacity 200ms var(--ease-out);
}

.app-modal-leave-active {
  transition: opacity 160ms var(--ease-out);
}

.app-modal-enter-from,
.app-modal-leave-to {
  opacity: 0;
}

.app-modal-enter-active .app-modal__panel,
.app-modal-leave-active .app-modal__panel {
  transition:
    opacity 200ms var(--ease-out),
    transform 220ms var(--ease-out);
}

.app-modal-enter-from .app-modal__panel,
.app-modal-leave-to .app-modal__panel {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

@media (max-width: 640px) {
  .app-modal {
    align-items: flex-end;
    padding: 0;
  }

  .app-modal__panel {
    width: 100%;
    max-width: none;
    max-height: 92dvh;
    border-radius: 20px 20px 0 0;
    border-bottom: 0;
  }

  .app-modal__footer {
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  }

  .app-modal-enter-from .app-modal__panel,
  .app-modal-leave-to .app-modal__panel {
    opacity: 1;
    transform: translateY(100%);
  }

  .app-modal__header,
  .app-modal__body {
    padding-left: 16px;
    padding-right: 16px;
  }

  .app-modal__footer {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
