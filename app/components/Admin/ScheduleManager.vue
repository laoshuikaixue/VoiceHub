<template>
  <div class="space-y-6 pb-24 md:pb-8">
    <!-- 日期选择器 -->
    <div class="relative bg-bg-secondary-50 border border-border-secondary-50 rounded-2xl p-1 overflow-hidden">
      <div class="flex items-center" @touchstart.stop>
        <button
          :disabled="isFirstDateVisible"
          class="p-2 text-text-tertiary hover:text-text-secondary disabled:opacity-30 transition-colors"
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
          class="flex-1 flex overflow-x-auto scrollbar-hide gap-2 px-2 py-1 overscroll-x-contain"
          style="overscroll-behavior-x: contain; touch-action: pan-x"
        >
          <button
            v-for="date in availableDates"
            :key="date.value"
            :data-date="date.value"
            :class="[
              'flex flex-col items-center justify-center min-w-[64px] h-16 rounded-lg transition-all duration-200 border',
              selectedDate === date.value
                ? 'bg-primary-hover border-primary text-text-primary shadow-lg shadow-[var(--primary-glow)]'
                : 'bg-bg-secondary border-border-secondary text-text-tertiary hover:bg-bg-tertiary hover:text-text-secondary hover:border-border-tertiary'
            ]"
            @click="handleDateSelect(date.value)"
          >
            <span class="text-[10px] font-bold uppercase tracking-wider opacity-80">{{
              date.weekday
            }}</span>
            <span class="text-lg font-black leading-none my-0.5">{{ date.day }}</span>
                  <span class="text-[9px] font-bold opacity-60">{{ callLocale('monthLabel', `${date.month}月`, date.month) }}</span>
          </button>
        </div>

        <button
          :disabled="isLastDateVisible"
          class="p-2 text-text-tertiary hover:text-text-secondary disabled:opacity-30 transition-colors"
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
        <div class="flex items-center border-l border-border-secondary ml-1 pl-1">
          <!-- 定位到今天 -->
          <button
            class="p-2 text-text-tertiary hover:text-success transition-colors"
            :title="locale.jumpToday"
            @click="scrollToToday"
          >
            <CircleDot class="w-5 h-5" />
          </button>

          <!-- 手动日期选择按钮 -->
          <button
            class="p-2 text-text-tertiary hover:text-primary transition-colors"
            :title="locale.selectSpecificDate"
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
      class="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary-60 backdrop-blur-sm"
    >
      <div
        class="bg-bg-secondary border border-border-secondary rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
        @click.stop
      >
        <div class="flex items-center justify-between p-4 border-b border-border-secondary">
          <h3 class="text-sm font-black text-text-primary uppercase tracking-widest">{{ locale.selectDate }}</h3>
          <button
            class="text-text-tertiary hover:text-text-secondary transition-colors"
            @click="showManualDatePicker = false"
          >
            <CloseIcon class="w-5 h-5" />
          </button>
        </div>
        <div class="p-6 space-y-6">
          <input
            v-model="manualSelectedDate"
            class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-primary transition-colors"
            type="date"
          />
          <div class="flex gap-3">
            <button
              class="flex-1 py-3 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-xl transition-colors uppercase tracking-wider"
              @click="showManualDatePicker = false"
            >
              {{ locale.cancel }}
            </button>
            <button
              class="flex-1 py-3 bg-primary-hover hover:bg-primary text-text-primary text-xs font-bold rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-colors uppercase tracking-wider"
              @click="confirmManualDate"
            >
              {{ locale.confirm }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 播出时段选择器 (如果启用) -->
    <div
      v-if="playTimeEnabled"
      class="flex items-center gap-3 bg-bg-secondary-30 border border-border-secondary rounded-lg p-3"
    >
      <CustomSelect
        :model-value="selectedPlayTime"
        :label="locale.playTime"
        :options="playTimeOptions"
        class-name="w-full"
        @update:model-value="handlePlayTimeSelect"
      />
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 min-h-[60vh]">
      <LoadingState :title="locale.loadingTitle" :message="locale.loadingMessage" />
    </div>

    <div v-else>
      <div
        class="lg:hidden sticky -top-4 -mx-4 -mt-4 z-20 flex p-1 bg-bg-primary-90 backdrop-blur-md border-b border-border-secondary shadow-xl mb-4 pt-4"
      >
        <button
          :class="[
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black uppercase tracking-widest transition-all',
            mobileTab === 'pending' ? 'bg-primary-hover text-text-primary shadow-lg' : 'text-text-tertiary'
          ]"
          @click="mobileTab = 'pending'"
        >
          <ListMusic class="w-4 h-4" />
          <span class="flex items-center gap-1.5"
            >{{ locale.pendingSongs }}
            <span class="px-1.5 py-0.5 bg-bg-tertiary text-[10px] rounded text-text-tertiary">{{
              filteredUnscheduledSongs.length
            }}</span></span
          >
        </button>
        <button
          :class="[
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black uppercase tracking-widest transition-all',
            mobileTab === 'scheduled' ? 'bg-primary-hover text-text-primary shadow-lg' : 'text-text-tertiary'
          ]"
          @click="mobileTab = 'scheduled'"
        >
          <PlaySquare class="w-4 h-4" />
          <span class="flex items-center gap-1.5"
            >{{ locale.playlist }}
            <span class="px-1.5 py-0.5 bg-bg-tertiary text-[10px] rounded text-text-tertiary">{{
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
            <h3 class="hidden lg:block text-lg font-black tracking-tight text-text-primary uppercase">
              {{ activeTab === 'pool' ? locale.poolList : locale.pendingSongs }}
            </h3>
            <div class="flex items-center gap-2 w-full lg:w-auto">
              <div
                class="flex flex-1 lg:flex-none gap-1 p-1 bg-bg-secondary-50 rounded-xl border border-border-secondary"
              >
                <button
                  v-for="tab in scheduleTabs"
                  :key="tab.id"
                  :class="[
                    'flex-1 lg:flex-none px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                    activeTab === tab.id
                      ? 'bg-bg-tertiary text-primary shadow-md border border-primary-20'
                      : 'text-text-disabled hover:text-text-tertiary'
                  ]"
                  @click="activeTab = tab.id"
                >
                  {{ tab.label }}
                </button>
              </div>
              <button
                class="hidden lg:flex p-1.5 bg-bg-secondary-50 rounded-lg border border-border-secondary text-text-tertiary hover:text-info hover:border-info-30 transition-all group relative disabled:opacity-50 disabled:cursor-not-allowed"
                v-if="activeTab === 'normal' || activeTab === 'all' || activeTab === 'replay'"
                :disabled="filteredUnscheduledSongs.filter((song) => !poolSongIds.has(song.id)).length === 0"
                :title="locale.addCurrentPage"
                @click="moveAllToPool"
              >
                <FolderPlus class="w-3.5 h-3.5" />
              </button>
              <button
                class="hidden lg:flex items-center justify-center gap-1 p-1.5 bg-bg-secondary-50 rounded-lg border border-border-secondary text-text-tertiary hover:text-primary hover:border-primary-30 transition-all group relative overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed"
                :disabled="refreshingAllDurations.running"
                :title="refreshingAllDurations.running ? `${locale.refreshPageDurations} (${refreshingAllDurations.progress})` : locale.refreshPageDurations"
                @click="refreshAllDurations"
              >
                <RefreshCcw
                  class="w-3.5 h-3.5"
                  :class="{ 'animate-spin': refreshingAllDurations.running }"
                />
                <span
                  v-if="refreshingAllDurations.running"
                  class="text-[9px] font-bold tabular-nums whitespace-nowrap"
                >{{ refreshingAllDurations.done }}/{{ refreshingAllDurations.total }}</span>
                <span
                  v-if="refreshingAllDurations.running"
                  class="absolute inset-x-0 bottom-0 h-0.5 bg-bg-tertiary"
                >
                  <span
                    class="block h-full bg-primary transition-[width] duration-300"
                    :style="{ width: `${refreshingAllDurations.total > 0 ? Math.round((refreshingAllDurations.done / refreshingAllDurations.total) * 100) : 0}%` }"
                  />
                </span>
              </button>
            </div>
          </div>

          <!-- 筛选区 - 移动端折叠 -->
          <div class="bg-bg-secondary-40 border border-border-secondary rounded-2xl shadow-xl">
            <div
              class="p-4 flex items-center justify-between lg:hidden border-b border-border-secondary-50 rounded-t-2xl"
              @click="mobileFiltersOpen = !mobileFiltersOpen"
            >
              <div class="flex items-center gap-2 text-text-tertiary">
                <Filter class="w-3.5 h-3.5" />
                <span class="text-[11px] font-black uppercase tracking-widest">{{ locale.searchAndFilter }}</span>
              </div>
              <ChevronRight
                :class="[
                  'w-3.5 h-3.5 text-text-secondary transition-transform duration-300',
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
                  class="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary w-3.5 h-3.5"
                />
                <input
                  v-model="searchQuery"
                  type="text"
                  :placeholder="locale.searchPlaceholder"
                  class="w-full pl-9 pr-4 py-2 bg-bg-primary border border-border-secondary rounded-xl text-xs focus:outline-none focus:border-primary-30 transition-all text-text-primary"
                />
                <button
                  v-if="searchQuery"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-tertiary"
                  @click="searchQuery = ''"
                >
                  <CloseIcon class="w-3.5 h-3.5" />
                </button>
              </div>
              <div class="grid grid-cols-1 gap-2">
                <CustomSelect
                  :model-value="selectedSemester"
                  :label="locale.currentSemester"
                  :options="availableSemesters"
                  label-key="name"
                  value-key="id"
                  @update:model-value="handleSemesterSelect"
                />
                <CustomSelect
                  v-if="playTimeEnabled"
                  v-model="selectedFilterPlayTime"
                  :label="locale.preferredTime"
                  :options="filterPlayTimeOptions"
                  label-key="label"
                  value-key="value"
                />
                <div class="grid grid-cols-2 gap-2">
                  <CustomSelect
                    v-model="selectedGrade"
                    :label="locale.grade"
                    :options="availableGrades"
                    label-key="label"
                    value-key="value"
                  />
                  <CustomSelect v-model="songSortOption" :label="locale.sort" :options="sortOptions" />
                </div>
                <button
                  class="flex items-center justify-center gap-2 w-full px-4 py-2 bg-bg-primary border border-border-secondary hover:border-primary-30 hover:text-primary rounded-xl text-xs focus:outline-none transition-all text-text-secondary"
                  :class="{
                    'border-primary-50 text-primary bg-primary-10': isPlaylistFilterActive
                  }"
                  @click="showPlaylistFilterModal = true"
                >
                  <ListMusic class="w-3.5 h-3.5" />
                  <span>{{ isPlaylistFilterActive ? locale.playlistFilterApplied : locale.playlistFilter }}</span>
                </button>
              </div>
            </div>
          </div>

          <div
            :class="[
              'draggable-songs flex-1 border-2 border-dashed rounded-[2rem] p-2 md:p-3 min-h-[400px] transition-colors duration-200',
              isDraggableOver
                ? 'border-primary bg-primary-5'
                : 'border-border-secondary-80 bg-bg-secondary-20'
            ]"
          >
            <div class="space-y-2">
              <div
                v-for="song in filteredUnscheduledSongs"
                :key="song.id"
                :class="[
                  'draggable-song relative group rounded-xl p-3 transition-all select-none',
                  song.cardCodeId
                    ? 'bg-warning-5 border border-warning-30'
                    : 'bg-bg-secondary border border-border-secondary-50 hover:border-border-tertiary'
                ]"
                :draggable="true"
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
                    class="relative w-12 h-12 rounded-lg overflow-hidden bg-bg-tertiary flex-shrink-0 border border-border-tertiary-50 cursor-pointer hover:opacity-80 transition-opacity"
                    @click.stop="playSong(song)"
                  >
                    <img
                      v-if="song.cover"
                      :src="convertToHttps(song.cover)"
                      class="w-full h-full object-cover"
                      referrerpolicy="no-referrer"
                      loading="lazy"
                      alt=""
                    />
                    <div
                      v-else
                      class="w-full h-full flex items-center justify-center text-text-disabled"
                    >
                      <Music2 class="w-6 h-6 opacity-50" />
                    </div>
                  </div>

                  <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div class="flex items-center gap-2 min-w-0">
                      <h4
                        class="font-bold text-text-primary text-sm truncate flex items-center gap-2 min-w-0"
                      >
                        <span
                          v-if="isBilibiliSong(song)"
                          class="text-text-primary flex items-center gap-1 text-left truncate"
                        >
                          <span class="truncate">{{ song.title }}</span>
                        </span>
                        <span v-else class="truncate">{{ song.title }}</span>

                        <!-- 歌单来源标签 -->
                        <span
                          v-if="isPlaylistFilterActive && playlistNamesMap[song.musicId]"
                          class="flex items-center gap-1 flex-shrink-0"
                        >
                          <span
                            v-for="(playlistName, idx) in playlistNamesMap[song.musicId]"
                            :key="idx"
                            class="px-1.5 py-[2px] bg-primary-10 text-primary rounded text-[9px] border border-primary-20 truncate max-w-[100px] font-normal leading-none"
                            :title="playlistName"
                          >
                            {{ playlistName }}
                          </span>
                        </span>
                      </h4>
                      <button
                        v-if="song.hasSubmissionNote && song.submissionNote"
                        class="inline-flex items-center justify-center w-5 h-5 rounded-full border border-primary-30 bg-primary-10 text-primary hover:bg-primary-20 transition-all flex-shrink-0"
                        :title="locale.viewRemark"
                        @click.stop="openSubmissionRemark(song)"
                      >
                        <MessageSquare :size="12" />
                      </button>
                      <span
                        v-if="song.cardCodeId"
                        class="inline-flex items-center rounded-md border border-warning-20 bg-warning-10 px-1.5 py-0.5 text-[9px] font-bold text-warning whitespace-nowrap flex-shrink-0"
                        :title="locale.cardPending"
                      >
                        {{ locale.cardPending }}
                      </span>
                      <span
                        v-if="song.hasSubmissionNote && song.submissionNote"
                        class="text-xs text-primary-80 truncate max-w-[150px] cursor-pointer hover:text-primary transition-colors"
                        :title="locale.viewRemark"
                        @click.stop="openSubmissionRemark(song)"
                      >
                        {{
                          song.submissionNote.length > 25
                            ? song.submissionNote.substring(0, 25) + '...'
                            : song.submissionNote
                        }}
                      </span>
                    </div>
                    <div class="text-xs text-text-tertiary truncate flex items-center gap-1.5">
                      <span>{{ song.artist }}</span>
                      <!-- 时长显示 / 行内编辑 -->
                      <span
                        v-if="song.durationSeconds && !editingDuration[song.id]"
                        :class="[
                          'shrink-0 px-1 rounded transition-colors cursor-pointer',
                          durationRefreshStatus[song.id] === 'success'
                            ? 'text-success bg-success-10'
                            : durationRefreshStatus[song.id] === 'error'
                              ? 'text-error bg-error-10'
                              : 'text-text-disabled hover:text-text-secondary hover:bg-bg-quaternary'
                        ]"
                        :title="locale.messages?.editDuration || '点击编辑时长'"
                        @click.stop="startEditDuration(song)"
                      >{{ formatDuration(song.durationSeconds) }}</span>
                      <input
                        v-else-if="editingDuration[song.id]"
                        ref="editingDurationInput"
                        v-model="editingDurationValue"
                        type="text"
                        inputmode="text"
                        pattern="[0-9:]*"
                        class="w-20 text-[11px] font-mono text-center bg-bg-primary border border-primary rounded px-1 py-0.5 text-text-primary focus:outline-none focus:border-primary shrink-0"
                        :placeholder="locale.messages?.durationInputPlaceholder || '分:秒'"
                        @focusout="saveDurationEdit(song)"
                        @keydown="handleDurationKeydown($event, song)"
                      >
                    </div>
                    <div class="text-[10px] text-text-tertiary truncate flex items-center gap-1">
                      <span>{{ song.requester }}</span>
                      <span v-if="song.requesterGrade || song.grade" class="text-text-disabled">|</span>
                      <span v-if="song.requesterGrade || song.grade">
                        {{ song.requesterGrade || song.grade }}
                        {{ song.requesterClass || song.class }}
                      </span>
                      <span
                        v-if="song.preferredPlayTimeId"
                        class="ml-1 px-1.5 py-0.5 bg-info-10 text-info rounded text-[9px] border border-info-20 whitespace-nowrap"
                      >
                        {{ callLocale('preferredPlayTime', `期望: ${getPlayTimeName(song.preferredPlayTimeId)}`, getPlayTimeName(song.preferredPlayTimeId)) }}
                      </span>
                      <span
                        v-if="activeTab === 'pool' && song.addedByName"
                        class="ml-1 px-1.5 py-0.5 bg-primary-10 text-primary rounded text-[9px] border border-primary-20 whitespace-nowrap"
                      >
                        {{ locale.addedBy }} {{ song.addedByName }}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <!-- 普通模式：投票数 -->
                    <div
                      v-if="activeTab !== 'replay'"
                      class="flex items-center gap-1 text-[10px] font-bold text-text-tertiary bg-bg-primary-50 px-2 py-1 rounded-md border border-border-secondary-50"
                    >
                      <Heart class="w-3 h-3 text-error-50" />
                      {{ song.voteCount || 0 }}
                    </div>

                    <!-- 重播模式：查看按钮 -->
                    <button
                      v-if="activeTab === 'replay'"
                      class="px-3 py-1.5 rounded-lg bg-primary-10 hover:bg-primary-20 text-primary border border-primary-20 text-[10px] font-bold transition-colors"
                      @click.stop="openReplayModal(song)"
                    >
                      {{ locale.view }}
                    </button>

                    <!-- 重播模式：拒绝按钮（仅移动端） -->
                    <button
                      v-if="activeTab === 'replay'"
                      class="lg:hidden p-1.5 rounded-lg bg-error-10 hover:bg-error-20 text-error border border-error-20 transition-colors flex items-center justify-center"
                      :title="locale.rejectRequest"
                      @click.stop="rejectReplayRequest(song.id)"
                    >
                      <CloseIcon class="w-3.5 h-3.5" />
                    </button>

                    <!-- 待排库：加入备选池按钮 -->
                    <button
                      v-if="activeTab === 'normal' || activeTab === 'all' || activeTab === 'replay'"
                      class="hidden lg:flex p-1.5 rounded-lg bg-info-10 border border-info-20 text-info hover:bg-info-20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-info-10"
                      :disabled="poolSongIds.has(song.id)"
                      :title="poolSongIds.has(song.id) ? locale.alreadyInPool : locale.addSingleToPool"
                      @click.stop="addSingleToPool(song.id)"
                    >
                      <FolderPlus class="w-3.5 h-3.5" />
                    </button>

                    <!-- 备选池：移除按钮（桌面） -->
                    <button
                      v-if="activeTab === 'pool'"
                      class="hidden lg:flex p-1.5 rounded-lg bg-error-10 border border-error-20 text-error hover:bg-error-20 transition-colors"
                      :title="locale.removeFromPool"
                      @click.stop="removeFromPool(song.songId)"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>

                    <!-- 移动端加入备选池按钮 -->
                    <button
                      class="flex items-center justify-center lg:hidden p-2 rounded-full bg-info-10 text-info hover:bg-info-20 active:scale-95 transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      v-if="activeTab === 'normal' || activeTab === 'all' || activeTab === 'replay'"
                      :disabled="poolSongIds.has(song.id)"
                      :title="poolSongIds.has(song.id) ? locale.alreadyInPool : locale.addSingleToPool"
                      @click.stop="addSingleToPool(song.id)"
                    >
                      <FolderPlus class="w-5 h-5" />
                    </button>

                    <!-- 备选池：加入排期按钮 -->
                    <button
                      class="flex items-center justify-center lg:hidden p-2 rounded-full bg-primary-hover-20 text-primary hover:bg-primary-hover-30 active:scale-95 transition-all flex-shrink-0"
                      v-if="activeTab === 'pool'"
                      :title="locale.addToSchedule"
                      @click.stop="addSongToSchedule(song)"
                    >
                      <Plus class="w-5 h-5" />
                    </button>

                    <!-- 备选池：移除按钮（移动端） -->
                    <button
                      class="flex items-center justify-center lg:hidden p-2 rounded-full bg-error-20 text-error hover:bg-error-30 active:scale-95 transition-all flex-shrink-0"
                      v-if="activeTab === 'pool'"
                      :title="locale.removeFromPool"
                      @click.stop="removeFromPool(song.songId)"
                    >
                      <Trash2 class="w-5 h-5" />
                    </button>

                    <!-- 非备选池：加入排期按钮（移动端） -->
                    <button
                      class="flex items-center justify-center lg:hidden p-2 rounded-full bg-primary-hover-20 text-primary hover:bg-primary-hover-30 active:scale-95 transition-all flex-shrink-0"
                      v-if="activeTab !== 'pool'"
                      :title="locale.addToSchedule"
                      @click.stop="addSongToSchedule(song)"
                    >
                      <Plus class="w-5 h-5" />
                    </button>

                    <!-- 刷新时长按钮 -->
                    <button
                      class="p-1.5 rounded-lg bg-bg-primary border border-border-secondary text-text-disabled hover:text-primary transition-colors"
                      :title="locale.refreshDuration"
                      :disabled="refreshingDuration[song.id]"
                      @click.stop="refreshDuration(song)"
                    >
                      <RefreshCcw class="w-3.5 h-3.5" :class="{ 'animate-spin': refreshingDuration[song.id] }" />
                    </button>

                    <!-- 菜单按钮 -->
                    <button
                      type="button"
                      class="p-1.5 rounded-lg bg-bg-primary border border-border-secondary text-text-disabled hover:text-text-tertiary transition-colors"
                      @click="openContextMenu($event, 'left', song)"
                    >
                      <MoreVertical class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- 空状态 -->
              <div
                v-if="filteredUnscheduledSongs.length === 0"
                class="h-[300px] flex flex-col items-center justify-center text-text-primary"
              >
                <div v-if="searchQuery" class="flex flex-col items-center">
                  <Search class="w-8 h-8 mb-2 opacity-20" />
                  <p class="text-[10px] font-black uppercase tracking-widest">{{ locale.emptySearch }}</p>
                </div>
                <div v-else-if="activeTab === 'pool'" class="flex flex-col items-center">
                  <FolderPlus class="w-8 h-8 mb-2 opacity-20" />
                  <p class="text-[10px] font-black uppercase tracking-widest">{{ locale.poolEmptyHint }}</p>
                </div>
                <div v-else class="flex flex-col items-center">
                  <ListMusic class="w-8 h-8 mb-2 opacity-20" />
                  <p class="text-[10px] font-black uppercase tracking-widest">{{ locale.emptySongs }}</p>
                </div>
              </div>
            </div>

            <!-- 分页 -->
            <Pagination
              v-model:current-page="currentPage"
              :total-pages="totalPages"
              :total-items="allUnscheduledSongs.length"
              :item-name="activeTab === 'pool' ? locale.poolItemName : locale.pendingSongItemName"
            />
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
            <div class="flex items-baseline gap-3">
              <h3 class="text-lg font-black tracking-tight text-text-primary uppercase">{{ locale.playOrder }}</h3>
              <span v-show="scheduledTotalDuration > 0" class="flex items-baseline gap-1.5 text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                {{ locale.expectedTotalDuration }}
                <span class="text-sm font-black text-primary">{{ formatDuration(scheduledTotalDuration) }}</span>
              </span>
            </div>
            <div
              class="flex flex-wrap items-center gap-2 p-1.5 bg-bg-secondary-50 border border-border-secondary-50 rounded-2xl"
            >
              <div class="flex gap-1">
                <button
                  :disabled="
                    !hasChanges && localScheduledSongs.length === 0 && !hasUnpublishedDrafts
                  "
                  class="flex items-center justify-center p-2 bg-bg-primary border border-border-secondary hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary rounded-xl transition-all group relative disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="saveDraft"
                >
                  <Save class="w-3.5 h-3.5" />
                  <span
                    class="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-bg-tertiary text-[9px] text-text-secondary rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-tertiary"
                    >{{ locale.saveDraft }}</span
                  >
                </button>
                <button
                  :disabled="localScheduledSongs.length === 0"
                  class="flex items-center justify-center p-2 bg-bg-primary border border-border-secondary hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary rounded-xl transition-all group relative disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="openDownloadDialog"
                >
                  <Download class="w-3.5 h-3.5" />
                  <span
                    class="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-bg-tertiary text-[9px] text-text-secondary rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-tertiary"
                    >{{ locale.downloadSongs }}</span
                  >
                </button>
                <button
                  :disabled="localScheduledSongs.length === 0"
                  class="flex items-center justify-center p-2 bg-bg-primary border border-border-secondary hover:bg-bg-tertiary text-text-tertiary hover:text-success rounded-xl transition-all group relative disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="markAllAsPlayed"
                >
                  <CheckCircle2 class="w-3.5 h-3.5" />
                  <span
                    class="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-bg-tertiary text-[9px] text-text-secondary rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-tertiary"
                    >{{ locale.markAllPlayed }}</span
                  >
                </button>
                <button
                  :disabled="refreshingAllDurations.running"
                  class="flex items-center justify-center p-2 bg-bg-primary border border-border-secondary hover:bg-bg-tertiary text-text-tertiary hover:text-primary rounded-xl transition-all group relative disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="refreshAllDurations('scheduled')"
                >
                  <RefreshCcw
                    class="w-3.5 h-3.5"
                    :class="{ 'animate-spin': refreshingAllDurations.running }"
                  />
                  <span
                    class="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-bg-tertiary text-[9px] text-text-secondary rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-tertiary"
                    >{{ locale.refreshPageDurations }}{{
                      refreshingAllDurations.running
                        ? ` (${refreshingAllDurations.progress})`
                        : ''
                    }}</span
                  >
                </button>
                <button
                  :disabled="autoScheduleCandidates.length === 0"
                  class="flex items-center justify-center p-2 bg-bg-primary border border-border-secondary hover:bg-bg-tertiary text-text-tertiary hover:text-primary rounded-xl transition-all group relative disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="openAutoScheduleDialog"
                >
                  <Sparkles class="w-3.5 h-3.5" />
                  <span
                    class="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-bg-tertiary text-[9px] text-text-secondary rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-tertiary"
                    >{{ locale.autoSchedule }}</span
                  >
                </button>
                <button
                  class="flex items-center justify-center p-2 bg-bg-primary border border-border-secondary hover:bg-bg-tertiary text-text-tertiary hover:text-info rounded-xl transition-all group relative"
                  @click="openMoveDateDialog"
                >
                  <ArrowRight class="w-3.5 h-3.5" />
                  <span
                    class="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-bg-tertiary text-[9px] text-text-secondary rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-tertiary"
                    >{{ locale.moveDate }}</span
                  >
                </button>
                <button
                  class="flex items-center justify-center p-2 bg-bg-primary border border-border-secondary hover:bg-bg-tertiary text-text-tertiary hover:text-primary rounded-xl transition-all group relative"
                  @click="openCopyDateDialog"
                >
                  <Copy class="w-3.5 h-3.5" />
                  <span
                    class="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-bg-tertiary text-[9px] text-text-secondary rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-tertiary"
                    >{{ locale.copyDate }}</span
                  >
                </button>
                <button
                  :disabled="localScheduledSongs.length === 0"
                  class="flex items-center justify-center p-2 bg-bg-primary border border-border-secondary hover:bg-bg-tertiary text-text-tertiary hover:text-error rounded-xl transition-all group relative disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="clearScheduleList"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  <span
                    class="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-bg-tertiary text-[9px] text-text-secondary rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-tertiary"
                    >{{ locale.clearList }}</span
                  >
                </button>
              </div>
              <div class="h-6 w-[1px] bg-bg-tertiary mx-1" />
              <button
                :disabled="!canPublish"
                class="flex items-center gap-2 px-4 py-2 bg-success-10 hover:bg-success-20 text-success text-[10px] font-black rounded-xl border border-success-20 transition-all uppercase tracking-widest active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                @click="publishSchedule"
              >
                <Send class="w-3 h-3" /> {{ locale.publishSchedule }}
              </button>
              <button
                :disabled="!hasChanges"
                class="flex items-center gap-2 px-5 py-2 bg-primary-hover hover:bg-primary text-text-primary text-[10px] font-black rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all uppercase tracking-widest active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                @click="saveSequence"
              >
                <FileBadge class="w-3.5 h-3.5" /> {{ locale.saveAndPublish }}
              </button>
            </div>
          </div>

          <div
            ref="sequenceList"
            :class="[
              'sequence-list flex-1 border-2 border-dashed rounded-[2rem] p-2 md:p-3 min-h-[400px] transition-colors duration-200',
              isSequenceOver ? 'border-primary bg-primary-5' : 'border-border-secondary-80 bg-bg-secondary-20'
            ]"
            @dragleave="handleSequenceDragLeave"
            @dragover.prevent="handleDragOver"
            @dragenter.prevent="isSequenceOver = true"
            @drop.stop.prevent="dropToSequence"
          >
            <div
              v-if="localScheduledSongs.length === 0"
              class="flex flex-col items-center justify-center h-full py-12 text-text-primary"
            >
              <PlaySquare class="w-8 h-8 mb-4 opacity-20" />
              <p class="text-[10px] font-black uppercase tracking-widest">{{ locale.addSongsHint }}</p>
            </div>

            <TransitionGroup class="space-y-2" name="schedule-list" tag="div">
              <div
                v-for="(schedule, index) in localScheduledSongs"
                :key="schedule.id"
                :class="[
                  'scheduled-song relative group bg-bg-secondary border border-border-secondary-50 rounded-xl p-3 hover:border-border-tertiary transition-all select-none',
                  dragOverIndex === index ? 'border-t-2 border-t-primary' : '',
                  schedule.isDraft ? 'border-warning-30 bg-warning-5' : '',
                  schedule.song && (schedule.song.cardCodeId || schedule.song.usedCardCode)
                    ? 'border-warning-30 bg-warning-5'
                    : ''
                ]"
                :data-schedule-id="schedule.id"
                :draggable="true"
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
                    class="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-bg-primary-50 border border-border-secondary text-text-tertiary font-black text-xs flex-shrink-0"
                  >
                    <span class="text-[8px] text-text-disabled uppercase leading-none mb-0.5">{{ locale.positionShort }}</span>
                    <span class="text-sm text-text-secondary leading-none">{{
                      index + 1 < 10 ? '0' + (index + 1) : index + 1
                    }}</span>
                  </div>

                  <!-- 封面图片 -->
                  <div
                    class="relative w-10 h-10 rounded-lg overflow-hidden bg-bg-tertiary flex-shrink-0 border border-border-tertiary-50 cursor-pointer hover:opacity-80 transition-opacity"
                    @click.stop="playSong(schedule.song)"
                  >
                    <img
                      v-if="schedule.song.cover"
                      :src="convertToHttps(schedule.song.cover)"
                      class="w-full h-full object-cover"
                      referrerpolicy="no-referrer"
                      loading="lazy"
                      alt=""
                    />
                    <div
                      v-else
                      class="w-full h-full flex items-center justify-center text-text-disabled"
                    >
                      <Music2 class="w-5 h-5 opacity-50" />
                    </div>
                  </div>

                  <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div class="flex items-center gap-2 min-w-0">
                      <h4 class="font-bold text-text-primary text-sm truncate min-w-0">
                        {{ schedule.song.title }}
                      </h4>
                      <button
                        v-if="schedule.song.hasSubmissionNote && schedule.song.submissionNote"
                        class="inline-flex items-center justify-center w-5 h-5 rounded-full border border-primary-30 bg-primary-10 text-primary hover:bg-primary-20 transition-all flex-shrink-0"
                        :title="locale.viewRemark"
                        @click.stop="openSubmissionRemark(schedule.song, schedule.replayRequestId)"
                      >
                        <MessageSquare :size="12" />
                      </button>
                      <span
                        v-if="schedule.song.hasSubmissionNote && schedule.song.submissionNote"
                        class="text-xs text-primary-80 truncate max-w-[150px] cursor-pointer hover:text-primary transition-colors"
                        :title="locale.viewRemark"
                        @click.stop="openSubmissionRemark(schedule.song, schedule.replayRequestId)"
                      >
                        {{
                          schedule.song.submissionNote.length > 25
                            ? schedule.song.submissionNote.substring(0, 25) + '...'
                            : schedule.song.submissionNote
                        }}
                      </span>
                      <!-- 重播标识 -->
                      <span
                        v-if="schedule.replayRequestId != null"
                        class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary-10 text-primary border border-primary-20 uppercase tracking-wider whitespace-nowrap flex-shrink-0 flex items-center gap-1"
                        :title="locale.replaySong"
                      >
                        <Icon name="repeat" :size="10" class-name="flex-shrink-0" />{{ locale.replay }}
                      </span>
                      <span
                        v-if="schedule.isDraft"
                        class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning-10 text-warning border border-warning-20 uppercase tracking-wider whitespace-nowrap flex-shrink-0"
                        >{{ locale.draft }}</span
                      >
                      <!-- 点歌券徽章（已使用点歌券投稿的歌曲在排期中高亮显示） -->
                      <span
                        v-if="schedule.song.cardCodeId || schedule.song.usedCardCode"
                        class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning-10 text-warning border border-warning-20 uppercase tracking-wider whitespace-nowrap flex-shrink-0"
                        :title="locale.cardPending"
                      >
                        {{ locale.cardCode }}
                      </span>
                    </div>
                    <div class="text-xs text-text-tertiary truncate flex items-center gap-1.5">
                      <span>{{ schedule.song.artist }}</span>
                      <span
                        v-if="schedule.song.durationSeconds && !editingDuration[schedule.song.id]"
                        :class="[
                          'shrink-0 px-1 rounded transition-colors cursor-pointer',
                          durationRefreshStatus[schedule.song.id] === 'success'
                            ? 'text-success bg-success-10'
                            : durationRefreshStatus[schedule.song.id] === 'error'
                              ? 'text-error bg-error-10'
                              : 'text-text-disabled hover:text-text-secondary hover:bg-bg-quaternary'
                        ]"
                        :title="locale.messages?.editDuration || '点击编辑时长'"
                        @click.stop="startEditDuration(schedule.song)"
                      >{{ formatDuration(schedule.song.durationSeconds) }}</span>
                      <input
                        v-else-if="editingDuration[schedule.song.id]"
                        ref="editingDurationInput"
                        v-model="editingDurationValue"
                        type="text"
                        inputmode="text"
                        pattern="[0-9:]*"
                        class="w-20 text-[11px] font-mono text-center bg-bg-primary border border-primary rounded px-1 py-0.5 text-text-primary focus:outline-none focus:border-primary shrink-0"
                        :placeholder="locale.messages?.durationInputPlaceholder || '分:秒'"
                        @focusout="saveDurationEdit(schedule.song)"
                        @keydown="handleDurationKeydown($event, schedule.song)"
                      >
                    </div>
                    <div class="text-[10px] text-text-tertiary truncate flex items-center gap-1">
                      <span
                        v-if="schedule.replayRequestId != null"
                        :title="
                          (locale.replayApplicants || '重播申请人：') +
                          (schedule.song.replayRequesters || [])
                            .map((r) => r.displayName || r.name)
                            .join('、')
                        "
                      >
                        {{ locale.applicant }}{{
                          (schedule.song.replayRequesters || [])
                            .slice(0, 2)
                            .map((r) => r.displayName || r.name)
                            .join('、')
                        }}{{
                          schedule.song.replayRequestCount > 2
                            ? locale.andMoreApplicants(schedule.song.replayRequestCount)
                            : ''
                        }}
                      </span>
                      <span v-else>{{ schedule.song.requester }}</span>
                      <span
                        v-if="schedule.song.requesterGrade || schedule.song.grade"
                        class="text-text-disabled"
                        >|</span
                      >
                      <span v-if="schedule.song.requesterGrade || schedule.song.grade">
                        {{ schedule.song.requesterGrade || schedule.song.grade }}
                        {{ schedule.song.requesterClass || schedule.song.class }}
                      </span>
                      <span
                        v-if="schedule.song.preferredPlayTimeId"
                        class="ml-1 px-1.5 py-0.5 bg-info-10 text-info rounded text-[9px] border border-info-20 whitespace-nowrap"
                      >
                        {{ callLocale('preferredPlayTime', `期望: ${getPlayTimeName(schedule.song.preferredPlayTimeId)}`, getPlayTimeName(schedule.song.preferredPlayTimeId)) }}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      v-if="schedule.isDraft"
                      class="p-1.5 rounded-lg bg-success-10 hover:bg-success-20 text-success border border-success-20 transition-colors"
                      :title="locale.publishThisDraft"
                      @click="publishSingleDraft(schedule)"
                    >
                      <Send class="w-3.5 h-3.5" />
                    </button>

                    <!-- 移动端删除按钮 -->
                    <button
                      class="lg:hidden p-2 rounded-full bg-error-20 text-error hover:bg-error-30 active:scale-95 transition-all flex-shrink-0 flex items-center justify-center"
                      @click.stop="removeSongFromSchedule(schedule)"
                    >
                      <Minus class="w-5 h-5" />
                    </button>

                    <!-- 刷新时长按钮 -->
                    <button
                      class="p-1.5 rounded-lg bg-bg-primary border border-border-secondary text-text-disabled hover:text-primary hover:border-primary-30 transition-all duration-200"
                      :class="{
                        'bg-primary-10 border-primary-30 text-primary shadow-[0_0_0_3px_var(--primary-glow)]': refreshingDuration[schedule.song.id]
                      }"
                      :title="locale.refreshDuration"
                      :disabled="refreshingDuration[schedule.song.id]"
                      @click.stop="refreshDuration(schedule.song)"
                    >
                      <RefreshCcw class="w-3.5 h-3.5" :class="{ 'animate-spin': refreshingDuration[schedule.song.id] }" />
                    </button>

                    <button
                      type="button"
                      class="p-1.5 rounded-lg bg-bg-primary border border-border-secondary text-text-disabled hover:text-text-tertiary transition-colors"
                      @click="openContextMenu($event, 'right', schedule)"
                    >
                      <MoreVertical class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </TransitionGroup>
          </div>
        </div>
      </div>

      <!-- 移动端底部操作栏 -->
      <div
        class="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-bg-primary-90 backdrop-blur-xl border-t border-border-secondary flex items-center gap-3 pb-6"
      >
        <div class="w-[148px] overflow-x-auto scrollbar-hide">
          <div class="flex items-center gap-2 w-max">
            <button
              class="w-11 h-11 shrink-0 bg-bg-secondary border border-border-secondary text-text-tertiary rounded-xl flex items-center justify-center active:scale-95 transition-all"
              @click="openDownloadDialog"
            >
              <Download class="w-5 h-5" />
            </button>
            <button
              class="w-11 h-11 shrink-0 bg-bg-secondary border border-border-secondary text-text-tertiary rounded-xl flex items-center justify-center active:scale-95 transition-all"
              @click="saveDraft"
            >
              <Save class="w-5 h-5" />
            </button>
            <button
              class="w-11 h-11 shrink-0 bg-bg-secondary border border-border-secondary text-success rounded-xl flex items-center justify-center active:scale-95 transition-all"
              @click="markAllAsPlayed"
            >
              <CheckCircle2 class="w-5 h-5" />
            </button>
            <button
              class="w-11 h-11 shrink-0 bg-bg-secondary border border-border-secondary text-info rounded-xl flex items-center justify-center active:scale-95 transition-all"
              @click="openMoveDateDialog"
            >
              <ArrowRight class="w-5 h-5" />
            </button>
            <button
              class="w-11 h-11 shrink-0 bg-bg-secondary border border-border-secondary text-primary rounded-xl flex items-center justify-center active:scale-95 transition-all"
              @click="openCopyDateDialog"
            >
              <Copy class="w-5 h-5" />
            </button>
            <button
              class="w-11 h-11 shrink-0 bg-bg-secondary border border-border-secondary text-error rounded-xl flex items-center justify-center active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="localScheduledSongs.length === 0"
              @click="clearScheduleList"
            >
              <Trash2 class="w-5 h-5" />
            </button>
            <button
              class="w-11 h-11 shrink-0 bg-bg-secondary border border-border-secondary text-info rounded-xl flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              v-if="activeTab === 'normal' || activeTab === 'all' || activeTab === 'replay'"
              :disabled="filteredUnscheduledSongs.filter((song) => !poolSongIds.has(song.id)).length === 0"
              :title="locale.addCurrentPage"
              @click="moveAllToPool"
            >
              <FolderPlus class="w-5 h-5" />
            </button>
            <button
              class="w-11 h-11 shrink-0 bg-bg-secondary border border-border-secondary text-primary rounded-xl flex items-center justify-center active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!canPublish"
              :title="locale.publishOnly"
              @click="publishSchedule"
            >
              <Send class="w-5 h-5" />
            </button>
            <button
              class="w-11 h-11 shrink-0 bg-bg-secondary border border-border-secondary text-primary rounded-xl flex items-center justify-center active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="refreshingAllDurations.running"
              :title="refreshingAllDurations.running ? `${locale.refreshPageDurations} (${refreshingAllDurations.progress})` : locale.refreshPageDurations"
              @click="refreshAllDurations"
            >
              <RefreshCcw class="w-5 h-5" :class="{ 'animate-spin': refreshingAllDurations.running }" />
            </button>
            <button
              class="w-11 h-11 shrink-0 bg-bg-secondary border border-border-secondary text-primary rounded-xl flex items-center justify-center active:scale-95 transition-all"
              :title="locale.autoSchedule"
              @click="openAutoScheduleDialog"
            >
              <Sparkles class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- 主要操作 -->
        <button
          :disabled="!hasChanges"
          class="flex-1 py-3 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          @click="saveSequence"
        >
          <FileBadge class="w-4 h-4" /> {{ locale.saveAndPublish }}
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
    :cancel-text="locale.cancel"
    @close="showConfirmDialog = false"
    @confirm="handleConfirm"
  />

  <!-- 下载对话框 -->
  <SongDownloadDialog
    :show="showDownloadDialog"
    :songs="localScheduledSongs"
    @close="showDownloadDialog = false"
  />

  <div
    v-if="showMoveDateDialog"
    class="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary-60 backdrop-blur-sm"
  >
    <div
      class="bg-bg-secondary border border-border-secondary rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
      @click.stop
    >
      <div class="flex items-center justify-between p-4 border-b border-border-secondary">
        <h3 class="text-sm font-black text-text-primary uppercase tracking-widest">{{ locale.moveDateTitle }}</h3>
        <button
          class="text-text-tertiary hover:text-text-secondary transition-colors"
          @click="showMoveDateDialog = false"
        >
          <CloseIcon class="w-5 h-5" />
        </button>
      </div>
      <div class="p-6 space-y-4">
          <div class="text-xs text-text-tertiary">{{ locale.currentDate(selectedDate) }}</div>
        <input
          v-model="moveTargetDate"
          class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-info transition-colors"
          type="date"
        />
        <div class="flex gap-3">
          <button
            class="flex-1 py-3 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-xl transition-colors uppercase tracking-wider"
            @click="showMoveDateDialog = false"
          >
          {{ locale.cancel }}
          </button>
          <button
            class="flex-1 py-3 bg-info hover:bg-info text-text-primary text-xs font-bold rounded-xl shadow-lg shadow-[var(--info-glow-20)] transition-colors uppercase tracking-wider"
            @click="confirmMoveDate"
          >
          {{ locale.nextStep }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="showCopyDateDialog"
    class="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary-60 backdrop-blur-sm"
  >
    <div
      class="bg-bg-secondary border border-border-secondary rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
      @click.stop
    >
      <div class="flex items-center justify-between p-4 border-b border-border-secondary">
        <h3 class="text-sm font-black text-text-primary uppercase tracking-widest">{{ locale.copyDateTitle }}</h3>
        <button
          class="text-text-tertiary hover:text-text-secondary transition-colors"
          @click="showCopyDateDialog = false"
        >
          <CloseIcon class="w-5 h-5" />
        </button>
      </div>
      <div class="p-4 space-y-3">
        <!-- 复制方式选择器 -->
        <div class="flex items-center gap-2 p-1 bg-bg-primary border border-border-secondary rounded-xl">
          <button
            :class="[
              'flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all border',
              copyMode === 'single'
                ? 'bg-primary-hover border-primary text-text-primary shadow-md shadow-[var(--primary-glow)]'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
            ]"
            @click="switchCopyMode('single')"
          >
            {{ locale.singleDayCopy }}
          </button>
          <button
            :class="[
              'flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all border',
              copyMode === 'cycle'
                ? 'bg-primary-hover border-primary text-text-primary shadow-md shadow-[var(--primary-glow)]'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
            ]"
            @click="switchCopyMode('cycle')"
          >
            {{ locale.cycleCopy }}
          </button>
        </div>

        <!-- 源日期 -->
        <div>
          <div class="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-2">
            {{ copyMode === 'single' ? locale.cycleCopySourceDate : locale.copyDateSourceRange }}
          </div>
          <!-- 单天模式：只显示一个源日期 -->
          <div v-if="copyMode === 'single'" class="space-y-1.5">
            <div class="gap-3 flex items-center">
              <span class="text-[9px] text-text-disabled w-16 shrink-0 uppercase tracking-wider">{{ locale.copyDateRangeStart }}</span>
              <input
                v-model="copyFromStart"
                class="flex-1 bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-text-primary focus:outline-none focus:border-primary transition-colors"
                type="date"
              />
            </div>
          </div>
          <!-- 周期模式：显示源日期范围 -->
          <div v-else class="space-y-1.5">
            <div class="gap-3 flex items-center">
              <span class="text-[9px] text-text-disabled w-16 shrink-0 uppercase tracking-wider">{{ locale.copyDateRangeStart }}</span>
              <input
                v-model="copyFromStart"
                class="flex-1 bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-text-primary focus:outline-none focus:border-primary transition-colors"
                type="date"
              />
            </div>
            <div class="gap-3 flex items-center">
              <span class="text-[9px] text-text-disabled w-16 shrink-0 uppercase tracking-wider">{{ locale.copyDateRangeEnd }}</span>
              <input
                v-model="copyFromEnd"
                class="flex-1 bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-text-primary focus:outline-none focus:border-primary transition-colors"
                type="date"
              />
            </div>
          </div>
        </div>

        <!-- 目标日期 -->
        <div>
          <div class="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-2">
            {{ locale.copyDateTargetRange }}
          </div>
          <!-- 单天模式：只显示一个目标日期 -->
          <div v-if="copyMode === 'single'" class="space-y-1.5">
            <div class="gap-3 flex items-center">
              <span class="text-[9px] text-text-disabled w-16 shrink-0 uppercase tracking-wider">{{ locale.cycleCopyTargetSingleDate }}</span>
              <input
                v-model="copySingleTargetDate"
                class="flex-1 bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-text-primary focus:outline-none focus:border-primary transition-colors"
                type="date"
              />
            </div>
          </div>
          <!-- 周期模式：显示目标日期范围 -->
          <div v-else class="space-y-1.5">
            <div class="gap-3 flex items-center">
              <span class="text-[9px] text-text-disabled w-16 shrink-0 uppercase tracking-wider">{{ locale.cycleCopyTargetStart }}</span>
              <input
                v-model="copyToStart"
                class="flex-1 bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-text-primary focus:outline-none focus:border-primary transition-colors"
                type="date"
              />
            </div>
            <div class="gap-3 flex items-center">
              <span class="text-[9px] text-text-disabled w-16 shrink-0 uppercase tracking-wider">{{ locale.cycleCopyTargetEnd }}</span>
              <input
                v-model="copyToEnd"
                class="flex-1 bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-text-primary focus:outline-none focus:border-primary transition-colors"
                type="date"
              />
            </div>
          </div>
        </div>
        <div class="flex gap-3">
          <button
            class="flex-1 py-3 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-xl transition-colors uppercase tracking-wider"
            @click="showCopyDateDialog = false"
          >
            {{ locale.cancel }}
          </button>
          <button
            class="flex-1 py-3 bg-primary-hover hover:bg-primary text-text-primary text-xs font-bold rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-colors uppercase tracking-wider"
            @click="confirmCopyDate"
          >
            {{ locale.nextStep }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- 重播申请详情弹窗 -->
  <div
    v-if="showReplayModal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary-60 backdrop-blur-sm"
    @click="closeReplayModal"
  >
    <div
      class="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      @click.stop
    >
      <div class="flex items-center justify-between p-4 border-b border-border-secondary">
        <h3 class="text-sm font-black text-text-primary uppercase tracking-widest">
        {{ locale.replayDetailTitle(replayModalTitle) }}
        </h3>
        <div class="flex items-center gap-3">
          <button
            class="px-3 py-1.5 bg-error-10 hover:bg-error-20 text-error border border-error-20 rounded-lg text-xs font-bold transition-colors"
            @click="(rejectReplayRequest(replayModalSongId), closeReplayModal())"
          >
          {{ locale.rejectRequest }}
          </button>
          <button
            class="text-text-tertiary hover:text-text-secondary transition-colors"
            @click="closeReplayModal"
          >
            <CloseIcon class="w-5 h-5" />
          </button>
        </div>
      </div>
      <div class="p-0 overflow-y-auto max-h-[60vh]">
        <div class="divide-y divide-panel-bg-dark-50">
          <div
            v-for="(req, idx) in replayModalRequests"
            :key="idx"
            class="flex items-center justify-between p-4 group"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 rounded-lg bg-bg-secondary border border-border-secondary flex items-center justify-center text-text-tertiary group-hover:text-primary transition-colors"
              >
                <User class="w-3.5 h-3.5" />
              </div>
              <div class="flex flex-col">
                <span class="text-sm font-bold text-text-primary">{{ req.name }}</span>
                <span v-if="req.grade" class="text-[10px] text-text-tertiary"
                  >{{ req.grade }}{{ req.class ? ` ${req.class}` : '' }}</span
                >
              </div>
            </div>
            <div
              class="flex items-center gap-1.5 text-[10px] font-black text-text-disabled uppercase tracking-widest"
            >
              <Clock class="w-2.5 h-2.5" />
              {{ formatDate(req.createdAt) }}
            </div>
          </div>
          <div v-if="replayModalRequests.length === 0" class="py-10 text-center text-text-secondary">
            <Info class="w-6 h-6 mx-auto mb-2 opacity-20" />
        <p class="text-xs font-bold uppercase tracking-widest">{{ locale.noReplayDetails }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <SubmissionRemarkDialog
    :show="submissionRemarkDialog.show"
    :song-title="submissionRemarkDialog.songTitle"
    :content="submissionRemarkDialog.content"
    :is-public="submissionRemarkDialog.isPublic"
    :is-updating-public="submissionRemarkDialog.isUpdatingPublic"
    :note-status="submissionRemarkDialog.status"
    @close="submissionRemarkDialog.show = false"
    @update:is-public="updateSubmissionNotePublic"
    @approve="updateSubmissionNotePublicStatus('approved')"
    @reject="updateSubmissionNotePublicStatus('rejected')"
  />

  <SchedulePlaylistFilterModal
    :show="showPlaylistFilterModal"
    @update:show="showPlaylistFilterModal = $event"
    @apply="handlePlaylistFilterApply"
  />

  <!-- 自动排期弹窗 -->
  <div
    v-if="showAutoScheduleDialog"
    class="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary-60 backdrop-blur-sm"
  >
    <div
      class="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden mx-4"
      @click.stop
    >
      <div class="flex items-center justify-between p-4 border-b border-border-secondary">
        <h3 class="text-sm font-black text-text-primary uppercase tracking-widest">{{ locale.autoScheduleTitle }}</h3>
        <button
          class="text-text-tertiary hover:text-text-secondary transition-colors"
          @click="closeAutoScheduleDialog"
        >
          <CloseIcon class="w-5 h-5" />
        </button>
      </div>

      <div class="p-5 space-y-4">
        <!-- 输入区 -->
        <div v-if="!autoScheduleResult.songs.length" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">{{ locale.targetDuration }}</label>
            <div class="flex gap-2">
              <input
                v-model.number="autoScheduleTargetMinutes"
                type="number"
                min="1"
                :placeholder="locale.targetDurationPlaceholder"
                class="flex-1 bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-primary transition-colors"
                @keydown.enter="runAutoSchedule"
              />
              <span class="flex items-center text-xs text-text-disabled px-1">min</span>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">{{ locale.targetSongCount }}</label>
            <div class="flex gap-2">
              <input
                v-model.number="autoScheduleTargetSongCount"
                type="number"
                min="1"
                step="1"
                :placeholder="locale.targetSongCountPlaceholder"
                class="flex-1 bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-primary transition-colors"
                @keydown.enter="runAutoSchedule"
              />
              <span class="flex items-center text-xs text-text-disabled px-1">{{ locale.songCountUnit }}</span>
            </div>
          </div>

          <!-- 工具栏 -->
          <div class="flex items-center gap-2 p-2 bg-bg-secondary-50 border border-border-secondary rounded-xl">
            <div class="flex items-center gap-2 flex-1">
              <Lock class="w-3.5 h-3.5 text-text-tertiary shrink-0" />
              <span class="text-[10px] font-bold text-text-secondary uppercase tracking-wider shrink-0">
                {{ locale.fixExistingSelected }}
              </span>
              <button
                class="relative inline-flex items-center w-10 h-6 rounded-full transition-colors shrink-0"
                :class="autoScheduleFixExisting ? 'bg-primary' : 'bg-bg-tertiary'"
                @click="autoScheduleFixExisting = !autoScheduleFixExisting"
              >
                <span
                  class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                  :class="autoScheduleFixExisting ? 'translate-x-4' : 'translate-x-0.5'"
                />
              </button>
              <span
                v-if="autoScheduleFixExisting && autoScheduleScheduledSeconds > 0"
                class="text-[10px] font-bold text-primary"
              >
                {{ locale.fixExistingCount(localScheduledSongs.length) }} ·
                {{ locale.fixExistingRemaining(autoScheduleTargetMinutes || 0, autoScheduleScheduledSeconds) }}
              </span>
              <span v-else-if="autoScheduleFixExisting && localScheduledSongs.length === 0" class="text-[10px] text-text-disabled">
                {{ locale.fixExistingNone }}
              </span>
            </div>
            <button
              :disabled="refreshingAutoCandidates.running"
              class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold border border-border-secondary text-text-tertiary hover:text-primary hover:border-primary-30 rounded-lg transition-all uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              :title="locale.refreshCandidateDurations"
              @click="refreshAutoCandidateDurations"
            >
              <RefreshCcw class="w-3.5 h-3.5" :class="{ 'animate-spin': refreshingAutoCandidates.running }" />
              {{ locale.refreshCandidateDurations }}
              <span v-if="refreshingAutoCandidates.running" class="text-text-disabled ml-1">
                {{ refreshingAutoCandidates.progress }}
              </span>
            </button>
          </div>

          <div>
            <label class="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">{{ locale.scheduleDirection }}</label>
            <div class="flex gap-2">
              <button
                :class="[
                  'flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all uppercase tracking-wider',
                  autoScheduleDirection === 'under'
                    ? 'bg-primary-10 border-primary-30 text-primary'
                    : 'bg-bg-primary border-border-secondary text-text-secondary hover:border-border-tertiary'
                ]"
                @click="autoScheduleDirection = 'under'"
              >
                {{ locale.directionUnder }}
              </button>
              <button
                :class="[
                  'flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all uppercase tracking-wider',
                  autoScheduleDirection === 'middle'
                    ? 'bg-primary-10 border-primary-30 text-primary'
                    : 'bg-bg-primary border-border-secondary text-text-secondary hover:border-border-tertiary'
                ]"
                @click="autoScheduleDirection = 'middle'"
              >
                {{ locale.directionMiddle }}
              </button>
              <button
                :class="[
                  'flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all uppercase tracking-wider',
                  autoScheduleDirection === 'over'
                    ? 'bg-primary-10 border-primary-30 text-primary'
                    : 'bg-bg-primary border-border-secondary text-text-secondary hover:border-border-tertiary'
                ]"
                @click="autoScheduleDirection = 'over'"
              >
                {{ locale.directionOver }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">{{ locale.scheduleAlgorithm }}</label>
            <div class="flex gap-2">
              <button
                :class="[
                  'flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all uppercase tracking-wider',
                  autoScheduleAlgorithm === 'auto'
                    ? 'bg-primary-10 border-primary-30 text-primary'
                    : 'bg-bg-primary border-border-secondary text-text-secondary hover:border-border-tertiary'
                ]"
                @click="autoScheduleAlgorithm = 'auto'"
              >
                {{ locale.algorithmAuto }}
              </button>
              <button
                :class="[
                  'flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all uppercase tracking-wider',
                  autoScheduleAlgorithm === 'greedy'
                    ? 'bg-primary-10 border-primary-30 text-primary'
                    : 'bg-bg-primary border-border-secondary text-text-secondary hover:border-border-tertiary'
                ]"
                @click="autoScheduleAlgorithm = 'greedy'"
              >
                {{ locale.algorithmGreedy }}
              </button>
              <button
                :class="[
                  'flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all uppercase tracking-wider',
                  autoScheduleAlgorithm === 'exhaustive'
                    ? 'bg-primary-10 border-primary-30 text-primary'
                    : 'bg-bg-primary border-border-secondary text-text-secondary hover:border-border-tertiary'
                ]"
                @click="autoScheduleAlgorithm = 'exhaustive'"
              >
                {{ locale.algorithmExhaustive }}
              </button>
            </div>
          </div>

          <div class="text-[11px] text-text-disabled">
            {{ locale.availableCount(autoScheduleCandidates.length) }}
          </div>

          <div class="flex gap-2">
            <button
              class="flex-1 py-3 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-xl transition-colors uppercase tracking-wider"
              @click="closeAutoScheduleDialog"
            >
              {{ locale.cancel }}
            </button>
            <button
              :disabled="!autoScheduleTargetMinutes || autoScheduleTargetMinutes <= 0 || autoScheduleCandidates.length === 0"
              class="flex-1 py-3 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              @click="runAutoSchedule"
            >
              <Sparkles class="w-3.5 h-3.5" />
              {{ locale.autoScheduleRun }}
            </button>
          </div>
        </div>

        <!-- 结果区 -->
        <div v-else class="space-y-3">
          <div class="flex items-center justify-between px-1">
            <div class="flex items-center gap-2">
              <Sparkles class="w-4 h-4 text-primary" />
              <span class="text-xs font-bold text-text-primary">{{ locale.resultTitle }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-[11px] text-text-tertiary">
                {{ locale.totalDuration }}
              </span>
              <span class="text-sm font-black text-primary">
                {{ formatDuration(autoScheduleResult.totalDuration) }}
              </span>
            </div>
          </div>

          <div
            :class="[
              'px-3 py-2 rounded-lg text-[11px] font-bold border',
              autoScheduleResult.diff <= 0
                ? 'bg-info-10 border-info-20 text-info'
                : 'bg-warning-10 border-warning-20 text-warning'
            ]"
          >
            {{ autoScheduleResult.diff <= 0
              ? locale.resultUnderTarget(autoScheduleResult.absDiff)
              : locale.resultOverTarget(autoScheduleResult.absDiff)
            }}
          </div>

          <div class="space-y-2 max-h-[36vh] overflow-y-auto scrollbar-hide">
            <div
              v-for="(song, idx) in autoScheduleResult.songs"
              :key="song.id"
              class="flex items-center gap-3 p-2.5 bg-bg-primary border border-border-secondary-50 rounded-lg"
            >
              <span class="text-[10px] font-bold text-text-disabled w-5 shrink-0">{{ idx + 1 < 10 ? '0' + (idx + 1) : idx + 1 }}</span>
              <div
                class="relative w-10 h-10 rounded-lg overflow-hidden bg-bg-tertiary flex-shrink-0 border border-border-tertiary-50"
              >
                <img
                  v-if="song.cover"
                  :src="convertToHttps(song.cover)"
                  class="w-full h-full object-cover"
                  referrerpolicy="no-referrer"
                  loading="lazy"
                  alt=""
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center text-text-disabled"
                >
                  <Music2 class="w-5 h-5 opacity-50" />
                </div>
              </div>
              <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                <span class="text-sm font-bold text-text-primary truncate flex items-center gap-1.5">
                  <span>{{ song.title }}</span>
                  <span
                    v-if="song.isFixed"
                    class="inline-flex items-center gap-0.5 px-1 py-0.5 bg-primary-10 text-primary rounded text-[9px] font-bold border border-primary-20 shrink-0"
                  >
                    <Lock class="w-2.5 h-2.5" />
                    固定
                  </span>
                </span>
                <span class="text-xs text-text-tertiary truncate flex items-center gap-1.5">
                  <span>{{ song.artist }}</span>
                  <span
                    v-if="song.durationSeconds && !editingDuration[song.id]"
                    class="text-text-disabled hover:text-text-secondary hover:bg-bg-quaternary cursor-pointer shrink-0 px-1 rounded transition-colors"
                    :title="locale.messages?.editDuration || '点击编辑时长'"
                    @click.stop="startEditDuration(song)"
                  >{{ formatDuration(song.durationSeconds) }}</span>
                  <input
                    v-else-if="editingDuration[song.id]"
                    ref="editingDurationInput"
                    v-model="editingDurationValue"
                    type="text"
                    inputmode="text"
                    pattern="[0-9:]*"
                    class="w-20 text-[11px] font-mono text-center bg-bg-primary border border-primary rounded px-1 py-0.5 text-text-primary focus:outline-none focus:border-primary shrink-0"
                    :placeholder="locale.messages?.durationInputPlaceholder || '分:秒'"
                    @focusout="saveDurationEdit(song)"
                    @keydown="handleDurationKeydown($event, song)"
                  >
                  <span v-if="song.requester" class="text-text-disabled">|</span>
                  <span v-if="song.requester" class="text-text-tertiary truncate">{{ song.requester }}</span>
                  <span v-if="song.voteCount != null" class="ml-auto flex items-center gap-1 text-[10px] font-bold text-text-tertiary bg-bg-primary-50 px-1.5 py-0.5 rounded-md border border-border-secondary-50 shrink-0">
                    <Heart class="w-3 h-3 text-error-50" />
                    {{ song.voteCount }}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <!-- 方案导航 -->
          <div class="flex items-center gap-2 pt-1">
            <button
              :disabled="currentPlanIndex <= 0 || generatingNewPlan"
              class="flex-1 py-2.5 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-xl transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              @click="goToPreviousPlan"
            >
              <ChevronLeft class="w-3.5 h-3.5" />
              {{ locale.previousPlan }}
            </button>
            <span class="text-[10px] font-bold text-text-tertiary whitespace-nowrap">
              {{ locale.planIndicator(currentPlanIndex + 1, autoSchedulePlans.length) }}
            </span>
            <button
              :disabled="generatingNewPlan"
              class="flex-1 py-2.5 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-xl transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              @click="goToNextPlan"
            >
              <Loader2 v-if="generatingNewPlan" class="w-3.5 h-3.5 animate-spin" />
              <span v-else-if="currentPlanIndex < autoSchedulePlans.length - 1">
                {{ locale.nextPlan }}
                <ChevronRight class="w-3.5 h-3.5" />
              </span>
              <span v-else-if="actualExhaustive" class="flex items-center gap-1.5">
                <Plus class="w-3.5 h-3.5" />
                {{ locale.newPlan }}
              </span>
              <span v-else class="opacity-30">
                {{ locale.nextPlan }}
                <ChevronRight class="w-3.5 h-3.5" />
              </span>
            </button>
          </div>

          <div class="flex gap-2">
            <button
              class="flex-1 py-2.5 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-xl transition-colors uppercase tracking-wider"
              @click="resetAutoSchedule"
            >
              {{ locale.tryAgain }}
            </button>
            <button
              class="flex-1 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-bold rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-colors uppercase tracking-wider"
              @click="confirmAutoSchedule"
            >
              {{ locale.confirmApply }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 上下文菜单 -->
  <div
    v-if="contextMenuOpen"
    class="fixed inset-0 z-50"
    @click="contextMenuOpen = false"
  >
    <div
      class="absolute bg-bg-secondary border border-border-secondary rounded-xl shadow-2xl p-1 min-w-[130px]"
      :style="contextMenuPos"
      @click.stop
    >
      <button
        class="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[11px] font-bold text-text-primary hover:bg-bg-primary transition-colors"
        @click="playSong(contextMenuSong); contextMenuOpen = false"
      >
        <Play class="w-3 h-3" />
        <span>{{ locale.playSong }}</span>
      </button>
      <template v-if="contextMenuSide === 'left'">
        <button
          v-if="activeTab === 'normal' || activeTab === 'all'"
          class="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[11px] font-bold text-text-primary hover:bg-bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          :disabled="poolSongIds.has(contextMenuSong.id)"
          @click="addSingleToPool(contextMenuSong.id); contextMenuOpen = false"
        >
          <FolderPlus class="w-3 h-3" />
          <span>{{ locale.addSingleToPool }}</span>
        </button>
        <button
          v-if="activeTab === 'normal' || activeTab === 'all' || activeTab === 'replay'"
          class="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[11px] font-bold text-text-primary hover:bg-bg-primary transition-colors"
          @click="addSongToSchedule(contextMenuSong); contextMenuOpen = false"
        >
          <PlaySquare class="w-3 h-3" />
          <span>{{ locale.addToSchedule }}</span>
        </button>
        <button
          v-if="activeTab === 'pool'"
          class="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[11px] font-bold text-text-primary hover:bg-bg-primary transition-colors"
          @click="addSongToSchedule(contextMenuSong); contextMenuOpen = false"
        >
          <PlaySquare class="w-3 h-3" />
          <span>{{ locale.addToSchedule }}</span>
        </button>
        <button
          v-if="activeTab === 'pool'"
          class="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[11px] font-bold text-error hover:bg-error-10 transition-colors"
          @click="removeFromPool(contextMenuSong.songId || contextMenuSong.id); contextMenuOpen = false"
        >
          <Trash2 class="w-3 h-3" />
          <span>{{ locale.removeFromPool }}</span>
        </button>
      </template>
      <template v-if="contextMenuSide === 'right'">
        <button
          class="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[11px] font-bold text-error hover:bg-error-10 transition-colors"
          @click="removeSongFromSchedule(contextMenuSong); contextMenuOpen = false"
        >
          <Trash2 class="w-3 h-3" />
          <span>{{ locale.removeFromSchedule }}</span>
        </button>
        <button
          v-if="contextMenuSong.isDraft"
          class="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[11px] font-bold text-success hover:bg-success-10 transition-colors"
          @click="publishSingleDraft(contextMenuSong); contextMenuOpen = false"
        >
          <Send class="w-3 h-3" />
          <span>{{ locale.publishThisDraft }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch, inject } from 'vue'
import {
  Search,
  Save,
  Send,
  CheckCircle2,
  Download,
  FileBadge,
  PlaySquare,
  Play,
  ChevronDown,
  ListMusic,
  Filter,
  Info,
  Clock,
  User,
  AlertTriangle,
  X as CloseIcon,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Calendar as CalendarIcon,
  ArrowLeft,
  ArrowRight,
  Music2,
  Heart,
  Plus,
  Minus,
  CircleDot,
  ExternalLink,
  MessageSquare,
  Trash2,
  Copy,
  RefreshCcw,
  Loader2,
  Sparkles,
  FolderPlus,
  Lock
} from '@lucide/vue'
import SongDownloadDialog from './SongDownloadDialog.vue'
import SubmissionRemarkDialog from './SubmissionRemarkDialog.vue'
import ConfirmDialog from '../UI/ConfirmDialog.vue'
import Icon from '~/components/UI/Icon.vue'
import Pagination from '~/components/UI/Common/Pagination.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import LoadingState from '~/components/UI/Common/LoadingState.vue'
import { useSongPlayer } from '~/composables/useSongPlayer'
import { isBilibiliSong } from '~/utils/bilibiliSource'
import { convertToHttps, getNeteaseCookie } from '~/utils/url'
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'
import { formatDuration, addDaysToString, getDaysBetween } from '~/utils/timeUtils'
import { autoSchedule, autoScheduleExhaustive, poolCandidateFromItem } from '~/utils/autoSchedule'
import { getMusicUrlResult, isKnownInvalidQqAudioUrl } from '~/utils/musicUrl'

import SchedulePlaylistFilterModal from './SchedulePlaylistFilterModal.vue'
import { getPlaylistDetail } from '~/utils/neteaseApi'

const { admin } = useLocale()
const { localize: localizeServerError } = useServerErrors()
const locale = computed(() => {
  const base = admin.value?.scheduleManager || {}
  return useSafeLocale({
    ...base,
    messages: {
      confirmAutoScheduleApplied: (count, duration) => `已自动排期 ${count} 首歌曲，合计 ${duration}`,
      ...(base.messages || {})
    },
    errors: {
      rejectReplayFailed: (message) => `拒绝申请失败: ${message || '未知错误'}`,
      saveDraftFailed: (message) => `保存草稿失败: ${message || '未知错误'}`,
      publishScheduleFailed: (message) => `发布排期失败: ${message || '未知错误'}`,
      publishDraftFailed: (message) => `发布草稿失败: ${message || '未知错误'}`,
      moveDateFailed: (message) => `迁移失败: ${message || '未知错误'}`,
      ...(base.errors || {})
    },
    confirmations: {
      moveDateMessage: (sourceDate, count, targetDate) =>
        `确定将 ${sourceDate} 的所有 ${count} 首歌曲迁移到 ${targetDate} 吗？歌曲顺序与内容将保持不变。`,
      publishDraftMessage: (title) =>
        `确定要发布草稿《${title}》吗？发布后将立即公示并发送通知。`,
      ...(base.confirmations || {})
    },
    andMoreApplicants: base.andMoreApplicants || ((count) => ` 等${count}人`),
    currentDate: base.currentDate || ((date) => `当前日期：${date}`),
    replayDetailTitle: base.replayDetailTitle || ((title) => `${title} - 重播申请详情`),
    timeAgo: {
      ...(base.timeAgo || {}),
      never: base.timeAgo?.never || base.unknown || '从未',
      justNow: base.timeAgo?.justNow || '刚刚',
      minutes: (value) => formatLocaleValue(base.timeAgo?.minutes, value) || `${value} 分钟前`,
      hours: (value) => formatLocaleValue(base.timeAgo?.hours, value) || `${value} 小时前`,
      days: (value) => formatLocaleValue(base.timeAgo?.days, value) || `${value} 天前`
    }
  })
})
const { t: callLocale, nested: getNestedMessage } = useLocaleText(locale)

// 通知文案：优先 i18n 分区取值（section.key），异常时回退硬编码（防止异步回调作用域问题导致报错）
const safeMessage = (section, key, fallback) => {
  try {
    const text = getNestedMessage(section, key)
    return text || fallback
  } catch {
    return fallback
  }
}

const getTodayDateValue = () => getBeijingTimeISOString().slice(0, 10)

// 日期选择器只关心日历日期，避免 UTC 转换让北京时间凌晨落到前一天
const parseDateValue = (dateValue) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

const formatUtcDateValue = (date) => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDaysToDateValue = (dateValue, days) => {
  const parsed = parseDateValue(dateValue)
  if (!parsed) return dateValue

  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days))
  return formatUtcDateValue(date)
}

