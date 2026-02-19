<template>
  <div class="space-y-6 pb-24 md:pb-8">
    <!-- 日期选择器 -->
    <div class="relative bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-1 overflow-hidden">
      <div class="flex items-center" @touchstart.stop>
        <button
          :disabled="isFirstDateVisible"
          class="p-2 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors"
          @click="scrollDates('left')"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>

        <div
          ref="dateSelector"
          class="flex-1 flex overflow-x-auto scrollbar-hide gap-2 px-2 py-1 scroll-smooth overscroll-x-contain"
          style="overscroll-behavior-x: contain; touch-action: pan-x"
        >
          <button
            v-for="date in availableDates"
            :key="date.value"
            :data-date="date.value"
            :class="[
              'flex flex-col items-center justify-center min-w-[64px] h-16 rounded-lg transition-all duration-200 border',
              selectedDate === date.value
                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
            ]"
            @click="selectedDate = date.value"
          >
            <span class="text-[10px] font-bold uppercase tracking-wider opacity-80">{{
              date.weekday
            }}</span>
            <span class="text-lg font-black leading-none my-0.5">{{ date.day }}</span>
            <span class="text-[9px] font-bold opacity-60">{{ date.month }}月</span>
          </button>
        </div>

        <button
          :disabled="isLastDateVisible"
          class="p-2 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors"
          @click="scrollDates('right')"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <polyline points="9,18 15,12 9,6" />
          </svg>
        </button>

        <!-- 操作按钮组 -->
        <div class="flex items-center border-l border-zinc-800 ml-1 pl-1">
          <!-- 定位到今天 -->
          <button
            class="p-2 text-zinc-500 hover:text-emerald-400 transition-colors"
            title="跳转到今天"
            @click="scrollToToday"
          >
            <CircleDot class="w-5 h-5" />
          </button>

          <!-- 手动日期选择按钮 -->
          <button
            class="p-2 text-zinc-500 hover:text-blue-400 transition-colors"
            title="选择特定日期"
            @click="openManualDatePicker"
          >
            <CalendarIcon class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>

    <!-- 手动日期选择弹窗 -->
    <div
      v-if="showManualDatePicker"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div
        class="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
        @click.stop
      >
        <div class="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 class="text-sm font-black text-zinc-100 uppercase tracking-widest">选择日期</h3>
          <button
            class="text-zinc-500 hover:text-zinc-300 transition-colors"
            @click="showManualDatePicker = false"
          >
            <CloseIcon class="w-5 h-5" />
          </button>
        </div>
        <div class="p-6 space-y-6">
          <input
            v-model="manualSelectedDate"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
            type="date"
          >
          <div class="flex gap-3">
            <button
              class="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-colors uppercase tracking-wider"
              @click="showManualDatePicker = false"
            >
              取消
            </button>
            <button
              class="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-colors uppercase tracking-wider"
              @click="confirmManualDate"
            >
              确认
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 播出时段选择器 (如果启用) -->
    <div
      v-if="playTimeEnabled"
      class="flex items-center gap-3 bg-zinc-900/30 border border-zinc-800 rounded-lg p-3"
    >
      <CustomSelect
        v-model="selectedPlayTime"
        label="播出时段"
        :options="playTimeOptions"
        class-name="w-full"
      />
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 min-h-[60vh]">
      <LoadingState title="正在加载排期数据" message="请稍候..." />
    </div>

    <div v-else>
      <div
        class="lg:hidden sticky -top-4 -mx-4 -mt-4 z-20 flex p-1 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 shadow-xl mb-4 pt-4"
      >
        <button
          :class="[
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black uppercase tracking-widest transition-all',
            mobileTab === 'pending' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500'
          ]"
          @click="mobileTab = 'pending'"
        >
          <ListMusic class="w-4 h-4" />
          <span class="flex items-center gap-1.5"
            >待排歌曲
            <span class="px-1.5 py-0.5 bg-zinc-800 text-[10px] rounded text-zinc-400">{{
              filteredUnscheduledSongs.length
            }}</span></span
          >
        </button>
        <button
          :class="[
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black uppercase tracking-widest transition-all',
            mobileTab === 'scheduled' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500'
          ]"
          @click="mobileTab = 'scheduled'"
        >
          <PlaySquare class="w-4 h-4" />
          <span class="flex items-center gap-1.5"
            >播放列表
            <span class="px-1.5 py-0.5 bg-zinc-800 text-[10px] rounded text-zinc-400">{{
              localScheduledSongs.length
            }}</span></span
          >
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        <!-- 左侧：待排歌曲（待排库） -->
        <div
          v-show="mobileTab === 'pending' || isDesktop"
          :class="[
            'lg:col-span-4 flex flex-col space-y-2',
            mobileTab === 'scheduled' ? 'hidden lg:flex' : 'flex'
          ]"
          @dragover.prevent="handleDraggableDragOver"
          @dragleave="handleDraggableDragLeave"
          @drop.stop.prevent="handleReturnToDraggable"
        >
          <div class="flex items-center justify-between px-1">
            <h3 class="hidden lg:block text-lg font-black tracking-tight text-zinc-100 uppercase">
              待排歌曲
            </h3>
            <div
              class="flex w-full lg:w-auto gap-1 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800"
            >
              <button
                v-for="tab in [
                  { id: 'normal', label: '普通投稿' },
                  { id: 'replay', label: '重播申请' },
                  { id: 'all', label: '所有' }
                ]"
                :key="tab.id"
                :class="[
                  'flex-1 lg:flex-none px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                  activeTab === tab.id
                    ? 'bg-zinc-800 text-blue-400 shadow-md border border-blue-500/20'
                    : 'text-zinc-600 hover:text-zinc-400'
                ]"
                @click="activeTab = tab.id"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>

          <!-- 筛选区 - 移动端折叠 -->
          <div class="bg-zinc-900/40 border border-zinc-800 rounded-2xl shadow-xl">
            <div
              class="p-4 flex items-center justify-between lg:hidden border-b border-zinc-800/50 rounded-t-2xl"
              @click="mobileFiltersOpen = !mobileFiltersOpen"
            >
              <div class="flex items-center gap-2 text-zinc-400">
                <Filter class="w-3.5 h-3.5" />
                <span class="text-[11px] font-black uppercase tracking-widest">检索与筛选</span>
              </div>
              <ChevronRight
                :class="[
                  'w-3.5 h-3.5 text-zinc-700 transition-transform duration-300',
                  mobileFiltersOpen ? 'rotate-90' : ''
                ]"
              />
            </div>

            <div
              v-show="mobileFiltersOpen || isDesktop"
              class="p-3 space-y-2 transition-all duration-300 ease-in-out rounded-b-2xl"
            >
              <div class="relative">
                <Search
                  class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700 w-3.5 h-3.5"
                />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="搜索歌曲、艺术家..."
                  class="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-blue-500/30 transition-all text-zinc-200"
                >
                <button
                  v-if="searchQuery"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                  @click="searchQuery = ''"
                >
                  <CloseIcon class="w-3.5 h-3.5" />
                </button>
              </div>
              <div class="grid grid-cols-1 gap-2">
                <CustomSelect
                  v-model="selectedSemester"
                  label="当前学期"
                  :options="availableSemesters"
                  label-key="name"
                  value-key="name"
                  @change="onSemesterChange"
                />
                <div class="grid grid-cols-2 gap-2">
                  <CustomSelect v-model="selectedGrade" label="年级" :options="availableGrades" />
                  <CustomSelect v-model="songSortOption" label="排序" :options="sortOptions" />
                </div>
              </div>
            </div>
          </div>

          <div
            :class="[
              'draggable-songs flex-1 border-2 border-dashed rounded-[2rem] p-2 md:p-3 min-h-[400px] transition-colors duration-200',
              isDraggableOver
                ? 'border-blue-500 bg-blue-500/5'
                : 'border-zinc-800/80 bg-zinc-900/20'
            ]"
          >
            <div class="space-y-2">
              <div
                v-for="song in filteredUnscheduledSongs"
                :key="song.id"
                class="draggable-song relative group bg-zinc-900 border border-zinc-800/50 rounded-xl p-3 hover:border-zinc-700 transition-all select-none"
                draggable="true"
                @dragend="dragEnd"
                @dragstart="dragStart($event, song)"
                @touchend="handleTouchEnd"
                @touchmove="handleTouchMove"
                @touchstart="handleTouchStart($event, song, 'song')"
              >
                <!-- 歌曲卡片内容 -->
                <div class="flex items-center gap-3">
                  <!-- 封面图片 -->
                  <div
                    class="relative w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 border border-zinc-700/50"
                  >
                    <img
                      v-if="song.cover"
                      :src="convertToHttps(song.cover)"
                      class="w-full h-full object-cover"
                      referrerpolicy="no-referrer"
                      loading="lazy"
                      alt=""
                    >
                    <div
                      v-else
                      class="w-full h-full flex items-center justify-center text-zinc-600"
                    >
                      <Music2 class="w-6 h-6 opacity-50" />
                    </div>
                  </div>

                  <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                    <h4 class="font-bold text-zinc-100 text-sm truncate">
                      <button
                        v-if="song.musicPlatform === 'bilibili'"
                        class="text-zinc-100 hover:text-blue-400 hover:underline flex items-center gap-1 transition-colors w-full text-left"
                        @click.stop="openBilibiliPreview(song)"
                      >
                        <span class="truncate">{{ song.title }}</span>
                        <ExternalLink class="w-3 h-3 opacity-70 flex-shrink-0" />
                      </button>
                      <span v-else>{{ song.title }}</span>
                    </h4>
                    <div class="text-xs text-zinc-400 truncate">{{ song.artist }}</div>
                    <div class="text-[10px] text-zinc-500 truncate flex items-center gap-1">
                      <span>{{ song.requester }}</span>
                      <span v-if="song.requesterGrade" class="text-zinc-600">|</span>
                      <span v-if="song.requesterGrade">{{ song.requesterGrade }}</span>
                      <span
                        v-if="song.preferredPlayTimeId"
                        class="ml-1 px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[9px] border border-indigo-500/20 whitespace-nowrap"
                      >
                        期望: {{ getPlayTimeName(song.preferredPlayTimeId) }}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <!-- 普通模式：投票数 -->
                    <div
                      v-if="activeTab !== 'replay'"
                      class="flex items-center gap-1 text-[10px] font-bold text-zinc-500 bg-zinc-950/50 px-2 py-1 rounded-md border border-zinc-800/50"
                    >
                      <Heart class="w-3 h-3 text-red-500/50" />
                      {{ song.voteCount || 0 }}
                    </div>

                    <!-- 重播模式：查看按钮 -->
                    <button
                      v-if="activeTab === 'replay'"
                      class="px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[10px] font-bold transition-colors"
                      @click.stop="openReplayModal(song)"
                    >
                      查看
                    </button>

                    <!-- 重播模式：拒绝按钮（仅移动端） -->
                    <button
                      v-if="activeTab === 'replay'"
                      class="lg:hidden p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-colors"
                      title="拒绝申请"
                      @click.stop="rejectReplayRequest(song.id)"
                    >
                      <CloseIcon class="w-3.5 h-3.5" />
                    </button>

                    <!-- 移动端添加按钮 -->
                    <button
                      class="lg:hidden p-2 rounded-full bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 active:scale-95 transition-all flex-shrink-0"
                      @click.stop="addSongToSchedule(song)"
                    >
                      <Plus class="w-5 h-5" />
                    </button>

                    <!-- 菜单按钮 -->
                    <div
                      class="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-600 cursor-grab active:cursor-grabbing hover:text-zinc-400 transition-colors"
                    >
                      <MoreVertical class="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- 空状态 -->
              <div
                v-if="filteredUnscheduledSongs.length === 0"
                class="h-[300px] flex flex-col items-center justify-center text-zinc-800"
              >
                <div v-if="searchQuery" class="flex flex-col items-center">
                  <Search class="w-8 h-8 mb-2 opacity-20" />
                  <p class="text-[10px] font-black uppercase tracking-widest">未找到匹配的歌曲</p>
                </div>
                <div v-else class="flex flex-col items-center">
                  <ListMusic class="w-8 h-8 mb-2 opacity-20" />
                  <p class="text-[10px] font-black uppercase tracking-widest">暂无歌曲记录</p>
                </div>
              </div>
            </div>

            <!-- 分页 -->
            <div
              v-if="totalPages > 1"
              class="mt-4 flex items-center justify-between pt-4 border-t border-zinc-800/50"
            >
              <button
                :disabled="currentPage === 1"
                class="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 disabled:opacity-30 transition-colors"
                @click="prevPage"
              >
                <ArrowLeft class="w-4 h-4" />
              </button>
              <span class="text-[10px] font-bold text-zinc-600"
                >{{ currentPage }} / {{ totalPages }}</span
              >
              <button
                :disabled="currentPage === totalPages"
                class="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 disabled:opacity-30 transition-colors"
                @click="nextPage"
              >
                <ArrowRight class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- 右侧：播放列表（播放顺序） -->
        <div
          v-show="mobileTab === 'scheduled' || isDesktop"
          :class="[
            'lg:col-span-8 flex flex-col space-y-4',
            mobileTab === 'pending' ? 'hidden lg:flex' : 'flex'
          ]"
        >
          <div
            class="hidden lg:flex flex-col xl:flex-row xl:items-center justify-between gap-4 px-1"
          >
            <h3 class="text-lg font-black tracking-tight text-zinc-100 uppercase">播放顺序</h3>
            <div
              class="flex flex-wrap items-center gap-2 p-1.5 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl"
            >
              <div class="flex gap-1">
                <button
                  :disabled="
                    !hasChanges && localScheduledSongs.length === 0 && !hasUnpublishedDrafts
                  "
                  class="p-2 bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded-xl transition-all group relative disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="saveDraft"
                >
                  <Save class="w-3.5 h-3.5" />
                  <span
                    class="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-800 text-[9px] text-zinc-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-zinc-700"
                    >保存草稿</span
                  >
                </button>
                <button
                  :disabled="localScheduledSongs.length === 0"
                  class="p-2 bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded-xl transition-all group relative disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="openDownloadDialog"
                >
                  <Download class="w-3.5 h-3.5" />
                  <span
                    class="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-800 text-[9px] text-zinc-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-zinc-700"
                    >下载歌曲</span
                  >
                </button>
                <button
                  :disabled="localScheduledSongs.length === 0"
                  class="p-2 bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-500 hover:text-emerald-500 rounded-xl transition-all group relative disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="markAllAsPlayed"
                >
                  <CheckCircle2 class="w-3.5 h-3.5" />
                  <span
                    class="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-800 text-[9px] text-zinc-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-zinc-700"
                    >全部已播放</span
                  >
                </button>
              </div>
              <div class="h-6 w-[1px] bg-zinc-800 mx-1" />
              <button
                :disabled="!canPublish"
                class="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-black rounded-xl border border-emerald-500/20 transition-all uppercase tracking-widest active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                @click="publishSchedule"
              >
                <Send class="w-3 h-3" /> 发布排期
              </button>
              <button
                :disabled="!hasChanges"
                class="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all uppercase tracking-widest active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                @click="saveSequence"
              >
                <FileBadge class="w-3.5 h-3.5" /> 保存并发布
              </button>
            </div>
          </div>

          <div
            ref="sequenceList"
            :class="[
              'sequence-list flex-1 border-2 border-dashed rounded-[2rem] p-2 md:p-3 min-h-[400px] transition-colors duration-200',
              isSequenceOver ? 'border-blue-500 bg-blue-500/5' : 'border-zinc-800/80 bg-zinc-900/20'
            ]"
            @dragleave="handleSequenceDragLeave"
            @dragover.prevent="handleDragOver"
            @dragenter.prevent="isSequenceOver = true"
            @drop.stop.prevent="dropToSequence"
          >
            <div
              v-if="localScheduledSongs.length === 0"
              class="flex flex-col items-center justify-center h-full py-12 text-zinc-800"
            >
              <PlaySquare class="w-8 h-8 mb-4 opacity-20" />
              <p class="text-[10px] font-black uppercase tracking-widest">请从待排库中添加歌曲</p>
            </div>

            <TransitionGroup class="space-y-2" name="schedule-list" tag="div">
              <div
                v-for="(schedule, index) in localScheduledSongs"
                :key="schedule.id"
                :class="[
                  'scheduled-song relative group bg-zinc-900 border border-zinc-800/50 rounded-xl p-3 hover:border-zinc-700 transition-all select-none',
                  dragOverIndex === index ? 'border-t-2 border-t-blue-500' : '',
                  schedule.isDraft ? 'border-amber-500/30 bg-amber-500/5' : ''
                ]"
                :data-schedule-id="schedule.id"
                draggable="true"
                @dragend="dragEnd"
                @dragleave="handleDragLeave"
                @dragstart="dragScheduleStart($event, schedule)"
                @touchend="handleTouchEnd"
                @touchmove="handleTouchMove"
                @touchstart="handleTouchStart($event, schedule, 'schedule')"
                @dragover.prevent
                @dragenter.prevent="handleDragEnter($event, index)"
                @drop.stop.prevent="dropReorder($event, index)"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-zinc-950/50 border border-zinc-800 text-zinc-500 font-black text-xs flex-shrink-0"
                  >
                    <span class="text-[8px] text-zinc-600 uppercase leading-none mb-0.5">POS</span>
                    <span class="text-sm text-zinc-300 leading-none">{{
                      index + 1 < 10 ? '0' + (index + 1) : index + 1
                    }}</span>
                  </div>

                  <!-- 封面图片 -->
                  <div
                    class="relative w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 border border-zinc-700/50"
                  >
                    <img
                      v-if="schedule.song.cover"
                      :src="convertToHttps(schedule.song.cover)"
                      class="w-full h-full object-cover"
                      referrerpolicy="no-referrer"
                      loading="lazy"
                      alt=""
                    >
                    <div
                      v-else
                      class="w-full h-full flex items-center justify-center text-zinc-600"
                    >
                      <Music2 class="w-5 h-5 opacity-50" />
                    </div>
                  </div>

                  <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div class="flex items-center gap-2">
                      <h4 class="font-bold text-zinc-200 text-sm truncate">
                        {{ schedule.song.title }}
                      </h4>
                      <!-- 重播标识 -->
                      <span
                        v-if="schedule.song.replayRequestCount > 0"
                        class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 uppercase tracking-wider flex items-center gap-1"
                        title="重播歌曲"
                      >
                        <Icon name="repeat" :size="10" />
                        重播
                      </span>
                      <span
                        v-if="schedule.isDraft"
                        class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider"
                        >草稿</span
                      >
                    </div>
                    <div class="text-xs text-zinc-500 truncate">{{ schedule.song.artist }}</div>
                    <div class="text-[10px] text-zinc-600 truncate flex items-center gap-1">
                      <!-- 显示申请人或投稿人 -->
                      <span
                        v-if="schedule.song.replayRequestCount > 0"
                        :title="
                          '重播申请人：' +
                          (schedule.song.replayRequesters || [])
                            .map((r) => r.displayName || r.name)
                            .join('、')
                        "
                      >
                        申请人:
                        {{
                          (schedule.song.replayRequesters || [])
                            .slice(0, 2)
                            .map((r) => r.displayName || r.name)
                            .join('、')
                        }}{{
                          schedule.song.replayRequestCount > 2
                            ? ' 等' + schedule.song.replayRequestCount + '人'
                            : ''
                        }}
                      </span>
                      <span v-else>{{ schedule.song.requester }}</span>
                      <span v-if="schedule.song.requesterGrade" class="text-zinc-700">|</span>
                      <span v-if="schedule.song.requesterGrade">{{
                        schedule.song.requesterGrade
                      }}</span>
                      <span
                        v-if="schedule.song.preferredPlayTimeId"
                        class="ml-1 px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[9px] border border-indigo-500/20 whitespace-nowrap"
                      >
                        期望: {{ getPlayTimeName(schedule.song.preferredPlayTimeId) }}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      v-if="schedule.isDraft"
                      class="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 transition-colors"
                      title="发布此草稿"
                      @click="publishSingleDraft(schedule)"
                    >
                      <Send class="w-3.5 h-3.5" />
                    </button>

                    <!-- 移动端删除按钮 -->
                    <button
                      class="lg:hidden p-2 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 active:scale-95 transition-all flex-shrink-0"
                      @click.stop="removeSongFromSchedule(schedule)"
                    >
                      <Minus class="w-5 h-5" />
                    </button>

                    <div
                      class="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-600 cursor-grab active:cursor-grabbing hover:text-zinc-400 transition-colors"
                    >
                      <MoreVertical class="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </TransitionGroup>
          </div>
        </div>
      </div>

      <!-- 移动端底部操作栏 -->
      <div
        class="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800 flex items-center gap-3 pb-6"
      >
        <!-- 次要操作栏 (图标按钮) -->
        <button
          class="p-3 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl flex items-center justify-center active:scale-95 transition-all"
          @click="openDownloadDialog"
        >
          <Download class="w-5 h-5" />
        </button>
        <button
          class="p-3 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl flex items-center justify-center active:scale-95 transition-all"
          @click="saveDraft"
        >
          <Save class="w-5 h-5" />
        </button>
        <button
          class="p-3 bg-zinc-900 border border-zinc-800 text-emerald-500 rounded-xl flex items-center justify-center active:scale-95 transition-all"
          @click="markAllAsPlayed"
        >
          <CheckCircle2 class="w-5 h-5" />
        </button>
        <button
          class="p-3 bg-zinc-900 border border-zinc-800 text-blue-500 rounded-xl flex items-center justify-center active:scale-95 transition-all"
          title="仅发布排期"
          @click="publishSchedule"
        >
          <Send class="w-5 h-5" />
        </button>

        <!-- 主要操作 -->
        <button
          :disabled="!hasChanges"
          class="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          @click="saveSequence"
        >
          <FileBadge class="w-4 h-4" /> 保存并发布
        </button>
      </div>
    </div>
  </div>

  <!-- 确认对话框 -->
  <ConfirmDialog
    :confirm-text="confirmDialogConfirmText"
    :loading="loading"
    :message="confirmDialogMessage"
    :show="showConfirmDialog"
    :title="confirmDialogTitle"
    :type="confirmDialogType"
    cancel-text="取消"
    @close="showConfirmDialog = false"
    @confirm="handleConfirm"
  />

  <!-- 下载对话框 -->
  <SongDownloadDialog
    :show="showDownloadDialog"
    :songs="localScheduledSongs"
    @close="showDownloadDialog = false"
  />

  <!-- 重播申请详情弹窗 -->
  <div
    v-if="showReplayModal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    @click="closeReplayModal"
  >
    <div
      class="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      @click.stop
    >
      <div class="flex items-center justify-between p-4 border-b border-zinc-800">
        <h3 class="text-sm font-black text-zinc-100 uppercase tracking-widest">
          {{ replayModalTitle }} - 重播申请详情
        </h3>
        <div class="flex items-center gap-3">
          <button
            class="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-xs font-bold transition-colors"
            @click="
              rejectReplayRequest(replayModalSongId);
              closeReplayModal()
            "
          >
            拒绝申请
          </button>
          <button
            class="text-zinc-500 hover:text-zinc-300 transition-colors"
            @click="closeReplayModal"
          >
            <CloseIcon class="w-5 h-5" />
          </button>
        </div>
      </div>
      <div class="p-0 overflow-y-auto max-h-[60vh]">
        <div class="divide-y divide-zinc-800/50">
          <div
            v-for="(req, idx) in replayModalRequests"
            :key="idx"
            class="flex items-center justify-between p-4 group"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-blue-400 transition-colors"
              >
                <User class="w-3.5 h-3.5" />
              </div>
              <div class="flex flex-col">
                <span class="text-sm font-bold text-zinc-200">{{ req.name }}</span>
                <span v-if="req.grade" class="text-[10px] text-zinc-500"
                  >{{ req.grade }}{{ req.class ? ` ${req.class}` : '' }}</span
                >
              </div>
            </div>
            <div
              class="flex items-center gap-1.5 text-[10px] font-black text-zinc-600 uppercase tracking-widest"
            >
              <Clock class="w-2.5 h-2.5" />
              {{ formatDate(req.createdAt) }}
            </div>
          </div>
          <div v-if="replayModalRequests.length === 0" class="py-10 text-center text-zinc-700">
            <Info class="w-6 h-6 mx-auto mb-2 opacity-20" />
            <p class="text-xs font-bold uppercase tracking-widest">暂无详细申请记录</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 哔哩哔哩 iframe 预览弹窗 -->
  <BilibiliIframeModal
    :show="showBilibiliPreview"
    :bvid="previewBvid"
    :page="previewPage"
    @close="showBilibiliPreview = false"
  />
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import {
  Search,
  Save,
  Send,
  CheckCircle2,
  Download,
  FileBadge,
  PlaySquare,
  ChevronDown,
  ListMusic,
  Filter,
  Info,
  Clock,
  User,
  AlertTriangle,
  X as CloseIcon,
  ChevronRight,
  MoreVertical,
  Calendar as CalendarIcon,
  ArrowLeft,
  ArrowRight,
  Music2,
  Heart,
  Plus,
  Minus,
  CircleDot,
  ExternalLink
} from 'lucide-vue-next'
import SongDownloadDialog from './SongDownloadDialog.vue'
import ConfirmDialog from '../UI/ConfirmDialog.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import LoadingState from '~/components/UI/Common/LoadingState.vue'
import BilibiliIframeModal from '~/components/UI/BilibiliIframeModal.vue'
import { useBilibiliPreview } from '~/composables/useBilibiliPreview'
import { convertToHttps, getBilibiliUrl } from '~/utils/url'

