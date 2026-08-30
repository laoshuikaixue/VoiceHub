<template>
  <div class="max-w-[1200px] mx-auto space-y-6 pb-24 px-2">
    <!-- 顶部标题栏 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.pageTitle }}</h2>
        <p class="text-xs text-text-tertiary mt-1 font-medium">
          {{ locale.pageDescription }}
        </p>
      </div>
      <div class="flex gap-3">
        <button
          :disabled="loading || saving"
          class="flex items-center gap-2 px-5 py-2 bg-bg-secondary border border-border-secondary hover:border-border-tertiary text-text-tertiary text-xs font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          @click="resetForm"
        >
          <RotateCcw :size="14" /> {{ locale.reset }}
        </button>
        <button
          :disabled="loading || saving"
          class="flex items-center gap-2 px-8 py-2 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="saveConfig"
        >
          <template v-if="saving">
            <AppSpinner :size="14" />
            {{ locale.saving }}
          </template>
          <template v-else-if="saveSuccess"> <CheckCircle2 :size="14" /> {{ locale.saved }} </template>
          <template v-else> <Save :size="14" /> {{ locale.saveConfig }} </template>
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-20">
      <AppSpinner :size="32" class="mb-4" />
      <p class="text-text-tertiary text-sm">{{ locale.loading }}</p>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 基础信息 -->
      <section :class="cardClass">
        <h3
          class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2 border-b border-border-secondary pb-4"
        >
          <Globe :size="16" class="text-primary" /> {{ locale.basicInfo }}
        </h3>
        <div class="space-y-4">
          <div>
            <label :class="labelClass">{{ locale.siteTitle }}</label>
            <input
              v-model="formData.siteTitle"
              type="text"
              :placeholder="locale.siteTitlePlaceholder"
              :class="inputClass"
            />
          </div>
          <div>
            <label :class="labelClass">{{ locale.icpNumber }}</label>
            <input
              v-model="formData.icpNumber"
              type="text"
              :placeholder="locale.icpPlaceholder"
              :class="inputClass"
            />
          </div>
          <div>
            <label :class="labelClass">{{ locale.gonganNumber }}</label>
            <input
              v-model="formData.gonganNumber"
              type="text"
              :placeholder="locale.gonganPlaceholder"
              :class="inputClass"
            />
          </div>
          <div class="pt-2">
            <div
              class="flex items-center justify-between p-3 bg-bg-primary-50 border border-border-secondary rounded-xl"
            >
              <div>
                <p class="text-xs font-bold text-text-primary">{{ locale.showBeianIcon }}</p>
                <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.showBeianIconDesc }}</p>
              </div>
              <input
                v-model="formData.showBeianIcon"
                type="checkbox"
                class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
              />
            </div>
          </div>
          <div>
            <label :class="labelClass">{{ locale.siteDescription }}</label>
            <textarea
              v-model="formData.siteDescription"
              :rows="3"
              :placeholder="locale.siteDescriptionPlaceholder"
              :class="[inputClass, 'resize-none']"
            />
          </div>
          <div class="pt-2">
            <div
              class="flex items-center justify-between p-3 bg-bg-primary-50 border border-border-secondary rounded-xl"
            >
              <div>
                <p class="text-xs font-bold text-text-primary">{{ locale.statisticsCodeEnabled }}</p>
                <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.statisticsCodeEnabledDesc }}</p>
              </div>
              <input
                v-model="formData.statisticsCodeEnabled"
                type="checkbox"
                class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
              />
            </div>
          </div>
          <div>
            <label :class="labelClass">{{ locale.statisticsCode }}</label>
            <textarea
              v-model="formData.statisticsCode"
              :rows="5"
              :placeholder="locale.statisticsCodePlaceholder"
              :class="[inputClass, 'font-mono text-xs resize-y']"
              :disabled="!formData.statisticsCodeEnabled"
            />
            <p class="text-[10px] text-text-tertiary mt-1 leading-relaxed">{{ locale.statisticsCodeHint }}</p>
          </div>
        </div>
      </section>

      <!-- 视觉识别 -->
      <section :class="cardClass">
        <h3
          class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2 border-b border-border-secondary pb-4"
        >
          <ImageIcon :size="16" class="text-info" /> {{ locale.visualIdentity }}
        </h3>
        <div class="space-y-4">
          <div>
            <label :class="labelClass">{{ locale.siteLogoUrl }}</label>
            <input
              v-model="formData.siteLogoUrl"
              type="text"
              :placeholder="locale.siteLogoPlaceholder"
              :class="inputClass"
            />
          </div>
          <div>
            <label :class="labelClass">{{ locale.schoolLogoHome }}</label>
            <input
              v-model="formData.schoolLogoHomeDarkUrl"
              type="text"
              :placeholder="locale.schoolLogoHomePlaceholder"
              :class="inputClass"
            />
          </div>
          <div>
            <label :class="labelClass">{{ locale.schoolLogoHomeLight }}</label>
            <input
              v-model="formData.schoolLogoHomeLightUrl"
              type="text"
              :disabled="!String(formData.schoolLogoHomeDarkUrl || '').trim()"
              :placeholder="locale.schoolLogoHomeLightPlaceholder"
              :class="[inputClass, 'disabled:cursor-not-allowed disabled:opacity-50']"
            />
          </div>
          <div>
            <label :class="labelClass">{{ locale.schoolLogoPrint }}</label>
            <input
              v-model="formData.schoolLogoPrintUrl"
              type="text"
              :placeholder="locale.schoolLogoPrintPlaceholder"
              :class="inputClass"
            />
          </div>
        </div>
      </section>

      <!-- 主题设置 -->
      <section v-if="isSuperAdmin" :class="cardClass">
        <h3 class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2 border-b border-border-secondary pb-4">
          <Palette :size="16" class="text-primary" /> {{ locale.themeSettings }}
        </h3>
        <div class="space-y-3">
          <p class="text-[10px] text-text-tertiary">{{ locale.themeSettingsDesc }}</p>
          <div
            v-for="option in themeOptions"
            :key="option.value"
            class="flex items-center gap-3 rounded-xl border border-border-secondary bg-bg-primary-50 p-3"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-bold text-text-primary">{{ option.label }}</p>
              <p v-if="option.value === 'System'" class="mt-0.5 text-[10px] text-text-tertiary">
                {{ locale.systemThemeHint }}
              </p>
            </div>
            <button
              type="button"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors"
              :class="formData.defaultTheme === option.value
                ? 'border-warning bg-warning-10 text-warning'
                : 'border-border-secondary text-text-disabled hover:border-warning-30 hover:text-warning'"
              :aria-label="locale.setDefaultTheme"
              :aria-pressed="formData.defaultTheme === option.value"
              @click="setDefaultTheme(option.value)"
            >
              <Star :size="15" :fill="formData.defaultTheme === option.value ? 'currentColor' : 'none'" />
            </button>
            <button
              type="button"
              class="relative h-6 w-12 shrink-0 rounded-full transition-colors"
              :class="themeToggleClass(option.value)"
              :aria-label="formData.enabledThemes.includes(option.value) ? locale.disableTheme : locale.enableTheme"
              :aria-pressed="formData.enabledThemes.includes(option.value)"
              :disabled="isThemeToggleLocked(option.value)"
              @click="toggleTheme(option.value)"
            >
              <span
                class="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform"
                :class="formData.enabledThemes.includes(option.value) ? 'translate-x-6' : 'translate-x-0'"
              />
            </button>
          </div>
          <p class="text-[10px] text-text-tertiary">{{ locale.defaultThemeDesc }}</p>
        </div>
      </section>

      <!-- 投稿逻辑设置 -->
      <section :class="cardClass">
        <h3
          class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2 border-b border-border-secondary pb-4"
        >
          <Settings2 :size="16" class="text-warning" /> {{ locale.submissionLogic }}
        </h3>
        <div class="space-y-6">
          <div
            class="flex items-center justify-between p-3 bg-bg-primary-50 border border-border-secondary rounded-xl"
          >
            <div>
              <p class="text-xs font-bold text-text-primary">{{ locale.enableCollaborative }}</p>
              <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.enableCollaborativeDesc }}</p>
            </div>
            <input
              v-model="formData.enableCollaborativeSubmission"
              type="checkbox"
              class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
            />
          </div>

          <div class="rounded-xl border border-border-secondary bg-bg-primary-50">
            <div class="flex items-center justify-between p-3">
              <div class="pr-4">
                <p class="text-xs font-bold text-text-primary">{{ locale.enableRemarks }}</p>
                <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.enableRemarksDesc }}</p>
              </div>
              <input
                v-model="formData.enableSubmissionRemarks"
                type="checkbox"
                class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
              />
            </div>

            <div
              v-if="formData.enableSubmissionRemarks"
              class="ml-4 mr-2 mb-2 pl-4 border-l border-border-secondary space-y-2 transition-opacity"
            >
              <div
                class="flex items-center justify-between p-3 bg-bg-primary border border-border-secondary rounded-xl"
              >
                <div class="pr-4">
                  <p class="text-xs font-bold text-text-primary">{{ locale.submissionNoteRequiresApproval }}</p>
                  <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.submissionNoteRequiresApprovalDesc }}</p>
                </div>
                <input
                  v-model="formData.submissionNoteRequiresApproval"
                  type="checkbox"
                  :disabled="!formData.enableSubmissionRemarks"
                  class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-border-secondary bg-bg-primary-50">
            <div class="flex items-center justify-between p-3">
              <div class="pr-4">
                <p class="text-xs font-bold text-text-primary">{{ locale.enableCardCodeRequests }}</p>
                <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.enableCardCodeRequestsDesc }}</p>
              </div>
              <input
                v-model="formData.enableCardCodeRequests"
                type="checkbox"
                class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
              />
            </div>

            <div
              v-if="formData.enableCardCodeRequests"
              class="ml-4 mr-2 mb-2 pl-4 border-l border-border-secondary space-y-2 transition-opacity"
            >
              <div
                class="flex items-center justify-between p-3 bg-bg-primary border border-border-secondary rounded-xl"
              >
                <div class="pr-4">
                  <p class="text-xs font-bold text-text-primary">{{ locale.requireCardCodeForRequests }}</p>
                  <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.requireCardCodeForRequestsDesc }}</p>
                </div>
                <input
                  v-model="formData.requireCardCodeForRequests"
                  type="checkbox"
                  :disabled="!formData.enableCardCodeRequests"
                  class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer disabled:cursor-not-allowed"
                />
              </div>

              <div
                v-if="formData.enableSubmissionLimit"
                class="flex items-center justify-between p-3 bg-bg-primary border border-border-secondary rounded-xl transition-opacity"
              >
                <div class="pr-4">
                  <p class="text-xs font-bold text-text-primary">{{ locale.enableCardCodeLimitBypass }}</p>
                  <p class="text-[10px] text-text-tertiary mt-0.5">
                    {{ locale.enableCardCodeLimitBypassDesc }}
                  </p>
                </div>
                <input
                  v-model="formData.enableCardCodeLimitBypass"
                  type="checkbox"
                  :disabled="!formData.enableCardCodeRequests || !formData.enableSubmissionLimit"
                  class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div
            class="flex items-center justify-between p-3 bg-bg-primary-50 border border-border-secondary rounded-xl"
          >
            <div>
              <p class="text-xs font-bold text-text-primary">{{ locale.enableReplay }}</p>
              <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.enableReplayDesc }}</p>
            </div>
            <input
              v-model="formData.enableReplayRequests"
              type="checkbox"
              class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
            />
          </div>

          <div class="rounded-xl border border-border-secondary bg-bg-primary-50">
            <div
              class="flex items-center justify-between p-3"
            >
              <div class="pr-4">
                <p class="text-xs font-bold text-text-primary">{{ locale.enableLimit }}</p>
                <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.enableLimitDesc }}</p>
              </div>
              <input
                v-model="formData.enableSubmissionLimit"
                type="checkbox"
                class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
              />
            </div>

            <div
              v-if="formData.enableSubmissionLimit"
              class="ml-4 mr-2 mb-2 pl-4 border-l border-border-secondary space-y-2 transition-opacity"
            >
              <div class="grid grid-cols-3 gap-2 p-1 bg-bg-primary border border-border-secondary rounded-xl">
                <button
                  :class="[
                    'py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                    activeLimitTab === 'daily'
                      ? 'bg-bg-tertiary text-primary shadow-sm'
                      : 'text-text-disabled hover:text-text-tertiary'
                  ]"
                  :disabled="!formData.enableSubmissionLimit"
                  @click="handleLimitTypeChange('daily')"
                >
                  {{ locale.dailyLimit }}
                </button>
                <button
                  :class="[
                    'py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                    activeLimitTab === 'weekly'
                      ? 'bg-bg-tertiary text-primary shadow-sm'
                      : 'text-text-disabled hover:text-text-tertiary'
                  ]"
                  :disabled="!formData.enableSubmissionLimit"
                  @click="handleLimitTypeChange('weekly')"
                >
                  {{ locale.weeklyLimit }}
                </button>
                <button
                  :class="[
                    'py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                    activeLimitTab === 'monthly'
                      ? 'bg-bg-tertiary text-primary shadow-sm'
                      : 'text-text-disabled hover:text-text-tertiary'
                  ]"
                  :disabled="!formData.enableSubmissionLimit"
                  @click="handleLimitTypeChange('monthly')"
                >
                  {{ locale.monthlyLimit }}
                </button>
              </div>

              <div>
                <label :class="labelClass">{{ currentLimitLabel }}</label>
                <div class="relative">
                  <input
                    v-model.number="currentLimitValue"
                    type="number"
                    min="0"
                    :disabled="!formData.enableSubmissionLimit"
                    :class="[inputClass, 'disabled:cursor-not-allowed disabled:opacity-50']"
                  />
                  <span
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-text-secondary uppercase"
                    >{{ locale.limitUnit }}</span
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 排期可见范围设置 -->
      <section :class="cardClass">
        <h3
          class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2 border-b border-border-secondary pb-4"
        >
          <CalendarRange :size="16" class="text-warning" /> {{ locale.scheduleVisibility }}
        </h3>
        <div class="space-y-4">
          <div class="p-4 bg-bg-primary-50 border border-border-secondary rounded-xl space-y-4">
            <p class="text-[10px] text-text-tertiary leading-relaxed">
              {{ locale.scheduleVisibilityDesc }}
            </p>

            <div class="space-y-3">
              <div class="flex items-center gap-3 p-3 bg-bg-primary border border-border-secondary rounded-xl">
                <label class="flex items-center gap-2 shrink-0 cursor-pointer">
                  <span class="text-xs font-bold text-text-primary">{{ locale.daysBeforeEnabled }}</span>
                  <span
                    :class="[
                      'relative inline-flex h-5 w-10 items-center rounded-full transition-colors',
                      formData.scheduleDaysBeforeEnabled ? 'bg-primary' : 'bg-bg-tertiary'
                    ]"
                  >
                    <input v-model="formData.scheduleDaysBeforeEnabled" type="checkbox" class="sr-only" />
                    <span
                      :class="[
                        'absolute top-1 h-3 w-3 rounded-full bg-bg-secondary transition-all',
                        formData.scheduleDaysBeforeEnabled ? 'left-6' : 'left-1'
                      ]"
                    />
                  </span>
                </label>
                <div class="relative flex-1">
                  <input
                    v-model.number="formData.scheduleDaysBefore"
                    :disabled="!formData.scheduleDaysBeforeEnabled"
                    type="number"
                    min="1"
                    max="730"
                    :class="inputClass"
                  />
                  <span class="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-text-secondary uppercase">{{ locale.daysUnit }}</span>
                </div>
              </div>
              <p class="text-[10px] text-text-tertiary px-1">{{ locale.daysBeforeEnabledDesc }}</p>

              <div class="flex items-center gap-3 p-3 bg-bg-primary border border-border-secondary rounded-xl">
                <label class="flex items-center gap-2 shrink-0 cursor-pointer">
                  <span class="text-xs font-bold text-text-primary">{{ locale.daysAfterEnabled }}</span>
                  <span
                    :class="[
                      'relative inline-flex h-5 w-10 items-center rounded-full transition-colors',
                      formData.scheduleDaysAfterEnabled ? 'bg-primary' : 'bg-bg-tertiary'
                    ]"
                  >
                    <input v-model="formData.scheduleDaysAfterEnabled" type="checkbox" class="sr-only" />
                    <span
                      :class="[
                        'absolute top-1 h-3 w-3 rounded-full bg-bg-secondary transition-all',
                        formData.scheduleDaysAfterEnabled ? 'left-6' : 'left-1'
                      ]"
                    />
                  </span>
                </label>
                <div class="relative flex-1">
                  <input
                    v-model.number="formData.scheduleDaysAfter"
                    :disabled="!formData.scheduleDaysAfterEnabled"
                    type="number"
                    min="1"
                    max="730"
                    :class="inputClass"
                  />
                  <span class="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-text-secondary uppercase">{{ locale.daysUnit }}</span>
                </div>
              </div>
              <p class="text-[10px] text-text-tertiary px-1">{{ locale.daysAfterEnabledDesc }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 安全与隐私设置 -->
      <section :class="cardClass">
        <h3
          class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2 border-b border-border-secondary pb-4"
        >
          <Shield :size="16" class="text-error" /> {{ locale.securityPrivacy }}
        </h3>
        <div class="space-y-4">
          <div class="rounded-xl border border-border-secondary bg-bg-primary-50">
            <div class="flex items-center justify-between p-3">
              <div class="pr-4">
                <p class="text-xs font-bold text-text-primary">{{ locale.captchaEnabled }}</p>
                <p class="text-[10px] text-text-tertiary mt-0.5 leading-relaxed">{{ locale.captchaEnabledDesc }}</p>
              </div>
              <input
                id="captcha-enabled"
                v-model="formData.captchaEnabled"
                type="checkbox"
                class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
              />
            </div>

            <div
              v-if="formData.captchaEnabled"
              class="ml-4 mr-2 mb-2 pl-4 border-l border-border-secondary space-y-2 transition-opacity"
            >
              <div class="p-3 bg-bg-primary border border-border-secondary rounded-xl space-y-3">
                <!-- 验证码类型选择 -->
                <div>
                  <label class="block text-xs font-bold text-text-tertiary mb-2">{{ locale.captchaType }}</label>
                  <div class="flex gap-4">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        v-model="formData.captchaProvider"
                        type="radio"
                        value="graphic"
                        :disabled="!formData.captchaEnabled"
                        class="w-4 h-4 rounded-full border-border-secondary bg-bg-secondary cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span class="text-sm text-text-secondary">{{ locale.captchaGraphic }}</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        v-model="formData.captchaProvider"
                        type="radio"
                        value="turnstile"
                        :disabled="!formData.captchaEnabled"
                        class="w-4 h-4 rounded-full border-border-secondary bg-bg-secondary cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span class="text-sm text-text-secondary">{{ locale.captchaTurnstile }}</span>
                    </label>
                  </div>
                </div>

                <!-- 图形验证码配置 -->
                <div v-if="formData.captchaProvider === 'graphic'">
                  <label class="block text-xs font-bold text-text-tertiary mb-2">{{ locale.captchaMaxFailures }}</label>
                  <input
                    v-model.number="formData.captchaMaxFailures"
                    type="number"
                    min="1"
                    :disabled="!formData.captchaEnabled"
                    :placeholder="locale.captchaMaxFailuresPlaceholder"
                    class="w-full max-w-[200px] bg-bg-secondary border border-border-secondary rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p class="text-[10px] text-text-tertiary mt-1">
                    {{ locale.captchaMaxFailuresDesc }}
                  </p>
                </div>

                <!-- Turnstile 配置 -->
                <div v-if="formData.captchaProvider === 'turnstile'" class="space-y-3">
                  <div>
                    <label class="block text-xs font-bold text-text-tertiary mb-2">{{ locale.turnstileSiteKey }}</label>
                    <input
                      v-model="formData.turnstileSiteKey"
                      type="text"
                      :disabled="!formData.captchaEnabled"
                      :placeholder="locale.turnstileSiteKeyPlaceholder"
                      class="w-full bg-bg-secondary border border-border-secondary rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-text-tertiary mb-2">{{ locale.turnstileSecretKey }}</label>
                    <input
                      v-model="formData.turnstileSecretKey"
                      type="password"
                      :disabled="!formData.captchaEnabled"
                      :placeholder="locale.turnstileSecretKeyPlaceholder"
                      class="w-full bg-bg-secondary border border-border-secondary rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <p class="text-[10px] text-text-tertiary mt-1">
                      {{ locale.turnstileSecretKeyDesc }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between p-3 bg-bg-primary-50 border border-border-secondary rounded-xl">
            <div class="pr-4">
              <p class="text-xs font-bold text-text-primary">{{ locale.forcePasswordChangeOnFirstLogin }}</p>
              <p class="text-[10px] text-text-tertiary mt-0.5 leading-relaxed">{{ locale.forcePasswordChangeOnFirstLoginDesc }}</p>
            </div>
            <input
              id="force-password-change-first-login"
              v-model="formData.forcePasswordChangeOnFirstLogin"
              type="checkbox"
              class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
            />
          </div>

          <!-- 允许注册开关 -->
          <div class="rounded-xl border border-border-secondary bg-bg-primary-50">
            <div class="flex items-center justify-between p-3">
              <div class="pr-4">
                <p class="text-xs font-bold text-text-primary">{{ locale.allowRegister }}</p>
                <p class="text-[10px] text-text-tertiary mt-0.5 leading-relaxed">{{ locale.allowRegisterDesc }}</p>
              </div>
              <input
                id="allow-register"
                v-model="formData.allowRegister"
                type="checkbox"
                class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
              />
            </div>

            <div
              v-if="formData.allowRegister || formData.allowOAuthRegistration"
              class="ml-4 mr-2 mb-2 pl-4 border-l border-border-secondary space-y-2 transition-opacity"
            >
              <div
                v-if="formData.allowRegister"
                class="flex items-center justify-between p-3 bg-bg-primary border border-border-secondary rounded-xl"
              >
                <div class="pr-4">
                  <p class="text-xs font-bold text-text-primary">{{ locale.registerRequiresApproval }}</p>
                  <p class="text-[10px] text-text-tertiary mt-0.5 leading-relaxed">{{ locale.registerRequiresApprovalDesc }}</p>
                </div>
                <input
                  id="register-requires-approval"
                  v-model="formData.registerRequiresApproval"
                  type="checkbox"
                  :disabled="!formData.allowRegister"
                  class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer disabled:cursor-not-allowed"
                />
              </div>

              <div class="flex items-center justify-between p-3 bg-bg-primary border border-border-secondary rounded-xl">
                <div class="pr-4">
                  <p class="text-xs font-bold text-text-primary">{{ locale.registerEmailRequired }}</p>
                  <p class="text-[10px] text-text-tertiary mt-0.5 leading-relaxed">{{ locale.registerEmailRequiredDesc }}</p>
                  <p v-if="!formData.smtpEnabled" class="text-[10px] text-warning mt-1 leading-relaxed">{{ locale.registerEmailSmtpRequired }}</p>
                </div>
                <input
                  id="register-email-required"
                  v-model="formData.registerEmailRequired"
                  type="checkbox"
                  :disabled="(!formData.allowRegister && !formData.allowOAuthRegistration) || !formData.smtpEnabled"
                  class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer disabled:cursor-not-allowed"
                />
              </div>

              <div class="flex items-center justify-between p-3 bg-bg-primary border border-border-secondary rounded-xl">
                <div class="pr-4">
                  <p class="text-xs font-bold text-text-primary">{{ locale.registerRequiresGradeClass }}</p>
                  <p class="text-[10px] text-text-tertiary mt-0.5 leading-relaxed">{{ locale.registerRequiresGradeClassDesc }}</p>
                </div>
                <input
                  id="register-requires-grade-class"
                  v-model="formData.registerRequiresGradeClass"
                  type="checkbox"
                  :disabled="!formData.allowRegister && !formData.allowOAuthRegistration"
                  class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between p-3 bg-bg-primary-50 border border-border-secondary rounded-xl">
            <div class="pr-4">
              <p class="text-xs font-bold text-text-primary">{{ locale.showBlacklistKeywords }}</p>
              <p class="text-[10px] text-text-tertiary mt-0.5 leading-relaxed">{{ locale.showBlacklistKeywordsDesc }}</p>
            </div>
            <input
              id="show-keywords"
              v-model="formData.showBlacklistKeywords"
              type="checkbox"
              class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
            />
          </div>

          <div class="flex items-center justify-between p-3 bg-bg-primary-50 border border-border-secondary rounded-xl">
            <div class="pr-4">
              <p class="text-xs font-bold text-text-primary">{{ locale.hideStudentInfo }}</p>
              <p class="text-[10px] text-text-tertiary mt-0.5 leading-relaxed">{{ locale.hideStudentInfoDesc }}</p>
            </div>
            <input
              id="hide-students"
              v-model="formData.hideStudentInfo"
              type="checkbox"
              class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
            />
          </div>

          <div class="flex items-center justify-between p-3 bg-bg-primary-50 border border-border-secondary rounded-xl">
            <div class="pr-4">
              <p class="text-xs font-bold text-text-primary">{{ locale.telemetryEnabled }}</p>
              <p class="text-[10px] text-text-tertiary mt-0.5 leading-relaxed">
                {{ locale.telemetryEnabledDesc }} <strong class="text-text-tertiary">{{ locale.telemetryPrivacy }}</strong>
              </p>
            </div>
            <input
              id="telemetry-enabled"
              v-model="formData.telemetryEnabled"
              type="checkbox"
              class="w-5 h-5 shrink-0 rounded border-border-secondary bg-bg-secondary cursor-pointer"
            />
          </div>

          <div
            class="p-4 bg-primary-5 border border-primary-10 rounded-xl flex items-start gap-3"
          >
            <AlertCircle class="text-primary shrink-0 mt-0.5" :size="14" />
            <p class="text-[10px] text-text-tertiary leading-normal">
              {{ locale.configWarning }}
            </p>
          </div>
        </div>
      </section>

      <!-- 投稿须知 -->
      <section
        class="lg:col-span-2 bg-bg-secondary-40 border border-border-secondary rounded-2xl p-6 space-y-6"
      >
        <div class="flex items-center justify-between border-b border-border-secondary pb-4">
          <h3
            class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2"
          >
            <FileText :size="16" class="text-success" /> {{ locale.submissionGuidelines }}
          </h3>
          <div class="flex gap-1 bg-bg-primary rounded-lg p-1">
            <button
              :class="[
                'px-3 py-1.5 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider',
                editMode === 'edit'
                  ? 'bg-primary-hover text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              ]"
              @click="editMode = 'edit'"
            >
              {{ locale.guidelinesEdit }}
            </button>
            <button
              :class="[
                'px-3 py-1.5 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider',
                editMode === 'preview'
                  ? 'bg-primary-hover text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              ]"
              @click="editMode = 'preview'"
            >
              {{ locale.guidelinesPreview }}
            </button>
          </div>
        </div>
        <textarea
          v-if="editMode === 'edit'"
          v-model="formData.submissionGuidelines"
          :rows="6"
          :placeholder="locale.guidelinesPlaceholder"
          :class="[inputClass, 'font-mono text-xs leading-relaxed min-h-[150px]']"
        />
        <div
          v-else
          class="guidelines-preview markdown-body w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-3 text-sm text-text-secondary leading-relaxed min-h-[150px] max-h-[400px] overflow-y-auto"
          v-html="renderedPreview"
        />
      </section>

      <!-- OAuth 第三方登录配置 -->
      <OAuthConfigManager v-model="formData" class="lg:col-span-2" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  Globe,
  ImageIcon,
  FileText,
  Settings2,
  Shield,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Palette,
  Star,
  CalendarRange
} from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { useToast } from '~/composables/useToast'
import { joinThemeLogoUrl, splitThemeLogoUrl, useSiteConfig } from '~/composables/useSiteConfig'
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'
import { renderMarkdown } from '~/utils/markdown'
import { getAggregateOAuthLoginTypesOrDefault } from '~/utils/oauth'
import { usePermissions } from '~/composables/usePermissions'
import { THEMES } from '~/composables/useTheme'
import OAuthConfigManager from './OAuthConfigManager.vue'

const { showToast: showNotification } = useToast()
const { refreshSiteConfig } = useSiteConfig()
const { siteConfig: locale, theme: themeLocale } = useLocale()
const { isSuperAdmin } = usePermissions()
const { localize: localizeServerError } = useServerErrors()
const themeOptions = computed(() => THEMES.map((value) => ({ value, label: themeLocale.value?.[value] || value })))

const setDefaultTheme = (theme) => {
  formData.value.defaultTheme = theme
  const enabled = new Set(formData.value.enabledThemes)
  enabled.add(theme)
  formData.value.enabledThemes = THEMES.filter((item) => enabled.has(item))
  if (theme === 'System') {
    const enabled = new Set(formData.value.enabledThemes)
    enabled.add('System')
    enabled.add('ClassicDark')
    enabled.add('ClassicLight')
    formData.value.enabledThemes = THEMES.filter((item) => enabled.has(item))
    showNotification(locale.value?.systemThemeAutoEnabled || '跟随系统需要经典深色和经典浅色，已自动启用', 'info')
  }
}

const isThemeToggleLocked = (theme) => {
  if (formData.value.defaultTheme === theme) return true
  if (formData.value.enabledThemes.length <= 1 && formData.value.enabledThemes.includes(theme)) return true
  return (theme === 'ClassicDark' || theme === 'ClassicLight') && formData.value.enabledThemes.includes('System')
}

const themeToggleClass = (theme) => {
  if (isThemeToggleLocked(theme)) return 'bg-primary-80 opacity-50 cursor-not-allowed'
  return formData.value.enabledThemes.includes(theme) ? 'bg-primary' : 'bg-bg-quaternary'
}

const toggleTheme = (theme) => {
  if (isThemeToggleLocked(theme)) return
  const enabled = new Set(formData.value.enabledThemes)
  if (enabled.has(theme)) {
    if (enabled.size <= 1 || formData.value.defaultTheme === theme) return
    if (theme === 'ClassicDark' || theme === 'ClassicLight') {
      if (enabled.has('System')) {
        showNotification(locale.value?.systemThemeRequiresBothClassic || '启用跟随系统时，经典深色和经典浅色必须同时启用', 'info')
        return
      }
    }
    enabled.delete(theme)
  } else {
    enabled.add(theme)
  }
  formData.value.enabledThemes = THEMES.filter((item) => enabled.has(item))
}
const parseJsonArray = (value, fallback) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback
    let themes = parsed.filter((item) => THEMES.includes(item))
    // 脏数据防御：跟随系统依赖经典深色/浅色同时启用，缺失时剔除 System
    if (themes.includes('System') && (!themes.includes('ClassicDark') || !themes.includes('ClassicLight'))) {
      themes = themes.filter((item) => item !== 'System')
    }
    return themes.length > 0 ? themes : fallback
  } catch {
    return fallback
  }
}