const getScheduleDateValue = (playDate) => {
  if (!playDate) return ''

  if (typeof playDate === 'string') {
    const dateValue = playDate.slice(0, 10)
    if (parseDateValue(dateValue)) return dateValue
  }

  const date = new Date(playDate)
  if (Number.isNaN(date.getTime())) return ''
  return formatUtcDateValue(date)
}

// 响应式数据
const selectedDate = useState('adminSelectedDate', getTodayDateValue)
const loading = ref(false)
const songSortOption = ref('votes-desc')
const hasChanges = ref(false)
const searchQuery = ref('')
const selectedGrade = ref('')
const activeTab = ref('normal')
const mobileTab = ref('pending')
const mobileFiltersOpen = ref(false)
const scheduleTabs = computed(() => [
  { id: 'normal', label: locale.value?.tabs?.normal || '普通投稿' },
  { id: 'replay', label: locale.value?.tabs?.replay || '重播申请' },
  { id: 'all', label: locale.value?.tabs?.all || '所有' },
  { id: 'pool', label: locale.value?.tabs?.pool || locale.value?.poolList || '备选池' }
])

// 歌单过滤状态
const showPlaylistFilterModal = ref(false)
const isPlaylistFilterActive = ref(false)
const playlistFilterTrackIds = ref(new Set())
const playlistNamesMap = ref({})

