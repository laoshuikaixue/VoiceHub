<template>
  <div class="max-w-[1600px] mx-auto space-y-10 pb-20">
    <!-- 加载状态 -->
    <div v-if="isLoading && !hasInitialData" class="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div class="relative w-24 h-24">
        <div class="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
        <div class="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin"></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <Activity class="text-blue-500 animate-pulse" :size="32" />
        </div>
      </div>
      <div class="text-center">
        <h3 class="text-xl font-black text-white tracking-tight">{{ loadingSteps[currentLoadingStep] }}</h3>
        <p class="text-sm text-zinc-500 mt-2">正在获取最新的统计数据...</p>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error && !hasInitialData" class="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div class="p-6 bg-red-500/10 border border-red-500/20 rounded-[2.5rem]">
        <X class="text-red-500" :size="48" />
      </div>
      <div class="text-center">
        <h3 class="text-xl font-black text-white tracking-tight">数据加载失败</h3>
        <p class="text-sm text-zinc-500 mt-2 max-w-md">{{ error }}</p>
        <button 
          @click="refreshAllData"
          class="mt-6 px-8 py-3 bg-zinc-900 border border-zinc-800 rounded-full text-sm font-black text-white hover:bg-zinc-800 transition-all flex items-center gap-2 mx-auto"
        >
          <RefreshCw :size="16" />
          立即重试
        </button>
      </div>
    </div>

    <!-- 主要内容 -->
    <div v-else class="space-y-10">
      <!-- Header with Filter -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 class="text-3xl font-black text-white tracking-tight">数据中心</h2>
          <p class="text-sm text-zinc-500 mt-1 font-medium">洞察校园声音背后的互动趋势与影响力</p>
        </div>
        <div class="flex items-center gap-3">
          <button 
            @click="refreshAllData"
            :disabled="isLoading"
            class="p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-full text-zinc-400 hover:text-white transition-all group"
          >
            <RefreshCw :size="18" :class="{ 'animate-spin': isLoading }" />
          </button>
          <div class="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center gap-2">
            <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span class="text-[10px] font-black text-blue-400 uppercase tracking-widest">实时模式</span>
          </div>
          <div class="relative group">
            <select
              v-model="selectedSemester"
              @change="handleSemesterChange"
              class="appearance-none bg-zinc-900 border border-zinc-800 rounded-full px-6 py-2 text-xs font-black text-zinc-300 focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer pr-10"
            >
              <option value="all">全部学期</option>
              <option v-for="sem in availableSemesters" :key="sem.id" :value="sem.name">
                {{ sem.name }}
              </option>
            </select>
            <Calendar class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none group-hover:text-zinc-400 transition-colors" :size="14" />
          </div>
        </div>
      </div>

      <!-- Grid Row 1: Key Performance Indicators -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          v-for="(stat, i) in [
            { label: '注册用户总量', value: analysisData.totalUsers, trend: analysisData.usersChange, icon: Users, color: 'blue' },
            { label: '活跃歌曲库', value: analysisData.totalSongs, trend: analysisData.songsChange, icon: Music, color: 'emerald' },
            { label: '本学期排期天数', value: analysisData.totalSchedules, trend: analysisData.schedulesChange, icon: Calendar, color: 'amber' },
            { label: '累计点歌次数', value: analysisData.totalRequests, trend: analysisData.requestsChange, icon: Heart, color: 'rose' }
          ]"
          :key="i"
          class="group relative p-6 bg-zinc-900/40 border border-zinc-800/60 rounded-[2rem] overflow-hidden hover:border-zinc-700 transition-all hover:shadow-2xl hover:shadow-black/40"
        >
          <div class="flex justify-between items-start">
            <div :class="`p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-400 group-hover:text-${stat.color}-400 group-hover:border-${stat.color}-500/30 transition-all`">
              <component :is="stat.icon" :size="20" />
            </div>
            <div 
              v-if="stat.trend !== 0"
              :class="`flex items-center gap-1 text-[11px] font-black ${stat.trend < 0 ? 'text-red-500' : `text-${stat.color}-500`}`"
            >
              <ArrowDownRight v-if="stat.trend < 0" :size="12" />
              <ArrowUpRight v-else :size="12" />
              {{ Math.abs(stat.trend) }}%
            </div>
            <div v-else class="text-[11px] font-black text-zinc-500 uppercase tracking-widest">
              稳定
            </div>
          </div>
          <div class="mt-4">
            <h4 class="text-3xl font-black text-zinc-100 tracking-tighter">{{ typeof stat.value === 'number' && stat.value >= 1000 ? (stat.value / 1000).toFixed(1) + 'K' : stat.value }}</h4>
            <p class="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mt-1">{{ stat.label }}</p>
          </div>
          <div :class="`absolute -right-4 -bottom-4 w-24 h-24 bg-${stat.color}-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity`" />
        </div>
      </div>

      <!-- Grid Row 2: Charts & Real-time -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <!-- Real-time Pulse Section -->
        <div class="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div 
            @mouseenter="handleMouseEnter"
            @mouseleave="handleMouseLeave"
            class="p-8 bg-zinc-900/20 border border-zinc-800/40 rounded-[2.5rem] flex items-center justify-between relative overflow-hidden group cursor-help"
          >
             <div class="relative z-10">
               <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">当前活跃用户</span>
               <div class="flex items-baseline gap-2 mt-1">
                 <h3 class="text-5xl font-black text-white">{{ realtimeStats.activeUsers }}</h3>
                 <span class="text-xs font-bold text-zinc-500">人在线</span>
               </div>
             </div>
             <div class="relative z-10 w-24 h-24 flex items-center justify-center">
               <div class="absolute inset-0 bg-blue-500/20 rounded-full animate-ping opacity-20" />
               <div class="absolute inset-4 bg-blue-500/20 rounded-full animate-pulse opacity-40" />
               <Activity class="text-blue-500" :size="32" />
             </div>
          </div>
          <div class="p-8 bg-zinc-900/20 border border-zinc-800/40 rounded-[2.5rem] flex items-center justify-between relative overflow-hidden group">
             <div class="relative z-10">
               <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">今日累计点播</span>
               <div class="flex items-baseline gap-2 mt-1">
                 <h3 class="text-5xl font-black text-emerald-500">{{ realtimeStats.todayRequests }}</h3>
                 <span class="text-xs font-bold text-zinc-500">首歌曲</span>
               </div>
             </div>
             <div class="relative z-10 w-24 h-24 flex items-center justify-center">
               <div class="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping opacity-10" />
               <Globe class="text-emerald-500" :size="32" />
             </div>
          </div>
        </div>

        <!-- Trend Analysis Chart Card -->
        <div class="lg:col-span-8 bg-zinc-900/40 border border-zinc-800 rounded-[3rem] p-8 shadow-2xl overflow-hidden flex flex-col min-h-[500px]">
          <div class="flex items-center justify-between mb-10">
            <div>
              <h3 class="text-xl font-bold flex items-center gap-3 text-white">
                <BarChart2 class="text-blue-500" :size="20" />
                点歌趋势分析
              </h3>
              <p class="text-xs text-zinc-500 mt-1">近 7 日投稿量波动情况</p>
            </div>
            <div class="flex items-center gap-4">
              <div v-if="panelStates.trends.loading" class="animate-spin text-blue-500">
                <RefreshCw :size="16" />
              </div>
              <button 
                v-if="panelStates.trends.error"
                @click="loadTrends"
                class="p-2 text-red-400 hover:text-red-300 transition-colors"
                title="重试"
              >
                <RefreshCw :size="16" />
              </button>
            </div>
          </div>
          
          <div v-if="panelStates.trends.loading && trendData.length === 0" class="flex-1 flex flex-col items-center justify-center space-y-4">
            <div class="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <p class="text-xs font-black text-zinc-600 uppercase tracking-widest">正在加载趋势数据...</p>
          </div>
          <div v-else-if="panelStates.trends.error && trendData.length === 0" class="flex-1 flex flex-col items-center justify-center space-y-4">
            <div class="p-4 bg-red-500/10 rounded-2xl">
              <Activity class="text-red-500/50" :size="32" />
            </div>
            <p class="text-xs font-black text-red-400 uppercase tracking-widest">{{ panelStates.trends.error }}</p>
            <button @click="loadTrends" class="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-widest rounded-full transition-all">立即重试</button>
          </div>
          <div v-else-if="trendData.length > 0" class="flex-1 flex items-end gap-2 md:gap-4 px-2 mb-4">
            <div 
              v-for="(item, i) in trendData.slice(-7)" 
              :key="i" 
              class="flex-1 flex flex-col items-center gap-3 group h-full relative"
            >
              <div class="relative w-full flex flex-col justify-end h-full">
                 <div 
                   :style="{ height: `${(item.count / Math.max(...trendData.map(d => d.count), 1)) * 100}%` }"
                   class="w-full bg-gradient-to-t from-blue-600/10 to-blue-500/40 rounded-t-xl group-hover:from-blue-600/30 group-hover:to-blue-400 transition-all border-x border-t border-blue-500/20 group-hover:border-blue-500/40 min-h-[4px]"
                 ></div>
                 <div 
                   class="absolute left-1/2 -translate-x-1/2 -translate-y-full mb-2 text-[10px] font-black text-blue-400 opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap pointer-events-none z-10"
                   :style="{ bottom: `${(item.count / Math.max(...trendData.map(d => d.count), 1)) * 100}%` }"
                 >
                   {{ item.count }}首
                 </div>
              </div>
              <span class="text-[10px] font-black text-zinc-600 group-hover:text-zinc-400 transition-colors uppercase tracking-widest">
                {{ item.date.split('-').slice(1).join('-') }}
              </span>
            </div>
          </div>
          <div v-else class="flex-1 flex flex-col items-center justify-center space-y-4 text-zinc-600">
            <BarChart2 :size="48" class="opacity-20" />
            <p class="text-sm font-medium">暂无趋势数据</p>
          </div>
        </div>

        <!-- Top Rankings List -->
        <div class="lg:col-span-4 bg-zinc-900/40 border border-zinc-800 rounded-[3rem] p-8 flex flex-col min-h-[500px]">
          <div class="flex items-center justify-between mb-8">
            <h3 class="text-xl font-bold flex items-center gap-3 text-white">
              <Trophy class="text-amber-500" :size="20" />
              热门歌曲排行
            </h3>
            <div class="flex items-center gap-4">
              <div class="flex gap-2">
                <button 
                  @click="handleSortChange('vote')"
                  :class="`text-[10px] font-black uppercase tracking-widest transition-colors ${selectedSortBy === 'vote' ? 'text-blue-500' : 'text-zinc-600 hover:text-zinc-400'}`"
                >
                  点赞
                </button>
                <span class="text-zinc-800">|</span>
                <button 
                  @click="handleSortChange('replay')"
                  :class="`text-[10px] font-black uppercase tracking-widest transition-colors ${selectedSortBy === 'replay' ? 'text-blue-500' : 'text-zinc-600 hover:text-zinc-400'}`"
                >
                  重播
                </button>
              </div>
              <div v-if="panelStates.topSongs.loading" class="animate-spin text-amber-500">
                <RefreshCw :size="14" />
              </div>
            </div>
          </div>
          
          <div v-if="panelStates.topSongs.loading && topSongs.length === 0" class="flex-1 space-y-4">
            <div v-for="i in 5" :key="i" class="h-20 bg-zinc-800/20 animate-pulse rounded-2xl"></div>
          </div>
          <div v-else-if="panelStates.topSongs.error && topSongs.length === 0" class="flex-1 flex flex-col items-center justify-center space-y-4">
            <Music :size="32" class="text-red-500/20" />
            <p class="text-[10px] font-black text-red-400 uppercase tracking-widest">{{ panelStates.topSongs.error }}</p>
            <button @click="loadTopSongs" class="px-4 py-2 bg-zinc-800 text-[10px] font-black uppercase rounded-full">重试</button>
          </div>
          <div v-else-if="topSongs.length > 0" class="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
            <div v-for="(song, i) in topSongs.slice(0, 5)" :key="i" class="p-4 bg-zinc-950/50 border border-zinc-800/40 rounded-2xl flex items-center gap-4 group hover:bg-zinc-800/30 transition-all">
              <div :class="`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                i === 0 ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 
                i === 1 ? 'bg-zinc-300 text-black' : 
                i === 2 ? 'bg-amber-800 text-white' : 'text-zinc-600 border border-zinc-800'
              }`">
                {{ i + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-bold text-zinc-200 truncate group-hover:text-white transition-colors">{{ song.title }}</h4>
                <p class="text-[10px] text-zinc-600 font-medium truncate uppercase tracking-widest">{{ song.artist }}</p>
              </div>
              <div class="text-right">
                <span class="text-xs font-black text-zinc-400">{{ song.count }}</span>
                <div class="text-[8px] font-black text-zinc-700 uppercase">{{ selectedSortBy === 'replay' ? '次数' : '点赞' }}</div>
              </div>
            </div>
          </div>
          <div v-else class="flex-1 flex flex-col items-center justify-center text-zinc-700">
            <Music :size="32" class="opacity-20 mb-2" />
            <p class="text-xs font-bold uppercase tracking-widest">暂无数据</p>
          </div>
        </div>
      </div>

      <!-- Grid Row 3: Users & Semester Comparison -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <!-- User Rankings -->
         <div class="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] p-8 flex flex-col min-h-[500px]">
            <div class="flex items-center justify-between mb-8">
              <h3 class="text-xl font-bold flex items-center gap-3 text-white">
                <UserCheck class="text-purple-500" :size="20" />
                活跃用户排行榜
              </h3>
              <div v-if="panelStates.activeUsers.loading" class="animate-spin text-purple-500">
                <RefreshCw :size="16" />
              </div>
            </div>
            
            <div v-if="panelStates.activeUsers.loading && activeUsers.length === 0" class="flex-1 space-y-4">
              <div v-for="i in 4" :key="i" class="h-24 bg-zinc-800/20 animate-pulse rounded-3xl"></div>
            </div>
            <div v-else-if="panelStates.activeUsers.error && activeUsers.length === 0" class="flex-1 flex flex-col items-center justify-center space-y-4">
              <Users :size="32" class="text-red-500/20" />
              <p class="text-[10px] font-black text-red-400 uppercase tracking-widest">{{ panelStates.activeUsers.error }}</p>
              <button @click="loadActiveUsers" class="px-4 py-2 bg-zinc-800 text-[10px] font-black uppercase rounded-full">重试</button>
            </div>
            <div v-else-if="activeUsers.length > 0" class="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2">
              <div v-for="(user, i) in activeUsers.slice(0, 5)" :key="i" class="relative p-5 bg-zinc-950/30 border border-zinc-800/50 rounded-3xl overflow-hidden group">
                <div class="flex items-center gap-4 relative z-10">
                  <div class="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center font-black text-zinc-500 group-hover:text-zinc-200 transition-colors">
                    {{ user.name.charAt(0) }}
                  </div>
                  <div class="flex-1">
                    <h4 class="text-sm font-bold text-zinc-100">{{ user.name }}</h4>
                    <p class="text-xs text-zinc-600 font-medium mt-1">{{ user.contributions }}首投稿 · {{ user.likes }}次点赞</p>
                  </div>
                  <div class="text-right">
                    <span class="text-xl font-black text-zinc-300 group-hover:text-purple-400 transition-colors">{{ user.activityScore }}</span>
                    <p class="text-[10px] font-black text-zinc-700 uppercase tracking-widest">活跃度</p>
                  </div>
                </div>
                <!-- Progress Indicator -->
                <div 
                  class="absolute bottom-0 left-0 h-1 bg-purple-500/20 group-hover:bg-purple-500/40 transition-all" 
                  :style="{ width: `${(user.activityScore / Math.max(...activeUsers.map(u => u.activityScore), 1)) * 100}%` }" 
                />
              </div>
            </div>
            <div v-else class="flex-1 flex flex-col items-center justify-center text-zinc-700">
              <Users :size="32" class="opacity-20 mb-2" />
              <p class="text-xs font-bold uppercase tracking-widest">暂无活跃用户</p>
            </div>
         </div>

         <!-- Semester Comparison -->
         <div class="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] p-8 flex flex-col min-h-[500px]">
            <div class="flex items-center justify-between mb-8">
              <h3 class="text-xl font-bold flex items-center gap-3 text-white">
                <Globe class="text-emerald-500" :size="20" />
                学期对比分析
              </h3>
              <div v-if="panelStates.semesterComparison.loading" class="animate-spin text-emerald-500">
                <RefreshCw :size="16" />
              </div>
            </div>
            
            <div v-if="panelStates.semesterComparison.loading && semesterComparison.length === 0" class="flex-1 space-y-4">
              <div v-for="i in 3" :key="i" class="h-32 bg-zinc-800/20 animate-pulse rounded-[2rem]"></div>
            </div>
            <div v-else-if="panelStates.semesterComparison.error && semesterComparison.length === 0" class="flex-1 flex flex-col items-center justify-center space-y-4">
              <Globe :size="32" class="text-red-500/20" />
              <p class="text-[10px] font-black text-red-400 uppercase tracking-widest">{{ panelStates.semesterComparison.error }}</p>
              <button @click="loadSemesterComparison" class="px-4 py-2 bg-zinc-800 text-[10px] font-black uppercase rounded-full">重试</button>
            </div>
            <div v-else-if="semesterComparison.length > 0" class="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-2">
              <div 
                v-for="(sem, i) in semesterComparison" 
                :key="i" 
                :class="`p-6 border rounded-[2rem] transition-all ${sem.isActive ? 'bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'bg-zinc-950/20 border-zinc-800/60 opacity-60 hover:opacity-100'}`"
              >
                <div class="flex items-center justify-between mb-4">
                  <span class="text-xs font-black text-zinc-300 uppercase tracking-widest">{{ sem.semester }}</span>
                  <span v-if="sem.isActive" class="px-2 py-0.5 bg-emerald-500/20 text-emerald-500 rounded text-[8px] font-black uppercase">当前学期</span>
                  <span v-else class="text-[10px] font-black text-zinc-600">历史基准</span>
                </div>
                <div class="grid grid-cols-3 gap-4">
                  <div>
                    <h5 class="text-lg font-black text-zinc-100">{{ sem.totalSongs }}</h5>
                    <p class="text-[9px] font-black text-zinc-600 uppercase tracking-tighter mt-1">歌曲总量</p>
                  </div>
                  <div>
                    <h5 class="text-lg font-black text-zinc-100">{{ sem.totalSchedules }}</h5>
                    <p class="text-[9px] font-black text-zinc-600 uppercase tracking-tighter mt-1">排期总数</p>
                  </div>
                  <div>
                    <h5 class="text-lg font-black text-zinc-100">{{ sem.totalRequests }}</h5>
                    <p class="text-[9px] font-black text-zinc-600 uppercase tracking-tighter mt-1">获赞总数</p>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="flex-1 flex flex-col items-center justify-center text-zinc-700">
              <Globe :size="32" class="opacity-20 mb-2" />
              <p class="text-xs font-bold uppercase tracking-widest">暂无对比数据</p>
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
        <div class="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden min-w-[320px] backdrop-blur-xl bg-opacity-90 animate-in fade-in zoom-in duration-200">
          <div class="p-6 border-b border-zinc-800/50 bg-gradient-to-br from-blue-500/10 to-transparent">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-sm font-black text-white uppercase tracking-widest">活跃用户详情</h4>
              <div class="flex items-center gap-2 px-2 py-1 bg-blue-500/20 rounded-full">
                <div class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                <span class="text-[10px] font-black text-blue-400">{{ realtimeStats.activeUsers }} 在线</span>
              </div>
            </div>
            
            <div v-if="realtimeStats.activeUsersList && realtimeStats.activeUsersList.length > 0" class="space-y-4">
              <div 
                v-for="user in realtimeStats.activeUsersList.slice(0, 5)" 
                :key="user.id"
                class="flex items-center gap-3 p-3 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl group hover:border-blue-500/30 transition-all"
              >
                <div class="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center font-black text-zinc-500 group-hover:text-blue-400 transition-colors">
                  {{ user.name.charAt(0) }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-bold text-zinc-200 truncate">{{ user.name }}</div>
                  <div class="text-[10px] text-zinc-500 font-medium truncate">@{{ user.username }}</div>
                </div>
                <div class="text-[10px] font-black text-zinc-600 bg-zinc-900 px-2 py-1 rounded-lg">
                  {{ user.lastActive }}
                </div>
              </div>
              <div v-if="realtimeStats.activeUsersList.length > 5" class="text-center py-2">
                <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">及其他 {{ realtimeStats.activeUsersList.length - 5 }} 位用户</span>
              </div>
            </div>
            <div v-else class="py-10 flex flex-col items-center justify-center text-zinc-600">
              <Users :size="32" class="opacity-20 mb-3" />
              <p class="text-xs font-black uppercase tracking-widest">暂无在线用户</p>
            </div>
          </div>
          <div class="px-6 py-4 bg-zinc-950/50 flex items-center justify-between">
            <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">实时数据同步中</span>
            <Activity :size="12" class="text-blue-500 animate-pulse" />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
import { 
  TrendingUp, Users, Music, Calendar, Heart, 
  Activity, ArrowUpRight, ArrowDownRight, 
  Trophy, UserCheck, BarChart2, Globe,
  RefreshCw, Eye, MousePointer2
} from 'lucide-vue-next'
import { useSemesters } from '~/composables/useSemesters'

// 使用学期管理 composable
const {fetchSemesters, semesters: availableSemesters, currentSemester} = useSemesters()

// 响应式数据
const selectedSemester = ref('all')
const selectedSortBy = ref('vote')
const isLoading = ref(false)
const error = ref(null)
const hasInitialData = ref(false)
const currentLoadingStep = ref(0)

// 加载步骤
const loadingSteps = [
  '获取学期信息',
  '加载统计数据',
  '获取图表数据',
  '加载实时数据'
]

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

// 图表数据
const trendData = ref([])
const topSongs = ref([])
const activeUsers = ref([])
const userEngagement = ref({})
const semesterComparison = ref([])

// 各个面板的loading和error状态
const panelStates = ref({
  trends: {loading: false, error: null},
  topSongs: {loading: false, error: null},
  activeUsers: {loading: false, error: null},
  userEngagement: {loading: false, error: null},
  semesterComparison: {loading: false, error: null}
})
const realtimeStats = ref({
  activeUsers: 0,
  activeUsersList: [],
  todayRequests: 0,
  popularGenres: [],
  peakHours: []
})

// 悬停提示状态
const showUsersList = ref(false)

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
  const viewportHeight = window.innerHeight

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
  await Promise.all([
    loadAnalysisData(),
    loadChartData(),
    loadRealtimeStats()
  ])
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
    const topSongsData = await $fetch(`/api/admin/stats/top-songs?limit=10&${params.toString()}&sortBy=${selectedSortBy.value}`, {
      method: 'GET'
    })
    topSongs.value = topSongsData || []
    panelStates.value.topSongs.error = null
  } catch (err) {
    console.warn('获取热门歌曲数据失败:', err)
    panelStates.value.topSongs.error = '加载热门歌曲失败'
    topSongs.value = []
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
    error.value = '加载数据失败，请稍后重试'
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
  Object.keys(panelStates.value).forEach(key => {
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
      panelStates.value.trends.error = '加载趋势数据失败'
      trendData.value = []
    } finally {
      panelStates.value.trends.loading = false
    }
  }

  // 独立加载热门歌曲数据
  const loadTopSongs = async () => {
    try {
      const topSongsData = await $fetch(`/api/admin/stats/top-songs?limit=10&${params.toString()}&sortBy=${selectedSortBy.value}`, {
        method: 'GET'
      })
      topSongs.value = topSongsData || []
      panelStates.value.topSongs.error = null
    } catch (err) {
      console.warn('获取热门歌曲数据失败:', err)
      panelStates.value.topSongs.error = '加载热门歌曲失败'
      topSongs.value = []
    } finally {
      panelStates.value.topSongs.loading = false
    }
  }

  // 独立加载活跃用户数据
  const loadActiveUsers = async () => {
    try {
      const activeUsersData = await $fetch(`/api/admin/stats/active-users?limit=10&${params.toString()}`, {
        method: 'GET'
      })
      activeUsers.value = activeUsersData || []
      panelStates.value.activeUsers.error = null
      console.log('活跃用户数据加载完成:', activeUsersData)
      console.log('activeUsers.value长度:', activeUsers.value.length)
    } catch (err) {
      console.warn('获取活跃用户数据失败:', err)
      panelStates.value.activeUsers.error = '加载活跃用户失败'
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
      panelStates.value.userEngagement.error = '加载用户参与度失败'
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
      panelStates.value.semesterComparison.error = '加载学期对比失败'
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
    await Promise.all([
      loadAnalysisData(),
      loadChartData(),
      loadRealtimeStats()
    ])

    hasInitialData.value = true

    // 设置定时刷新实时数据（每30秒）
    setInterval(() => {
      loadRealtimeStats()
    }, 30000)

  } catch (err) {
    console.error('初始化数据分析面板失败:', err)
    error.value = '初始化失败，请刷新页面重试'
  }
})

// 刷新所有数据
const refreshAllData = async () => {
  await Promise.all([
    loadAnalysisData(),
    loadChartData(),
    loadRealtimeStats()
  ])
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
    const activeUsersData = await $fetch(`/api/admin/stats/active-users?limit=10&${params.toString()}`, {
      method: 'GET'
    })
    activeUsers.value = activeUsersData || []
    panelStates.value.activeUsers.error = null
    console.log('活跃用户数据重新加载完成:', activeUsersData)
  } catch (err) {
    console.warn('重新获取活跃用户数据失败:', err)
    panelStates.value.activeUsers.error = '加载活跃用户失败'
    activeUsers.value = []
  } finally {
    panelStates.value.activeUsers.loading = false
  }
}

