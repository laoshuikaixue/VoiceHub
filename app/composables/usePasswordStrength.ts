import { computed, type Ref } from 'vue'
import { useLocale } from '~/utils/locale'

export function usePasswordStrength(passwordRef: Ref<string>) {
  const { common } = useLocale()
  const strengthLevels = computed(() => common.value?.passwordStrengthLevels || {})

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
        colorClass: 'bg-error',
        textColorClass: 'text-error',
        text: strengthLevels.value?.weak || ''
      }
    } else if (score < 4) {
      return {
        width: `${scorePercentage}%`,
        colorClass: 'bg-warning',
        textColorClass: 'text-warning',
        text: strengthLevels.value?.medium || ''
      }
    } else if (score < 5) {
      return {
        width: `${scorePercentage}%`,
        colorClass: 'bg-primary',
        textColorClass: 'text-primary',
        text: strengthLevels.value?.strong || ''
      }
    } else {
      return {
        width: '100%',
        colorClass: 'bg-success',
        textColorClass: 'text-success',
        text: strengthLevels.value?.veryStrong || ''
      }
    }
  })
}