const handlePlaylistFilterApply = async (playlistIds, playlistTracks = {}, playlistNames = {}) => {
  if (!playlistIds || playlistIds.length === 0) {
    isPlaylistFilterActive.value = false
    playlistFilterTrackIds.value = new Set()
    playlistNamesMap.value = {}
    return
  }

  isPlaylistFilterActive.value = true
  const newTrackIds = new Set()
  const newNamesMap = {}
  const cookie = getNeteaseCookie()

  const fetchPromises = playlistIds.map(async (id) => {
  const playlistName = playlistNames[id] || callLocale('playlistName', `Playlist ${id}`, id)
    let trackIds = []

    // 优先使用从组件中传来的已经缓存的 trackIds
    if (playlistTracks && playlistTracks[id]) {
      trackIds = playlistTracks[id]
    } else {
      // 缓存中没有则重新请求
      try {
        const res = await getPlaylistDetail(id, cookie)
        if (
          res &&
          res.code === 200 &&
          res.body &&
          res.body.playlist &&
          res.body.playlist.trackIds
        ) {
          trackIds = res.body.playlist.trackIds.map((t) => t.id.toString())
        }
      } catch (err) {
        console.error(`获取歌单 ${id} 失败:`, err)
      }
    }

    // 存入集合并建立映射关系
    trackIds.forEach((t) => {
      newTrackIds.add(t)
      if (!newNamesMap[t]) {
        newNamesMap[t] = new Set()
      }
      newNamesMap[t].add(playlistName)
    })
  })

  await Promise.all(fetchPromises)

  playlistFilterTrackIds.value = newTrackIds
  playlistNamesMap.value = {}
  Object.keys(newNamesMap).forEach((key) => {
    playlistNamesMap.value[key] = Array.from(newNamesMap[key])
  })
}