// 获取趋势图点坐标
const getTrendPoints = (data) => {
  if (!data || data.length === 0) return ''

  // 过滤并验证数据，确保 count 是有效数字
  const validData = data.filter(d => d && typeof d.count === 'number' && !isNaN(d.count))
  if (validData.length === 0) return ''

  const maxCount = Math.max(...validData.map(d => d.count))
  // 防止除零错误
  if (maxCount === 0) return ''

  return validData.slice(0, 10).map((item, index) => {
    const x = (index / Math.max(validData.slice(0, 10).length - 1, 1)) * 360 + 20
    const y = 180 - (item.count / maxCount) * 160
    return `${x},${y}`
  }).join(' ')
}

// 获取排名样式类
const getRankClass = (index) => {
  if (index === 0) return 'rank-gold'
  if (index === 1) return 'rank-silver'
  if (index === 2) return 'rank-bronze'
  return 'rank-normal'
}

// 获取排名图标
const getRankIcon = (index) => {
  const icons = ['🥇', '🥈', '🥉']
  return icons[index] || (index + 1)
}

// 格式化学期时间段
const formatSemesterPeriod = (semester) => {
  // 解析学期名称，例如 "2024春" -> "2024年春季学期"
  const match = semester.match(/(\d{4})(春|秋)/)
  if (match) {
    const year = match[1]
    const season = match[2] === '春' ? '春季' : '秋季'
    return `${year}年${season}学期`
  }
  return semester
}
</script>