const loading = ref(true)
const saving = ref(false)
const saveSuccess = ref(false)
const editMode = ref('edit') // 投稿须知编辑/预览模式

// 投稿须知 Markdown 预览
const renderedPreview = computed(() => renderMarkdown(formData.value.submissionGuidelines))

// 样式类常量
const inputClass =
  'w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-30 transition-all placeholder:text-text-primary'
const labelClass = 'text-[10px] font-black text-text-disabled uppercase tracking-widest px-1 block mb-2'
const cardClass = 'bg-bg-secondary-40 border border-border-secondary rounded-2xl p-6 shadow-xl space-y-6'

const defaultSubmissionGuidelines = computed(() => locale.value?.defaultSubmissionGuidelines || '请遵守校园广播站投稿规范。')

const formData = ref({
  siteTitle: '',
  siteLogoUrl: '',
  schoolLogoHomeDarkUrl: '',
  schoolLogoHomeLightUrl: '',
  schoolLogoPrintUrl: '',
  siteDescription: '',
  submissionGuidelines: '',
  icpNumber: '',
  gonganNumber: '',
  statisticsCode: '',
  statisticsCodeEnabled: false,
  showBeianIcon: false,
  enableCollaborativeSubmission: true,
  enableSubmissionRemarks: false,
  submissionNoteRequiresApproval: false,
  enableReplayRequests: false,
  enableSubmissionLimit: false,
  // 点歌券点歌设置
  enableCardCodeRequests: false,
  requireCardCodeForRequests: false,
  enableCardCodeLimitBypass: false,
  dailySubmissionLimit: 5,
  weeklySubmissionLimit: null,
  monthlySubmissionLimit: null,
  scheduleDaysBeforeEnabled: false,
  scheduleDaysBefore: 1,
  scheduleDaysAfterEnabled: false,
  scheduleDaysAfter: 1,
  showBlacklistKeywords: false,
  hideStudentInfo: true,
  forcePasswordChangeOnFirstLogin: false,
  telemetryEnabled: true,
  captchaEnabled: false,
  captchaProvider: 'graphic',
  turnstileSiteKey: '',
  turnstileSecretKey: '',
  captchaMaxFailures: 3,
  allowRegister: false,
  registerRequiresApproval: true,
  oauthRegisterRequiresApproval: true,
  registerEmailRequired: false,
  registerRequiresGradeClass: false,
  smtpEnabled: false,
  allowOAuthRegistration: false,
  oauthRedirectUri: '',
  oauthStateSecret: '',
  githubOAuthEnabled: false,
  githubClientId: '',
  githubClientSecret: '',
  casdoorOAuthEnabled: false,
  casdoorServerUrl: '',
  casdoorClientId: '',
  casdoorClientSecret: '',
  casdoorOrganizationName: '',
  googleOAuthEnabled: false,
  googleClientId: '',
  googleClientSecret: '',
  aggregateOAuthEnabled: false,
  aggregateOAuthAppId: '',
  aggregateOAuthAppKey: '',
  aggregateOAuthLoginType: ['qq'],
  aggregateOAuthEndpoint: '',
  customOAuthEnabled: false,
  customOAuthDisplayName: '',
  customOAuthAuthorizeUrl: '',
  customOAuthTokenUrl: '',
  customOAuthUserInfoUrl: '',
  customOAuthScope: '',
  customOAuthClientId: '',
  customOAuthClientSecret: '',
  customOAuthUserIdField: '',
  customOAuthUsernameField: '',
  customOAuthNameField: '',
  customOAuthEmailField: '',
  customOAuthAvatarField: '',
  defaultTheme: 'System',
  enabledThemes: [...THEMES]
})