// 响应式数据
const selectedDate = ref(new Date().toISOString().split('T')[0])
const loading = ref(false)
const songSortOption = ref('votes-desc')
const hasChanges = ref(false)
const searchQuery = ref('')
const selectedGrade = ref('全部')
const activeTab = ref('normal')
const mobileTab = ref('pending')
const mobileFiltersOpen = ref(false)

// 哔哩哔哩预览相关
const { showBilibiliPreview, previewBvid, previewPage, openBilibiliPreview } = useBilibiliPreview()

// 确认对话框相关
const showConfirmDialog = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogMessage = ref('')
const confirmDialogType = ref('warning')
const confirmDialogConfirmText = ref('确认')
const confirmAction = ref(null)

// 下载相关
const showDownloadDialog = ref(false)
const openDownloadDialog = () => {
  showDownloadDialog.value = true
}

// 重播申请弹窗相关
const showReplayModal = ref(false)
const replayModalTitle = ref('')
const replayModalRequests = ref([])
const replayModalSongId = ref(null)

const openReplayModal = (song) => {
  replayModalTitle.value = song.title
  replayModalRequests.value = song.requestDetails || []
  replayModalSongId.value = song.id
  showReplayModal.value = true
}

const closeReplayModal = () => {
  showReplayModal.value = false
  replayModalTitle.value = ''
  replayModalRequests.value = []
  replayModalSongId.value = null
}