<style scoped>
.data-analysis-panel {
  padding: 20px;
  background: var(--bg-primary);
  border-radius: 12px;
  border: 1px solid #1f1f1f;
  color: #e2e8f0;
  min-height: 100vh;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px;
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(139, 92, 246, 0.1));
  border-radius: 16px;
  border: 1px solid rgba(79, 70, 229, 0.2);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-header h2 {
  margin: 0;
  font-size: 32px;
  font-weight: 800;
  color: #f8fafc;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #f8fafc, #e2e8f0);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 14px;
  font-weight: 500;
}

.error-message svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(79, 70, 229, 0.1);
  border: 1px solid rgba(79, 70, 229, 0.3);
  border-radius: 10px;
  color: #a5b4fc;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: rgba(79, 70, 229, 0.2);
  border-color: rgba(79, 70, 229, 0.5);
  color: #c7d2fe;
  transform: scale(1.05);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.refresh-btn svg {
  width: 20px;
  height: 20px;
  transition: transform 0.2s ease;
}

.refresh-btn svg.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.semester-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.semester-selector label {
  font-weight: 500;
  color: #cbd5e1;
}

.semester-select {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 8px 12px;
  color: #e2e8f0;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.semester-select:hover {
  border-color: #4f46e5;
}

.semester-select:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