const originalData = ref({})

// 当前限额类型和值的快捷访问
const activeLimitTab = ref('daily')

// 根据数据中的限额值同步当前激活的标签页
const syncActiveLimitTab = (data) => {
  if (data.monthlySubmissionLimit != null) {
    activeLimitTab.value = 'monthly'
  } else if (data.weeklySubmissionLimit != null) {
    activeLimitTab.value = 'weekly'
  } else {
    activeLimitTab.value = 'daily'
  }
}

const currentLimitValue = computed({
  get: () => {
    if (activeLimitTab.value === 'monthly') return formData.value.monthlySubmissionLimit
    return activeLimitTab.value === 'daily'
      ? formData.value.dailySubmissionLimit
      : formData.value.weeklySubmissionLimit
  },
  set: (val) => {
    if (activeLimitTab.value === 'monthly') {
      formData.value.monthlySubmissionLimit = val
    } else if (activeLimitTab.value === 'daily') {
      formData.value.dailySubmissionLimit = val
    } else {
      formData.value.weeklySubmissionLimit = val
    }
  }
})

const currentLimitLabel = computed(() => {
  const limitTypeLabel =
    activeLimitTab.value === 'daily'
      ? locale.value?.dailyLimitLabel
      : activeLimitTab.value === 'weekly'
        ? locale.value?.weeklyLimitLabel
        : locale.value?.monthlyLimitLabel

  return `${locale.value?.limitLabelPrefix || '当前启用：'}${limitTypeLabel || '未设置限额'}${locale.value?.limitLabelSuffix || '投稿限制'}`
})