// 音频播放器
const { playSong } = useSongPlayer()

// 确认对话框相关
const showConfirmDialog = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogMessage = ref('')
const confirmDialogType = ref('warning')
const confirmDialogConfirmText = ref('')
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
// 刷新时长状态（每首歌独立追踪）
const refreshingDuration = ref({})
// 时长刷新结果状态（用于颜色标记：'success' | 'error' | null）
const durationRefreshStatus = ref({})
// 批量刷新时长状态
const refreshingAllDurations = ref({ running: false, progress: '', done: 0, total: 0 })
const refreshingAutoCandidates = ref({ running: false, progress: '', success: 0, fail: 0 })
// 行内编辑歌曲时长状态
const editingDuration = ref({})
const editingDurationValue = ref('')
const editingDurationInput = ref(null)
const durationSaveInFlight = new Set()

const formatDurationInput = (seconds) => {
  const total = Number(seconds)
  if (!Number.isInteger(total) || total < 0) return ''
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remainingSeconds = total % 60
  const paddedSeconds = String(remainingSeconds).padStart(2, '0')
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
    : `${minutes}:${paddedSeconds}`
}

const parseDurationInput = (value) => {
  const parts = value.split(':')
  if (parts.length !== 2 && parts.length !== 3) return null
  if (parts.some((part) => !/^\d+$/.test(part))) return null

  const values = parts.map(Number)
  const hours = parts.length === 3 ? values[0] : 0
  const minutes = parts.length === 3 ? values[1] : values[0]
  const seconds = parts.length === 3 ? values[2] : values[1]
  if (minutes > 59 || seconds > 59) return null

  const total = hours * 3600 + minutes * 60 + seconds
  return total <= 7200 ? total : null
}

// 开始编辑歌曲时长
const startEditDuration = (song) => {
  if (editingDuration.value[song.id]) return
  editingDuration.value[song.id] = true
  editingDurationValue.value = song.durationSeconds == null
    ? ''
    : formatDurationInput(song.durationSeconds)
  nextTick(() => {
    const input = Array.isArray(editingDurationInput.value)
      ? editingDurationInput.value[0]
      : editingDurationInput.value
    if (input) {
      input.focus()
      input.select()
    }
  })
}

// 保存编辑的歌曲时长
const saveDurationEdit = async (song) => {
  if (!editingDuration.value[song.id] || durationSaveInFlight.has(song.id)) return
  durationSaveInFlight.add(song.id)

  try {
    const raw = editingDurationValue.value.trim()
    if (raw === '') {
      if (song.durationSeconds == null) {
        cancelEditDuration(song.id)
        return
      }
      // 清空时长
      const updated = await updateSongDuration(song.id, null)
      if (!updated) return
      delete editingDuration.value[song.id]
      editingDurationValue.value = ''
      return
    }

    const seconds = parseDurationInput(raw)
    if (seconds == null) {
      if (window.$showNotification) {
        window.$showNotification(locale.value.messages?.durationInvalid || '时长格式无效，请输入 分:秒 或 时:分:秒', 'error')
      }
      return
    }

    if (seconds === Number(song.durationSeconds)) {
      cancelEditDuration(song.id)
      return
    }

    const updated = await updateSongDuration(song.id, seconds)
    if (!updated) return
    delete editingDuration.value[song.id]
    editingDurationValue.value = ''
  } finally {
    durationSaveInFlight.delete(song.id)
  }
}

// 通用：更新歌曲时长并同步所有列表
const updateSongDuration = async (songId, durationSeconds) => {
  try {
    await $fetch('/api/admin/songs/duration', {
      method: 'POST',
      body: { songId, durationSeconds },
      ...(auth ? auth.getAuthConfig?.() : {})
    })

    const normalized = durationSeconds ?? null
    // 更新待排歌曲列表
    const pendingIdx = songs.value.findIndex((s) => s.id === songId)
    if (pendingIdx !== -1) {
      songs.value[pendingIdx].durationSeconds = normalized
    }
    // 更新已排歌曲列表
    for (const schedule of localScheduledSongs.value) {
      if (schedule.song && schedule.song.id === songId) {
        schedule.song.durationSeconds = normalized
        break
      }
    }
    // 更新备选池
    for (const p of songPool.value) {
      if (p.songId === songId) { p.durationSeconds = normalized; break }
    }
    // 更新重播申请
    for (const r of replayRequests.value) {
      if (r.id === songId) { r.durationSeconds = normalized; break }
    }
    // 更新自动排期候选
    if (autoScheduleCandidates.value) {
      const cand = autoScheduleCandidates.value.find((c) => c.id === songId)
      if (cand) cand.durationSeconds = normalized
    }

    if (window.$showNotification) {
      window.$showNotification(locale.value.messages?.durationUpdated || '时长已更新', 'success')
    }
    return true
  } catch (err) {
    console.error('更新时长失败:', err)
    if (window.$showNotification) {
      window.$showNotification(localizeServerError(err), 'error')
    }
    return false
  }
}

// 取消编辑
const cancelEditDuration = (songId) => {
  delete editingDuration.value[songId]
  editingDurationValue.value = ''
}