/* 实时数据样式 */
.realtime-stats {
  margin-bottom: 32px;
}

.realtime-card {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1));
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s ease;
}

.realtime-card:hover {
  border-color: rgba(16, 185, 129, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(16, 185, 129, 0.1);
}

.realtime-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.realtime-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #f1f5f9;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(16, 185, 129, 0.2);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  color: #6ee7b7;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  animation: pulse-live 2s infinite;
}

@keyframes pulse-live {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.realtime-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
}

.realtime-item {
  text-align: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
}

.realtime-label {
  display: block;
  font-size: 14px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.realtime-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #10b981;
  text-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 24px;
}

.chart-card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.chart-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #4f46e5, #7c3aed, #ec4899);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.chart-card:hover::before {
  opacity: 1;
}

.chart-card:hover {
  border-color: #3a3a3a;
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.chart-card.enhanced {
  background: linear-gradient(135deg, #1a1a1a, #1f1f1f);
  border: 1px solid #2d2d2d;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.chart-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
}

/* 排序控制样式 */
.sort-controls {
  display: flex;
  gap: 8px;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: 8px;
}

.sort-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sort-btn:hover {
  color: #e2e8f0;
}

.sort-btn.active {
  background: #4f46e5;
  color: white;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
}

.chart-actions {
  display: flex;
  gap: 8px;
}

.chart-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(79, 70, 229, 0.1);
  border: 1px solid rgba(79, 70, 229, 0.2);
  border-radius: 8px;
  color: #a5b4fc;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chart-btn:hover {
  background: rgba(79, 70, 229, 0.2);
  border-color: rgba(79, 70, 229, 0.4);
  color: #c7d2fe;
}

.chart-btn svg {
  width: 16px;
  height: 16px;
}

.chart-container {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
}

/* 趋势图样式 */
.trend-svg {
  width: 100%;
  height: 200px;
  margin-bottom: 16px;
}

.trend-grid {
  stroke: #2a2a2a;
  stroke-width: 1;
  opacity: 0.3;
}

.trend-line {
  fill: none;
  stroke: #4f46e5;
  stroke-width: 2;
  filter: drop-shadow(0 0 4px rgba(79, 70, 229, 0.3));
}

.trend-point {
  fill: #4f46e5;
  stroke: #1a1a1a;
  stroke-width: 2;
  cursor: pointer;
  transition: all 0.2s ease;
}

.trend-point:hover {
  fill: #6366f1;
  r: 6;
  filter: drop-shadow(0 0 8px rgba(79, 70, 229, 0.5));
}

.trend-legend {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #94a3b8;
  margin-top: 8px;
}

.trend-legend-item {
  text-align: center;
  flex: 1;
}

.trend-legend-date {
  display: block;
  margin-bottom: 4px;
}

.trend-legend-value {
  display: block;
  font-weight: 600;
  color: #4f46e5;
}

.chart-content {
  width: 100%;
  padding: 10px;
  height: 100%;
  overflow-y: auto;
}

.songs-ranking {
  max-height: 280px;
  overflow-y: auto;
  padding-right: 8px;
}

.songs-ranking::-webkit-scrollbar {
  width: 6px;
}

.songs-ranking::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.songs-ranking::-webkit-scrollbar-thumb {
  background: rgba(79, 70, 229, 0.3);
  border-radius: 3px;
  transition: background 0.3s ease;
}

.songs-ranking::-webkit-scrollbar-thumb:hover {
  background: rgba(79, 70, 229, 0.5);
}

.chart-placeholder {
  text-align: center;
  color: #64748b;
  font-size: 16px;
  padding: 60px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.placeholder-icon {
  width: 64px;
  height: 64px;
  opacity: 0.3;
  margin-bottom: 8px;
}

.placeholder-icon svg {
  width: 100%;
  height: 100%;
}

.chart-placeholder p {
  margin: 10px 0;
  color: #94a3b8;
  font-size: 16px;
}

.placeholder-text {
  font-size: 16px;
  font-weight: 500;
  color: #64748b;
  margin-bottom: 4px;
}

.placeholder-subtext {
  font-size: 14px !important;
  color: #475569 !important;
}

.trend-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #2d2d2d;
}

.trend-date {
  color: #cbd5e1;
}

.trend-count {
  color: #4f46e5;
  font-weight: 500;
}

.song-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  margin-bottom: 12px;
}