// 加载配置
const loadConfig = async () => {
  try {
    loading.value = true
    const response = await fetch('/api/admin/system-settings', {
      credentials: 'include'
    })

    if (!response.ok) throw new Error(locale.value?.fetchFailed || 'Failed to load site config')

    const data = await response.json()

    syncActiveLimitTab(data)

    const schoolLogoHome = splitThemeLogoUrl(data.schoolLogoHomeUrl)
    formData.value = {
      siteTitle: data.siteTitle || '',
      siteLogoUrl: data.siteLogoUrl || '',
      schoolLogoHomeDarkUrl: schoolLogoHome.dark,
      schoolLogoHomeLightUrl: schoolLogoHome.light,
      schoolLogoPrintUrl: data.schoolLogoPrintUrl || '',
      siteDescription: data.siteDescription || '',
      submissionGuidelines: data.submissionGuidelines || defaultSubmissionGuidelines.value,
      icpNumber: data.icpNumber || '',
      gonganNumber: data.gonganNumber || '',
      statisticsCode: data.statisticsCode || '',
      statisticsCodeEnabled: !!data.statisticsCodeEnabled,
      showBeianIcon: !!data.showBeianIcon,
      enableCollaborativeSubmission: data.enableCollaborativeSubmission !== false,
      enableSubmissionRemarks: !!data.enableSubmissionRemarks,
      submissionNoteRequiresApproval: !!data.submissionNoteRequiresApproval,
      enableReplayRequests: !!data.enableReplayRequests,
      enableSubmissionLimit: !!data.enableSubmissionLimit,
      // 点歌券点歌设置
      enableCardCodeRequests: !!data.enableCardCodeRequests,
      requireCardCodeForRequests: !!data.requireCardCodeForRequests,
      enableCardCodeLimitBypass: !!data.enableCardCodeLimitBypass,
      dailySubmissionLimit: data.dailySubmissionLimit ?? 5,
      weeklySubmissionLimit: data.weeklySubmissionLimit ?? null,
      monthlySubmissionLimit: data.monthlySubmissionLimit ?? null,
      scheduleDaysBeforeEnabled: data.scheduleDaysBeforeEnabled === true,
      scheduleDaysBefore: data.scheduleDaysBefore ?? 1,
      scheduleDaysAfterEnabled: data.scheduleDaysAfterEnabled === true,
      scheduleDaysAfter: data.scheduleDaysAfter ?? 1,
      showBlacklistKeywords: !!data.showBlacklistKeywords,
      hideStudentInfo: data.hideStudentInfo ?? true,
      forcePasswordChangeOnFirstLogin: data.forcePasswordChangeOnFirstLogin === true,
      telemetryEnabled: !!data.telemetryEnabled,
      captchaEnabled: !!data.captchaEnabled,
      captchaProvider: data.captchaProvider || 'graphic',
      turnstileSiteKey: data.turnstileSiteKey || '',
      turnstileSecretKey: undefined,
      captchaMaxFailures: data.captchaMaxFailures ?? 3,
      allowOAuthRegistration: !!data.allowOAuthRegistration,
      allowRegister: !!data.allowRegister,
      registerRequiresApproval: data.registerRequiresApproval !== false,
      oauthRegisterRequiresApproval: data.oauthRegisterRequiresApproval !== false,
      registerEmailRequired: data.registerEmailRequired === true,
      registerRequiresGradeClass: data.registerRequiresGradeClass === true,
      smtpEnabled: !!data.smtpEnabled,
      oauthRedirectUri: data.oauthRedirectUri || '',
      oauthStateSecret: data.oauthStateSecret || '',
      githubOAuthEnabled: !!data.githubOAuthEnabled,
      githubClientId: data.githubClientId || '',
      githubClientSecret: data.githubClientSecret || '',
      casdoorOAuthEnabled: !!data.casdoorOAuthEnabled,
      casdoorServerUrl: data.casdoorServerUrl || '',
      casdoorClientId: data.casdoorClientId || '',
      casdoorClientSecret: data.casdoorClientSecret || '',
      casdoorOrganizationName: data.casdoorOrganizationName || '',
      googleOAuthEnabled: !!data.googleOAuthEnabled,
      googleClientId: data.googleClientId || '',
      googleClientSecret: data.googleClientSecret || '',
      aggregateOAuthEnabled: !!data.aggregateOAuthEnabled,
      aggregateOAuthAppId: data.aggregateOAuthAppId || '',
      aggregateOAuthAppKey: data.aggregateOAuthAppKey || '',
      aggregateOAuthLoginType: getAggregateOAuthLoginTypesOrDefault(data.aggregateOAuthLoginType),
      aggregateOAuthEndpoint: data.aggregateOAuthEndpoint || 'https://a.idcfx.net/connect.php',
      customOAuthEnabled: !!data.customOAuthEnabled,
      customOAuthDisplayName: data.customOAuthDisplayName || '',
      customOAuthAuthorizeUrl: data.customOAuthAuthorizeUrl || '',
      customOAuthTokenUrl: data.customOAuthTokenUrl || '',
      customOAuthUserInfoUrl: data.customOAuthUserInfoUrl || '',
      customOAuthScope: data.customOAuthScope || '',
      customOAuthClientId: data.customOAuthClientId || '',
      customOAuthClientSecret: data.customOAuthClientSecret || '',
      customOAuthUserIdField: data.customOAuthUserIdField || '',
      customOAuthUsernameField: data.customOAuthUsernameField || '',
      customOAuthNameField: data.customOAuthNameField || '',
      customOAuthEmailField: data.customOAuthEmailField || '',
      customOAuthAvatarField: data.customOAuthAvatarField || '',
      defaultTheme: data.defaultTheme || 'System',
      enabledThemes: parseJsonArray(data.enabledThemes, [...THEMES])
    }

    originalData.value = JSON.parse(JSON.stringify(formData.value))
  } catch (error) {
    console.error('Failed to load site config:', error)
    showNotification(locale.value?.loadFailed || '系统设置加载失败', 'error')
  } finally {
    loading.value = false
  }
}

