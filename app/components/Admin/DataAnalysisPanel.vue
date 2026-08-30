<template>
  <div class="max-w-[1600px] mx-auto space-y-10 pb-20">
    <!-- 加载状态 -->
    <div
      v-if="isLoading && !hasInitialData"
      class="flex flex-col items-center justify-center min-h-[60vh] space-y-6"
    >
      <div class="relative w-24 h-24">
        <div class="absolute inset-0 border-4 border-primary-20 rounded-full" />
        <div class="absolute inset-0 flex items-center justify-center">
          <AppSpinner :size="96" />
        </div>
        <div class="absolute inset-0 flex items-center justify-center">
          <Activity class="text-primary animate-pulse" :size="32" />
        </div>
      </div>
      <div class="text-center">
        <h3 class="text-xl font-black text-text-primary tracking-tight">
          {{ loadingSteps[currentLoadingStep] }}
        </h3>
        <p class="text-sm text-text-tertiary mt-2">{{ locale.loadingDesc }}</p>
      </div>
    </div>

    <!-- 错误状态 -->
    <div
      v-else-if="error && !hasInitialData"
      class="flex flex-col items-center justify-center min-h-[60vh] space-y-6"
    >
      <div class="p-6 bg-error-10 border border-error-20 rounded-3xl">
        <X class="text-error" :size="48" />
      </div>
      <div class="text-center">
        <h3 class="text-xl font-black text-text-primary tracking-tight">{{ locale.loadFailed }}</h3>
        <p class="text-sm text-text-tertiary mt-2 max-w-md">{{ error }}</p>
        <button
          class="mt-6 px-8 py-3 bg-bg-secondary border border-border-secondary rounded-full text-sm font-black text-text-primary hover:bg-bg-tertiary transition-all flex items-center gap-2 mx-auto"
          @click="refreshAllData"
        >
          <RefreshCw :size="16" />
          {{ locale.retryNow }}
        </button>
      </div>
    </div>

    <!-- 主要内容 -->
    <div v-else class="space-y-10">
      <!-- 顶部标题和筛选栏 -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 class="text-3xl font-black text-text-primary tracking-tight">{{ locale.title }}</h2>
          <p class="text-sm text-text-tertiary mt-1 font-medium">{{ locale.desc }}</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            :disabled="isLoading"
            class="p-2.5 bg-bg-secondary-50 border border-border-secondary rounded-full text-text-tertiary hover:text-text-primary transition-all group disabled:opacity-50 flex items-center justify-center"
            @click="refreshAllData"
          >
            <RefreshCw :size="18" :class="{ 'animate-spin': isLoading }" />
          </button>
          <div
            class="px-3 py-1.5 bg-primary-10 border border-primary-20 rounded-full flex items-center gap-2"
          >
            <div class="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span class="text-[10px] font-black text-primary uppercase tracking-widest"
              >{{ locale.realtimeMode }}</span
            >
          </div>
          <CustomSelect
            v-model="selectedSemester"
            :options="availableSemesterOptions"
            label-key="name"
            value-key="value"
            :placeholder="locale.selectSemester"
            class-name="w-48"
            @change="handleSemesterChange"
          />
        </div>
      </div>

      <!-- 第一行：关键绩效指标 (KPI) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          v-for="(stat, i) in kpiStats"
          :key="i"
          class="group relative p-6 bg-bg-secondary-40 border border-border-secondary-60 rounded-[2rem] overflow-hidden hover:border-border-tertiary transition-all hover:shadow-2xl hover:shadow-[0_25px_50px_var(--shadow-color-deep)]"
        >
          <div class="flex justify-between items-start">
            <div
              :class="[
                'p-3 rounded-2xl bg-bg-primary border border-border-secondary text-text-tertiary transition-all group-hover:border-border-tertiary',
                stat.iconColorHoverClass
              ]"
            >
              <component :is="stat.icon" :size="20" />
            </div>
            <div
              v-if="stat.trend !== 0"
              :class="[
                'flex items-center gap-1 text-[11px] font-black',
                stat.trendColorClass
              ]"
            >
              <ArrowDownRight v-if="stat.trend < 0" :size="12" />
              <ArrowUpRight v-else :size="12" />
              {{ Math.abs(stat.trend) }}%
            </div>
            <div v-else class="text-[11px] font-black text-text-tertiary uppercase tracking-widest">
              {{ locale.stable }}
            </div>
          </div>
          <div class="mt-4">
            <h4 class="text-3xl font-black text-text-primary tracking-tighter">
              {{ formatNumber(stat.value) }}
            </h4>
            <p class="text-[10px] font-black text-text-disabled uppercase tracking-[0.2em] mt-1">
              {{ stat.label }}
            </p>
          </div>
          <!-- 背景装饰 -->
          <div
            :class="[
              'absolute -right-4 -bottom-4 w-24 h-24 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full pointer-events-none',
              stat.glowColorClass
            ]"
          />
        </div>
      </div>

      <!-- 第二行：图表和实时数据 -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <!-- 实时脉冲部分 -->
        <div class="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            class="p-8 bg-bg-secondary-20 border border-border-secondary-40 rounded-3xl flex items-center justify-between relative overflow-hidden group cursor-help"
            @mouseenter="handleMouseEnter"
            @mouseleave="handleMouseLeave"
          >
            <div class="relative z-10">
              <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest"
                >{{ locale.currentActiveUsers }}</span
              >
              <div class="flex items-baseline gap-2 mt-1">
                <h3 class="text-5xl font-black text-text-primary">{{ realtimeStats.activeUsers }}</h3>
                <span class="text-xs font-bold text-text-tertiary">{{ locale.onlineUnit }}</span>
              </div>
            </div>
            <div class="relative z-10 w-24 h-24 flex items-center justify-center">
              <div class="absolute inset-0 bg-primary-20 rounded-full animate-ping opacity-20" />
              <div class="absolute inset-4 bg-primary-20 rounded-full animate-pulse opacity-40" />
              <Activity class="text-primary" :size="32" />
            </div>
          </div>
          <div
            class="p-8 bg-bg-secondary-20 border border-border-secondary-40 rounded-3xl flex items-center justify-between relative overflow-hidden group"
          >
            <div class="relative z-10">
              <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest"
                >{{ locale.todayRequests }}</span
              >
              <div class="flex items-baseline gap-2 mt-1">
                <h3 class="text-5xl font-black text-success">
                  {{ realtimeStats.todayRequests }}
                </h3>
                <span class="text-xs font-bold text-text-tertiary">{{ locale.songUnit }}</span>
              </div>
            </div>
            <div class="relative z-10 w-24 h-24 flex items-center justify-center">
              <div
                class="absolute inset-0 bg-success-20 rounded-full animate-ping opacity-10"
              />
              <Globe class="text-success" :size="32" />
            </div>
          </div>
        </div>

        <!-- 趋势分析图表卡片 -->
        <div
          class="lg:col-span-8 bg-bg-secondary-40 border border-border-secondary rounded-[3rem] p-8 shadow-2xl overflow-hidden flex flex-col min-h-[500px]"
        >
          <div class="flex items-center justify-between mb-10">
            <div>
              <h3 class="text-xl font-bold flex items-center gap-3 text-text-primary">
                <BarChart2 class="text-primary" :size="20" />
                {{ locale.trendTitle }}
              </h3>
              <p class="text-xs text-text-tertiary mt-1">{{ locale.trendDesc }}</p>
            </div>
            <div class="flex items-center gap-4">
              <div v-if="panelStates.trends.loading" class="animate-spin text-primary">
                <RefreshCw :size="16" />
              </div>
              <button
                v-if="panelStates.trends.error"
                class="p-2 text-error hover:text-error transition-colors"
                :title="locale.retry"
                @click="loadTrends"
              >
                <RefreshCw :size="16" />
              </button>
            </div>
          </div>

          <div
            v-if="panelStates.trends.loading && trendData.length === 0"
            class="flex-1 flex flex-col items-center justify-center space-y-4"
          >
            <AppSpinner :size="48" />
            <p class="text-xs font-black text-text-disabled uppercase tracking-widest">
              {{ locale.loadingTrends }}
            </p>
          </div>
          <div
            v-else-if="panelStates.trends.error && trendData.length === 0"
            class="flex-1 flex flex-col items-center justify-center space-y-4"
          >
            <div class="p-4 bg-error-10 rounded-2xl">
              <Activity class="text-error-50" :size="32" />
            </div>
            <p class="text-xs font-black text-error uppercase tracking-widest">
              {{ panelStates.trends.error }}
            </p>
            <button
              class="px-6 py-2 bg-bg-tertiary hover:bg-bg-quaternary text-text-primary text-[10px] font-black uppercase tracking-widest rounded-full transition-all"
              @click="loadTrends"
            >
              {{ locale.retryNow }}
            </button>
          </div>
          <div
            v-else-if="trendData.length > 0"
            class="flex-1 flex items-end gap-2 md:gap-4 px-2 mb-4"
          >
            <div
              v-for="(item, i) in trendData.slice(-7)"
              :key="i"
              class="flex-1 flex flex-col items-center gap-3 group h-full relative"
            >
              <div class="relative w-full flex flex-col justify-end h-full">
                <div
                  :style="{
                    height: `${(item.count / Math.max(...trendData.map((d) => d.count), 1)) * 100}%`
                  }"
                  class="w-full bg-gradient-to-t from-primary-10 to-primary-40 rounded-t-xl group-hover:from-primary-30 group-hover:to-primary-60 transition-all border-x border-t border-primary-20 group-hover:border-primary-40 min-h-[4px]"
                />
                <div
                  class="absolute left-1/2 -translate-x-1/2 -translate-y-full mb-2 text-[10px] font-black text-primary opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap pointer-events-none z-10"
                  :style="{
                    bottom: `${(item.count / Math.max(...trendData.map((d) => d.count), 1)) * 100}%`
                  }"
                >
                  {{ locale.countSongs(item.count) }}
                </div>
              </div>
              <span
                class="text-[10px] font-black text-text-disabled group-hover:text-text-tertiary transition-colors uppercase tracking-widest"
              >
                {{ formatDateShort(item.date) }}
              </span>
            </div>
          </div>
          <div v-else class="flex-1 flex flex-col items-center justify-center text-text-disabled">
            <BarChart2 :size="48" class="opacity-20" />
            <p class="text-sm font-medium mt-4">{{ locale.noTrendData }}</p>
          </div>
        </div>

        <!-- 热门歌曲排行榜 -->
        <div
          class="lg:col-span-4 bg-bg-secondary-40 border border-border-secondary rounded-[3rem] p-8 flex flex-col min-h-[500px]"
        >
          <div class="flex items-center justify-between mb-8">
            <h3 class="text-xl font-bold flex items-center gap-3 text-text-primary">
              <Trophy class="text-warning" :size="20" />
              {{ locale.topSongsTitle }}
            </h3>
            <div class="flex items-center gap-4">
              <div class="flex gap-2">
                <button
                  :class="`text-[10px] font-black uppercase tracking-widest transition-colors ${selectedSortBy === 'vote' ? 'text-primary' : 'text-text-disabled hover:text-text-tertiary'}`"
                  @click="handleSortChange('vote')"
                >
                  {{ locale.likes }}
                </button>
                <span class="text-text-primary">|</span>
                <button
                  :class="`text-[10px] font-black uppercase tracking-widest transition-colors ${selectedSortBy === 'replay' ? 'text-primary' : 'text-text-disabled hover:text-text-tertiary'}`"
                  @click="handleSortChange('replay')"
                >
                  {{ locale.replays }}
                </button>
              </div>
              <div v-if="panelStates.topSongs.loading" class="animate-spin text-warning">
                <RefreshCw :size="14" />
              </div>
            </div>
          </div>

          <div
            v-if="panelStates.topSongs.loading && topSongs.length === 0"
            class="flex-1 space-y-4"
          >
            <div v-for="i in 5" :key="i" class="h-20 bg-bg-tertiary-20 animate-pulse rounded-2xl" />
          </div>
          <div
            v-else-if="panelStates.topSongs.error && topSongs.length === 0"
            class="flex-1 flex flex-col items-center justify-center space-y-4"
          >
            <Music :size="32" class="text-error-20" />
            <p class="text-[10px] font-black text-error uppercase tracking-widest">
              {{ panelStates.topSongs.error }}
            </p>
            <button
              class="px-4 py-2 bg-bg-tertiary text-[10px] font-black uppercase rounded-full hover:bg-bg-quaternary text-text-primary transition-colors"
              @click="loadTopSongs"
            >
              {{ locale.retry }}
            </button>
          </div>
          <div
            v-else-if="topSongs.length > 0"
            class="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2"
          >
            <div
              v-for="(song, i) in topSongs.slice(0, 5)"
              :key="i"
              class="p-4 bg-bg-primary-50 border border-border-secondary-40 rounded-2xl flex items-center gap-4 group hover:bg-bg-tertiary-30 transition-all"
            >
              <div
                :class="`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                  i === 0
                    ? 'bg-warning text-black shadow-lg shadow-[var(--warning-glow-20)]'
                    : i === 1
                      ? 'bg-bg-quaternary text-black'
                      : i === 2
                        ? 'bg-brand-yellow text-text-primary'
                        : 'text-text-disabled border border-border-secondary'
                }`"
              >
                {{ i + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <h4
                  class="text-sm font-bold text-text-primary truncate group-hover:text-text-primary transition-colors"
                >
                  {{ song.title }}
                </h4>
                <p class="text-[10px] text-text-disabled font-medium truncate uppercase tracking-widest">
                  {{ song.artist }}
                </p>
              </div>
              <div class="text-right">
                <span class="text-xs font-black text-text-tertiary">{{ song.count }}</span>
                <div class="text-[8px] font-black text-text-secondary uppercase">
                  {{ selectedSortBy === 'replay' ? locale.times : locale.likes }}
                </div>
              </div>
            </div>
          </div>
          <div v-else class="flex-1 flex flex-col items-center justify-center text-text-secondary">
            <Music :size="32" class="opacity-20 mb-2" />
            <p class="text-xs font-bold uppercase tracking-widest">{{ locale.noData }}</p>
          </div>
        </div>
      </div>

      <!-- 第三行：用户和学期对比 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- 活跃用户排行榜 -->
        <div
          class="bg-bg-secondary-40 border border-border-secondary rounded-[3rem] p-8 flex flex-col min-h-[500px]"
        >
          <div class="flex items-center justify-between mb-8">
            <h3 class="text-xl font-bold flex items-center gap-3 text-text-primary">
              <UserCheck class="text-info" :size="20" />
              {{ locale.activeUsersTitle }}
            </h3>
            <div v-if="panelStates.activeUsers.loading" class="animate-spin text-info">
              <RefreshCw :size="16" />
            </div>
          </div>

          <div
            v-if="panelStates.activeUsers.loading && activeUsers.length === 0"
            class="flex-1 space-y-4"
          >
            <div v-for="i in 4" :key="i" class="h-24 bg-bg-tertiary-20 animate-pulse rounded-3xl" />
          </div>
          <div
            v-else-if="panelStates.activeUsers.error && activeUsers.length === 0"
            class="flex-1 flex flex-col items-center justify-center space-y-4"
          >
            <Users :size="32" class="text-error-20" />
            <p class="text-[10px] font-black text-error uppercase tracking-widest">
              {{ panelStates.activeUsers.error }}
            </p>
            <button
              class="px-4 py-2 bg-bg-tertiary text-[10px] font-black uppercase rounded-full hover:bg-bg-quaternary text-text-primary transition-colors"
              @click="loadActiveUsers"
            >
              {{ locale.retry }}
            </button>
          </div>
          <div
            v-else-if="activeUsers.length > 0"
            class="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2"
          >
            <div
              v-for="(user, i) in activeUsers.slice(0, 5)"
              :key="i"
              class="relative p-5 bg-bg-primary-30 border border-border-secondary-50 rounded-3xl overflow-hidden group"
            >
              <div class="flex items-center gap-4 relative z-10">
                <div
                  class="w-12 h-12 rounded-2xl bg-bg-tertiary flex items-center justify-center font-black text-text-tertiary group-hover:text-text-primary transition-colors"
                >
                  {{ user.name.charAt(0) }}
                </div>
                <div class="flex-1">
                  <h4 class="text-sm font-bold text-text-primary">{{ user.name }}</h4>
                  <p class="text-xs text-text-disabled font-medium mt-1">
                    {{ locale.userActivity(user.contributions, user.likes) }}
                  </p>
                </div>
                <div class="text-right">
                  <span
                    class="text-xl font-black text-text-secondary group-hover:text-info transition-colors"
                    >{{ user.activityScore }}</span
                  >
                  <p class="text-[10px] font-black text-text-secondary uppercase tracking-widest">
                    {{ locale.activity }}
                  </p>
                </div>
              </div>
              <!-- 进度条指示器 -->
              <div
                class="absolute bottom-0 left-0 h-1 bg-info-20 group-hover:bg-info-40 transition-all"
                :style="{
                  width: `${(user.activityScore / Math.max(...activeUsers.map((u) => u.activityScore), 1)) * 100}%`
                }"
              />
            </div>
          </div>
          <div v-else class="flex-1 flex flex-col items-center justify-center text-text-secondary">
            <Users :size="32" class="opacity-20 mb-2" />
            <p class="text-xs font-bold uppercase tracking-widest">{{ locale.noActiveUsers }}</p>
          </div>
        </div>

        <!-- 学期对比分析 -->
        <div
          class="bg-bg-secondary-40 border border-border-secondary rounded-[3rem] p-8 flex flex-col min-h-[500px]"
        >
          <div class="flex items-center justify-between mb-8">
            <h3 class="text-xl font-bold flex items-center gap-3 text-text-primary">
              <Globe class="text-success" :size="20" />
              {{ locale.semesterComparisonTitle }}
            </h3>
            <div
              v-if="panelStates.semesterComparison.loading"
              class="animate-spin text-success"
            >
              <RefreshCw :size="16" />
            </div>
          </div>

          <div
            v-if="panelStates.semesterComparison.loading && semesterComparison.length === 0"
            class="flex-1 space-y-4"
          >
            <div v-for="i in 3" :key="i" class="h-32 bg-bg-tertiary-20 animate-pulse rounded-[2rem]" />
          </div>
          <div
            v-else-if="panelStates.semesterComparison.error && semesterComparison.length === 0"
            class="flex-1 flex flex-col items-center justify-center space-y-4"
          >
            <Globe :size="32" class="text-error-20" />
            <p class="text-[10px] font-black text-error uppercase tracking-widest">
              {{ panelStates.semesterComparison.error }}
            </p>
            <button
              class="px-4 py-2 bg-bg-tertiary text-[10px] font-black uppercase rounded-full hover:bg-bg-quaternary text-text-primary transition-colors"
              @click="loadSemesterComparison"
            >
              {{ locale.retry }}
            </button>
          </div>
          <div
            v-else-if="semesterComparison.length > 0"
            class="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-2"
          >
            <div
              v-for="(sem, i) in semesterComparison"
              :key="i"
              :class="`p-6 border rounded-[2rem] transition-all ${sem.isActive ? 'bg-success-5 border-success-20 shadow-lg shadow-[var(--success-glow-5)]' : 'bg-bg-primary-20 border-border-secondary-60 opacity-60 hover:opacity-100'}`"
            >
              <div class="flex items-center justify-between mb-4">
                <span class="text-xs font-black text-text-secondary uppercase tracking-widest">{{
                  sem.semester
                }}</span>
                <span
                  v-if="sem.isActive"
                  class="px-2 py-0.5 bg-success-20 text-success rounded text-[8px] font-black uppercase"
                  >{{ locale.currentSemester }}</span
                >
                <span v-else class="text-[10px] font-black text-text-disabled">{{ locale.historyBaseline }}</span>
              </div>
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <h5 class="text-lg font-black text-text-primary">{{ sem.totalSongs }}</h5>
                  <p class="text-[9px] font-black text-text-disabled uppercase tracking-tighter mt-1">
                    {{ locale.totalSongs }}
                  </p>
                </div>
                <div>
                  <h5 class="text-lg font-black text-text-primary">{{ sem.totalSchedules }}</h5>
                  <p class="text-[9px] font-black text-text-disabled uppercase tracking-tighter mt-1">
                    {{ locale.totalSchedules }}
                  </p>
                </div>
                <div>
                  <h5 class="text-lg font-black text-text-primary">{{ sem.totalRequests }}</h5>
                  <p class="text-[9px] font-black text-text-disabled uppercase tracking-tighter mt-1">
                    {{ locale.totalLikes }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="flex-1 flex flex-col items-center justify-center text-text-secondary">
            <Globe :size="32" class="opacity-20 mb-2" />
            <p class="text-xs font-bold uppercase tracking-widest">{{ locale.noComparisonData }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 全局悬浮提示框 -->
    <Teleport to="body">
      <div
        v-if="tooltip.show"
        ref="tooltipEl"
        :style="tooltip.style"
        class="fixed z-[999999] pointer-events-auto"
        @mouseenter="handleTooltipMouseEnter"
        @mouseleave="handleTooltipMouseLeave"
      >
        <div
          class="bg-bg-secondary border border-border-secondary rounded-3xl shadow-2xl overflow-hidden min-w-[320px] backdrop-blur-xl bg-opacity-90 animate-in fade-in zoom-in duration-200"
        >
          <div
            class="p-6 border-b border-border-secondary-50 bg-gradient-to-br from-primary-10 to-transparent"
          >
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-sm font-black text-text-primary uppercase tracking-widest">{{ locale.activeUserDetails }}</h4>
              <div class="flex items-center gap-2 px-2 py-1 bg-primary-20 rounded-full">
                <div class="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                <span class="text-[10px] font-black text-primary"
                  >{{ locale.onlineCount(realtimeStats.activeUsers) }}</span
                >
              </div>
            </div>

            <div
              v-if="realtimeStats.activeUsersList && realtimeStats.activeUsersList.length > 0"
              class="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1"
            >
              <div
                v-for="user in realtimeStats.activeUsersList"
                :key="user.id"
                class="flex items-center gap-3 p-3 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl group hover:border-primary-30 transition-all"
              >
                <img
                  v-if="user.avatar && !failedAvatars[user.id]"
                  :src="user.avatar"
                  class="w-10 h-10 rounded-xl object-cover border border-border-secondary-50"
                  @error="markAvatarFailed(user.id)"
                >
                <div
                  v-else
                  class="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center font-black text-text-tertiary group-hover:text-primary transition-colors"
                >
                  {{ user.name.charAt(0) }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-bold text-text-primary truncate">{{ user.name }}</div>
                  <div class="text-[10px] text-text-tertiary font-medium truncate">
                    @{{ user.username }}
                  </div>
                </div>
                <div class="text-[10px] font-black text-text-disabled bg-bg-secondary px-2 py-1 rounded-lg">
                  {{ user.lastActive }}
                </div>
              </div>
            </div>
            <div v-else class="py-10 flex flex-col items-center justify-center text-text-disabled">
              <Users :size="32" class="opacity-20 mb-3" />
              <p class="text-xs font-black uppercase tracking-widest">{{ locale.noOnlineUsers }}</p>
            </div>
          </div>
          <div class="px-6 py-4 bg-bg-primary-50 flex items-center justify-between">
            <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest"
              >{{ locale.syncingRealtime }}</span
            >
            <Activity :size="12" class="text-primary animate-pulse" />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { onMounted, ref, computed, nextTick } from 'vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import {
  TrendingUp,
  Users,
  Music,
  Calendar,
  Heart,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  UserCheck,
  BarChart2,
  Globe,
  RefreshCw,
  Eye,
  MousePointer2,
  Check,
  X
} from '@lucide/vue'
import { useSemesters } from '~/composables/useSemesters'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useLocale } from '~/utils/locale'

// 使用学期管理 composable
const { fetchSemesters, semesters: availableSemesters, currentSemester } = useSemesters()
const { admin } = useLocale()
const locale = computed(() => {
  const base = admin.value?.dataAnalysis || {}
  return useSafeLocale({
    ...base,
    countSongs: base.countSongs || ((count) => `${count}首`),
    userActivity: base.userActivity || ((contributions, likes) => `${contributions}首投稿 · ${likes}次点赞`),
    andMoreUsers: base.andMoreUsers || ((count) => `及其他 ${count} 位用户`),
    onlineCount: base.onlineCount || ((count) => `${count} 在线`),
    messages: {
      updated: '数据已更新',
      refreshSuccess: '数据刷新成功',
      ...(base.messages || {})
    },
    errors: {
      topSongs: '加载热门歌曲失败',
      loadData: '加载数据失败，请稍后重试',
      stats: '加载统计数据失败',
      trends: '加载趋势数据失败',
      activeUsers: '加载活跃用户失败',
      userEngagement: '加载用户参与度失败',
      semesterComparison: '加载学期对比失败',
      init: '初始化失败，请刷新页面重试',
      initNotify: '数据初始化失败',
      retry: '重试失败',
      ...(base.errors || {})
    }
  })
})

// 响应式数据
const selectedSemester = ref('all')
const selectedSortBy = ref('vote')
const isLoading = ref(false)
const error = ref(null)
const hasInitialData = ref(false)
const currentLoadingStep = ref(0)

// 转换学期列表以适应 CustomSelect
const availableSemesterOptions = computed(() => {
  const options = (availableSemesters.value || []).map((s) => ({ name: s.name, value: s.name }))
  return [{ name: locale.value.allSemesters, value: 'all' }, ...options]
})

// 加载步骤
const loadingSteps = computed(() => locale.value.loadingSteps || ['获取学期信息', '加载统计数据', '获取图表数据', '加载实时数据'])

const analysisData = ref({
  totalSongs: 0,
  totalUsers: 0,
  totalSchedules: 0,
  totalRequests: 0,
  // 变化百分比
  songsChange: 0,
  usersChange: 0,
  schedulesChange: 0,
  requestsChange: 0,
  // 趋势数据
  songsTrend: [],
  usersTrend: [],
  schedulesTrend: [],
  requestsTrend: []
})

// 计算 KPI 统计数据
const kpiStats = computed(() => [
  {
    label: locale.value?.kpi?.totalUsers || 'Total users',
    value: analysisData.value.totalUsers,
    trend: analysisData.value.usersChange,
    icon: Users,
    color: 'blue',
    iconColorHoverClass: 'group-hover:text-primary group-hover:border-primary-30',
    trendColorClass: 'text-primary',
    glowColorClass: 'bg-primary-5'
  },
  {
    label: locale.value?.kpi?.activeSongs || 'Active songs',
    value: analysisData.value.totalSongs,
    trend: analysisData.value.songsChange,
    icon: Music,
    color: 'emerald',
    iconColorHoverClass: 'group-hover:text-success group-hover:border-success-30',
    trendColorClass: 'text-success',
    glowColorClass: 'bg-success-5'
  },
  {
    label: locale.value?.kpi?.scheduleDays || 'Schedule days',
    value: analysisData.value.totalSchedules,
    trend: analysisData.value.schedulesChange,
    icon: Calendar,
    color: 'amber',
    iconColorHoverClass: 'group-hover:text-warning group-hover:border-warning-30',
    trendColorClass: 'text-warning',
    glowColorClass: 'bg-warning-5'
  },
  {
    label: locale.value?.kpi?.totalRequests || 'Total requests',
    value: analysisData.value.totalRequests,
    trend: analysisData.value.requestsChange,
    icon: Heart,
    color: 'rose',
    iconColorHoverClass: 'group-hover:text-error group-hover:border-error-30',
    trendColorClass: 'text-error',
    glowColorClass: 'bg-error-5'
  }
])

// 图表数据
const trendData = ref([])
const topSongs = ref([])
const activeUsers = ref([])
const userEngagement = ref({})
const semesterComparison = ref([])

// 各个面板的loading和error状态
const panelStates = ref({
  trends: { loading: false, error: null },
  topSongs: { loading: false, error: null },
  activeUsers: { loading: false, error: null },
  userEngagement: { loading: false, error: null },
  semesterComparison: { loading: false, error: null }
})
const realtimeStats = ref({
  activeUsers: 0,
  activeUsersList: [],
  todayRequests: 0,
  popularGenres: [],
  peakHours: []
})

// 全局tooltip状态
const tooltipEl = ref(null)
const failedAvatars = ref({})
const markAvatarFailed = (id) => {
  if (id == null || failedAvatars.value[id]) return
  failedAvatars.value = { ...failedAvatars.value, [id]: true }
}
const tooltip = ref({
  show: false,
  isHovered: false,
  style: {
    position: 'fixed',
    top: '0px',
    left: '0px',
    zIndex: 999999
  }
})

// 鼠标进入事件处理
const handleMouseEnter = async (event) => {
  const rect = event.target.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // 计算tooltip位置
  let left = rect.left + rect.width / 2
  let top = rect.top - 10

  // 确保tooltip不超出视口边界
  const tooltipWidth = 320 // 预估tooltip宽度
  const tooltipHeight = 480 // 预估tooltip高度（列表区已限高50vh）

  if (left + tooltipWidth / 2 > viewportWidth) {
    left = viewportWidth - tooltipWidth / 2 - 10
  }
  if (left - tooltipWidth / 2 < 0) {
    left = tooltipWidth / 2 + 10
  }
  if (top - tooltipHeight < 0) {
    top = rect.bottom + 10
  }
  // 以视口高度为界，限制不超出底部
  if (top + tooltipHeight > viewportHeight - 10) {
    top = viewportHeight - tooltipHeight - 10
  }
  if (top < 10) {
    top = 10
  }

  tooltip.value.style.left = `${left}px`
  tooltip.value.style.top = `${top}px`
  tooltip.value.style.transform = 'translateX(-50%)'
  tooltip.value.show = true

  // 渲染后按实际高度二次校正，确保完整显示在视口内
  await nextTick()
  const el = tooltipEl.value
  if (!el) return
  const actualHeight = el.offsetHeight
  let actualTop = parseFloat(el.style.top) || 0
  if (actualTop + actualHeight > viewportHeight - 10) {
    actualTop = viewportHeight - actualHeight - 10
  }
  if (actualTop < 10) {
    actualTop = 10
  }
  el.style.top = `${actualTop}px`
}

// 鼠标离开事件处理
const handleMouseLeave = () => {
  // 延迟隐藏，给用户时间移动到tooltip上
  setTimeout(() => {
    if (!tooltip.value.isHovered) {
      tooltip.value.show = false
    }
  }, 100)
}

// tooltip鼠标进入事件
const handleTooltipMouseEnter = () => {
  tooltip.value.isHovered = true
}

// tooltip鼠标离开事件
const handleTooltipMouseLeave = () => {
  tooltip.value.isHovered = false
  tooltip.value.show = false
}

// 处理学期切换
const handleSemesterChange = async () => {
  await Promise.all([loadAnalysisData(), loadChartData(), loadRealtimeStats()])

  if (window.$showNotification) {
    window.$showNotification(locale.value.messages.updated, 'success')
  }
}

// 处理排行方式切换
const handleSortChange = async (sortBy) => {
  if (selectedSortBy.value === sortBy && !panelStates.value.topSongs.error) return
  selectedSortBy.value = sortBy

  // 重新加载热门歌曲数据
  const params = new URLSearchParams()
  if (selectedSemester.value && selectedSemester.value !== 'all') {
    params.append('semester', selectedSemester.value)
  }

  try {
    panelStates.value.topSongs.loading = true
    const topSongsData = await $fetch(
      `/api/admin/stats/top-songs?limit=10&${params.toString()}&sortBy=${selectedSortBy.value}`,
      {
        method: 'GET'
      }
    )
    topSongs.value = topSongsData || []
    panelStates.value.topSongs.error = null
  } catch (err) {
    console.warn('获取热门歌曲数据失败:', err)
    panelStates.value.topSongs.error = locale.value.errors.topSongs
    topSongs.value = []
    if (window.$showNotification) {
      window.$showNotification(locale.value.errors.topSongs, 'error')
    }
  } finally {
    panelStates.value.topSongs.loading = false
  }
}

// 加载分析数据
const loadAnalysisData = async () => {
  try {
    isLoading.value = true
    error.value = null
    currentLoadingStep.value = 1

    // 构建API查询参数
    const params = new URLSearchParams()
    if (selectedSemester.value && selectedSemester.value !== 'all') {
      params.append('semester', selectedSemester.value)
    }

    // 调用API获取统计数据
    const response = await $fetch(`/api/admin/stats?${params.toString()}`, {
      method: 'GET'
    })

    // 更新分析数据
    analysisData.value = {
      totalSongs: response.totalSongs || 0,
      totalUsers: response.totalUsers || 0,
      totalSchedules: response.totalSchedules || 0,
      totalRequests: response.weeklyRequests || 0,
      // 变化百分比
      songsChange: response.songsChange || 0,
      usersChange: response.usersChange || 0,
      schedulesChange: response.schedulesChange || 0,
      requestsChange: response.requestsChange || 0,
      // 趋势数据
      songsTrend: response.songsTrend || [],
      usersTrend: response.usersTrend || [],
      schedulesTrend: response.schedulesTrend || [],
      requestsTrend: response.requestsTrend || []
    }
  } catch (err) {
    console.error('加载分析数据失败:', err)
    error.value = locale.value.errors.loadData
    if (window.$showNotification) {
      window.$showNotification(locale.value.errors.stats, 'error')
    }
  } finally {
    isLoading.value = false
  }
}

// 加载实时统计数据
const loadRealtimeStats = async () => {
  try {
    currentLoadingStep.value = 3
    const response = await $fetch('/api/admin/stats/realtime', {
      method: 'GET'
    })

    realtimeStats.value = {
      activeUsers: response.activeUsers || 0,
      activeUsersList: response.activeUsersList || [],
      todayRequests: response.todayRequests || 0,
      popularGenres: response.popularGenres || [],
      peakHours: response.peakHours || []
    }
  } catch (err) {
    console.error('加载实时数据失败:', err)
  }
}

// 加载图表数据
const loadChartData = async () => {
  currentLoadingStep.value = 2

  // 构建API查询参数
  const params = new URLSearchParams()
  if (selectedSemester.value && selectedSemester.value !== 'all') {
    params.append('semester', selectedSemester.value)
  }

  // 重置所有面板状态
  Object.keys(panelStates.value).forEach((key) => {
    panelStates.value[key].loading = true
    panelStates.value[key].error = null
  })

  // 独立加载趋势数据
  const loadTrends = async () => {
    try {
      const trends = await $fetch(`/api/admin/stats/trends?${params.toString()}`, {
        method: 'GET'
      })
      trendData.value = trends || []
      panelStates.value.trends.error = null
    } catch (err) {
      console.warn('获取趋势数据失败:', err)
      panelStates.value.trends.error = locale.value.errors.trends
      trendData.value = []
    } finally {
      panelStates.value.trends.loading = false
    }
  }

  // 独立加载热门歌曲数据
  const loadTopSongs = async () => {
    try {
      const topSongsData = await $fetch(
        `/api/admin/stats/top-songs?limit=10&${params.toString()}&sortBy=${selectedSortBy.value}`,
        {
          method: 'GET'
        }
      )
      topSongs.value = topSongsData || []
      panelStates.value.topSongs.error = null
    } catch (err) {
      console.warn('获取热门歌曲数据失败:', err)
      panelStates.value.topSongs.error = locale.value.errors.topSongs
      topSongs.value = []
    } finally {
      panelStates.value.topSongs.loading = false
    }
  }

  // 独立加载活跃用户数据
  const loadActiveUsers = async () => {
    try {
      const activeUsersData = await $fetch(
        `/api/admin/stats/active-users?limit=10&${params.toString()}`,
        {
          method: 'GET'
        }
      )
      activeUsers.value = activeUsersData || []
      panelStates.value.activeUsers.error = null
    } catch (err) {
      console.warn('获取活跃用户数据失败:', err)
      panelStates.value.activeUsers.error = locale.value.errors.activeUsers
      activeUsers.value = []
    } finally {
      panelStates.value.activeUsers.loading = false
    }
  }

  // 独立加载用户参与度数据
  const loadUserEngagement = async () => {
    try {
      const engagement = await $fetch(`/api/admin/stats/user-engagement?${params.toString()}`, {
        method: 'GET'
      })
      userEngagement.value = engagement || {}
      panelStates.value.userEngagement.error = null
    } catch (err) {
      console.warn('获取用户参与度数据失败:', err)
      panelStates.value.userEngagement.error = locale.value.errors.userEngagement
      userEngagement.value = {}
    } finally {
      panelStates.value.userEngagement.loading = false
    }
  }

  // 独立加载学期对比数据
  const loadSemesterComparison = async () => {
    try {
      const comparison = await $fetch('/api/admin/stats/semester-comparison', {
        method: 'GET'
      })
      semesterComparison.value = comparison || []
      panelStates.value.semesterComparison.error = null
    } catch (err) {
      console.warn('获取学期对比数据失败:', err)
      panelStates.value.semesterComparison.error = locale.value.errors.semesterComparison
      semesterComparison.value = []
    } finally {
      panelStates.value.semesterComparison.loading = false
    }
  }

  // 并行执行所有加载任务，但每个都是独立的
  await Promise.allSettled([
    loadTrends(),
    loadTopSongs(),
    loadActiveUsers(),
    loadUserEngagement(),
    loadSemesterComparison()
  ])
}

// 组件挂载时初始化
onMounted(async () => {
  try {
    currentLoadingStep.value = 0
    // 获取学期列表
    await fetchSemesters()

    // 设置默认学期为当前学期
    if (currentSemester.value) {
      selectedSemester.value = currentSemester.value.name
    }

    // 并行加载所有数据
    await Promise.all([loadAnalysisData(), loadChartData(), loadRealtimeStats()])

    hasInitialData.value = true

    // 设置定时刷新实时数据（每30秒）
    setInterval(() => {
      loadRealtimeStats()
    }, 30000)
  } catch (err) {
    console.error('初始化数据分析面板失败:', err)
    error.value = locale.value.errors.init
    if (window.$showNotification) {
      window.$showNotification(locale.value.errors.initNotify, 'error')
    }
  }
})

// 刷新所有数据
const refreshAllData = async () => {
  if (isLoading.value) return

  await Promise.all([loadAnalysisData(), loadChartData(), loadRealtimeStats()])

  if (window.$showNotification) {
    window.$showNotification(locale.value.messages.refreshSuccess, 'success')
  }
}

// 独立重试函数
const loadActiveUsers = async () => {
  const params = new URLSearchParams()
  if (selectedSemester.value && selectedSemester.value !== 'all') {
    params.append('semester', selectedSemester.value)
  }

  panelStates.value.activeUsers.loading = true
  panelStates.value.activeUsers.error = null

  try {
    const activeUsersData = await $fetch(
      `/api/admin/stats/active-users?limit=10&${params.toString()}`,
      {
        method: 'GET'
      }
    )
    activeUsers.value = activeUsersData || []
    panelStates.value.activeUsers.error = null
  } catch (err) {
    console.warn('重新获取活跃用户数据失败:', err)
    panelStates.value.activeUsers.error = locale.value.errors.activeUsers
    activeUsers.value = []
    if (window.$showNotification) {
      window.$showNotification(locale.value.errors.retry, 'error')
    }
  } finally {
    panelStates.value.activeUsers.loading = false
  }
}

const loadSemesterComparison = async () => {
  panelStates.value.semesterComparison.loading = true
  panelStates.value.semesterComparison.error = null
  try {
    const comparison = await $fetch('/api/admin/stats/semester-comparison', {
      method: 'GET'
    })
    semesterComparison.value = comparison || []
  } catch (err) {
    console.warn('获取学期对比数据失败:', err)
    panelStates.value.semesterComparison.error = locale.value.errors.semesterComparison
    if (window.$showNotification) {
      window.$showNotification(locale.value.errors.retry, 'error')
    }
  } finally {
    panelStates.value.semesterComparison.loading = false
  }
}

// 格式化数字
const formatNumber = (num) => {
  if (typeof num === 'number' && num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num
}

// 格式化日期 (短格式)
const formatDateShort = (dateStr) => {
  if (!dateStr) return ''
  // 假设格式为 YYYY-MM-DD
  const parts = dateStr.split('-')
  if (parts.length >= 3) {
    return `${parts[1]}-${parts[2]}`
  }
  return dateStr
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: var(--overlay-5);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--data-analysis-scroll-thumb);
  border-radius: 3px;
  transition: background 0.3s ease;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--data-analysis-scroll-thumb-hover);
}
</style>
