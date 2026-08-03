<template>
  <div class="max-w-[1600px] mx-auto space-y-10 pb-20 bg-[#0b1220] text-slate-100">
    <!-- 加载状态 -->
    <div
      v-if="isLoading && !hasInitialData"
      class="flex flex-col items-center justify-center min-h-[60vh] space-y-6"
    >
      <div class="w-24 h-24 rounded-md bg-slate-800 border border-slate-600/30" />
      <div class="text-center">
          <h3 class="text-xl font-bold text-slate-100 tracking-tight">
          {{ loadingSteps[currentLoadingStep] }}
        </h3>
        <p class="text-sm text-slate-400 mt-2">{{ locale.loadingDesc }}</p>
      </div>
    </div>

    <!-- 错误状态 -->
    <div
      v-else-if="error && !hasInitialData"
      class="flex flex-col items-center justify-center min-h-[60vh] space-y-6"
    >
      <div class="p-5 bg-rose-500/10 border border-rose-400/30 rounded-md">
        <X class="text-rose-400" :size="40" />
      </div>
      <div class="text-center">
        <h3 class="text-xl font-bold text-slate-100 tracking-tight">{{ locale.loadFailed }}</h3>
        <p class="text-sm text-slate-400 mt-2 max-w-md">{{ error }}</p>
        <button
          class="mt-6 px-4 py-2 bg-slate-800 border border-slate-600/40 rounded-md text-sm font-semibold text-slate-100 hover:bg-slate-700 transition-colors flex items-center gap-2 mx-auto"
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
          <h2 class="text-3xl font-bold text-slate-100 tracking-tight">{{ locale.title }}</h2>
          <p class="text-sm text-slate-400 mt-1 font-medium">{{ locale.desc }}</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            :disabled="isLoading"
            class="p-2.5 bg-slate-800 border border-slate-600/40 rounded-md text-slate-400 hover:text-slate-100 hover:border-sky-400/50 transition-colors disabled:opacity-50"
            @click="refreshAllData"
          >
            <RefreshCw :size="18" />
          </button>
          <div
            class="px-3 py-1.5 bg-sky-400/10 border border-sky-400/30 rounded-md flex items-center gap-2"
          >
            <div class="w-2 h-2 bg-sky-400 rounded-full" />
            <span class="text-[10px] font-bold text-sky-400 uppercase tracking-widest"
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
          class="group relative p-6 bg-[#111827] border border-slate-400/20 rounded-md overflow-hidden hover:border-slate-400/35 transition-colors"
        >
          <div class="flex justify-between items-start">
            <div
              :class="`p-3 rounded-md bg-slate-950 border border-slate-600/40 text-slate-400 group-hover:text-${stat.color}-400 group-hover:border-${stat.color}-500/30 transition-colors`"
            >
              <component :is="stat.icon" :size="20" />
            </div>
            <div
              v-if="stat.trend !== 0"
              :class="`flex items-center gap-1 text-[11px] font-bold ${stat.trend < 0 ? 'text-rose-400' : `text-${stat.color}-400`}`"
            >
              <ArrowDownRight v-if="stat.trend < 0" :size="12" />
              <ArrowUpRight v-else :size="12" />
              {{ Math.abs(stat.trend) }}%
            </div>
            <div v-else class="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              {{ locale.stable }}
            </div>
          </div>
          <div class="mt-4">
            <h4 class="text-3xl font-bold text-slate-100 tracking-tight">
              {{ formatNumber(stat.value) }}
            </h4>
            <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mt-1">
              {{ stat.label }}
            </p>
          </div>
          <!-- 背景装饰 -->
        </div>
      </div>

      <!-- 第二行：图表和实时数据 -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <!-- 实时脉冲部分 -->
        <div class="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            class="p-8 bg-[#111827] border border-slate-400/20 rounded-md flex items-center justify-between relative overflow-hidden group cursor-help"
            @mouseenter="handleMouseEnter"
            @mouseleave="handleMouseLeave"
          >
            <div class="relative z-10">
              <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-widest"
                >{{ locale.currentActiveUsers }}</span
              >
              <div class="flex items-baseline gap-2 mt-1">
                <h3 class="text-5xl font-bold text-slate-100">{{ realtimeStats.activeUsers }}</h3>
                <span class="text-xs font-semibold text-slate-400">{{ locale.onlineUnit }}</span>
              </div>
            </div>
            <div class="relative z-10 w-24 h-24 flex items-center justify-center rounded-md bg-sky-400/10 border border-sky-400/20">
              <Activity class="text-sky-400" :size="32" />
            </div>
          </div>
          <div
            class="p-8 bg-[#111827] border border-slate-400/20 rounded-md flex items-center justify-between relative overflow-hidden group"
          >
            <div class="relative z-10">
              <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-widest"
                >{{ locale.todayRequests }}</span
              >
              <div class="flex items-baseline gap-2 mt-1">
                <h3 class="text-5xl font-bold text-emerald-400">
                  {{ realtimeStats.todayRequests }}
                </h3>
                <span class="text-xs font-semibold text-slate-400">{{ locale.songUnit }}</span>
              </div>
            </div>
            <div class="relative z-10 w-24 h-24 flex items-center justify-center rounded-md bg-emerald-400/10 border border-emerald-400/20">
              <Globe class="text-emerald-400" :size="32" />
            </div>
          </div>
        </div>

        <!-- 趋势分析图表卡片 -->
        <div
          class="lg:col-span-8 bg-[#111827] border border-slate-400/20 rounded-md p-8 overflow-hidden flex flex-col min-h-[500px]"
        >
          <div class="flex items-center justify-between mb-10">
            <div>
              <h3 class="text-xl font-bold flex items-center gap-3 text-white">
                <BarChart2 class="text-blue-500" :size="20" />
                {{ locale.trendTitle }}
              </h3>
              <p class="text-xs text-slate-400 mt-1">{{ locale.trendDesc }}</p>
            </div>
            <div class="flex items-center gap-4">
              <div v-if="panelStates.trends.loading" class="text-sky-400">
                <RefreshCw :size="16" />
              </div>
              <button
                v-if="panelStates.trends.error"
                class="p-2 text-rose-400 hover:text-rose-300 transition-colors"
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
            <div
              class="w-12 h-12 rounded-md bg-slate-800 border border-slate-600/30"
            />
            <p class="text-xs font-semibold text-slate-400 tracking-wide">
              {{ locale.loadingTrends }}
            </p>
          </div>
          <div
            v-else-if="panelStates.trends.error && trendData.length === 0"
            class="flex-1 flex flex-col items-center justify-center space-y-4"
          >
            <div class="p-4 bg-rose-500/10 border border-rose-400/30 rounded-md">
              <Activity class="text-rose-400/60" :size="32" />
            </div>
            <p class="text-xs font-semibold text-rose-400 tracking-wide">
              {{ panelStates.trends.error }}
            </p>
            <button
              class="px-4 py-2 bg-slate-800 border border-slate-600/40 hover:bg-slate-700 text-slate-100 text-[10px] font-semibold uppercase tracking-widest rounded-md transition-colors"
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
                  class="w-full bg-sky-400/35 rounded-t-md group-hover:bg-sky-400/50 transition-colors border-x border-t border-sky-400/25 group-hover:border-sky-400/45 min-h-[4px]"
                />
                <div
                  class="absolute left-1/2 -translate-x-1/2 -translate-y-full mb-2 text-[10px] font-semibold text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10"
                  :style="{
                    bottom: `${(item.count / Math.max(...trendData.map((d) => d.count), 1)) * 100}%`
                  }"
                >
                  {{ locale.countSongs(item.count) }}
                </div>
              </div>
              <span
                class="text-[10px] font-semibold text-slate-400 group-hover:text-slate-300 transition-colors uppercase tracking-widest"
              >
                {{ formatDateShort(item.date) }}
              </span>
            </div>
          </div>
          <div v-else class="flex-1 flex flex-col items-center justify-center text-slate-400">
            <BarChart2 :size="48" class="opacity-20" />
            <p class="text-sm font-medium mt-4">当前筛选范围暂无统计数据。</p>
          </div>
        </div>

        <!-- 热门歌曲排行榜 -->
        <div
          class="lg:col-span-4 bg-[#111827] border border-slate-400/20 rounded-md p-8 flex flex-col min-h-[500px]"
        >
          <div class="flex items-center justify-between mb-8">
            <h3 class="text-xl font-bold flex items-center gap-3 text-white">
              <Trophy class="text-amber-500" :size="20" />
              {{ locale.topSongsTitle }}
            </h3>
            <div class="flex items-center gap-4">
              <div class="flex gap-2">
                <button
                  :class="`text-[10px] font-semibold uppercase tracking-widest transition-colors ${selectedSortBy === 'vote' ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'}`"
                  @click="handleSortChange('vote')"
                >
                  {{ locale.likes }}
                </button>
                <span class="text-zinc-800">|</span>
                <button
                  :class="`text-[10px] font-semibold uppercase tracking-widest transition-colors ${selectedSortBy === 'replay' ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'}`"
                  @click="handleSortChange('replay')"
                >
                  {{ locale.replays }}
                </button>
              </div>
              <div v-if="panelStates.topSongs.loading" class="text-amber-400">
                <RefreshCw :size="14" />
              </div>
            </div>
          </div>

          <div
            v-if="panelStates.topSongs.loading && topSongs.length === 0"
            class="flex-1 space-y-4"
          >
            <div v-for="i in 5" :key="i" class="h-20 bg-slate-800 border border-slate-600/20 rounded-md" />
          </div>
          <div
            v-else-if="panelStates.topSongs.error && topSongs.length === 0"
            class="flex-1 flex flex-col items-center justify-center space-y-4"
          >
            <Music :size="32" class="text-rose-400/50" />
            <p class="text-[10px] font-semibold text-rose-400 tracking-wide">
              {{ panelStates.topSongs.error }}
            </p>
            <button
              class="px-4 py-2 bg-slate-800 border border-slate-600/40 text-[10px] font-semibold uppercase rounded-md hover:bg-slate-700 text-slate-100 transition-colors"
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
              class="p-4 bg-slate-950/60 border border-slate-600/25 rounded-md flex items-center gap-4 group hover:border-slate-400/35 transition-colors"
            >
              <div
                :class="`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                  i === 0
                    ? 'bg-amber-400 text-slate-950'
                    : i === 1
                      ? 'bg-zinc-300 text-black'
                      : i === 2
                        ? 'bg-amber-800 text-white'
                  : 'text-slate-400 border border-slate-600/40'
                }`"
              >
                {{ i + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <h4
                  class="text-sm font-bold text-zinc-200 truncate group-hover:text-white transition-colors"
                >
                  {{ song.title }}
                </h4>
                <p class="text-[10px] text-slate-400 font-medium truncate uppercase tracking-widest">
                  {{ song.artist }}
                </p>
              </div>
              <div class="text-right">
                <span class="text-xs font-black text-zinc-400">{{ song.count }}</span>
                <div class="text-[8px] font-semibold text-slate-400 uppercase">
                  {{ selectedSortBy === 'replay' ? locale.times : locale.likes }}
                </div>
              </div>
            </div>
          </div>
          <div v-else class="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Music :size="32" class="opacity-20 mb-2" />
            <p class="text-xs font-semibold tracking-wide">当前筛选范围暂无统计数据。</p>
          </div>
        </div>
      </div>

      <!-- 第三行：用户和学期对比 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- 活跃用户排行榜 -->
        <div
          class="bg-[#111827] border border-slate-400/20 rounded-md p-8 flex flex-col min-h-[500px]"
        >
          <div class="flex items-center justify-between mb-8">
            <h3 class="text-xl font-bold flex items-center gap-3 text-white">
              <UserCheck class="text-purple-500" :size="20" />
              {{ locale.activeUsersTitle }}
            </h3>
            <div v-if="panelStates.activeUsers.loading" class="text-sky-400">
              <RefreshCw :size="16" />
            </div>
          </div>

          <div
            v-if="panelStates.activeUsers.loading && activeUsers.length === 0"
            class="flex-1 space-y-4"
          >
            <div v-for="i in 4" :key="i" class="h-24 bg-slate-800 border border-slate-600/20 rounded-md" />
          </div>
          <div
            v-else-if="panelStates.activeUsers.error && activeUsers.length === 0"
            class="flex-1 flex flex-col items-center justify-center space-y-4"
          >
            <Users :size="32" class="text-rose-400/50" />
            <p class="text-[10px] font-semibold text-rose-400 tracking-wide">
              {{ panelStates.activeUsers.error }}
            </p>
            <button
              class="px-4 py-2 bg-slate-800 border border-slate-600/40 text-[10px] font-semibold uppercase rounded-md hover:bg-slate-700 text-slate-100 transition-colors"
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
              class="relative p-5 bg-slate-950/50 border border-slate-600/25 rounded-md overflow-hidden group"
            >
              <div class="flex items-center gap-4 relative z-10">
                <div
                  class="w-12 h-12 rounded-md bg-slate-800 flex items-center justify-center font-bold text-slate-400 group-hover:text-slate-200 transition-colors"
                >
                  {{ user.name.charAt(0) }}
                </div>
                <div class="flex-1">
                  <h4 class="text-sm font-bold text-zinc-100">{{ user.name }}</h4>
                  <p class="text-xs text-slate-400 font-medium mt-1">
                    {{ locale.userActivity(user.contributions, user.likes) }}
                  </p>
                </div>
                <div class="text-right">
                  <span
                    class="text-xl font-black text-zinc-300 group-hover:text-purple-400 transition-colors"
                    >{{ user.activityScore }}</span
                  >
                  <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    {{ locale.activity }}
                  </p>
                </div>
              </div>
              <!-- 进度条指示器 -->
              <div
                class="absolute bottom-0 left-0 h-1 bg-purple-500/20 group-hover:bg-purple-500/40 transition-all"
                :style="{
                  width: `${(user.activityScore / Math.max(...activeUsers.map((u) => u.activityScore), 1)) * 100}%`
                }"
              />
            </div>
          </div>
          <div v-else class="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Users :size="32" class="opacity-20 mb-2" />
            <p class="text-xs font-semibold tracking-wide">当前筛选范围暂无统计数据。</p>
          </div>
        </div>

        <!-- 学期对比分析 -->
        <div
          class="bg-[#111827] border border-slate-400/20 rounded-md p-8 flex flex-col min-h-[500px]"
        >
          <div class="flex items-center justify-between mb-8">
            <h3 class="text-xl font-bold flex items-center gap-3 text-white">
              <Globe class="text-emerald-500" :size="20" />
              {{ locale.semesterComparisonTitle }}
            </h3>
            <div
              v-if="panelStates.semesterComparison.loading"
              class="text-emerald-400"
            >
              <RefreshCw :size="16" />
            </div>
          </div>

          <div
            v-if="panelStates.semesterComparison.loading && semesterComparison.length === 0"
            class="flex-1 space-y-4"
          >
            <div v-for="i in 3" :key="i" class="h-32 bg-slate-800 border border-slate-600/20 rounded-md" />
          </div>
          <div
            v-else-if="panelStates.semesterComparison.error && semesterComparison.length === 0"
            class="flex-1 flex flex-col items-center justify-center space-y-4"
          >
            <Globe :size="32" class="text-rose-400/50" />
            <p class="text-[10px] font-semibold text-rose-400 tracking-wide">
              {{ panelStates.semesterComparison.error }}
            </p>
            <button
              class="px-4 py-2 bg-slate-800 border border-slate-600/40 text-[10px] font-semibold uppercase rounded-md hover:bg-slate-700 text-slate-100 transition-colors"
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
              :class="`p-6 border rounded-md transition-colors ${sem.isActive ? 'bg-emerald-400/5 border-emerald-400/30' : 'bg-slate-950/40 border-slate-600/30 opacity-70 hover:opacity-100'}`"
            >
              <div class="flex items-center justify-between mb-4">
                <span class="text-xs font-black text-zinc-300 uppercase tracking-widest">{{
                  sem.semester
                }}</span>
                <span
                  v-if="sem.isActive"
                  class="px-2 py-0.5 bg-emerald-500/20 text-emerald-500 rounded text-[8px] font-black uppercase"
                  >{{ locale.currentSemester }}</span
                >
                <span v-else class="text-[10px] font-semibold text-slate-400">{{ locale.historyBaseline }}</span>
              </div>
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <h5 class="text-lg font-black text-zinc-100">{{ sem.totalSongs }}</h5>
                  <p class="text-[9px] font-semibold text-slate-400 uppercase tracking-tighter mt-1">
                    {{ locale.totalSongs }}
                  </p>
                </div>
                <div>
                  <h5 class="text-lg font-black text-zinc-100">{{ sem.totalSchedules }}</h5>
                  <p class="text-[9px] font-semibold text-slate-400 uppercase tracking-tighter mt-1">
                    {{ locale.totalSchedules }}
                  </p>
                </div>
                <div>
                  <h5 class="text-lg font-black text-zinc-100">{{ sem.totalRequests }}</h5>
                  <p class="text-[9px] font-semibold text-slate-400 uppercase tracking-tighter mt-1">
                    {{ locale.totalLikes }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Globe :size="32" class="opacity-20 mb-2" />
            <p class="text-xs font-semibold tracking-wide">当前筛选范围暂无统计数据。</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 全局悬浮提示框 -->
    <Teleport to="body">
      <div
        v-if="tooltip.show"
        :style="tooltip.style"
        class="fixed z-[999999] pointer-events-auto"
        @mouseenter="handleTooltipMouseEnter"
        @mouseleave="handleTooltipMouseLeave"
      >
        <div
          class="bg-[#111827] border border-slate-400/20 rounded-md overflow-hidden min-w-[320px]"
        >
          <div
            class="p-6 border-b border-slate-600/30"
          >
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-sm font-black text-white uppercase tracking-widest">{{ locale.activeUserDetails }}</h4>
              <div class="flex items-center gap-2 px-2 py-1 bg-sky-400/10 border border-sky-400/20 rounded-md">
                <div class="w-1.5 h-1.5 bg-sky-400 rounded-full" />
                <span class="text-[10px] font-bold text-sky-400"
                  >{{ locale.onlineCount(realtimeStats.activeUsers) }}</span
                >
              </div>
            </div>

            <div
              v-if="realtimeStats.activeUsersList && realtimeStats.activeUsersList.length > 0"
              class="space-y-4"
            >
              <div
                v-for="user in realtimeStats.activeUsersList.slice(0, 5)"
                :key="user.id"
                class="flex items-center gap-3 p-3 bg-slate-950/60 border border-slate-600/30 rounded-md group hover:border-sky-400/35 transition-colors"
              >
                <div
                  class="w-10 h-10 rounded-md bg-slate-800 flex items-center justify-center font-bold text-slate-400 group-hover:text-sky-400 transition-colors"
                >
                  {{ user.name.charAt(0) }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-bold text-zinc-200 truncate">{{ user.name }}</div>
                  <div class="text-[10px] text-slate-400 font-medium truncate">
                    @{{ user.username }}
                  </div>
                </div>
                <div class="text-[10px] font-semibold text-slate-400 bg-slate-900 px-2 py-1 rounded-md">
                  {{ user.lastActive }}
                </div>
              </div>
              <div v-if="realtimeStats.activeUsersList.length > 5" class="text-center py-2">
                <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-widest"
                  >{{ locale.andMoreUsers(realtimeStats.activeUsersList.length - 5) }}</span
                >
              </div>
            </div>
            <div v-else class="py-10 flex flex-col items-center justify-center text-slate-400">
              <Users :size="32" class="opacity-20 mb-3" />
              <p class="text-xs font-black uppercase tracking-widest">{{ locale.noOnlineUsers }}</p>
            </div>
          </div>
          <div class="px-6 py-4 bg-slate-950/60 flex items-center justify-between">
            <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-widest"
              >{{ locale.syncingRealtime }}</span
            >
            <Activity :size="12" class="text-sky-400" />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
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
    color: 'blue'
  },
  {
    label: locale.value?.kpi?.activeSongs || 'Active songs',
    value: analysisData.value.totalSongs,
    trend: analysisData.value.songsChange,
    icon: Music,
    color: 'emerald'
  },
  {
    label: locale.value?.kpi?.scheduleDays || 'Schedule days',
    value: analysisData.value.totalSchedules,
    trend: analysisData.value.schedulesChange,
    icon: Calendar,
    color: 'amber'
  },
  {
    label: locale.value?.kpi?.totalRequests || 'Total requests',
    value: analysisData.value.totalRequests,
    trend: analysisData.value.requestsChange,
    icon: Heart,
    color: 'rose'
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
const handleMouseEnter = (event) => {
  const rect = event.target.getBoundingClientRect()
  const viewportWidth = window.innerWidth

  // 计算tooltip位置
  let left = rect.left + rect.width / 2
  let top = rect.top - 10

  // 确保tooltip不超出视口边界
  const tooltipWidth = 320 // 预估tooltip宽度
  const tooltipHeight = 300 // 预估tooltip高度

  if (left + tooltipWidth / 2 > viewportWidth) {
    left = viewportWidth - tooltipWidth / 2 - 10
  }
  if (left - tooltipWidth / 2 < 0) {
    left = tooltipWidth / 2 + 10
  }
  if (top - tooltipHeight < 0) {
    top = rect.bottom + 10
  }

  tooltip.value.style.left = `${left}px`
  tooltip.value.style.top = `${top}px`
  tooltip.value.style.transform = 'translateX(-50%)'
  tooltip.value.show = true
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
  background: #0f172a;
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.35);
  border-radius: 3px;
  transition: background 0.2s ease;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.55);
}
</style>