// 拖拽状态
const isDraggableOver = ref(false)
const isSequenceOver = ref(false)
const dragOverIndex = ref(-1)
const draggedSchedule = ref(null)

// 触摸拖拽状态
const touchDragData = ref(null)
const touchStartPos = ref({ x: 0, y: 0 })
const touchCurrentPos = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const isLongPressing = ref(false)
const dragElement = ref(null)
const longPressTimer = ref(null)
const touchStartTime = ref(0)

// 触控拖拽配置
const TOUCH_CONFIG = {
  LONG_PRESS_DURATION: 500, // 长按识别时间（毫秒）
  DRAG_THRESHOLD: 15, // 拖拽触发阈值（像素）
  VIBRATION_DURATION: 50, // 震动时长（毫秒）
  SCROLL_THRESHOLD: 10 // 滚动阈值（像素）
}

// DOM引用
const dateSelector = ref(null)
const sequenceList = ref(null)

// 滚动状态
const isFirstDateVisible = ref(true)
const isLastDateVisible = ref(true)

// 数据
const songs = ref([])
const publicSchedules = ref([])
const localScheduledSongs = ref([])
const replayRequests = ref([])
const scheduledSongIds = ref(new Set())

// 计算是否有未发布的草稿
const hasUnpublishedDrafts = computed(() => {
  return localScheduledSongs.value.some((schedule) => schedule.isDraft)
})