// 保存配置
const saveConfig = async () => {
  try {
    if (isSuperAdmin.value) {
      if (!formData.value.enabledThemes.includes(formData.value.defaultTheme)) {
        showNotification(locale.value?.defaultThemeMustBeEnabled || '默认主题必须处于启用状态', 'error')
        return
      }
      if (formData.value.enabledThemes.includes('System') && (!formData.value.enabledThemes.includes('ClassicDark') || !formData.value.enabledThemes.includes('ClassicLight'))) {
        showNotification(locale.value?.systemThemeRequiresBothClassic || '启用跟随系统时，经典深色和经典浅色必须同时启用', 'error')
        return
      }
    }
    saving.value = true
    const schoolLogoHomeDarkUrl = (formData.value.schoolLogoHomeDarkUrl || '').trim()
    const schoolLogoHomeLightUrl = schoolLogoHomeDarkUrl
      ? (formData.value.schoolLogoHomeLightUrl || '').trim()
      : ''
    const configToSave = {
      ...formData.value,
      schoolLogoHomeUrl: joinThemeLogoUrl(
        schoolLogoHomeDarkUrl,
        schoolLogoHomeLightUrl
      ),
      siteTitle: (formData.value.siteTitle || '').trim() || locale.value?.defaultSiteTitle || 'VoiceHub',
      siteLogoUrl: (formData.value.siteLogoUrl || '').trim() || '/favicon.ico',
      submissionGuidelines:
        (formData.value.submissionGuidelines || '').trim() || defaultSubmissionGuidelines.value,
      // 确保根据限额类型处理空值
      dailySubmissionLimit:
        activeLimitTab.value === 'daily' ? formData.value.dailySubmissionLimit : null,
      weeklySubmissionLimit:
        activeLimitTab.value === 'weekly' ? formData.value.weeklySubmissionLimit : null,
      monthlySubmissionLimit:
        activeLimitTab.value === 'monthly' ? formData.value.monthlySubmissionLimit : null,
      ...(isSuperAdmin.value
        ? {
            defaultTheme: formData.value.defaultTheme,
            enabledThemes: JSON.stringify(formData.value.enabledThemes)
          }
        : {})
    }
    if (!isSuperAdmin.value) {
      delete configToSave.defaultTheme
      delete configToSave.enabledThemes
    }
    delete configToSave.schoolLogoHomeDarkUrl
    delete configToSave.schoolLogoHomeLightUrl

    const response = await fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(configToSave)
    })

    if (!response.ok) {
      let message = locale.value?.saveFailed || '系统设置保存失败'
      try {
        const errorData = await response.json()
        console.error('Site config API error response:', errorData)

        message = localizeServerError(errorData, locale.value?.saveFailed || '系统设置保存失败')
      } catch (parseError) {
        console.error('Failed to parse site config API error:', parseError)
      }
      throw new Error(message)
    }

    saveSuccess.value = true
    formData.value = {
      ...formData.value,
      siteTitle: configToSave.siteTitle,
      siteLogoUrl: configToSave.siteLogoUrl
    }
    originalData.value = JSON.parse(JSON.stringify(formData.value))
    localStorage.setItem('voicehub.telemetryEnabled', configToSave.telemetryEnabled ? 'true' : 'false')
    // 刷新前端模块级缓存，避免首页等页面继续使用旧配置
    await refreshSiteConfig()
    showNotification(locale.value?.saveSuccess || '系统设置已保存', 'success')

    setTimeout(() => {
      saveSuccess.value = false
    }, 3000)
  } catch (error) {
    console.error('Failed to save site config:', error)
    let message = locale.value?.saveFailedRetry || '系统设置保存失败，请稍后重试'
    if (error?.message) {
      message = localizeServerError(error, error.message)
    }
    showNotification(message, 'error')
  } finally {
    saving.value = false
  }
}

// 处理限额类型变化
const handleLimitTypeChange = (type) => {
  activeLimitTab.value = type
  const limits = {
    daily: { key: 'dailySubmissionLimit', default: 5 },
    weekly: { key: 'weeklySubmissionLimit', default: 20 },
    monthly: { key: 'monthlySubmissionLimit', default: 50 }
  }

  // 如果当前类型的限额为 null，则设置默认值
  const targetLimit = limits[type]
  if (formData.value[targetLimit.key] === null) {
    formData.value[targetLimit.key] = targetLimit.default
  }
}

// 重置表单
const resetForm = () => {
  formData.value = JSON.parse(JSON.stringify(originalData.value))
  syncActiveLimitTab(formData.value)
}

onMounted(loadConfig)
</script>

<style scoped>
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type='number'] {
  -moz-appearance: textfield;
}
</style>
