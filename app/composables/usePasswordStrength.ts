import { computed, type Ref } from 'vue'

export function usePasswordStrength(passwordRef: Ref<string>) {
  return computed(() => {
    if (!passwordRef.value) {
      return { width: '0%', colorClass: '', textColorClass: '', text: '' }
    }

    let score = 0
    const value = passwordRef.value
    if (value.length >= 8) score++
    if (/[a-z]/.test(value)) score++
    if (/[A-Z]/.test(value)) score++
    if (/[0-9]/.test(value)) score++
    if (/[^A-Za-z0-9]/.test(value)) score++

    const scorePercentage = (score / 5) * 100

    if (score < 3) {
      return {
        width: `${scorePercentage || 10}%`,
        colorClass: 'bg-rose-500',
        textColorClass: 'text-rose-500',
        text: '弱'
      }
    } else if (score < 4) {
      return {
        width: `${scorePercentage}%`,
        colorClass: 'bg-amber-500',
        textColorClass: 'text-amber-500',
        text: '中等'
      }
    } else if (score < 5) {
      return {
        width: `${scorePercentage}%`,
        colorClass: 'bg-blue-500',
        textColorClass: 'text-blue-500',
        text: '强'
      }
    } else {
      return {
        width: '100%',
        colorClass: 'bg-emerald-500',
        textColorClass: 'text-emerald-500',
        text: '极强'
      }
    }
  })
}