// 计算是否有变化或有未发布的草稿
const canPublish = computed(() => {
  return (hasChanges.value && localScheduledSongs.value.length > 0) || hasUnpublishedDrafts.value
})

// 草稿相关数据
const drafts = ref([])
const isDraftMode = ref(false)

// 播出时段相关
const playTimes = ref([])
const playTimeEnabled = ref(false)
const selectedPlayTime = ref('')

// 播出时段选项
const playTimeOptions = computed(() => {
  const options = [{ label: '未选择时段 (全天)', value: '' }]
  if (playTimes.value) {
    playTimes.value.forEach((pt) => {
      let label = pt.name
      if (pt.startTime || pt.endTime) {
        label += ` (${formatPlayTimeRange(pt)})`
      }
      options.push({ label, value: pt.id })
    })
  }
  return options
})

// 排序选项
const sortOptions = [
  { label: '最新投稿', value: 'time-desc' },
  { label: '最早投稿', value: 'time-asc' },
  { label: '热度最高', value: 'votes-desc' },
  { label: '热度最低', value: 'votes-asc' }
]

// 学期相关
const availableSemesters = ref([])
const selectedSemester = ref('')

// 日期范围（用于无限滚动）
const dateRange = ref({ start: -15, end: 15 })

// 手动日期选择
const showManualDatePicker = ref(false)
const manualSelectedDate = ref('')

// 分页相关
const pageStates = reactive({
  normal: 1,
  replay: 1,
  all: 1
})
const currentPage = computed({
  get: () => pageStates[activeTab.value] || 1,
  set: (val) => {
    if (pageStates[activeTab.value] !== undefined) {
      pageStates[activeTab.value] = val
    }
  }
})
const pageSize = ref(10)

// 服务
let songsService = null
let adminService = null
let auth = null
let semesterService = null

// 生成日期列表（无限滚动模式）
const availableDates = computed(() => {
  const dates = []
  const today = new Date()

  // 根据当前范围生成日期
  for (let i = dateRange.value.start; i <= dateRange.value.end; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)

    const dateStr = date.toISOString().split('T')[0]
    const isToday = i === 0
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const weekday = weekdays[date.getDay()]

    dates.push({
      value: dateStr,
      day: date.getDate().toString().padStart(2, '0'),
      month: (date.getMonth() + 1).toString().padStart(2, '0'),
      weekday,
      isToday
    })
  }

  return dates
})

// 获取所有可选年级
const availableGrades = computed(() => {
  if (!songs.value) return ['全部']

  const grades = new Set()
  songs.value.forEach((song) => {
    if (song.requesterGrade) {
      grades.add(song.requesterGrade)
    }
  })

  // 对年级进行简单排序
  const sortedGrades = Array.from(grades).sort()
  return ['全部', ...sortedGrades]
})

// 过滤未排期歌曲（所有）
const allUnscheduledSongs = computed(() => {
  const sourceData = activeTab.value === 'replay' ? replayRequests.value : songs.value
  if (!sourceData) return []

  let unscheduledSongs = sourceData.filter((song) => {
    // 检查是否已在当前显示的排期列表中（当前日期、当前时段）
    const isScheduledInCurrentView = localScheduledSongs.value.some(
      (s) => (s.song && s.song.id === song.id) || s.songId === song.id
    )

    if (isScheduledInCurrentView) return false

    if (activeTab.value === 'replay' || activeTab.value === 'all') {
      // 重播申请和所有歌曲模式不需要检查 played 状态，只要当前视图没排上就行
      return true
    } else {
      // 普通投稿需未播放，且未在任何日期的排期中
      return !song.played && !scheduledSongIds.value.has(song.id)
    }
  })

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    unscheduledSongs = unscheduledSongs.filter((song) => {
      const title = (song.title || '').toLowerCase()
      const artist = (song.artist || '').toLowerCase()
      const requester = (song.requester || '').toLowerCase()

      return title.includes(query) || artist.includes(query) || requester.includes(query)
    })
  }

  // 年级过滤 (针对普通投稿和所有歌曲)
  if (
    (activeTab.value === 'normal' || activeTab.value === 'all') &&
    selectedGrade.value !== '全部'
  ) {
    unscheduledSongs = unscheduledSongs.filter(
      (song) => song.requesterGrade === selectedGrade.value
    )
  }

  return [...unscheduledSongs].sort((a, b) => {
    // 重播申请默认按申请数量降序排列，如果数量相同则按时间
    if (activeTab.value === 'replay') {
      if ((b.requestCount || 0) !== (a.requestCount || 0)) {
        return (b.requestCount || 0) - (a.requestCount || 0)
      }
    }

    switch (songSortOption.value) {
      case 'time-desc':
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      case 'time-asc':
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      case 'votes-desc':
        return (b.voteCount || 0) - (a.voteCount || 0)
      case 'votes-asc':
        return (a.voteCount || 0) - (b.voteCount || 0)
      default:
        return 0
    }
  })
})

// 分页后的未排期歌曲
const filteredUnscheduledSongs = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize.value
  const endIndex = startIndex + pageSize.value
  return allUnscheduledSongs.value.slice(startIndex, endIndex)
})

// 总页数
const totalPages = computed(() => {
  return Math.ceil(allUnscheduledSongs.value.length / pageSize.value)
})

// 计算显示的页码数组
const displayedPageNumbers = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const count = 5

  if (total <= count) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  let start = current - 2
  let end = current + 2

  if (start < 1) {
    start = 1
    end = count
  }

  if (end > total) {
    end = total
    start = total - count + 1
  }

  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})

// 桌面端检测
const isDesktop = ref(true)