// 键盘事件处理
const handleDurationKeydown = (event, song) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    saveDurationEdit(song)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelEditDuration(song.id)
  }
}
// 自动排期状态
const showAutoScheduleDialog = ref(false)
const contextMenuOpen = ref(false)
const contextMenuSide = ref('left')
const contextMenuSong = ref(null)
const contextMenuPos = ref({ top: '50%', left: '50%' })
const openContextMenu = (e, side, song) => {
  e.stopPropagation()
  const rect = e.currentTarget.getBoundingClientRect()
  const menuW = 150
  const menuH = 120
  contextMenuSide.value = side
  contextMenuSong.value = song
  const vW = window.innerWidth
  let left = rect.right + 8
  if (left + menuW > vW) {
    left = rect.left - menuW - 8
  }
  if (left < 8) left = vW - menuW - 8
  const top = rect.bottom + 8
  const adjustedTop = top + menuH > window.innerHeight ? top - menuH : top
  contextMenuPos.value = {
    top: `${adjustedTop}px`,
    left: `${left}px`
  }
  contextMenuOpen.value = true
}
const closeContextMenu = () => { contextMenuOpen.value = false }
const autoScheduleTargetMinutes = ref(null)
const autoScheduleTargetSongCount = ref(null)
const autoScheduleDirection = ref('under')
const autoScheduleFixExisting = ref(false)

const autoScheduleScheduledSeconds = computed(() => {
  if (!autoScheduleFixExisting.value) return 0
  return localScheduledSongs.value.reduce((sum, s) => {
    const dur = s.song && typeof s.song.durationSeconds === 'number' ? s.song.durationSeconds : 0
    return sum + dur
  }, 0)
})

const autoScheduleResult = ref({ songs: [], totalDuration: 0, diff: 0, absDiff: 0 })
const autoSchedulePlans = ref([])
const currentPlanIndex = ref(0)
const autoScheduleAlgorithm = ref('greedy')
const actualExhaustive = computed(() => {
  return autoScheduleAlgorithm.value === 'exhaustive' ||
    (autoScheduleAlgorithm.value === 'auto' && autoScheduleCandidates.value.length < 20)
})
const generatingNewPlan = ref(false)
// 备选池
const songPool = ref([])
const poolLoading = ref(false)
// 备选池已包含的歌曲 ID 集合，用于禁用重复加入按钮
const poolSongIds = computed(() => new Set(songPool.value.map((p) => p.songId)))
const showMoveDateDialog = ref(false)
const moveTargetDate = ref('')
const showCopyDateDialog = ref(false)
const copyMode = ref('single')
const copyFromStart = ref('')
const copyFromEnd = ref('')
const copyToStart = ref('')
const copyToEnd = ref('')
const copySingleTargetDate = ref('')
const submissionRemarkDialog = ref({
  show: false,
  songId: null,
  replayRequestId: null,
  title: '',
  artist: '',
  songTitle: '',
  content: '',
  isPublic: true,
  isUpdatingPublic: false,
  status: null
})

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

const openSubmissionRemark = (song, scheduleReplayRequestId = null) => {
  if (!song?.submissionNote) return
  submissionRemarkDialog.value = {
    show: true,
    songId: song.id,
    // 排期卡片的 replayRequestId 在排期顶层而非 song 子对象，优先使用显式传入的绑定
    replayRequestId: scheduleReplayRequestId || song.replayRequestId || null,
    title: song.title,
    artist: song.artist,
    songTitle: `${song.title} - ${song.artist}`,
    content: song.submissionNote,
    isPublic: song.submissionNotePublic === true,
    status: song.submissionNotePublicStatus || null
  }
}

const updateSubmissionNotePublicStatus = async (status) => {
  const dialogData = submissionRemarkDialog.value
  if (!dialogData.songId || dialogData.isUpdatingPublic) return

  dialogData.isUpdatingPublic = true

  try {
    const updatePayload = {
      title: dialogData.title,
      artist: dialogData.artist,
      submissionNotePublicStatus: status
    }
    if (dialogData.replayRequestId) {
      updatePayload.replayRequestId = dialogData.replayRequestId
    }

    await adminService.updateSong(dialogData.songId, updatePayload)

    const applyLocal = (song) => {
      song.submissionNotePublicStatus = status
      if (status === 'approved') song.submissionNotePublic = true
    }
    if (songsService && songsService.songs && songsService.songs.value) {
      const songIndex = songsService.songs.value.findIndex((s) => s.id === dialogData.songId)
      if (songIndex !== -1) applyLocal(songsService.songs.value[songIndex])
    }
    for (const scheduleList of [localScheduledSongs.value, publicSchedules.value]) {
      const scheduleIndex = scheduleList.findIndex(
        (s) => s.song && s.song.id === dialogData.songId
      )
      if (scheduleIndex !== -1) applyLocal(scheduleList[scheduleIndex].song)
    }
    const replayIndex = replayRequests.value.findIndex((s) => s.id === dialogData.songId)
    if (replayIndex !== -1) applyLocal(replayRequests.value[replayIndex])

    dialogData.status = status
    if (status === 'approved') dialogData.isPublic = true

    if (window.$showNotification) {
      try {
        window.$showNotification(
          safeMessage('messages', status === 'rejected' ? 'remarkRejected' : 'remarkApproved', '备注留言审核状态已更新'),
          'success'
        )
      } catch (notifyErr) {
        // 静默失败，不影响主流程
      }
    }
  } catch (error) {
    console.error('更新备注审核状态失败:', error)
    if (window.$showNotification) {
      try {
        window.$showNotification(safeMessage('errors', 'remarkUpdateFailed', '备注留言审核状态更新失败'), 'error')
      } catch (notifyErr) {
        // 静默失败，不影响主流程
      }
    }
  } finally {
    dialogData.isUpdatingPublic = false
  }
}

const updateSubmissionNotePublic = async (isPublic) => {
  const dialogData = submissionRemarkDialog.value
  if (!dialogData.songId || dialogData.isUpdatingPublic) return

  dialogData.isUpdatingPublic = true
  dialogData.isPublic = isPublic

  try {
    const updatePayload = {
      title: dialogData.title,
      artist: dialogData.artist,
      submissionNotePublic: isPublic
    }
    // 如果是重播申请，传入 replayRequestId 以更新重播申请的备注可见性
    if (dialogData.replayRequestId) {
      updatePayload.replayRequestId = dialogData.replayRequestId
    }

    await adminService.updateSong(dialogData.songId, updatePayload)

    const applyNotePublic = (song) => {
      song.submissionNotePublic = isPublic
      song.submissionNotePublicStatus = isPublic ? 'approved' : null
    }
    if (songsService && songsService.songs && songsService.songs.value) {
      const songIndex = songsService.songs.value.findIndex((s) => s.id === dialogData.songId)
      if (songIndex !== -1) {
        applyNotePublic(songsService.songs.value[songIndex])
      }
    }

    // 更新排期列表中的重播申请备注可见性
    for (const scheduleList of [localScheduledSongs.value, publicSchedules.value]) {
      const scheduleIndex = scheduleList.findIndex(
        (s) => s.song && s.song.id === dialogData.songId
      )
      if (scheduleIndex !== -1) {
        applyNotePublic(scheduleList[scheduleIndex].song)
      }
    }

    // 更新重播请求列表中的备注可见性
    const replayIndex = replayRequests.value.findIndex((s) => s.id === dialogData.songId)
    if (replayIndex !== -1) {
      applyNotePublic(replayRequests.value[replayIndex])
    }
    dialogData.status = isPublic ? 'approved' : null

    if (window.$showNotification) {
      window.$showNotification(locale.value.messages.remarkVisibilityUpdated, 'success')
    }
  } catch (error) {
    console.error('更新备注可见性失败:', error)
    if (window.$showNotification) {
      window.$showNotification(locale.value.errors.remarkVisibilityUpdateFailed, 'error')
    }
    dialogData.isPublic = !isPublic
  } finally {
    dialogData.isUpdatingPublic = false
  }
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

// 已排期歌曲的总时长（秒）
const scheduledTotalDuration = computed(() => {
  return localScheduledSongs.value.reduce((sum, s) => {
    const dur = s.song && typeof s.song.durationSeconds === 'number' ? s.song.durationSeconds : 0
    return sum + dur
  }, 0)
})

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
const selectedFilterPlayTime = ref('all')

// 待排歌曲的播出时段筛选选项
const filterPlayTimeOptions = computed(() => {
  const options = [
    { label: locale.value.allPlayTimes, value: 'all' },
    { label: locale.value.unspecifiedPlayTime, value: 'none' }
  ]
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

// 播出时段选项
const playTimeOptions = computed(() => {
  const options = [{ label: locale.value.noPlayTimeAllDay, value: '' }]
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
const sortOptions = computed(() => [
  { label: locale.value?.sortOptions?.newest || 'Newest', value: 'time-desc' },
  { label: locale.value?.sortOptions?.oldest || 'Oldest', value: 'time-asc' },
  { label: locale.value?.sortOptions?.hotDesc || 'Most votes', value: 'votes-desc' },
  { label: locale.value?.sortOptions?.hotAsc || 'Fewest votes', value: 'votes-asc' }
])

// 学期相关
const availableSemesters = ref([])
const selectedSemester = ref('')

// 日期范围（用于无限滚动）
const dateRange = ref({ start: -30, end: 30 })

// 手动日期选择
const showManualDatePicker = ref(false)
const manualSelectedDate = ref('')

// 分页相关
const pageStates = reactive({
  normal: 1,
  replay: 1,
  all: 1,
  pool: 1
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
  const todayValue = getTodayDateValue()

  // 根据当前范围生成日期
  for (let i = dateRange.value.start; i <= dateRange.value.end; i++) {
    const dateStr = addDaysToDateValue(todayValue, i)
    const parsedDate = parseDateValue(dateStr)
    if (!parsedDate) continue

    const isToday = i === 0
    const weekdays = locale.value?.weekdays || ['日', '一', '二', '三', '四', '五', '六']
    const weekday = weekdays[new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day)).getUTCDay()]

    dates.push({
      value: dateStr,
      day: String(parsedDate.day).padStart(2, '0'),
      month: String(parsedDate.month).padStart(2, '0'),
      weekday,
      isToday
    })
  }

  return dates
})

// 获取所有可选年级
const availableGrades = computed(() => {
  if (!songs.value) return [{ label: locale.value.allGrades, value: '' }]

  const grades = new Set()
  songs.value.forEach((song) => {
    if (song.requesterGrade) {
      grades.add(song.requesterGrade)
    }
  })

  // 对年级进行简单排序
  const sortedGrades = Array.from(grades).sort()
  return [
    { label: locale.value.allGrades, value: '' },
    ...sortedGrades.map((grade) => ({ label: grade, value: grade }))
  ]
})

// 过滤未排期歌曲（所有）
const allUnscheduledSongs = computed(() => {
  // 备选池模式
  if (activeTab.value === 'pool') {
    let poolSongs = songPool.value.filter((item) => {
      const isScheduledInCurrentView = localScheduledSongs.value.some(
        (s) => (s.song && s.song.id === item.songId) || s.songId === item.songId
      )
      return !isScheduledInCurrentView
    })
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      poolSongs = poolSongs.filter((song) => {
        const title = (song.title || '').toLowerCase()
        const artist = (song.artist || '').toLowerCase()
        const requester = (song.requester || '').toLowerCase()
        return title.includes(query) || artist.includes(query) || requester.includes(query)
      })
    }
    // 补充默认字段，保持与歌曲卡片渲染一致
    return poolSongs.map((item) => ({
      ...item,
      id: item.songId,
      voteCount: item.voteCount || 0,
      cardCodeId: item.cardCodeId || null,
      usedCardCode: item.usedCardCode || false,
      hasSubmissionNote: item.hasSubmissionNote || false,
      submissionNote: item.submissionNote || null,
      preferredPlayTimeId: item.preferredPlayTimeId || null,
      musicId: item.musicId || null,
      musicPlatform: item.musicPlatform || null,
      requesterGrade: item.requesterGrade || null,
      requesterClass: item.requesterClass || null
    }))
  }

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
      const isAlreadyScheduled = song.scheduled || scheduledSongIds.value.has(song.id)
      return !song.played && !isAlreadyScheduled
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
    selectedGrade.value
  ) {
    unscheduledSongs = unscheduledSongs.filter(
      (song) => song.requesterGrade === selectedGrade.value
    )
  }

  // 播出时段过滤
  if (selectedFilterPlayTime.value !== 'all') {
    unscheduledSongs = unscheduledSongs.filter((song) => {
      if (selectedFilterPlayTime.value === 'none') {
        return !song.preferredPlayTimeId
      }
      return song.preferredPlayTimeId === selectedFilterPlayTime.value
    })
  }

  // 歌单查重过滤
  if (isPlaylistFilterActive.value && playlistFilterTrackIds.value.size > 0) {
    unscheduledSongs = unscheduledSongs.filter((song) => {
      // 仅在歌曲为网易云平台且其 ID 存在于过滤列表中时才保留
      if (song.musicId && (song.musicPlatform === 'netease' || !song.musicPlatform)) {
        return playlistFilterTrackIds.value.has(song.musicId.toString())
      }
      // 如果不是网易云歌曲，则在启用了网易云歌单过滤时直接排除（因为查重只查网易云）
      return false
    })
  }

  return [...unscheduledSongs].sort((a, b) => {
    if (activeTab.value === 'pool') {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    }
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

// 桌面端检测
const isDesktop = ref(true)

// 方法
const formatDate = (dateString) => {
  if (!dateString) return locale.value?.timeAgo?.never || '从未'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return locale.value?.timeAgo?.never || '从未'
  const now = getSyncedDate()
  const diff = now - date

  if (diff < 60000) return locale.value.timeAgo.justNow
  if (diff < 3600000) return locale.value.timeAgo.minutes(Math.floor(diff / 60000))
  if (diff < 86400000) return locale.value.timeAgo.hours(Math.floor(diff / 3600000))
  return locale.value.timeAgo.days(Math.floor(diff / 86400000))
}

// 检查窗口大小
const checkWindowSize = () => {
  isDesktop.value = window.innerWidth >= 1024
}

let targetScrollLeft = null
let animationFrameId = null

// 自定义平滑滚动动画
const smoothScrollTo = (element, target, duration = 300) => {
  if (!element) return

  const start = element.scrollLeft
  const distance = target - start
  let startTime = null

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

  const animation = (currentTime) => {
    if (!startTime) startTime = currentTime
    const timeElapsed = currentTime - startTime
    const progress = Math.min(timeElapsed / duration, 1)

    element.scrollLeft = start + distance * easeOutCubic(progress)

    if (timeElapsed < duration) {
      animationFrameId = requestAnimationFrame(animation)
    } else {
      targetScrollLeft = null
      animationFrameId = null
    }
  }

  animationFrameId = requestAnimationFrame(animation)
}

// 处理日期选择器滚轮事件
const handleDateSelectorWheel = (event) => {
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    return
  }

  event.preventDefault()

  const isTouchpad = Math.abs(event.deltaY) < 50

  if (isTouchpad) {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
      targetScrollLeft = null
    }
    dateSelector.value.scrollLeft += event.deltaY
  } else {
    if (targetScrollLeft === null) {
      targetScrollLeft = dateSelector.value.scrollLeft
    }

    const scrollAmount = event.deltaY > 0 ? 150 : -150
    targetScrollLeft += scrollAmount

    const maxScroll = dateSelector.value.scrollWidth - dateSelector.value.clientWidth
    targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll))

    smoothScrollTo(dateSelector.value, targetScrollLeft)
  }
}

// 滚动日期选择器
const scrollDates = (direction) => {
  if (!dateSelector.value) return

  const scrollAmount = 200
  const currentScroll = dateSelector.value.scrollLeft

  if (targetScrollLeft === null) {
    targetScrollLeft = currentScroll
  }

  targetScrollLeft =
    direction === 'right' ? targetScrollLeft + scrollAmount : targetScrollLeft - scrollAmount

  const maxScroll = dateSelector.value.scrollWidth - dateSelector.value.clientWidth
  targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll))

  smoothScrollTo(dateSelector.value, targetScrollLeft, 400)
}

let scrollTimeout = null

// 更新滚动按钮状态并加载更多日期
const updateScrollButtonState = () => {
  if (!dateSelector.value) return

  isFirstDateVisible.value = false
  isLastDateVisible.value = false

  const { scrollLeft, scrollWidth, clientWidth } = dateSelector.value

  if (scrollLeft >= 50 && scrollWidth - scrollLeft - clientWidth >= 50) {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout)
      scrollTimeout = null
    }
    return
  }

  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }

  scrollTimeout = setTimeout(async () => {
    if (!dateSelector.value) return

    const currentScrollLeft = dateSelector.value.scrollLeft
    const currentScrollWidth = dateSelector.value.scrollWidth
    const currentClientWidth = dateSelector.value.clientWidth

    if (currentScrollLeft < 50) {
      const oldScrollWidth = currentScrollWidth
      dateRange.value.start -= 14

      await nextTick()

      const newScrollWidth = dateSelector.value.scrollWidth

      const delta = newScrollWidth - oldScrollWidth
      dateSelector.value.scrollLeft = currentScrollLeft + delta

      // 补偿正在进行的平滑滚动动画目标，避免跳跃或回弹
      if (targetScrollLeft !== null) {
        targetScrollLeft += delta
      }
    } else if (currentScrollWidth - currentScrollLeft - currentClientWidth < 50) {
      dateRange.value.end += 14
    }
  }, 150)
}

// 确认对话框处理
const handleConfirm = async () => {
  if (confirmAction.value) {
    await confirmAction.value()
  }
  showConfirmDialog.value = false
  confirmAction.value = null
}

// 监听浏览器刷新/关闭事件
const handleBeforeUnload = (e) => {
  if (hasChanges.value) {
    e.preventDefault()
    e.returnValue = ''
    return ''
  }
}

// 监听路由离开事件
onBeforeRouteLeave((to, from, next) => {
  if (hasChanges.value) {
    const answer = window.confirm(locale.value.confirmations.leaveUnsaved)
    if (answer) {
      next()
    } else {
      next(false)
    }
  } else {
    next()
  }
})

// 处理日期选择
const handleDateSelect = (dateValue) => {
  if (selectedDate.value === dateValue) return

  if (hasChanges.value) {
    if (!window.confirm(locale.value.confirmations.switchDateUnsaved)) {
      return
    }
  }
  selectedDate.value = dateValue
}

// 处理播出时段选择
const handlePlayTimeSelect = (value) => {
  if (selectedPlayTime.value === value) return

  if (hasChanges.value) {
    if (!window.confirm(locale.value.confirmations.switchPlayTimeUnsaved)) {
      return
    }
  }
  selectedPlayTime.value = value
}

// 处理学期选择
const handleSemesterSelect = async (value) => {
  if (selectedSemester.value === value) return

  if (hasChanges.value) {
    if (!window.confirm(locale.value.confirmations.switchSemesterUnsaved)) {
      return
    }
  }
  selectedSemester.value = value
  await onSemesterChange()
}

// 初始化
let unregisterBeforeNavigate = null
const registerBeforeNavigate = inject('registerBeforeNavigate', null)
let suppressSelectedDateLoad = false

onMounted(async () => {
  window.addEventListener('beforeunload', handleBeforeUnload)

  if (registerBeforeNavigate) {
    unregisterBeforeNavigate = registerBeforeNavigate(() => {
      if (hasChanges.value) {
        return window.confirm(locale.value.confirmations.switchPageUnsaved)
      }
      return true
    })
  }

  songsService = useSongs()
  adminService = useAdmin()
  auth = useAuth()
  semesterService = useSemesters()

  await useSyncedTime().syncTime()
  suppressSelectedDateLoad = true
  selectedDate.value = getTodayDateValue()
  await nextTick()
  suppressSelectedDateLoad = false

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

  // 自动排期弹窗 Esc 关闭
  window.addEventListener('keydown', handleAutoScheduleEscape)
})

