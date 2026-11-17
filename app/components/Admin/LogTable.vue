<template>
  <section class="bg-bg-secondary-40 border border-border-secondary rounded-2xl overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead>
          <tr class="border-b border-border-secondary text-[10px] font-black uppercase tracking-widest text-text-disabled">
            <th v-for="column in columns" :key="column" class="px-4 py-3 whitespace-nowrap">{{ column }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && !rows.length" class="border-b border-border-secondary">
            <td :colspan="columns.length" class="px-4 py-12 text-center">
              <AppSpinner :size="28" />
            </td>
          </tr>
          <tr v-else-if="!rows.length" class="border-b border-border-secondary">
            <td :colspan="columns.length" class="px-4 py-12 text-center text-xs text-text-disabled">
              {{ emptyText }}
            </td>
          </tr>
          <tr
            v-for="(row, index) in rows"
            :key="row[rowKey] ?? index"
            class="border-b border-border-secondary last:border-0 hover:bg-bg-tertiary-30 transition-colors"
          >
            <slot :row="row" :index="index" />
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'

defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  emptyText: { type: String, default: '' },
  rowKey: { type: String, default: 'id' }
})
</script>