// 方法
const formatDate = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${Math.floor(diff / 86400000)}天前`
}

// 检查窗口大小
const checkWindowSize = () => {
  isDesktop.value = window.innerWidth >= 1024
}

// 处理日期选择器滚轮事件
const handleDateSelectorWheel = (event) => {
  event.preventDefault()

  const scrollAmount = 200
  const currentScroll = dateSelector.value.scrollLeft

  if (event.deltaY > 0) {
    // 向下滚动，向右移动
    dateSelector.value.scrollTo({
      left: currentScroll + scrollAmount,
      behavior: 'smooth'
    })
  } else {
    // 向上滚动，向左移动
    dateSelector.value.scrollTo({
      left: currentScroll - scrollAmount,
      behavior: 'smooth'
    })
  }

  setTimeout(() => {
    updateScrollButtonState()
  }, 300)
}

// 滚动日期选择器
const scrollDates = (direction) => {
  if (!dateSelector.value) return

  const scrollAmount = 200
  const currentScroll = dateSelector.value.scrollLeft

  dateSelector.value.scrollTo({
    left: direction === 'right' ? currentScroll + scrollAmount : currentScroll - scrollAmount,
    behavior: 'smooth'
  })

  setTimeout(() => {
    updateScrollButtonState()
  }, 300)
}

// 更新滚动按钮状态并加载更多日期
const updateScrollButtonState = () => {
  if (!dateSelector.value) return

  const { scrollLeft, scrollWidth, clientWidth } = dateSelector.value

  // 接近左边界，加载更多过去日期
  if (scrollLeft < 50) {
    const oldScrollWidth = scrollWidth
    dateRange.value.start -= 7
    nextTick(() => {
      const newScrollWidth = dateSelector.value.scrollWidth
      dateSelector.value.scrollLeft += newScrollWidth - oldScrollWidth
    })
  }

  // 接近右边界，加载更多未来日期
  if (scrollWidth - scrollLeft - clientWidth < 50) {
    dateRange.value.end += 7
  }

  // 无限滚动模式下，除非有特定限制，否则按钮始终可用
  isFirstDateVisible.value = false
  isLastDateVisible.value = false
}

// 确认对话框处理
const handleConfirm = async () => {
  if (confirmAction.value) {
    await confirmAction.value()
  }
  showConfirmDialog.value = false
  confirmAction.value = null
}

// 初始化
onMounted(async () => {
  songsService = useSongs()
  adminService = useAdmin()
  auth = useAuth()
  semesterService = useSemesters()

  // 初始化窗口大小检测
  checkWindowSize()
  window.addEventListener('resize', checkWindowSize)

  // 立即滚动到当前日期，避免等待数据加载
  nextTick(() => {
    scrollToDateElement('auto')
  })

  // 先加载学期数据，然后加载其他数据
  await loadSemesters()
  await loadData()

  // 添加事件监听器
  nextTick(() => {
    if (dateSelector.value) {
      dateSelector.value.addEventListener('wheel', handleDateSelectorWheel, { passive: false })
      dateSelector.value.addEventListener('scroll', updateScrollButtonState)
    }
    updateScrollButtonState()

    // 再次确认滚动位置（防止布局偏移）
    scrollToDateElement('auto')
  })
})

// 滚动到指定日期元素
const scrollToDateElement = (behavior = 'smooth') => {
  if (!dateSelector.value || !selectedDate.value) return

  const el = dateSelector.value.querySelector(`[data-date="${selectedDate.value}"]`)
  if (el) {
    el.scrollIntoView({ behavior, block: 'nearest', inline: 'center' })
  }
}

// 清理事件监听器
onUnmounted(() => {
  if (dateSelector.value) {
    dateSelector.value.removeEventListener('wheel', handleDateSelectorWheel)
    dateSelector.value.removeEventListener('scroll', updateScrollButtonState)
  }
  window.removeEventListener('resize', checkWindowSize)
})

// 打开手动日期选择器
const openManualDatePicker = () => {
  manualSelectedDate.value = selectedDate.value
  showManualDatePicker.value = true
}

// 确认手动日期选择
const confirmManualDate = () => {
  if (manualSelectedDate.value) {
    selectedDate.value = manualSelectedDate.value
    showManualDatePicker.value = false

    // 选中日期后，如果是手动选择的日期可能在当前列表外，滚动到该日期
    nextTick(() => {
      scrollToDateElement('smooth')
    })
  }
}

// 定位到今天
const scrollToToday = () => {
  const todayStr = new Date().toISOString().split('T')[0]
  selectedDate.value = todayStr

  // 确保今天在范围内
  if (dateRange.value.start > 0 || dateRange.value.end < 0) {
    dateRange.value.start = -15
    dateRange.value.end = 15
  }

  nextTick(() => {
    scrollToDateElement('smooth')
  })
}

// 分页控制方法
const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

// 监听日期变化
watch(selectedDate, async () => {
  await loadData()
})

// 重置所有分页状态
const resetAllPages = () => {
  pageStates.normal = 1
  pageStates.replay = 1
  pageStates.all = 1
}

// 监听排序选项变化，重置分页
watch(songSortOption, () => {
  resetAllPages()
})

// 监听搜索查询变化，重置分页
watch(searchQuery, () => {
  resetAllPages()
})

// 监听年级筛选变化，重置分页
watch(selectedGrade, () => {
  resetAllPages()
})

// 加载重播申请
const fetchReplayRequests = async () => {
  try {
    const data = await $fetch('/api/admin/replay-requests', {
      ...auth.getAuthConfig(),
      query: { status: 'PENDING' }
    })
    replayRequests.value = data || []
  } catch (err) {
    console.error('Failed to fetch replay requests', err)
    replayRequests.value = []
  }
}

// 拒绝重播申请
const rejectReplayRequest = async (songId) => {
  confirmDialogTitle.value = '拒绝重播申请'
  confirmDialogMessage.value = '确定要拒绝该重播申请吗？'
  confirmDialogType.value = 'warning'
  confirmDialogConfirmText.value = '拒绝申请'

  confirmAction.value = async () => {
    try {
      await $fetch('/api/admin/replay-requests/reject', {
        method: 'POST',
        body: { songId },
        ...auth.getAuthConfig()
      })

      // 刷新申请列表
      await fetchReplayRequests()
      if (window.$showNotification) {
        window.$showNotification('重播申请已拒绝', 'success')
      }
    } catch (err) {
      console.error('拒绝申请失败', err)
      if (window.$showNotification) {
        window.$showNotification('拒绝申请失败: ' + (err.data?.message || err.message), 'error')
      }
    }
  }

  showConfirmDialog.value = true
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    // 使用选中的学期过滤歌曲，如果选择"全部"则不传递学期参数
    const semester = selectedSemester.value === '全部' ? undefined : selectedSemester.value

    // 并行加载数据
    await Promise.all([
      songsService.fetchSongs(false, semester, false, true),
      songsService.fetchPublicSchedules(false, semester, false, true),
      loadPlayTimes(),
      loadDrafts(), // 加载草稿列表
      fetchReplayRequests() // 加载重播申请
    ])

    songs.value = songsService.songs.value
    publicSchedules.value = songsService.publicSchedules.value

    // 在草稿加载完成后再更新本地排期数据
    updateLocalScheduledSongs()
    hasChanges.value = false
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载播出时段
const loadPlayTimes = async () => {
  try {
    const response = await $fetch('/api/play-times')
    playTimeEnabled.value = response.enabled
    playTimes.value = response.playTimes || []
  } catch (error) {
    console.error('加载播出时段失败:', error)
    playTimeEnabled.value = false
    playTimes.value = []
  }
}

// 格式化播出时段时间范围
const formatPlayTimeRange = (playTime) => {
  if (!playTime) return ''

  const start = playTime.startTime || '00:00'
  const end = playTime.endTime || '23:59'

  if (playTime.startTime && playTime.endTime) {
    return `${start} - ${end}`
  } else if (playTime.startTime) {
    return `${start} 开始`
  } else if (playTime.endTime) {
    return `${end} 结束`
  }

  return '全天'
}

// 获取播出时段名称
const getPlayTimeName = (playTimeId) => {
  if (!playTimeId || !playTimes.value) return ''
  const playTime = playTimes.value.find((pt) => pt.id === playTimeId)
  return playTime ? playTime.name : ''
}

// 加载学期列表
const loadSemesters = async () => {
  try {
    await semesterService.fetchSemesters()
    await semesterService.fetchCurrentSemester()

    // 构建学期列表，包含"全部"选项和各个学期
    const semesterList = [{ id: 'all', name: '全部', isCurrent: false }]

    // 添加当前学期（如果存在）
    if (semesterService.currentSemester.value) {
      semesterList.push({
        id: semesterService.currentSemester.value.id || 'current',
        name: semesterService.currentSemester.value.name,
        isCurrent: true
      })
    }

    // 添加其他学期
    if (semesterService.semesters.value) {
      semesterService.semesters.value.forEach((semester) => {
        if (
          !semesterService.currentSemester.value ||
          semester.name !== semesterService.currentSemester.value.name
        ) {
          semesterList.push({
            id: semester.id,
            name: semester.name,
            isCurrent: false
          })
        }
      })
    }

    availableSemesters.value = semesterList

    // 默认选择当前学期（如果存在），否则选择"全部"
    if (semesterService.currentSemester.value) {
      selectedSemester.value = semesterService.currentSemester.value.name
    } else if (semesterList.length > 0) {
      selectedSemester.value = semesterList[0].name
    }
  } catch (error) {
    console.error('获取学期列表失败:', error)
  }
}

// 学期切换处理
const onSemesterChange = async () => {
  // 学期切换后重新加载数据
  await loadData()
}

// 更新本地排期数据（包括草稿）
const updateLocalScheduledSongs = () => {
  console.log('更新本地排期数据 - 当前日期:', selectedDate.value)
  console.log('公开排期数量:', publicSchedules.value.length)
  console.log('草稿数量:', drafts.value.length)

  // 获取已发布的排期
  const todaySchedules = publicSchedules.value.filter((s) => {
    if (!s.playDate) return false
    const scheduleDateStr = new Date(s.playDate).toISOString().split('T')[0]
    return scheduleDateStr === selectedDate.value
  })

  // 获取草稿排期
  const todayDrafts = drafts.value.filter((draft) => {
    if (!draft.playDate) return false
    const draftDateStr = new Date(draft.playDate).toISOString().split('T')[0]
    return draftDateStr === selectedDate.value
  })

  console.log('当天已发布排期:', todaySchedules.length)
  console.log('当天草稿排期:', todayDrafts.length)

  // 合并已发布和草稿排期
  let allSchedules = [...todaySchedules, ...todayDrafts]

  // 如果选择了特定播出时段，进行过滤
  if (selectedPlayTime.value) {
    allSchedules = allSchedules.filter((s) => s.playTimeId === parseInt(selectedPlayTime.value))
  }

  // 按 sequence 字段排序
  allSchedules.sort((a, b) => (a.sequence || 0) - (b.sequence || 0))

  localScheduledSongs.value = allSchedules.map((s) => ({ ...s }))

  console.log('最终显示排期数量:', localScheduledSongs.value.length)

  // 更新已排期歌曲ID集合（包括草稿）
  scheduledSongIds.value = new Set(
    [...publicSchedules.value, ...drafts.value]
      .filter((s) => s.song && s.song.id)
      .map((s) => s.song.id)
  )
}

// 监听播出时段选择变化
watch(selectedPlayTime, () => {
  updateLocalScheduledSongs()
})

// 拖拽方法
const dragStart = (event, song) => {
  event.dataTransfer.setData(
    'text/plain',
    JSON.stringify({
      type: 'add-to-schedule',
      songId: song.id
    })
  )

  setTimeout(() => {
    event.target.classList.add('opacity-50')
  }, 0)
}

const dragScheduleStart = (event, schedule) => {
  event.dataTransfer.setData(
    'text/plain',
    JSON.stringify({
      type: 'reorder-schedule',
      scheduleId: schedule.id
    })
  )

  draggedSchedule.value = { ...schedule }

  setTimeout(() => {
    event.target.classList.add('opacity-50')
  }, 0)
}

const dragEnd = (event) => {
  event.target.classList.remove('opacity-50')
  dragOverIndex.value = -1
  isSequenceOver.value = false
  isDraggableOver.value = false
}

const handleDragOver = (event) => {
  event.preventDefault()
  isSequenceOver.value = true
}

const handleDragEnter = (event, index) => {
  dragOverIndex.value = index
}

const handleDragLeave = (event) => {
  if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
    dragOverIndex.value = -1
  }
}

const handleSequenceDragLeave = (event) => {
  if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
    isSequenceOver.value = false
  }
}

const handleDraggableDragOver = (event) => {
  event.preventDefault()
  isDraggableOver.value = true
}

const handleDraggableDragLeave = (event) => {
  if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
    isDraggableOver.value = false
  }
}

const dropToSequence = async (event) => {
  event.preventDefault()
  dragOverIndex.value = -1
  isSequenceOver.value = false

  try {
    const data = event.dataTransfer.getData('text/plain')
    if (!data) return

    const dragData = JSON.parse(data)

    if (dragData.type === 'add-to-schedule') {
      const songId = parseInt(dragData.songId)
      // 尝试在普通歌曲列表和重播申请列表中查找
      let song = songs.value.find((s) => s.id === songId)
      if (!song) {
        song = replayRequests.value.find((s) => s.id === songId)
      }

      if (!song) return

      const existingIndex = localScheduledSongs.value.findIndex((s) => s.song.id === songId)
      if (existingIndex !== -1) return

      const newSchedule = {
        id: Date.now(),
        song: song,
        playDate: selectedDate.value, // 直接使用日期字符串
        sequence: localScheduledSongs.value.length + 1,
        isNew: true,
        isLocalOnly: true
      }

      scheduledSongIds.value.add(songId)
      localScheduledSongs.value.push(newSchedule)
      hasChanges.value = true
    }
  } catch (err) {
    console.error('处理拖放失败:', err)
  }
}

const dropReorder = async (event, dropIndex) => {
  event.preventDefault()
  dragOverIndex.value = -1

  try {
    const data = event.dataTransfer.getData('text/plain')
    if (!data) return

    const dragData = JSON.parse(data)

    if (dragData.type === 'reorder-schedule' && draggedSchedule.value) {
      const scheduleId = parseInt(dragData.scheduleId)
      const draggedIndex = localScheduledSongs.value.findIndex((s) => s.id === scheduleId)

      if (draggedIndex === -1 || draggedIndex === dropIndex) return

      const newOrder = [...localScheduledSongs.value]
      const [draggedItem] = newOrder.splice(draggedIndex, 1)
      newOrder.splice(dropIndex, 0, draggedItem)

      newOrder.forEach((item, index) => {
        item.sequence = index + 1
      })

      localScheduledSongs.value = newOrder
      hasChanges.value = true
    } else if (dragData.type === 'add-to-schedule') {
      // 处理从左侧拖到特定位置
      const songId = parseInt(dragData.songId)
      // 尝试在普通歌曲列表和重播申请列表中查找
      let song = songs.value.find((s) => s.id === songId)
      if (!song) {
        song = replayRequests.value.find((s) => s.id === songId)
      }

      if (!song) return

      const existingIndex = localScheduledSongs.value.findIndex((s) => s.song.id === songId)
      if (existingIndex !== -1) return

      const newSchedule = {
        id: Date.now(),
        song: song,
        playDate: selectedDate.value, // 直接使用日期字符串
        sequence: dropIndex + 1,
        isNew: true
      }

      scheduledSongIds.value.add(songId)

      const newOrder = [...localScheduledSongs.value]
      newOrder.splice(dropIndex, 0, newSchedule)

      newOrder.forEach((item, index) => {
        item.sequence = index + 1
      })

      localScheduledSongs.value = newOrder
      hasChanges.value = true
    }
  } catch (err) {
    console.error('处理重排序失败:', err)
  }

  draggedSchedule.value = null
}

// 添加歌曲到排期（点击方式）
const addSongToSchedule = (song) => {
  const existingIndex = localScheduledSongs.value.findIndex((s) => s.song.id === song.id)
  if (existingIndex !== -1) return

  const newSchedule = {
    id: Date.now(),
    song: song,
    playDate: selectedDate.value,
    sequence: localScheduledSongs.value.length + 1,
    isNew: true,
    isLocalOnly: true
  }

  scheduledSongIds.value.add(song.id)
  localScheduledSongs.value.push(newSchedule)
  hasChanges.value = true

  if (navigator.vibrate) navigator.vibrate(50)
}

// 从排期移除歌曲（点击方式）
const removeSongFromSchedule = (schedule) => {
  const index = localScheduledSongs.value.findIndex((s) => s.id === schedule.id)

  if (index !== -1) {
    const removed = localScheduledSongs.value.splice(index, 1)[0]

    if (removed.song) {
      scheduledSongIds.value.delete(removed.song.id)
    }

    // 重新排序
    localScheduledSongs.value.forEach((item, idx) => {
      item.sequence = idx + 1
    })

    hasChanges.value = true
    if (navigator.vibrate) navigator.vibrate(50)
  }
}

// 处理拖回待排区域
const handleReturnToDraggable = async (event) => {
  try {
    const data = event.dataTransfer.getData('text/plain')
    if (!data) return

    const dragData = JSON.parse(data)

    if (dragData.type === 'reorder-schedule') {
      // 从播放列表拖回待排列表（移除）
      const scheduleId = parseInt(dragData.scheduleId)
      const index = localScheduledSongs.value.findIndex((s) => s.id === scheduleId)

      if (index !== -1) {
        const removed = localScheduledSongs.value.splice(index, 1)[0]

        // 如果是本地新增的，直接移除；如果是已存在的，需要记录删除操作（这里简化为本地移除，保存时处理）
        if (removed.song) {
          scheduledSongIds.value.delete(removed.song.id)
        }

        // 重新排序
        localScheduledSongs.value.forEach((item, idx) => {
          item.sequence = idx + 1
        })

        hasChanges.value = true
      }
    }
  } catch (err) {
    console.error('处理移除失败:', err)
  }

  isDraggableOver.value = false
}

// 标记全部已播放
const markAllAsPlayed = async () => {
  if (localScheduledSongs.value.length === 0) return

  confirmDialogTitle.value = '标记全部已播'
  confirmDialogMessage.value = '确定要将列表中的所有歌曲标记为已播放吗？'
  confirmDialogType.value = 'info'
  confirmDialogConfirmText.value = '确认标记'

  confirmAction.value = async () => {
    loading.value = true
    try {
      const songIds = localScheduledSongs.value.map((s) => s.song.id)

      await $fetch('/api/admin/songs/mark-played', {
        method: 'POST',
        body: { songIds },
        ...auth.getAuthConfig()
      })

      if (window.$showNotification) {
        window.$showNotification('所有歌曲已标记为播放', 'success')
      }

      // 重新加载数据
      await loadData()
    } catch (err) {
      console.error('标记播放失败:', err)
      if (window.$showNotification) {
        window.$showNotification('操作失败', 'error')
      }
    } finally {
      loading.value = false
    }
  }

  showConfirmDialog.value = true
}

// 保存并发布
const saveSequence = async () => {
  try {
    await publishSchedule()
  } catch (err) {
    console.error('保存并发布失败:', err)
  }
}

// 草稿相关方法

// 加载草稿列表（使用新的综合API）
const loadDrafts = async () => {
  try {
    const response = await $fetch('/api/admin/schedule/full', {
      ...auth.getAuthConfig(),
      query: {
        includeDrafts: 'only' // 只获取草稿
      }
    })

    drafts.value = response.data?.schedules || []
    console.log('加载草稿列表:', drafts.value.length)
  } catch (error) {
    console.error('加载草稿列表失败:', error)
    // 如果加载失败，设置为空数组避免错误
    drafts.value = []
  }
}

// 刷新草稿列表
const refreshDrafts = async () => {
  await loadDrafts()
  updateLocalScheduledSongs() // 更新播放顺序列表
}

// 保存草稿（无需确认）
const saveDraft = async () => {
  loading.value = true

  try {
    // 删除当天指定播出时段的所有排期和草稿
    const existingSchedules = [...publicSchedules.value, ...drafts.value].filter((s) => {
      if (!s.playDate) return false
      const scheduleDateStr = new Date(s.playDate).toISOString().split('T')[0]
      const isTargetDate = scheduleDateStr === selectedDate.value

      if (selectedPlayTime.value) {
        return isTargetDate && s.playTimeId === parseInt(selectedPlayTime.value)
      }
      return isTargetDate
    })

    // 删除现有的排期和草稿
    for (const schedule of existingSchedules) {
      try {
        await $fetch(`/api/admin/schedule/remove`, {
          method: 'POST',
          body: { scheduleId: schedule.id },
          ...auth.getAuthConfig()
        })
      } catch (deleteError) {
        console.warn('删除排期失败:', deleteError)
      }
    }

    // 如果有歌曲，创建草稿排期
    if (localScheduledSongs.value.length > 0) {
      for (let i = 0; i < localScheduledSongs.value.length; i++) {
        const song = localScheduledSongs.value[i]

        try {
          await $fetch('/api/admin/schedule/draft', {
            method: 'POST',
            body: {
              songId: song.song.id,
              playDate: selectedDate.value, // 直接传递日期字符串
              sequence: i + 1,
              playTimeId: selectedPlayTime.value ? parseInt(selectedPlayTime.value) : null
            },
            ...auth.getAuthConfig()
          })
        } catch (error) {
          console.error(`创建草稿排期失败 (歌曲: ${song.song.title}):`, error)
          throw error
        }
      }
    }

    hasChanges.value = false
    await loadData() // 重新加载数据

    // 确保草稿显示在播放顺序中
    updateLocalScheduledSongs()

    if (window.$showNotification) {
      if (localScheduledSongs.value.length > 0) {
        window.$showNotification('排期草稿保存成功！', 'success')
      } else {
        window.$showNotification('所有草稿已删除！', 'success')
      }
    }
  } catch (error) {
    console.error('保存草稿失败:', error)
    if (window.$showNotification) {
      window.$showNotification('保存草稿失败: ' + (error.data?.message || error.message), 'error')
    }
  } finally {
    loading.value = false
  }
}

// 发布排期（需要确认）
const publishSchedule = async () => {
  try {
    // 如果列表为空，提示删除排期
    if (localScheduledSongs.value.length === 0) {
      confirmDialogTitle.value = '删除排期'
      confirmDialogMessage.value = '确定要删除当天的所有排期吗？此操作不可恢复。'
      confirmDialogType.value = 'danger'
      confirmDialogConfirmText.value = '确认删除'
    } else {
      confirmDialogTitle.value = '发布排期'
      confirmDialogMessage.value = '确定要发布当前排期吗？发布后将立即公示并发送通知。'
      confirmDialogType.value = 'warning'
      confirmDialogConfirmText.value = '发布排期'
    }

    confirmAction.value = async () => {
      await publishScheduleConfirmed()
    }
    showConfirmDialog.value = true
  } catch (error) {
    console.error('发布排期失败:', error)
  }
}

// 确认发布排期
const publishScheduleConfirmed = async () => {
  loading.value = true

  try {
    // 构建发布数据
    const songsToPublish = localScheduledSongs.value.map((item, index) => ({
      songId: item.song.id,
      sequence: index + 1
    }))

    // 调用批量发布API
    await $fetch('/api/admin/schedule/bulk-publish', {
      method: 'POST',
      body: {
        playDate: selectedDate.value,
        playTimeId: selectedPlayTime.value ? parseInt(selectedPlayTime.value) : null,
        songs: songsToPublish
      },
      ...auth.getAuthConfig()
    })

    hasChanges.value = false
    await loadData() // 重新加载数据

    // 确保界面更新
    updateLocalScheduledSongs()

    if (window.$showNotification) {
      if (songsToPublish.length === 0) {
        window.$showNotification('排期已删除！', 'success')
      } else {
        window.$showNotification('排期发布成功，通知已发送！', 'success')
      }
    }
  } catch (error) {
    console.error('发布排期失败:', error)
    if (window.$showNotification) {
      window.$showNotification('发布排期失败: ' + (error.data?.message || error.message), 'error')
    }
  } finally {
    loading.value = false
  }
}

// 发布单个草稿（需要确认）
const publishSingleDraft = async (draft) => {
  try {
    confirmDialogTitle.value = '发布草稿'
    confirmDialogMessage.value = `确定要发布草稿《${draft.song.title}》吗？发布后将立即公示并发送通知。`
    confirmDialogType.value = 'warning'
    confirmDialogConfirmText.value = '发布'
    confirmAction.value = async () => {
      await publishSingleDraftConfirmed(draft)
    }
    showConfirmDialog.value = true
  } catch (error) {
    console.error('发布单个草稿失败:', error)
  }
}

// 确认发布单个草稿
const publishSingleDraftConfirmed = async (draft) => {
  loading.value = true

  try {
    await $fetch('/api/admin/schedule/publish', {
      method: 'POST',
      body: { scheduleId: draft.id },
      ...auth.getAuthConfig()
    })

    await loadData() // 重新加载数据

    // 确保界面更新
    updateLocalScheduledSongs()

    if (window.$showNotification) {
      window.$showNotification(`草稿《${draft.song.title}》发布成功，通知已发送！`, 'success')
    }
  } catch (error) {
    console.error('发布单个草稿失败:', error)
    if (window.$showNotification) {
      window.$showNotification('发布草稿失败: ' + (error.data?.message || error.message), 'error')
    }
  } finally {
    loading.value = false
  }
}

// 触摸拖拽方法
const handleTouchStart = (event, item, type) => {
  // 在移动端，如果是待排歌曲列表（type='song'），禁用拖拽逻辑，只允许通过加号按钮添加
  if (window.innerWidth < 1024 && type === 'song') {
    return
  }

  // 在所有设备上启用触摸拖拽，但桌面端优先使用原生拖拽

  const touch = event.touches[0]
  touchStartPos.value = { x: touch.clientX, y: touch.clientY }
  touchCurrentPos.value = { x: touch.clientX, y: touch.clientY }
  touchStartTime.value = Date.now()
  touchDragData.value = { item, type }

  // 重置状态
  isDragging.value = false
  isLongPressing.value = false

  // 清除之前的长按定时器
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
  }

  // 在移动端使用较短的长按时间，桌面端使用较长时间
  const longPressDelay = window.innerWidth <= 768 ? 300 : TOUCH_CONFIG.LONG_PRESS_DURATION

  // 设置长按识别定时器
  longPressTimer.value = setTimeout(() => {
    if (!isDragging.value && touchDragData.value) {
      isLongPressing.value = true

      // 触发震动反馈（如果设备支持）
      if (navigator.vibrate) {
        navigator.vibrate(TOUCH_CONFIG.VIBRATION_DURATION)
      }

      // 添加长按视觉反馈
      const target = event.target.closest('.draggable-song, .scheduled-song')
      if (target) {
        target.classList.add('opacity-75', 'scale-95')
        dragElement.value = target
      }
    }
  }, longPressDelay)

  // 只在必要时防止默认行为
  // event.preventDefault()
}

const handleTouchMove = (event) => {
  if (!touchDragData.value) return

  const touch = event.touches[0]
  touchCurrentPos.value = { x: touch.clientX, y: touch.clientY }

  const deltaX = Math.abs(touch.clientX - touchStartPos.value.x)
  const deltaY = Math.abs(touch.clientY - touchStartPos.value.y)
  const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

  // 如果移动距离较小，可能是滚动操作，不触发拖拽
  if (totalDelta < TOUCH_CONFIG.SCROLL_THRESHOLD) {
    return
  }

  // 清除长按定时器（用户开始移动）
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }

  // 在移动端使用较小的拖拽阈值，桌面端需要长按
  const dragThreshold = window.innerWidth <= 768 ? 10 : TOUCH_CONFIG.DRAG_THRESHOLD

  // 只有在长按识别后或移动距离超过阈值时才开始拖拽
  if (!isDragging.value && (isLongPressing.value || totalDelta > dragThreshold)) {
    isDragging.value = true

    // 创建拖拽元素
    const target = event.target.closest('.draggable-song, .scheduled-song')
    if (target) {
      target.classList.remove('scale-95')
      target.classList.add('opacity-50')
      dragElement.value = target

      // 触发拖拽开始震动
      if (navigator.vibrate) {
        navigator.vibrate(TOUCH_CONFIG.VIBRATION_DURATION)
      }
    }
  }

  // 更新拖拽位置指示
  if (isDragging.value) {
    updateDragPosition(touch.clientX, touch.clientY)
    event.preventDefault()
  }
}

// 更新拖拽位置指示
const updateDragPosition = (x, y) => {
  const elementBelow = document.elementFromPoint(x, y)
  if (!elementBelow) return

  // 清除之前的高亮
  document.querySelectorAll('.border-blue-500').forEach((el) => {
    // 仅移除通过拖拽添加的高亮，避免移除原本的样式
    if (el.dataset.dragHighlight) {
      el.classList.remove('border-blue-500', 'bg-blue-500/10')
      delete el.dataset.dragHighlight
    }
  })

  // 高亮当前目标区域
  const sequenceList = elementBelow.closest('.sequence-list')
  const scheduledSong = elementBelow.closest('.scheduled-song')
  const draggableSongs = elementBelow.closest('.draggable-songs')

  // 根据拖拽类型高亮不同的目标区域
  if (touchDragData.value?.type === 'song') {
    // 拖拽待排歌曲时，高亮播放列表区域
    if (sequenceList) {
      sequenceList.classList.add('border-blue-500', 'bg-blue-500/10')
      sequenceList.dataset.dragHighlight = 'true'
    } else if (scheduledSong) {
      scheduledSong.classList.add('border-blue-500', 'bg-blue-500/10')
      scheduledSong.dataset.dragHighlight = 'true'
    }
  } else if (touchDragData.value?.type === 'schedule') {
    // 拖拽已排歌曲时，高亮待排区域或其他已排歌曲
    if (draggableSongs) {
      draggableSongs.classList.add('border-blue-500', 'bg-blue-500/10')
      draggableSongs.dataset.dragHighlight = 'true'
    } else if (scheduledSong) {
      scheduledSong.classList.add('border-blue-500', 'bg-blue-500/10')
      scheduledSong.dataset.dragHighlight = 'true'
    }
  }
}

// 清除拖拽位置指示
const clearDragPosition = () => {
  document.querySelectorAll('.border-blue-500').forEach((el) => {
    if (el.dataset.dragHighlight) {
      el.classList.remove('border-blue-500', 'bg-blue-500/10')
      delete el.dataset.dragHighlight
    }
  })
}

// 清理触控拖拽状态
const cleanupTouchDrag = () => {
  if (dragElement.value) {
    dragElement.value.classList.remove('opacity-50', 'opacity-75', 'scale-95')
    dragElement.value = null
  }

  // 重置状态
  isDragging.value = false
  isLongPressing.value = false
  touchDragData.value = null
  dragOverIndex.value = -1
  isSequenceOver.value = false
  isDraggableOver.value = false

  // 清除位置指示
  clearDragPosition()
}

const handleTouchEnd = (event) => {
  if (!touchDragData.value) return

  // 清除长按定时器
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }

  if (isDragging.value) {
    const touch = event.changedTouches[0]
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY)

    if (elementBelow) {
      // 检查是否拖拽到序列列表
      const sequenceList = elementBelow.closest('.sequence-list')
      const scheduledSong = elementBelow.closest('.scheduled-song')
      const draggableSongs = elementBelow.closest('.draggable-songs')

      if (touchDragData.value.type === 'song' && (sequenceList || scheduledSong)) {
        // 从左侧拖拽到右侧
        handleTouchDropToSequence(scheduledSong)
        // 成功拖拽震动反馈
        if (navigator.vibrate) {
          navigator.vibrate([30, 50, 30])
        }
      } else if (touchDragData.value.type === 'schedule' && scheduledSong) {
        // 在右侧重新排序
        handleTouchReorder(scheduledSong)
        // 成功拖拽震动反馈
        if (navigator.vibrate) {
          navigator.vibrate([30, 50, 30])
        }
      } else if (touchDragData.value.type === 'schedule' && draggableSongs) {
        // 从右侧拖拽回左侧
        handleTouchReturnToDraggable()
        // 成功拖拽震动反馈
        if (navigator.vibrate) {
          navigator.vibrate([30, 50, 30])
        }
      }
    }
  }

  // 清理拖拽状态
  cleanupTouchDrag()
}

const handleTouchDropToSequence = async (targetElement) => {
  const song = touchDragData.value.item
  const existingIndex = localScheduledSongs.value.findIndex((s) => s.song.id === song.id)
  if (existingIndex !== -1) return

  let insertIndex = localScheduledSongs.value.length

  if (targetElement) {
    const scheduleId = parseInt(targetElement.dataset.scheduleId)
    const targetIndex = localScheduledSongs.value.findIndex((s) => s.id === scheduleId)
    if (targetIndex !== -1) {
      insertIndex = targetIndex
    }
  }

  // 直接添加到本地列表，不发送请求
  const newSchedule = {
    id: Date.now(),
    song: song,
    playDate: selectedDate.value,
    sequence: insertIndex + 1,
    isNew: true,
    isLocalOnly: true
  }

  scheduledSongIds.value.add(song.id)
  localScheduledSongs.value.splice(insertIndex, 0, newSchedule)

  // 更新序列号
  localScheduledSongs.value.forEach((item, idx) => {
    item.sequence = idx + 1
  })

  hasChanges.value = true
}

const handleTouchReorder = async (targetElement) => {
  const draggedSchedule = touchDragData.value.item
  const scheduleId = parseInt(targetElement.dataset.scheduleId)
  const draggedIndex = localScheduledSongs.value.findIndex((s) => s.id === draggedSchedule.id)
  const dropIndex = localScheduledSongs.value.findIndex((s) => s.id === scheduleId)

  if (draggedIndex === -1 || dropIndex === -1 || draggedIndex === dropIndex) return

  const newOrder = [...localScheduledSongs.value]
  const [draggedItem] = newOrder.splice(draggedIndex, 1)
  newOrder.splice(dropIndex, 0, draggedItem)

  newOrder.forEach((item, index) => {
    item.sequence = index + 1
  })

  localScheduledSongs.value = newOrder
  hasChanges.value = true
}

const handleTouchReturnToDraggable = async () => {
  const draggedSchedule = touchDragData.value.item
  const index = localScheduledSongs.value.findIndex((s) => s.id === draggedSchedule.id)

  if (index !== -1) {
    const removed = localScheduledSongs.value.splice(index, 1)[0]

    if (removed.song) {
      scheduledSongIds.value.delete(removed.song.id)
    }

    // 重新排序
    localScheduledSongs.value.forEach((item, idx) => {
      item.sequence = idx + 1
    })

    hasChanges.value = true
  }
}
</script>

<style scoped>
/* 隐藏滚动条但保留功能 */
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* 列表过渡动画 */
.schedule-list-move,
.schedule-list-enter-active,
.schedule-list-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.schedule-list-enter-from,
.schedule-list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.schedule-list-leave-active {
  position: absolute;
  width: 100%;
}
</style>