// 滚动到指定日期元素
const scrollToDateElement = (behavior = 'smooth') => {
  if (!dateSelector.value || !selectedDate.value) return

  const el = dateSelector.value.querySelector(`[data-date="${selectedDate.value}"]`)
  if (el) {
    if (behavior === 'smooth') {
      const listRect = dateSelector.value.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const scrollLeft = dateSelector.value.scrollLeft

      let target =
        scrollLeft + (elRect.left - listRect.left) - listRect.width / 2 + elRect.width / 2

      const maxScroll = dateSelector.value.scrollWidth - dateSelector.value.clientWidth
      target = Math.max(0, Math.min(target, maxScroll))

      targetScrollLeft = target
      smoothScrollTo(dateSelector.value, target, 400)
    } else {
      el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
    }
  }
}

// 清理事件监听器
onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)

  if (unregisterBeforeNavigate) {
    unregisterBeforeNavigate()
  }

  // 组件卸载时中止批量刷新进行中的请求
  if (refreshAllAbortController) {
    refreshAllAbortController.abort()
    refreshAllAbortController = null
  }
  if (refreshAutoCandidatesAbortController) {
    refreshAutoCandidatesAbortController.abort()
    refreshAutoCandidatesAbortController = null
  }

  if (dateSelector.value) {
    dateSelector.value.removeEventListener('wheel', handleDateSelectorWheel)
    dateSelector.value.removeEventListener('scroll', updateScrollButtonState)
  }
  window.removeEventListener('resize', checkWindowSize)

  // 清理自动排期弹窗 Esc 监听
  window.removeEventListener('keydown', handleAutoScheduleEscape)

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }

  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
    scrollTimeout = null
  }
})

// 打开手动日期选择器
const openManualDatePicker = () => {
  manualSelectedDate.value = selectedDate.value
  showManualDatePicker.value = true
}

// 确认手动日期选择
const confirmManualDate = () => {
  if (manualSelectedDate.value) {
    if (selectedDate.value === manualSelectedDate.value) {
      showManualDatePicker.value = false
      return
    }

    if (hasChanges.value) {
      if (!window.confirm(locale.value.confirmations.switchDateUnsaved)) {
        return
      }
    }

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
  const todayStr = getTodayDateValue()
  const isAlreadyToday = selectedDate.value === todayStr

  if (!isAlreadyToday) {
    if (hasChanges.value && !window.confirm(locale.value.confirmations.switchDateUnsaved)) {
      return
    }
    selectedDate.value = todayStr
  }

  // 确保今天在范围内
  if (dateRange.value.start > 0 || dateRange.value.end < 0) {
    dateRange.value.start = -15
    dateRange.value.end = 15
  }

  nextTick(() => {
    scrollToDateElement('smooth')
  })
}

// 监听日期变化
watch(selectedDate, async () => {
  if (suppressSelectedDateLoad) return
  await loadData()
})

// 重置所有分页状态
const resetAllPages = () => {
  pageStates.normal = 1
  pageStates.replay = 1
  pageStates.all = 1
  pageStates.pool = 1
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

// 监听期望时段筛选变化，重置分页
watch(selectedFilterPlayTime, () => {
  resetAllPages()
})

// 加载重播申请
const fetchReplayRequests = async () => {
  try {
    // 与歌曲列表一致，按当前选中学期过滤；选择"全部"时不传学期参数
    const selectedSemesterOption = availableSemesters.value.find((item) => String(item.id) === String(selectedSemester.value))
    const semester = selectedSemester.value === 'all' ? undefined : selectedSemesterOption?.name
    const data = await $fetch('/api/admin/replay-requests', {
      ...auth.getAuthConfig(),
      query: { status: 'PENDING', ...(semester ? { semester } : {}) }
    })
    replayRequests.value = data || []
  } catch (err) {
    console.error('Failed to fetch replay requests', err)
    replayRequests.value = []
  }
}

// 加载备选池
const fetchSongPool = async () => {
  poolLoading.value = true
  try {
    const data = await $fetch('/api/admin/schedule/song-pool', {
      ...auth.getAuthConfig()
    })
    songPool.value = data?.pool || []
  } catch (err) {
    console.error('加载备选池失败:', err)
    songPool.value = []
  } finally {
    poolLoading.value = false
  }
}

// 从待排库批量移入备选池
const moveAllToPool = async () => {
  const pageSongs = filteredUnscheduledSongs.value.filter((song) => !poolSongIds.value.has(song.id))
  const pendingSongIds = pageSongs.map((s) => s.id)
  if (pendingSongIds.length === 0) return

  confirmDialogTitle.value = locale.value.addCurrentPageConfirmTitle
  confirmDialogMessage.value = locale.value.addCurrentPageConfirmMessage(pendingSongIds.length, currentPage.value)
  confirmDialogType.value = 'warning'
  confirmDialogConfirmText.value = locale.value.confirm

  confirmAction.value = async () => {
    try {
      const songDurations = (await Promise.all(
        pageSongs
          .filter((song) => !song.durationSeconds && song.musicPlatform && song.musicId)
          .map(async (song) => {
            const durationSeconds = await resolveClientAudioDuration(song)
            return durationSeconds ? { songId: song.id, durationSeconds } : null
          })
      )).filter(Boolean)
      const result = await $fetch('/api/admin/schedule/song-pool', {
        method: 'POST',
        ...auth.getAuthConfig(),
        body: { songIds: pendingSongIds, songDurations }
      })
      await fetchSongPool()
      const added = result.added || []
      const skipped = result.skipped || []
      if (added.length > 0) {
        window.$showNotification && window.$showNotification(
          `${locale.value.addCurrentPageSuccess(added.length)}`,
          'success'
        )
      }
      if (skipped.length > 0) {
        const reasons = skipped.map((s) => s.reason).join('、')
        window.$showNotification && window.$showNotification(
          `${locale.value.addAllPendingSkipped(skipped.length)}（${reasons}）`,
          'warning'
        )
      }
    } catch (err) {
      console.error('移入备选池失败:', err)
      window.$showNotification && window.$showNotification(
        locale.value.addAllPendingFailed,
        'error'
      )
    }
  }

  showConfirmDialog.value = true
}

// 单首加入备选池
const addSingleToPool = async (songId) => {
  try {
    const result = await $fetch('/api/admin/schedule/song-pool', {
      method: 'POST',
      ...auth.getAuthConfig(),
      body: { songIds: [songId] }
    })
    await fetchSongPool()
    const added = result.added || []
    const skipped = result.skipped || []
    if (added.length > 0) {
      window.$showNotification && window.$showNotification(
        locale.value.addSingleToPoolSuccess,
        'success'
      )
    } else if (skipped.length > 0) {
      const reason = skipped[0]?.reason || ''
      window.$showNotification && window.$showNotification(
        `${locale.value.addSingleToPoolSkipped}（${reason}）`,
        'warning'
      )
    }
  } catch (err) {
    console.error('加入备选池失败:', err)
  }
}

// 从备选池移除
const removeFromPool = async (songId) => {
  try {
    await $fetch('/api/admin/schedule/song-pool', {
      method: 'DELETE',
      ...auth.getAuthConfig(),
      query: { songIds: songId }
    })
    await fetchSongPool()
    window.$showNotification && window.$showNotification(
      locale.value.removeFromPoolSuccess,
      'success'
    )
  } catch (err) {
    console.error('从备选池移除失败:', err)
    window.$showNotification && window.$showNotification(
      locale.value.removeFromPoolFailed,
      'error'
    )
  }
}

// 拒绝重播申请
const rejectReplayRequest = async (songId) => {
  confirmDialogTitle.value = locale.value.confirmations.rejectReplayTitle
  confirmDialogMessage.value = locale.value.confirmations.rejectReplayMessage
  confirmDialogType.value = 'warning'
  confirmDialogConfirmText.value = locale.value.rejectRequest

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
        window.$showNotification(locale.value.messages.replayRejected, 'success')
      }
    } catch (err) {
      console.error('拒绝申请失败', err)
      if (window.$showNotification) {
        const message = getThrownMessage(err) || '未知错误'
        window.$showNotification(
          callLocale('errors.rejectReplayFailed', `拒绝申请失败: ${message}`, message),
          'error'
        )
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
    const selectedSemesterOption = availableSemesters.value.find((item) => String(item.id) === String(selectedSemester.value))
    const semester = selectedSemester.value === 'all' ? undefined : selectedSemesterOption?.name

    // 播放列表应该显示所有学期的排期，不受待排歌曲学期选择的影响
    // 因为在界面上我们是按日期（selectedDate）来过滤显示排期的
    // 并行加载数据
    await Promise.all([
      songsService.fetchSongs(false, semester, true),
      songsService.fetchPublicSchedules(false, undefined, true),
      loadPlayTimes(),
      loadDrafts(), // 加载草稿列表
      fetchReplayRequests() // 加载重播申请
    ])

    songs.value = songsService.songs.value
    publicSchedules.value = songsService.publicSchedules.value

    // 在草稿加载完成后再更新本地排期数据
    updateLocalScheduledSongs()
    hasChanges.value = false
    // 加载备选池
    await fetchSongPool()
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

const readClientAudioDuration = (song, signal, sourceUrl = song?.playUrl) => {
  if (!import.meta.client || !sourceUrl) return Promise.resolve(null)

  return new Promise((resolve) => {
    const audio = new Audio()
    let settled = false
    const timeoutId = window.setTimeout(() => finish(null), 8000)

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.src = ''
      audio.load()
      signal?.removeEventListener('abort', abort)
    }
    const finish = (duration) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(Number.isFinite(duration) && duration >= 30 && duration <= 3600 ? Math.floor(duration) : null)
    }
    const abort = () => finish(null)

    if (signal?.aborted) {
      finish(null)
      return
    }
    signal?.addEventListener('abort', abort, { once: true })
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => finish(audio.duration)
    audio.onerror = () => finish(null)
    audio.src = convertToHttps(sourceUrl)
  })
}

// 按播放器相同的音源解析顺序读取时长，失败后切换到其他音源。
const resolveClientAudioDuration = async (song, signal) => {
  if (!import.meta.client || !song?.musicPlatform || !song?.musicId) return null

  const excludeSources = []
  const hasPlayUrl = Boolean(song.playUrl && String(song.playUrl).trim())
  let ignoreProvidedUrl = !hasPlayUrl
  const isPodcast =
    song.musicPlatform === 'netease-podcast' ||
    song.sourceInfo?.type === 'voice' ||
    (song.sourceInfo?.source === 'netease-backup' && song.sourceInfo?.type === 'voice')
  const mediaId = song.sourceInfo?.strMediaMid || song.sourceInfo?.mediaId || song.sourceInfo?.mediaMid

  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) return null

    let candidate
    try {
      candidate = await getMusicUrlResult(
        song.musicPlatform,
        song.musicId,
        song.playUrl,
        {
          unblock: isPodcast ? false : undefined,
          mediaId,
          ignoreProvidedUrl,
          excludeSources,
          musicInfo: {
            name: song.title,
            artist: song.artist,
            album: song.album || undefined
          }
        }
      )
    } catch {
      if (!ignoreProvidedUrl && hasPlayUrl) {
        ignoreProvidedUrl = true
        continue
      }
      return null
    }

    const sourceUrl = candidate?.url
    if (!sourceUrl || (song.musicPlatform === 'tencent' && isKnownInvalidQqAudioUrl(sourceUrl))) {
      if (candidate?.source === 'play-url') {
        ignoreProvidedUrl = true
      } else if (candidate?.source && !excludeSources.includes(candidate.source)) {
        excludeSources.push(candidate.source)
      }
      continue
    }

    const duration = await readClientAudioDuration(song, signal, sourceUrl)
    if (signal?.aborted) return null
    const isNetease = song.musicPlatform === 'netease' || song.musicPlatform === 'netease-podcast'
    if (duration != null && !(isNetease && duration === 30)) {
      return duration
    }

    if (candidate.source === 'play-url') {
      ignoreProvidedUrl = true
    } else if (candidate.source && !excludeSources.includes(candidate.source)) {
      excludeSources.push(candidate.source)
    } else {
      ignoreProvidedUrl = true
    }
  }

  return null
}

/**
 * 并发执行任务列表，限制同时进行数。
 * @param {Array<{fn:(signal)=>Promise, signal:AbortSignal}>} items
 * @param {number} concurrency 并发数，默认 3
 * @param {(done:number,total:number)=>void} [onProgress] 进度回调
 * @returns {Promise<Array<{ok:boolean,result:any}>>} 保持原始顺序
 */
const runConcurrent = async (items, concurrency = 3, onProgress, onItemComplete) => {
  const results = new Array(items.length)
  let nextIndex = 0
  let completed = 0
  let aborted = false

  const worker = async () => {
    while (nextIndex < items.length && !aborted) {
      const idx = nextIndex++
      const item = items[idx]
      let entry
      try {
        if (item.signal?.aborted) {
          aborted = true
          entry = { ok: false, result: null }
        } else {
          const res = await item.fn(item.signal)
          entry = { ok: true, result: res }
        }
      } catch (err) {
        entry = { ok: false, result: err }
      }
      results[idx] = entry
      completed++
      onProgress?.(completed, items.length)
      onItemComplete?.(idx, entry)
    }
  }

  const workers = []
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(worker())
  }

  await Promise.all(workers)
  return results
}

const requestSongDuration = async (song, signal) => {
  const clientDuration = await resolveClientAudioDuration(song, signal)
  if (clientDuration != null) {
    return await $fetch('/api/admin/songs/duration', {
      method: 'POST',
      body: { songId: song.id, durationSeconds: clientDuration },
      signal,
      ...auth.getAuthConfig()
    })
  }

  return await $fetch('/api/admin/songs/duration', {
    method: 'POST',
    body: { songId: song.id },
    signal,
    ...auth.getAuthConfig()
  })
}

// 刷新歌曲时长
const refreshDuration = async (song) => {
  const songId = song.id
  if (!song.musicPlatform || !song.musicId) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.messages.durationNoPlatform, 'warning')
    }
    return
  }

  // 清除上次刷新状态
  delete durationRefreshStatus.value[songId]
  refreshingDuration.value[songId] = true
  try {
    const result = await requestSongDuration(song)

    if (result.success && result.durationSeconds) {
      // 更新待排歌曲列表
      const songIndex = songs.value.findIndex((s) => s.id === songId)
      if (songIndex !== -1) {
        songs.value[songIndex].durationSeconds = result.durationSeconds
      }
      // 更新已排歌曲列表
      for (const schedule of localScheduledSongs.value) {
        if (schedule.song && schedule.song.id === songId) {
          schedule.song.durationSeconds = result.durationSeconds
          break
        }
      }
      // 更新备选池
      for (const p of songPool.value) {
        if (p.songId === songId) { p.durationSeconds = result.durationSeconds; break }
      }
      // 更新重播申请
      for (const r of replayRequests.value) {
        if (r.id === songId) { r.durationSeconds = result.durationSeconds; break }
      }
      // 标记成功，3 秒后清除颜色标记
      durationRefreshStatus.value[songId] = 'success'
      setTimeout(() => {
        if (durationRefreshStatus.value[songId] === 'success') {
          delete durationRefreshStatus.value[songId]
        }
      }, 3000)
      if (window.$showNotification) {
        window.$showNotification(locale.value.messages.durationUpdated, 'success')
      }
    } else {
      // 标记失败
      durationRefreshStatus.value[songId] = 'error'
      setTimeout(() => {
        if (durationRefreshStatus.value[songId] === 'error') {
          delete durationRefreshStatus.value[songId]
        }
      }, 3000)
      if (window.$showNotification) {
        window.$showNotification(locale.value.messages.durationFailed, 'error')
      }
    }
  } catch (err) {
    console.error('刷新时长失败:', err)
    // 标记失败
    durationRefreshStatus.value[songId] = 'error'
    setTimeout(() => {
      if (durationRefreshStatus.value[songId] === 'error') {
        delete durationRefreshStatus.value[songId]
      }
    }, 3000)
    if (window.$showNotification) {
      window.$showNotification(localizeServerError(err), 'error')
    }
  } finally {
    delete refreshingDuration.value[songId]
  }
}

// 批量刷新时长 AbortController
let refreshAllAbortController = null
let refreshAutoCandidatesAbortController = null

// 批量刷新歌曲时长
// source: 'pending' = 待排库（默认），'scheduled' = 播放顺序
const refreshAllDurations = async (source = 'pending') => {
  // 中止上次未完成的批量刷新
  refreshAllAbortController?.abort()
  refreshAllAbortController = new AbortController()
  const { signal } = refreshAllAbortController

  // 根据 source 确定目标歌曲列表
  const targets = []
  if (source === 'scheduled') {
    const seen = new Set()
    for (const schedule of localScheduledSongs.value) {
      const song = schedule.song
      if (song?.musicPlatform && song?.musicId && !seen.has(song.id)) {
        seen.add(song.id)
        targets.push(song)
      }
    }
  } else {
    const seen = new Set()
    for (const song of filteredUnscheduledSongs.value) {
      if (song.musicPlatform && song.musicId && !seen.has(song.id)) {
        seen.add(song.id)
        targets.push(song)
      }
    }
  }

  if (targets.length === 0) {
    if (window.$showNotification) {
      window.$showNotification(callLocale('allDurationsSkipped', '当前无可刷新时长的歌曲'), 'info')
    }
    return
  }

  const toRefresh = targets

  refreshingAllDurations.value = {
    running: true,
    progress: callLocale('allDurationsProgressTotal', `${toRefresh.length} 首歌`, toRefresh.length),
    done: 0,
    total: toRefresh.length
  }
  let successCount = 0
  let failCount = 0

  // 将单首歌结果写入 UI 状态（先获取到的先显示）
  const applyRefreshResult = (song, result) => {
    if (result.success && result.durationSeconds) {
      const dur = result.durationSeconds
      // 更新已排歌曲列表
      for (const schedule of localScheduledSongs.value) {
        if (schedule.song && schedule.song.id === song.id) {
          schedule.song.durationSeconds = dur
          break
        }
      }
      // 更新待排歌曲列表
      const songIndex = songs.value.findIndex((s) => s.id === song.id)
      if (songIndex !== -1) {
        songs.value[songIndex].durationSeconds = dur
      }
      for (const poolItem of songPool.value) {
        if (poolItem.songId === song.id) poolItem.durationSeconds = dur
      }
      // 标记成功（颜色统一在全部完成后清除）
      durationRefreshStatus.value[song.id] = 'success'
      successCount++
    } else {
      // 标记失败
      durationRefreshStatus.value[song.id] = 'error'
      failCount++
    }
  }

  const resultsPromise = runConcurrent(
    toRefresh.map((song) => ({
      fn: async (sig) => {
        if (sig.aborted) return { songId: song.id, aborted: true }
        const r = await requestSongDuration(song, sig)
        return { songId: song.id, ...r }
      },
      signal
    })),
    3,
    (completed) => {
      refreshingAllDurations.value.done = completed
    },
    (idx, entry) => {
      const song = toRefresh[idx]
      if (!song || !entry || entry.aborted) return
      applyRefreshResult(song, entry.result)
      // 同时更新完成数和进度提示
      refreshingAllDurations.value.done = successCount + failCount
      refreshingAllDurations.value.progress = callLocale(
        'allDurationsProgressWithCount',
        `${successCount + failCount}/${toRefresh.length}（成功${successCount} 失败${failCount}）`,
        `${successCount + failCount}`, `${toRefresh.length}`, `${successCount}`, `${failCount}`
      )
    }
  )

  try {
    // 等所有歌曲处理完
    await resultsPromise
  } finally {
    // 等待 2 秒后统一清除颜色标记
    await new Promise((r) => setTimeout(r, 2000))
    for (const song of toRefresh) {
      delete durationRefreshStatus.value[song.id]
    }
    refreshAllAbortController = null
    refreshingAllDurations.value = { running: false, progress: '', done: 0, total: 0 }
  }

  if (window.$showNotification) {
    if (successCount > 0 && failCount === 0) {
      window.$showNotification(locale.value.messages.allDurationsUpdated(successCount), 'success')
    } else if (successCount > 0 && failCount > 0) {
      window.$showNotification(locale.value.messages.allDurationsPartial(successCount, failCount), 'warning')
    } else {
      window.$showNotification(locale.value.messages.allDurationsFailed, 'error')
    }
  }
}