.song-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #4f46e5, #7c3aed);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.song-item:hover::before {
  opacity: 1;
}

.song-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.song-rank-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 16px;
  font-weight: 700;
  font-size: 16px;
  transition: all 0.3s ease;
}

.rank-gold {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #1a1a1a;
  box-shadow: 0 0 20px rgba(251, 191, 36, 0.3);
}

.rank-silver {
  background: linear-gradient(135deg, #e5e7eb, #9ca3af);
  color: #1a1a1a;
  box-shadow: 0 0 20px rgba(156, 163, 175, 0.3);
}

.rank-bronze {
  background: linear-gradient(135deg, #d97706, #92400e);
  color: #fff;
  box-shadow: 0 0 20px rgba(217, 119, 6, 0.3);
}

.rank-normal {
  background: rgba(79, 70, 229, 0.1);
  border: 2px solid rgba(79, 70, 229, 0.3);
  color: #a5b4fc;
}

.rank-icon {
  font-size: 18px;
}

.rank-number {
  font-size: 14px;
  font-weight: 600;
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-title {
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 4px;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: 14px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 80px;
}

.vote-count {
  font-weight: 600;
  color: #10b981;
  font-size: 16px;
  margin-bottom: 2px;
}

.vote-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.vote-bar {
  width: 60px;
  height: 4px;
  background: rgba(16, 185, 129, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.vote-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #059669);
  border-radius: 2px;
  transition: width 0.5s ease;
}

.engagement-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #2d2d2d;
}

.engagement-label {
  color: #cbd5e1;
}

.engagement-value {
  color: #4f46e5;
  font-weight: 500;
}

.semester-comparison {
  display: grid;
  gap: 16px;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 8px;
}

.semester-comparison::-webkit-scrollbar {
  width: 6px;
}

.semester-comparison::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.semester-comparison::-webkit-scrollbar-thumb {
  background: rgba(79, 70, 229, 0.3);
  border-radius: 3px;
  transition: background 0.3s ease;
}

.semester-comparison::-webkit-scrollbar-thumb:hover {
  background: rgba(79, 70, 229, 0.5);
}

.semester-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.3s ease;
}

.semester-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(79, 70, 229, 0.3);
  transform: translateY(-2px);
}

.semester-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.semester-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.semester-title h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
}