// 刷新自动排期候选歌曲的时长
const refreshAutoCandidateDurations = async () => {
  // 中止上次未完成的刷新
  refreshAutoCandidatesAbortController?.abort()
  refreshAutoCandidatesAbortController = new AbortController()
  const { signal } = refreshAutoCandidatesAbortController

  const candidates = autoScheduleCandidates.value
  if (candidates.length === 0) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.messages.candidateDurationsSkipped, 'info')
    }
    return
  }

  const toRefresh = candidates.filter((s) => s.musicPlatform && s.musicId)
  if (toRefresh.length === 0) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.messages.candidateDurationsSkipped, 'info')
    }
    return
  }

  refreshingAutoCandidates.value = {
    running: true,
    progress: callLocale('candidateDurationsProgressTotal', `${toRefresh.length} 首歌`, `${toRefresh.length} songs`),
    success: 0,
    fail: 0
  }
  let successCount = 0
  let failCount = 0

  // 将单首歌结果写入 UI 状态（先获取到的先显示）
  const applyRefreshResult = (song, result) => {
    if (result.success && result.durationSeconds) {
      const dur = result.durationSeconds
      const songIdx = songs.value.findIndex((s) => s.id === song.id)
      if (songIdx !== -1) songs.value[songIdx].durationSeconds = dur
      for (const r of replayRequests.value) {
        if (r.id === song.id) { r.durationSeconds = dur; break }
      }
      for (const p of songPool.value) {
        if (p.songId === song.id) { p.durationSeconds = dur; break }
      }
      durationRefreshStatus.value[song.id] = 'success'
      successCount++
    } else {
      durationRefreshStatus.value[song.id] = 'error'
      failCount++
    }
  }

  const resultsPromise = runConcurrent(
    toRefresh.map((song) => ({
      fn: async (sig) => {
        if (sig.aborted) return { songId: song.id, aborted: true }
        const r = await requestSongDuration(song, sig)
        return { songId: song.id, ...r }
      },
      signal
    })),
    3,
    (completed) => {
      refreshingAutoCandidates.value.success = completed - failCount
      refreshingAutoCandidates.value.fail = failCount
      refreshingAutoCandidates.value.progress = `${completed} / ${toRefresh.length}`
    },
    (idx, entry) => {
      const song = toRefresh[idx]
      if (!song || !entry || entry.aborted) return
      applyRefreshResult(song, entry.result)
      refreshingAutoCandidates.value.success = successCount
      refreshingAutoCandidates.value.fail = failCount
      refreshingAutoCandidates.value.progress = `${successCount + failCount} / ${toRefresh.length}`
    }
  )

  try {
    // 等所有歌曲处理完
    await resultsPromise
  } finally {
    // 等待 2 秒后统一清除颜色标记
    await new Promise((r) => setTimeout(r, 2000))
    for (const song of toRefresh) {
      delete durationRefreshStatus.value[song.id]
    }
    refreshAutoCandidatesAbortController = null
    refreshingAutoCandidates.value = { running: false, progress: '' }
  }

  if (window.$showNotification) {
    if (successCount > 0 && failCount === 0) {
      window.$showNotification(locale.value.messages.candidateDurationsUpdated(successCount), 'success')
    } else if (successCount > 0 && failCount > 0) {
      window.$showNotification(locale.value.messages.candidateDurationsPartial(successCount, failCount), 'warning')
    } else {
      window.$showNotification(locale.value.messages.candidateDurationsFailed, 'error')
    }
  }
}

// ===== 自动排期 =====
// 自动排期弹窗 Esc 关闭
const handleAutoScheduleEscape = (e) => {
  if (e.key === 'Escape' && showAutoScheduleDialog.value) {
    closeAutoScheduleDialog()
  }
}

const openAutoScheduleDialog = () => {
  autoScheduleResult.value = { songs: [], totalDuration: 0, diff: 0, absDiff: 0 }
  autoSchedulePlans.value = []
  currentPlanIndex.value = 0
  autoScheduleAlgorithm.value = 'auto'
  autoScheduleTargetSongCount.value = null
  autoScheduleFixExisting.value = false
  showAutoScheduleDialog.value = true
}
const closeAutoScheduleDialog = () => {
  showAutoScheduleDialog.value = false
  autoScheduleResult.value = { songs: [], totalDuration: 0, diff: 0, absDiff: 0 }
  autoSchedulePlans.value = []
  currentPlanIndex.value = 0
  autoScheduleAlgorithm.value = 'auto'
  autoScheduleTargetSongCount.value = null
  autoScheduleFixExisting.value = false
}
const resetAutoSchedule = () => {
  autoScheduleResult.value = { songs: [], totalDuration: 0, diff: 0, absDiff: 0 }
  autoSchedulePlans.value = []
  currentPlanIndex.value = 0
  autoScheduleAlgorithm.value = 'auto'
  autoScheduleTargetSongCount.value = null
  autoScheduleFixExisting.value = false
}

const autoScheduleCandidates = computed(() => {
  const scheduledIds = new Set(localScheduledSongs.value.map((s) => s.song && s.song.id).filter(Boolean))

  // 备选池模式
  if (activeTab.value === 'pool') {
    return songPool.value
      .filter((item) => !scheduledIds.has(item.songId))
      .map(poolCandidateFromItem)
  }

  // 待排库/重播/所有：复用 allUnscheduledSongs 的过滤逻辑，再排除已排期歌曲
  const base = allUnscheduledSongs.value.filter((s) => !scheduledIds.has(s.id))
  if (activeTab.value === 'all') {
    // 「所有」额外纳入备选池未排期的歌曲
    const poolCandidates = songPool.value
      .filter((item) => !scheduledIds.has(item.songId))
      .map(poolCandidateFromItem)
    const baseIds = new Set(base.map((s) => s.id))
    return [...base, ...poolCandidates.filter((p) => !baseIds.has(p.songId))]
  }
  return base
})

const buildPreSelected = () => {
  return autoScheduleFixExisting.value ? localScheduledSongs.value.filter(
    (s) => typeof s.song.durationSeconds === 'number' && s.song.durationSeconds > 0
  ).map((s) => ({
    id: s.song.id,
    songId: s.song.id,
    title: s.song.title,
    artist: s.song.artist,
    durationSeconds: s.song.durationSeconds || 0,
    replayRequestId: s.replayRequestId || null,
    musicId: s.song.musicId || null,
    musicPlatform: s.song.musicPlatform || null,
    requester: s.song.requester || null,
    cover: s.song.cover || null,
    createdAt: s.song.createdAt || null
  })) : []
}

const runAutoSchedule = () => {
  const candidates = autoScheduleCandidates.value
  const candidateIds = new Set(candidates.map((s) => s.id))
  const preSelected = buildPreSelected()
  const fn = autoScheduleAlgorithm.value === 'auto'
    ? (autoScheduleCandidates.value.length < 20 ? autoScheduleExhaustive : autoSchedule)
    : (autoScheduleAlgorithm.value === 'exhaustive' ? autoScheduleExhaustive : autoSchedule)
  const targetSongCount = Number.isFinite(autoScheduleTargetSongCount.value) && autoScheduleTargetSongCount.value > 0
    ? Math.floor(autoScheduleTargetSongCount.value)
    : null
  const results = fn(autoScheduleDirection.value, autoScheduleTargetMinutes.value, candidates, preSelected, 10, targetSongCount)
  const plansArray = Array.isArray(results) ? results : [results]
  const first = plansArray[0]
  if (!first || first.songs.length === 0) {
    if (window.$showNotification) {
      window.$showNotification(callLocale('messages.autoScheduleNoResult', '未能找到满足条件的歌曲组合'), 'warning')
    }
    return
  }
  autoSchedulePlans.value = plansArray.map((p) => ({ ...p, candidateIds }))
  currentPlanIndex.value = 0
  autoScheduleResult.value = autoSchedulePlans.value[0]
}

const generateMorePlans = async () => {
  if (generatingNewPlan.value) return
  generatingNewPlan.value = true
  const candidates = autoScheduleCandidates.value
  const candidateIds = new Set(candidates.map((s) => s.id))
  const preSelected = buildPreSelected()

  // 动态 plansCount：已有方案数 + 10，确保新增返回新的解
  const requestCount = autoSchedulePlans.value.length + 10
  const fn = autoScheduleAlgorithm.value === 'auto'
    ? (autoScheduleCandidates.value.length < 20 ? autoScheduleExhaustive : autoSchedule)
    : (autoScheduleAlgorithm.value === 'exhaustive' ? autoScheduleExhaustive : autoSchedule)
  const targetSongCount = Number.isFinite(autoScheduleTargetSongCount.value) && autoScheduleTargetSongCount.value > 0
    ? Math.floor(autoScheduleTargetSongCount.value)
    : null
  const results = fn(autoScheduleDirection.value, autoScheduleTargetMinutes.value, candidates, preSelected, requestCount, targetSongCount)
  const plansArray = Array.isArray(results) ? results : [results]
  const existingKeys = new Set(autoSchedulePlans.value.map((p) => p.songs.map((s) => s.id).sort().join(',')))
  let addedCount = 0
  let firstNewIndex = 0
  for (const plan of plansArray) {
    const key = plan.songs.map((s) => s.id).sort().join(',')
    if (!existingKeys.has(key) && plan.songs.length > 0) {
      autoSchedulePlans.value.push({ ...plan, candidateIds })
      existingKeys.add(key)
      if (addedCount === 0) firstNewIndex = autoSchedulePlans.value.length - 1
      addedCount++
    }
  }
  if (addedCount > 0) {
    // 跳到第一个新增方案，不跳末尾
    currentPlanIndex.value = firstNewIndex
    autoScheduleResult.value = autoSchedulePlans.value[currentPlanIndex.value]
  } else if (window.$showNotification) {
    window.$showNotification(callLocale('messages.autoScheduleNoMorePlans', '已无更多不同方案'), 'warning')
  }
  generatingNewPlan.value = false
}

// 切换到上一个方案
const goToPreviousPlan = () => {
  if (currentPlanIndex.value > 0) {
    currentPlanIndex.value--
    autoScheduleResult.value = autoSchedulePlans.value[currentPlanIndex.value]
  }
}

// 切换到下一个方案；穷举模式下到末尾则新增方案
const goToNextPlan = () => {
  if (currentPlanIndex.value < autoSchedulePlans.value.length - 1) {
    currentPlanIndex.value++
    autoScheduleResult.value = autoSchedulePlans.value[currentPlanIndex.value]
  } else if (actualExhaustive.value) {
    generateMorePlans()
  }
}

const confirmAutoSchedule = () => {
  const candidateIds = autoScheduleResult.value.candidateIds || new Set()
  const confirmed = autoScheduleResult.value.songs.filter((song) =>
    candidateIds.has(song.id)
  )
  const baseId = Date.now()
  let appliedCount = 0
  let appliedTotalSec = 0
  for (let i = 0; i < confirmed.length; i++) {
    const song = confirmed[i]
    const existingIndex = localScheduledSongs.value.findIndex((s) => s.song.id === song.id)
    if (existingIndex !== -1) continue

    const newSchedule = {
      id: baseId + i,
      replayRequestId: song.replayRequestId || null,
      song,
      playDate: selectedDate.value,
      sequence: localScheduledSongs.value.length + 1,
      isNew: true,
      isLocalOnly: true
    }
    scheduledSongIds.value.add(song.id)
    setSongScheduledFlag(song.id, true)
    localScheduledSongs.value.push(newSchedule)
    hasChanges.value = true
    appliedCount++
    appliedTotalSec += song.durationSeconds
  }
  if (appliedCount > 0 && window.$showNotification) {
    window.$showNotification(
      locale.value.messages.confirmAutoScheduleApplied(appliedCount, formatDuration(appliedTotalSec)),
      'success'
    )
  }
  closeAutoScheduleDialog()
}

// 格式化播出时段时间范围
const formatPlayTimeRange = (playTime) => {
  if (!playTime) return ''

  const start = playTime.startTime || '00:00'
  const end = playTime.endTime || '23:59'

  if (playTime.startTime && playTime.endTime) {
    return `${start} - ${end}`
  } else if (playTime.startTime) {
    return callLocale('playTimeStart', `${start} 开始`, start)
  } else if (playTime.endTime) {
    return callLocale('playTimeEnd', `${end} 结束`, end)
  }

  return locale.value.allDay
}

// 获取播出时段名称
const getPlayTimeName = (playTimeId) => {
  if (!playTimeId || !playTimes.value) return ''
  const playTime = playTimes.value.find((pt) => pt.id === playTimeId)
  if (!playTime) return ''

  let label = playTime.name
  if (playTime.startTime || playTime.endTime) {
    label += ` (${formatPlayTimeRange(playTime)})`
  }
  return label
}

// 加载学期列表
const loadSemesters = async () => {
  try {
    await semesterService.fetchSemesters()
    await semesterService.fetchCurrentSemester()

    // 构建学期列表，包含"全部"选项和各个学期
  const semesterList = [{ id: 'all', name: locale.value.allSemesters, isCurrent: false }]

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
      selectedSemester.value = semesterService.currentSemester.value.id || 'current'
    } else if (semesterList.length > 0) {
      selectedSemester.value = semesterList[0].id
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
    const scheduleDateStr = getScheduleDateValue(s.playDate)
    return scheduleDateStr === selectedDate.value
  })

  // 获取草稿排期
  const todayDrafts = drafts.value.filter((draft) => {
    if (!draft.playDate) return false
    const draftDateStr = getScheduleDateValue(draft.playDate)
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
      songId: song.id,
      replayRequestId: song.replayRequestId || null
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
      addSongToScheduleFromDrag(event)
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
      insertSongToScheduleAt(event, dropIndex)
    }
  } catch (err) {
    console.error('处理重排序失败:', err)
  }

  draggedSchedule.value = null
}

// 同步歌曲列表中对应歌曲的已排期标记（排期与歌曲列表中的歌曲是不同引用）
const setSongScheduledFlag = (songId, scheduled) => {
  const songInList = songs.value.find((s) => s.id === songId)
  if (songInList) songInList.scheduled = scheduled
}

// 从拖拽数据中查找歌曲（优先查 songs/replayRequests，再回退到 pool）
const findSongFromDragData = (dragData) => {
  const songId = parseInt(dragData.songId)
  const isReplayRequest = dragData.replayRequestId != null
  let song = isReplayRequest
    ? replayRequests.value.find((s) => s.replayRequestId === dragData.replayRequestId)
    : songs.value.find((s) => s.id === songId)
  if (!song) {
    song = replayRequests.value.find((s) => s.id === songId)
  }
  if (!song) {
    const poolItem = songPool.value.find((p) => p.songId === songId)
    if (poolItem) {
      song = {
        id: poolItem.songId,
        title: poolItem.title,
        artist: poolItem.artist,
        durationSeconds: poolItem.durationSeconds || null,
        cover: poolItem.cover || null,
        musicId: poolItem.musicId || null,
        musicPlatform: poolItem.musicPlatform || null,
        requester: poolItem.requester || null,
        requesterId: poolItem.requesterId || null,
        requesterGrade: poolItem.requesterGrade || null,
        requesterClass: poolItem.requesterClass || null,
        grade: poolItem.grade || null,
        class: poolItem["class"] || null,
        voteCount: poolItem.voteCount || 0,
        cardCodeId: poolItem.cardCodeId || null,
        usedCardCode: poolItem.usedCardCode || false,
        hasSubmissionNote: poolItem.hasSubmissionNote || false,
        submissionNote: poolItem.submissionNote || null,
        preferredPlayTimeId: poolItem.preferredPlayTimeId || null,
        semester: poolItem.semester || null
      }
    }
  }
  return { song, songId }
}

// 从拖拽数据中提取歌曲并添加到排期列表末尾（共享逻辑）
const addSongToScheduleFromDrag = (event) => {
  const { song, songId } = findSongFromDragData(JSON.parse(event.dataTransfer.getData('text/plain')) || {})
  if (!song) return

  const existingIndex = localScheduledSongs.value.findIndex((s) => s.song.id === songId)
  if (existingIndex !== -1) return

  const insertIndex = localScheduledSongs.value.length

  const newSchedule = {
    id: Date.now(),
    replayRequestId: song.replayRequestId || null,
    song: song,
    playDate: selectedDate.value,
    sequence: insertIndex + 1,
    isNew: true,
    isLocalOnly: true
  }

  scheduledSongIds.value.add(songId)
  setSongScheduledFlag(songId, true)
  localScheduledSongs.value.push(newSchedule)
  hasChanges.value = true
}

// 从拖拽数据中提取歌曲并插入到指定位置（共享逻辑）
const insertSongToScheduleAt = (event, dropIndex) => {
  const dragData = JSON.parse(event.dataTransfer.getData('text/plain'))
  const { song, songId } = findSongFromDragData(dragData)
  if (!song) return

  const existingIndex = localScheduledSongs.value.findIndex((s) => s.song.id === songId)
  if (existingIndex !== -1) return

  const newSchedule = {
    id: Date.now(),
    replayRequestId: song.replayRequestId || null,
    song: song,
    playDate: selectedDate.value,
    sequence: dropIndex + 1,
    isNew: true
  }

  scheduledSongIds.value.add(songId)
  setSongScheduledFlag(songId, true)

  const newOrder = [...localScheduledSongs.value]
  newOrder.splice(dropIndex, 0, newSchedule)
  newOrder.forEach((item, index) => {
    item.sequence = index + 1
  })

  localScheduledSongs.value = newOrder
  hasChanges.value = true
}

// 添加歌曲到排期（点击方式）
const addSongToSchedule = (song) => {
  const existingIndex = localScheduledSongs.value.findIndex((s) => s.song.id === song.id)
  if (existingIndex !== -1) return

  const newSchedule = {
    id: Date.now(),
    replayRequestId: song.replayRequestId || null,
    song: song,
    playDate: selectedDate.value,
    sequence: localScheduledSongs.value.length + 1,
    isNew: true,
    isLocalOnly: true
  }

  scheduledSongIds.value.add(song.id)
  setSongScheduledFlag(song.id, true)
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
      setSongScheduledFlag(removed.song.id, false)
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
          // 同步清除歌曲列表中的已排期标记，否则已发布歌曲移出后会从待排列表中消失
          setSongScheduledFlag(removed.song.id, false)
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

  confirmDialogTitle.value = locale.value.confirmations.markAllPlayedTitle
  confirmDialogMessage.value = locale.value.confirmations.markAllPlayedMessage
  confirmDialogType.value = 'info'
  confirmDialogConfirmText.value = locale.value.confirmations.markAllPlayedConfirm

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
        window.$showNotification(locale.value.messages.allMarkedPlayed, 'success')
      }

      // 重新加载数据
      await loadData()
    } catch (err) {
      console.error('标记播放失败:', err)
      if (window.$showNotification) {
        window.$showNotification(locale.value.errors.operationFailed, 'error')
      }
    } finally {
      loading.value = false
    }
  }

  showConfirmDialog.value = true
}

// 清空排期列表
const clearScheduleList = () => {
  if (localScheduledSongs.value.length === 0) return

  confirmDialogTitle.value = locale.value.confirmations.clearListTitle
  confirmDialogMessage.value = locale.value.confirmations.clearListMessage
  confirmDialogType.value = 'danger'
  confirmDialogConfirmText.value = locale.value.confirmations.clearListConfirm

  confirmAction.value = () => {
    localScheduledSongs.value.forEach((schedule) => {
      if (schedule.song) {
        scheduledSongIds.value.delete(schedule.song.id)
      }
    })
    localScheduledSongs.value = []
    hasChanges.value = true
    if (window.$showNotification) {
      window.$showNotification(locale.value.messages.playlistCleared, 'success')
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

const openMoveDateDialog = () => {
  if (hasChanges.value) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.messages.saveBeforeMove, 'warning')
    }
    return
  }

  moveTargetDate.value = selectedDate.value
  showMoveDateDialog.value = true
}

const openCopyDateDialog = () => {
  if (hasChanges.value) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.messages.saveBeforeCopy, 'warning')
    }
    return
  }

  const baseDate = selectedDate.value
  const nextWeek = addDaysToString(baseDate, 7)
  copyMode.value = 'single'
  copyFromStart.value = baseDate
  copyFromEnd.value = baseDate
  copyToStart.value = nextWeek
  copyToEnd.value = nextWeek
  copySingleTargetDate.value = nextWeek
  showCopyDateDialog.value = true
}

const switchCopyMode = (mode) => {
  copyMode.value = mode
}

const confirmMoveDate = async () => {
  const targetDate = moveTargetDate.value.trim()

  if (!parseDateValue(targetDate)) {
    if (window.$showNotification) {
      window.$showNotification(
        callLocale('errors.invalidTargetDate', '目标日期无效，请使用 YYYY-MM-DD 格式并确保日期有效'),
        'error'
      )
    }
    return
  }

  if (targetDate === selectedDate.value) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.errors.sameTargetDate, 'warning')
    }
    return
  }

  const sourceDate = selectedDate.value
  const sourceSchedules = [...publicSchedules.value, ...drafts.value].filter((schedule) => {
    if (!schedule.playDate) return false
    return getScheduleDateValue(schedule.playDate) === sourceDate
  })

  if (sourceSchedules.length === 0) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.errors.noMovableSongs, 'warning')
    }
    return
  }

  confirmDialogTitle.value = locale.value.moveDateTitle
  confirmDialogMessage.value = callLocale(
    'confirmations.moveDateMessage',
    `确定将 ${sourceDate} 的所有 ${sourceSchedules.length} 首歌曲迁移到 ${targetDate} 吗？歌曲顺序与内容将保持不变。`,
    sourceDate,
    sourceSchedules.length,
    targetDate
  )
  confirmDialogType.value = 'warning'
  confirmDialogConfirmText.value = locale.value.confirmations.moveDateConfirm
  showMoveDateDialog.value = false

  confirmAction.value = async () => {
    loading.value = true
    try {
      const result = await $fetch('/api/admin/schedule/move-date', {
        method: 'POST',
        body: {
          fromDate: sourceDate,
          toDate: targetDate
        },
        ...auth.getAuthConfig()
      })

      await loadData()
      updateLocalScheduledSongs()

      if (window.$showNotification) {
        window.$showNotification(
          result?.movedCount > 0
            ? callLocale(
                'messages.moveDateSuccess',
                `已迁移 ${result.movedCount} 首歌曲到 ${targetDate}`,
                result.movedCount,
                targetDate
              )
            : locale.value.errors.noMovableSongs,
          result?.movedCount > 0 ? 'success' : 'warning'
        )
      }
    } catch (error) {
      console.error('迁移排期日期失败:', error)
      if (window.$showNotification) {
        const backendMessage =
          getThrownMessage(error) || formatLocaleValue(locale.value?.unknown) || '未知错误'
        window.$showNotification(
          callLocale('errors.moveDateFailed', `迁移失败: ${backendMessage}`, backendMessage),
          'error'
        )
      }
    } finally {
      loading.value = false
    }
  }

  showConfirmDialog.value = true
}

const confirmCopyDate = async () => {
  if (copyMode.value === 'single') {
    const sourceDate = copyFromStart.value.trim()
    const targetDate = copySingleTargetDate.value.trim()

    if (!parseDateValue(sourceDate) || !parseDateValue(targetDate)) {
      if (window.$showNotification) {
        window.$showNotification(
          callLocale('errors.invalidTargetDate', '日期无效，请使用 YYYY-MM-DD 格式并确保日期有效'),
          'error'
        )
      }
      return
    }

    if (sourceDate === targetDate) {
      if (window.$showNotification) {
        window.$showNotification(locale.value.errors.sameTargetDate, 'warning')
      }
      return
    }

    // API 会检查目标日期是否已有排期，此处不需要重复检测

    // 检查源日期是否有可复制的排期
    const sourceSchedules = [...publicSchedules.value, ...drafts.value].filter((schedule) => {
      if (!schedule.playDate) return false
      return getScheduleDateValue(schedule.playDate) === sourceDate
    })

    // 检查目标日期是否有草稿
    const targetDateDrafts = drafts.value.filter((d) => d.playDate && getScheduleDateValue(d.playDate) === targetDate)
    if (targetDateDrafts.length > 0) {
      confirmDialogTitle.value = locale.value.copyDateTitle
      confirmDialogMessage.value = callLocale('confirmations.copyDateOverwriteDraftConfirm', '目标日期有草稿将被覆盖，确定继续？', targetDateDrafts.length)
      confirmDialogType.value = 'warning'
      confirmDialogConfirmText.value = locale.value.confirmations.copyDateSingleConfirm
      showCopyDateDialog.value = false
      confirmAction.value = async () => {
        loading.value = true
        try {
          let totalCopied = 0
          if (sourceSchedules.length > 0) {
            const result = await $fetch('/api/admin/schedule/copy', {
              method: 'POST',
              body: { fromDate: sourceDate, toDate: targetDate, overwriteDrafts: true },
              ...auth.getAuthConfig()
            })
            totalCopied = result?.copiedCount || 0
          }
          await loadData()
          updateLocalScheduledSongs()
          if (window.$showNotification) {
            window.$showNotification(
              totalCopied > 0
                ? callLocale('messages.copyDateSuccess', `已复制 ${totalCopied} 首歌曲到 ${targetDate}`, totalCopied, targetDate, targetDate)
                : locale.value.errors.noCopyableSongs,
              totalCopied > 0 ? 'success' : 'warning'
            )
          }
        } catch (error) {
          console.error('复制排期日期失败:', error)
          if (window.$showNotification) {
            const backendMessage = getThrownMessage(error) || formatLocaleValue(locale.value?.unknown) || '未知错误'
            window.$showNotification(callLocale('errors.copyDateFailed', `复制失败: ${backendMessage}`, backendMessage), 'error')
          }
        } finally {
          loading.value = false
        }
      }
      showConfirmDialog.value = true
      return
    }

    confirmDialogTitle.value = locale.value.copyDateTitle
    confirmDialogMessage.value = callLocale(
      'confirmations.copyDateSingleMessage',
      `确定将 ${sourceDate} 的排期复制到 ${targetDate} 吗？`,
      sourceDate,
      targetDate
    )
    confirmDialogType.value = 'warning'
    confirmDialogConfirmText.value = locale.value.confirmations.copyDateConfirm
    showCopyDateDialog.value = false

    confirmAction.value = async () => {
      loading.value = true
      try {
        let totalCopied = 0

        if (sourceSchedules.length > 0) {
          // 源日期有排期，调用API复制
          const result = await $fetch('/api/admin/schedule/copy', {
            method: 'POST',
            body: { fromDate: sourceDate, toDate: targetDate, overwriteDrafts: true },
            ...auth.getAuthConfig()
          })
          totalCopied = result?.copiedCount || 0
        }

        await loadData()
        updateLocalScheduledSongs()

        if (window.$showNotification) {
          window.$showNotification(
            totalCopied > 0
              ? callLocale(
                  'messages.copyDateSuccess',
                  `已复制 ${totalCopied} 首歌曲到 ${targetDate}`,
                  totalCopied,
                  targetDate,
                  targetDate
                )
              : locale.value.errors.noCopyableSongs,
            totalCopied > 0 ? 'success' : 'warning'
          )
        }
      } catch (error) {
        console.error('复制排期日期失败:', error)
        if (window.$showNotification) {
          const backendMessage =
            getThrownMessage(error) || formatLocaleValue(locale.value?.unknown) || '未知错误'
          window.$showNotification(
            callLocale('errors.copyDateFailed', `复制失败: ${backendMessage}`, backendMessage),
            'error'
          )
        }
      } finally {
        loading.value = false
      }
    }

    showConfirmDialog.value = true
    return
  }

  // --- 周期模式（原有逻辑） ---
  const fromStart = copyFromStart.value.trim()
  const fromEnd = copyFromEnd.value.trim()
  const toStart = copyToStart.value.trim()
  const toEnd = copyToEnd.value.trim()

  if (!parseDateValue(fromStart) || !parseDateValue(fromEnd) || !parseDateValue(toStart) || !parseDateValue(toEnd)) {
    if (window.$showNotification) {
      window.$showNotification(
        callLocale('errors.invalidTargetDate', '日期无效，请使用 YYYY-MM-DD 格式并确保日期有效'),
        'error'
      )
    }
    return
  }

  const sourceSpan = getDaysBetween(fromStart, fromEnd)
  const targetSpan = getDaysBetween(toStart, toEnd)

  if (sourceSpan < 0 || targetSpan < 0) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.errors.invalidDateRange, 'error')
    }
    return
  }

  const sourceDays = sourceSpan + 1
  const targetDays = targetSpan + 1

  // 检查源区间与目标区间是否有交集（整体范围检测，防止级联写入）
  if (toStart <= fromEnd && fromStart <= toEnd) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.errors.targetDateConflicts, 'warning')
    }
    return
  }

  // 检查目标日期是否有草稿
  const draftTargetDates = []
  for (let i = 0; i < targetDays; i++) {
    const tgtDate = addDaysToString(toStart, i)
    const tgtDrafts = drafts.value.filter((d) => d.playDate && getScheduleDateValue(d.playDate) === tgtDate)
    if (tgtDrafts.length > 0) {
      draftTargetDates.push(tgtDate)
    }
  }

  const hasDraftOverlap = draftTargetDates.length > 0
  confirmDialogTitle.value = locale.value.copyDateTitle
  confirmDialogMessage.value = hasDraftOverlap
    ? callLocale(
        'confirmations.copyDateOverwriteMessage',
        `确定将 ${fromStart} 至 ${fromEnd} 共 ${sourceDays} 天的排期复制到 ${toStart} 至 ${toEnd} 共 ${targetDays} 天吗？${draftTargetDates.length} 个目标日期有草稿将被覆盖。源排期将循环复用至填满目标区间。`,
        fromStart,
        fromEnd,
        sourceDays,
        toStart,
        toEnd,
        targetDays,
        draftTargetDates.length
      )
    : callLocale(
        'confirmations.copyDateMessage',
        `确定将 ${fromStart} 至 ${fromEnd} 共 ${sourceDays} 天的排期复制到 ${toStart} 至 ${toEnd} 共 ${targetDays} 天吗？源排期将循环复用至填满目标区间。`,
        fromStart,
        fromEnd,
        sourceDays,
        toStart,
        toEnd,
        targetDays
      )
  confirmDialogType.value = hasDraftOverlap ? 'warning' : 'warning'
  confirmDialogConfirmText.value = locale.value.confirmations.copyDateConfirm
  showCopyDateDialog.value = false

  confirmAction.value = async () => {
    loading.value = true
    try {
      let totalCopied = 0
      let succeededScheduleIds = []
      let replacedDrafts = []

      for (let i = 0; i < targetDays; i++) {
        const srcDay = i % sourceDays
        const srcDate = addDaysToString(fromStart, srcDay)
        const tgtDate = addDaysToString(toStart, i)
        const overwriteDrafts = draftTargetDates.includes(tgtDate)

        const result = await $fetch('/api/admin/schedule/copy', {
          method: 'POST',
          body: {
            fromDate: srcDate,
            toDate: tgtDate,
            overwriteDrafts
          },
          ...auth.getAuthConfig()
        })

        totalCopied += result?.copiedCount || 0
        succeededScheduleIds.push(...(result?.createdScheduleIds || []))
        replacedDrafts.push(...(result?.replacedDrafts || []))
      }

      await loadData()
      updateLocalScheduledSongs()

      if (window.$showNotification) {
        window.$showNotification(
          totalCopied > 0
            ? callLocale(
                'messages.copyDateSuccess',
                `已逐日复制 ${totalCopied} 首歌曲至 ${toStart} ~ ${toEnd}`,
                totalCopied,
                toStart,
                toEnd
              )
            : locale.value.errors.noCopyableSongs,
          totalCopied > 0 ? 'success' : 'warning'
        )
      }
    } catch (error) {
      // 只回滚本批创建的排期，并恢复本批覆盖的草稿，避免误删并发变更
      if (succeededScheduleIds.length > 0 || replacedDrafts.length > 0) {
        try {
          await $fetch('/api/admin/schedule/remove-all-date', {
            method: 'POST',
            body: { scheduleIds: succeededScheduleIds, restoreSchedules: replacedDrafts },
            ...auth.getAuthConfig()
          })
        } catch (rollbackError) {
          console.error('回滚已复制的排期失败:', rollbackError)
        }
      }
      console.error('复制排期日期失败:', error)
      if (window.$showNotification) {
        const backendMessage =
          getThrownMessage(error) || formatLocaleValue(locale.value?.unknown) || '未知错误'
        window.$showNotification(
          callLocale('errors.copyDateFailed', `复制失败: ${backendMessage}`, backendMessage),
          'error'
        )
      }
    } finally {
      loading.value = false
    }
  }

  showConfirmDialog.value = true
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
// 流程：先写入全部草稿，全部成功后再删除旧排期，避免中间失败导致数据丢失
const saveDraft = async () => {
  loading.value = true

  try {
    // 收集当天指定播出时段的所有现有排期和草稿 ID
    const existingScheduleIds = [...publicSchedules.value, ...drafts.value]
      .filter((s) => {
        if (!s.playDate) return false
        const scheduleDateStr = getScheduleDateValue(s.playDate)
        const isTargetDate = scheduleDateStr === selectedDate.value
        if (selectedPlayTime.value) {
          return isTargetDate && s.playTimeId === parseInt(selectedPlayTime.value)
        }
        return isTargetDate
      })
      .map((s) => s.id)

    // 先写入全部草稿，全部成功后再删除旧排期
    const newDraftIds = []
    for (let i = 0; i < localScheduledSongs.value.length; i++) {
      const song = localScheduledSongs.value[i]

      try {
        const created = await $fetch('/api/admin/schedule/draft', {
          method: 'POST',
          body: {
            songId: song.song.id,
            playDate: selectedDate.value,
            sequence: i + 1,
            playTimeId: selectedPlayTime.value ? parseInt(selectedPlayTime.value) : null,
            replayRequestId: song.replayRequestId || song.song?.replayRequestId || null
          },
          ...auth.getAuthConfig()
        })
        if (created?.id) {
          newDraftIds.push(created.id)
        }
      } catch (error) {
        console.error(`创建草稿排期失败 (歌曲: ${song.song.title}):`, error)
        throw error
      }
    }

    // 全部写入成功后，删除旧排期和草稿
    try {
      for (const scheduleId of existingScheduleIds) {
        await $fetch(`/api/admin/schedule/remove`, {
          method: 'POST',
          body: { scheduleId },
          ...auth.getAuthConfig()
        })
      }
    } catch (deleteError) {
      console.error('删除旧排期失败:', deleteError)
      // 删除失败时回滚新建草稿
      for (const draftId of newDraftIds) {
        try {
          await $fetch('/api/admin/schedule/remove', {
            method: 'POST',
            body: { scheduleId: draftId },
            ...auth.getAuthConfig()
          })
        } catch (rollbackErr) {
          console.error('回滚新建草稿失败:', rollbackErr)
        }
      }
      throw deleteError
    }

    hasChanges.value = false
    await loadData() // 重新加载数据

    // 确保草稿显示在播放顺序中
    updateLocalScheduledSongs()

    if (window.$showNotification) {
      if (localScheduledSongs.value.length > 0) {
        window.$showNotification(locale.value.messages.draftSaved, 'success')
      } else {
        window.$showNotification(locale.value.messages.allDraftsDeleted, 'success')
      }
    }
  } catch (error) {
    console.error('保存草稿失败:', error)
    if (window.$showNotification) {
      const message = getThrownMessage(error) || '未知错误'
      window.$showNotification(
        callLocale('errors.saveDraftFailed', `保存草稿失败: ${message}`, message),
        'error'
      )
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
      confirmDialogTitle.value = locale.value.confirmations.deleteScheduleTitle
      confirmDialogMessage.value = locale.value.confirmations.deleteScheduleMessage
      confirmDialogType.value = 'danger'
      confirmDialogConfirmText.value = locale.value.confirmations.deleteScheduleConfirm
    } else {
      confirmDialogTitle.value = locale.value.confirmations.publishScheduleTitle
      confirmDialogMessage.value = locale.value.confirmations.publishScheduleMessage
      confirmDialogType.value = 'warning'
      confirmDialogConfirmText.value = locale.value.publishSchedule
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
    // 构建发布数据，携带拖拽时显式选择的重播申请绑定
    const songsToPublish = localScheduledSongs.value.map((item, index) => ({
      songId: item.song.id,
      sequence: index + 1,
      replayRequestId: item.replayRequestId || item.song?.replayRequestId || null
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
        window.$showNotification(locale.value.messages.scheduleDeleted, 'success')
      } else {
        window.$showNotification(locale.value.messages.schedulePublished, 'success')
      }
    }
  } catch (error) {
    console.error('发布排期失败:', error)
    if (window.$showNotification) {
      const message = getThrownMessage(error) || '未知错误'
      window.$showNotification(
        callLocale('errors.publishScheduleFailed', `发布排期失败: ${message}`, message),
        'error'
      )
    }
  } finally {
    loading.value = false
  }
}

// 发布单个草稿（需要确认）
const publishSingleDraft = async (draft) => {
  try {
    confirmDialogTitle.value = locale.value.confirmations.publishDraftTitle
    confirmDialogMessage.value = callLocale(
      'confirmations.publishDraftMessage',
      `确定要发布草稿《${draft.song.title}》吗？发布后将立即公示并发送通知。`,
      draft.song.title
    )
    confirmDialogType.value = 'warning'
    confirmDialogConfirmText.value = locale.value.publish
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
      window.$showNotification(
        callLocale(
          'messages.draftPublished',
          `草稿《${draft.song.title}》发布成功，通知已发送！`,
          draft.song.title
        ),
        'success'
      )
    }
  } catch (error) {
    console.error('发布单个草稿失败:', error)
    if (window.$showNotification) {
      const message = getThrownMessage(error) || '未知错误'
      window.$showNotification(
        callLocale('errors.publishDraftFailed', `发布草稿失败: ${message}`, message),
        'error'
      )
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
  document.querySelectorAll('.border-primary').forEach((el) => {
    // 仅移除通过拖拽添加的高亮，避免移除原本的样式
    if (el.dataset.dragHighlight) {
      el.classList.remove('border-primary', 'bg-primary-10')
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
      sequenceList.classList.add('border-primary', 'bg-primary-10')
      sequenceList.dataset.dragHighlight = 'true'
    } else if (scheduledSong) {
      scheduledSong.classList.add('border-primary', 'bg-primary-10')
      scheduledSong.dataset.dragHighlight = 'true'
    }
  } else if (touchDragData.value?.type === 'schedule') {
    // 拖拽已排歌曲时，高亮待排区域或其他已排歌曲
    if (draggableSongs) {
      draggableSongs.classList.add('border-primary', 'bg-primary-10')
      draggableSongs.dataset.dragHighlight = 'true'
    } else if (scheduledSong) {
      scheduledSong.classList.add('border-primary', 'bg-primary-10')
      scheduledSong.dataset.dragHighlight = 'true'
    }
  }
}

// 清除拖拽位置指示
const clearDragPosition = () => {
  document.querySelectorAll('.border-primary').forEach((el) => {
    if (el.dataset.dragHighlight) {
      el.classList.remove('border-primary', 'bg-primary-10')
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
    replayRequestId: song.replayRequestId || null,
    song: song,
    playDate: selectedDate.value,
    sequence: insertIndex + 1,
    isNew: true,
    isLocalOnly: true
  }

  scheduledSongIds.value.add(song.id)
  setSongScheduledFlag(song.id, true)
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
      setSongScheduledFlag(removed.song.id, false)
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