.current-badge {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.semester-period {
  font-size: 12px;
  color: #94a3b8;
  text-align: right;
}

.semester-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.metric-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.metric-icon.songs {
  background: rgba(79, 70, 229, 0.2);
  color: #a5b4fc;
}

.metric-icon.schedules {
  background: rgba(16, 185, 129, 0.2);
  color: #6ee7b7;
}

.metric-icon.requests {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.metric-icon svg {
  width: 12px;
  height: 12px;
}

.metric-content {
  flex: 1;
  min-width: 0;
}

.metric-value {
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
  line-height: 1;
}

.metric-label {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

.semester-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #2d2d2d;
}

.semester-name {
  color: #f1f5f9;
  font-weight: 500;
  flex: 1;
}

.semester-stats {
  color: #94a3b8;
  font-size: 0.9em;
  flex: 2;
}

.semester-active {
  color: #10b981;
  font-weight: 500;
  font-size: 0.9em;
  flex: 1;
  text-align: right;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .charts-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .realtime-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }
}

@media (max-width: 768px) {
  .data-analysis-panel {
    padding: 16px;
  }

  .panel-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .header-controls {
    justify-content: space-between;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .realtime-card {
    padding: 16px;
  }

  .realtime-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .chart-card {
    padding: 16px;
  }

  .trend-svg {
    height: 150px;
  }

  .song-item {
    padding: 12px;
  }

  .song-rank-badge {
    width: 32px;
    height: 32px;
    font-size: 14px;
    margin-right: 12px;
  }

  .song-title {
    font-size: 14px;
  }

  .song-artist {
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .data-analysis-panel {
    padding: 12px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .realtime-grid {
    grid-template-columns: 1fr;
  }

  .trend-legend {
    font-size: 10px;
  }

  .chart-btn {
    width: 28px;
    height: 28px;
  }

  .chart-btn svg {
    width: 14px;
    height: 14px;
  }
}

/* 活跃用户排名样式 */
.users-ranking {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
}

.user-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.user-rank {
  flex-shrink: 0;
}

.rank-badge {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.rank-badge.gold {
  background: linear-gradient(135deg, #ffd700, #ffed4e);
  color: #92400e;
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
}

.rank-badge.silver {
  background: linear-gradient(135deg, #c0c0c0, #e5e7eb);
  color: #374151;
  box-shadow: 0 4px 12px rgba(192, 192, 192, 0.3);
}

.rank-badge.bronze {
  background: linear-gradient(135deg, #cd7f32, #d97706);
  color: #92400e;
  box-shadow: 0 4px 12px rgba(205, 127, 50, 0.3);
}

.rank-badge.other {
  background: rgba(100, 116, 139, 0.2);
  color: #cbd5e1;
  border: 1px solid rgba(100, 116, 139, 0.3);
}

.rank-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
}

.rank-number {
  font-size: 16px;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 4px;
}

.user-details {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #94a3b8;
}

.contribution-count,
.like-count {
  display: flex;
  align-items: center;
  gap: 4px;
}

.user-stats {
  text-align: right;
  flex-shrink: 0;
}

.activity-score {
  font-size: 20px;
  font-weight: 700;
  color: #10b981;
  line-height: 1;
}

.score-label {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
  margin-bottom: 8px;
}

.activity-bar {
  width: 80px;
  height: 4px;
  background: rgba(100, 116, 139, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.activity-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 2px;
  transition: width 0.3s ease;
}

@media (max-width: 768px) {
  .user-item {
    padding: 12px;
    gap: 12px;
  }

  .rank-badge {
    width: 32px;
    height: 32px;
    font-size: 12px;
  }

  .rank-icon {
    width: 16px;
    height: 16px;
  }

  .user-name {
    font-size: 14px;
  }

  .user-details {
    font-size: 12px;
    gap: 12px;
  }

  .activity-score {
    font-size: 16px;
  }

  .activity-bar {
    width: 60px;
  }
}

@media (max-width: 480px) {
  .user-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .user-rank {
    align-self: center;
  }

  .user-info {
    text-align: center;
    width: 100%;
  }

  .user-stats {
    text-align: center;
    width: 100%;
  }

  .user-details {
    justify-content: center;
  }

  .activity-bar {
    margin: 0 auto;
  }
}

/* 面板状态样式 */
.panel-loading {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  color: #4f46e5;
}

.chart-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #94a3b8;
}

.loading-content {
  text-align: center;
}

.loading-text {
  font-size: 14px;
  margin-top: 8px;
}

.chart-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #ef4444;
  text-align: center;
  gap: 16px;
}

.error-icon {
  width: 48px;
  height: 48px;
  color: #ef4444;
  opacity: 0.7;
}

.error-icon svg {
  width: 100%;
  height: 100%;
}

.chart-error p {
  margin: 0;
  font-size: 14px;
  color: #fca5a5;
}

/* 活跃用户悬停提示样式 */
.online-users-item {
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
}

.online-users-item:hover {
  background: rgba(79, 70, 229, 0.1);
  border-radius: 8px;
}

.users-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(100, 116, 139, 0.3);
  border-radius: 12px;
  padding: 16px;
  min-width: 280px;
  max-width: 320px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
  z-index: 99999;
  animation: tooltipFadeIn 0.2s ease-out;
}

.users-tooltip::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(100, 116, 139, 0.3);
  border-bottom: none;
  border-right: none;
  transform: translateX(-50%) rotate(45deg);
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.tooltip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(100, 116, 139, 0.3);
}

.tooltip-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #f1f5f9;
  background: linear-gradient(135deg, #0ea5e9, #06b6d4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.user-count {
  font-size: 12px;
  color: #0ea5e9;
  background: rgba(14, 165, 233, 0.15);
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.users-list {
  max-height: 240px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(100, 116, 139, 0.3) transparent;
}

.users-list::-webkit-scrollbar {
  width: 4px;
}

.users-list::-webkit-scrollbar-track {
  background: transparent;
}

.users-list::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.3);
  border-radius: 2px;
}

.user-item-tooltip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(100, 116, 139, 0.2);
  transition: all 0.2s ease;
}

.user-item-tooltip:last-child {
  border-bottom: none;
}

.user-item-tooltip:hover {
  background: rgba(100, 116, 139, 0.1);
  border-radius: 6px;
  padding: 8px 6px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #0ea5e9, #06b6d4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: white;
}

.user-info-tooltip {
  flex: 1;
  min-width: 0;
}

.user-info-tooltip .user-name {
  font-size: 14px;
  font-weight: 500;
  color: #f1f5f9;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-info-tooltip .user-username {
  font-size: 12px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-tooltip {
  text-align: center;
}

.empty-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #94a3b8;
  padding: 20px 0;
}

.empty-message svg {
  width: 36px;
  height: 36px;
  opacity: 0.5;
  color: #0ea5e9;
}

.empty-message p {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .users-tooltip {
    min-width: 240px;
    max-width: 280px;
    left: 0;
    transform: none;
    margin-left: 0;
  }

  .users-tooltip::before {
    left: 24px;
    transform: rotate(45deg);
  }
}

@media (max-width: 480px) {
  .users-tooltip {
    min-width: 200px;
    max-width: 240px;
    padding: 12px;
  }

  .user-item-tooltip {
    gap: 8px;
  }

  .user-avatar {
    width: 28px;
    height: 28px;
  }

  .avatar-placeholder {
    font-size: 12px;
  }

  .user-info-tooltip .user-name {
    font-size: 13px;
  }

  .user-info-tooltip .user-username {
    font-size: 11px;
  }
}

.retry-btn {
  padding: 8px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #ef4444;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.retry-btn:active {
  transform: translateY(1px);
}

/* 全局悬浮提示框样式 */
.users-tooltip-global {
  position: fixed;
  z-index: 999999;
  background: linear-gradient(145deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98));
  backdrop-filter: blur(16px);
  border: 1px solid rgba(100, 116, 139, 0.3);
  border-radius: 16px;
  padding: 18px;
  min-width: 280px;
  max-width: 320px;
  max-height: 300px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3), 0 10px 20px -5px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(100, 116, 139, 0.2);
  animation: tooltipFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.users-tooltip-global::before {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 10px solid rgba(15, 23, 42, 0.98);
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
}

/* 当tooltip在下方显示时，箭头在上方 */
.users-tooltip-global.tooltip-below::before {
  top: -8px;
  border-top: none;
  border-bottom: 8px solid rgba(15, 23, 42, 0.98);
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

/* 响应式设计 - 全局tooltip */
@media (max-width: 768px) {
  .users-tooltip-global {
    min-width: 240px;
    max-width: 280px;
    padding: 14px;
  }
}

@media (max-width: 480px) {
  .users-tooltip-global {
    min-width: 200px;
    max-width: 240px;
    padding: 12px;
    font-size: 13px;
  }

  .users-tooltip-global .tooltip-header h4 {
    font-size: 13px;
  }

  .users-tooltip-global .user-count {
    font-size: 11px;
  }
}
</style>