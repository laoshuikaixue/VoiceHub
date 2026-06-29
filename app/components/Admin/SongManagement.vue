<template>
  <div class="space-y-10 max-w-[1600px] mx-auto pb-20">
    <!-- 顶部标题和工具栏区域 -->
    <div class="space-y-6">
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div class="space-y-1">
          <h2 class="text-3xl font-black text-zinc-100 tracking-tight">{{ locale.title }}</h2>
          <div class="flex items-center gap-6 mt-4">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest"
                >{{ locale.stats.total }}</span
              >
              <span class="text-sm font-bold text-zinc-300">{{ baseFilteredSongs.length }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest"
                >{{ locale.stats.played }}</span
              >
              <span class="text-sm font-bold text-emerald-500">{{ playedCount }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest"
                >{{ locale.stats.pending }}</span
              >
              <span class="text-sm font-bold text-blue-500">{{ pendingCount }}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <!-- 桌面端批量操作 -->
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 scale-95 translate-x-10"
            enter-to-class="opacity-100 scale-100 translate-x-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 scale-100 translate-x-0"
            leave-to-class="opacity-0 scale-95 translate-x-10"
          >
            <div
              v-if="selectedSongs.length > 0"
              class="hidden sm:flex flex-row items-center gap-2 p-1.5 bg-zinc-900/90 border border-zinc-800 rounded-lg backdrop-blur-xl shadow-2xl"
            >
              <button
                class="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-[11px] font-black rounded-lg border border-zinc-700/50 transition-all active:scale-95 uppercase tracking-widest"
                @click="openDownloadDialog"
              >
                <Download :size="14" class="text-emerald-500/70" /> {{ locale.actions.download }} ({{
                  selectedSongs.length
                }})
              </button>
              <button
                class="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 text-[11px] font-black rounded-lg border border-zinc-700/50 transition-all active:scale-95 uppercase tracking-widest"
                @click="batchDelete"
              >
                <Trash2 :size="14" class="text-red-500/70" /> {{ locale.actions.delete }} ({{ selectedSongs.length }})
              </button>
            </div>
          </Transition>

          <button
            class="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-bold rounded-lg transition-all active:scale-95"
            @click="openAddSongModal"
          >
            <Plus :size="16" /> {{ locale.actions.addManual }}
          </button>
          <button
            :disabled="loading"
            class="flex items-center gap-2 px-5 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-bold rounded-lg border border-blue-500/20 transition-all disabled:opacity-50"
            @click="refreshSongs(true)"
          >
            <RotateCcw :size="16" :class="{ 'animate-spin': loading }" /> {{ locale.actions.refresh }}
          </button>
        </div>
      </div>

      <!-- 过滤器栏 -->
      <div
        class="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-4 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center"
      >
        <div class="relative flex-1 group w-full lg:w-auto">
          <Search
            class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-blue-500 transition-colors"
            :size="18"
          />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="locale.searchPlaceholder"
            class="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-lg pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500/30 transition-all placeholder:text-zinc-800 text-zinc-200"
          >
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 lg:flex lg:items-center gap-3 w-full lg:w-auto">
          <CustomSelect
            v-model="selectedSemester"
            :label="locale.filters.semester"
            :options="availableSemesters"
            label-key="name"
            value-key="name"
            :placeholder="locale.filters.selectSemester"
            class-name="w-full lg:w-40"
          />
          <CustomSelect
            v-model="selectedPlayTime"
            :label="locale.filters.playTime"
            :options="availablePlayTimes"
            label-key="name"
            value-key="id"
            :placeholder="locale.filters.selectPlayTime"
            class-name="w-full lg:w-40"
          />
          <CustomSelect
            v-model="statusFilter"
            :label="locale.filters.status"
            :options="statusOptions"
            :placeholder="locale.filters.selectStatus"
            class-name="w-full lg:w-32"
          />
          <CustomSelect
            v-model="sortOption"
            :label="locale.filters.sort"
            :options="sortOptions"
            :placeholder="locale.filters.selectSort"
            class-name="w-full lg:w-36 col-span-2 md:col-span-1"
          />
        </div>
      </div>
    </div>

    <!-- 歌曲表格 -->
    <div
      class="bg-zinc-900/10 border border-zinc-800/40 rounded-xl overflow-hidden shadow-2xl relative"
    >
      <!-- 加载遮罩 -->
      <div
        v-if="loading"
        class="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm z-10 flex items-center justify-center"
      >
        <div class="flex flex-col items-center gap-3">
          <div
            class="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"
          />
          <span class="text-xs font-bold text-zinc-400 tracking-widest uppercase">{{ locale.loading }}</span>
        </div>
      </div>

      <!-- 表头 -->
      <div
        class="hidden lg:grid grid-cols-12 gap-4 px-8 py-5 border-b border-zinc-800/60 bg-zinc-900/40"
      >
        <div class="col-span-1 flex items-center">
          <input
            type="checkbox"
            :checked="isAllSelected"
            class="w-5 h-5 rounded-lg border-2 border-zinc-800 bg-zinc-950 accent-blue-600 transition-all cursor-pointer"
            @change="toggleSelectAll"
          >
        </div>
        <div class="col-span-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">
          {{ locale.table.songInfo }}
        </div>
        <div class="col-span-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest">
          {{ locale.table.requester }}
        </div>
        <div
          class="col-span-1 text-[10px] font-black text-zinc-600 uppercase tracking-widest text-center"
        >
          {{ locale.table.stats }}
        </div>
        <div
          class="col-span-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest text-center"
        >
          {{ locale.table.status }}
        </div>
        <div
          class="col-span-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest text-right pr-4"
        >
          {{ locale.table.actions }}
        </div>
      </div>

      <!-- 移动端批量操作栏 -->
      <div
        v-if="filteredSongs.length > 0"
        class="lg:hidden flex items-center justify-between px-6 py-3 border-b border-zinc-800/60 bg-zinc-900/40"
      >
        <label class="flex items-center gap-2 text-xs font-bold text-zinc-300 cursor-pointer py-1">
          <input
            type="checkbox"
            :checked="isAllSelected"
            class="w-5 h-5 rounded-lg border-2 border-zinc-800 bg-zinc-950 accent-blue-600 transition-all cursor-pointer"
            @change="toggleSelectAll"
          >
          {{ locale.table.selectPage }}
        </label>
        <span v-if="selectedSongs.length > 0" class="text-xs text-blue-400 font-bold">{{ getLocaleMessage('selectedItems', selectedSongs.length) }}</span>
      </div>

      <!-- 空状态 -->
      <div
        v-if="filteredSongs.length === 0 && !loading"
        class="py-20 flex flex-col items-center justify-center text-zinc-500"
      >
        <Music :size="48" class="text-zinc-800 mb-4" />
        <p class="text-sm font-bold">{{ searchQuery ? locale.empty.search : locale.empty.default }}</p>
      </div>

      <!-- 列表内容 -->
      <div v-else class="divide-y divide-zinc-800/40">
        <div
          v-for="song in paginatedSongs"
          :key="song.id"
          :class="[
            'flex flex-col lg:grid lg:grid-cols-12 gap-4 px-6 lg:px-8 py-5 transition-all lg:items-center group relative',
            selectedSongs.includes(song.id) ? 'bg-blue-600/5' : 'hover:bg-zinc-800/20'
          ]"
        >
          <div class="hidden lg:flex col-span-1 items-center">
            <input
              type="checkbox"
              :checked="selectedSongs.includes(song.id)"
              class="w-5 h-5 rounded-lg border-2 border-zinc-800 bg-zinc-950 accent-blue-600 transition-all cursor-pointer"
              @change="toggleSelectSong(song.id)"
            >
          </div>

          <div class="col-span-12 lg:col-span-4 flex items-center gap-3 lg:gap-4 w-full">
            <label class="lg:hidden flex items-center justify-center p-2 -ml-2 shrink-0 cursor-pointer">
              <input
                type="checkbox"
                :checked="selectedSongs.includes(song.id)"
                class="w-5 h-5 rounded-lg border-2 border-zinc-800 bg-zinc-950 accent-blue-600 transition-all cursor-pointer"
                @change="toggleSelectSong(song.id)"
              >
            </label>
            <div
              :class="[
                'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all overflow-hidden bg-zinc-800/40 border-zinc-700/30 group-hover:border-zinc-600 cursor-pointer hover:opacity-80',
                selectedSongs.includes(song.id) ? 'border-blue-500/50' : ''
              ]"
              @click.stop="playSong(song)"
            >
              <img
                v-if="song.cover"
                :src="convertToHttps(song.cover)"
                class="w-full h-full object-cover"
                referrerpolicy="no-referrer"
              >
              <Music v-else :size="20" class="text-zinc-600" />
            </div>
            <div class="min-w-0">
              <h4
                :class="[
                  'font-bold transition-colors flex items-center',
                  selectedSongs.includes(song.id)
                    ? 'text-blue-400'
                    : 'text-zinc-100 group-hover:text-blue-400'
                ]"
              >
                <span
                  v-if="isBilibiliSong(song)"
                  class="truncate flex items-center gap-1 text-left"
                >
                  {{ song.title }}
                </span>
                <span v-else class="truncate">{{ song.title }}</span>
                <button
                  v-if="song.hasSubmissionNote && song.submissionNote"
                  class="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
                  :title="locale.actions.viewRemark"
                  @click.stop="openSubmissionRemark(song)"
                >
                  <MessageSquare :size="12" />
                </button>
                <span
                  v-if="song.hasSubmissionNote && song.submissionNote"
                  class="ml-2 text-xs text-blue-400/80 truncate max-w-[200px] cursor-pointer hover:text-blue-400 transition-colors font-normal"
                  :title="locale.actions.viewRemark"
                  @click.stop="openSubmissionRemark(song)"
                >
                  {{ song.submissionNote.length > 25 ? song.submissionNote.substring(0, 25) + '...' : song.submissionNote }}
                </span>
              </h4>
              <p class="text-xs text-zinc-500 font-medium truncate mt-0.5">{{ song.artist }}</p>
              <span
                class="lg:hidden text-[9px] font-black text-zinc-700 uppercase tracking-wider mt-1 inline-block"
                >{{ formatDate(song.createdAt) }}</span
              >
            </div>
          </div>

          <!-- Mobile Bottom Section -->
          <div class="flex flex-wrap items-center justify-between gap-3 w-full lg:contents mt-1 lg:mt-0">
            <!-- Left side: Requester, Votes, Status -->
            <div class="flex items-center gap-3 lg:contents">
              <div class="col-span-6 lg:col-span-2 flex flex-col lg:items-start min-w-[60px]">
                <span class="text-xs font-bold text-zinc-400 truncate max-w-[100px]">{{ song.requester || locale.unknown }}</span>
                <span v-if="song.user" class="text-[10px] font-bold text-zinc-600 truncate max-w-[100px]"
                  >@{{ song.user.username }}</span
                >
                <span v-if="song.preferredPlayTimeId" class="text-[10px] font-bold text-blue-500 mt-1">
                  {{ getLocaleMessage('preferredPlayTime', getPlayTimeName(song.preferredPlayTimeId)) }}
                </span>
                <span
                  class="hidden lg:inline text-[9px] font-black text-zinc-700 uppercase tracking-widest mt-1 opacity-60"
                  >{{ formatDate(song.createdAt) }}</span
                >
              </div>

              <div class="col-span-3 lg:col-span-1 text-center shrink-0">
                <button
                  :disabled="!(song.voteCount > 0)"
                  :class="[
                    'inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg transition-all',
                    song.voteCount > 0
                      ? 'bg-pink-500/10 text-pink-500 hover:bg-pink-500/20 cursor-pointer'
                      : 'bg-zinc-950/30 text-zinc-700 cursor-default'
                  ]"
                  @click="showVoters(song.id)"
                >
                  <Heart :size="12" :class="song.voteCount > 0 ? 'fill-pink-500/20' : ''" />
                  {{ song.voteCount || 0 }}
                </button>
              </div>

              <div class="col-span-3 lg:col-span-2 text-center shrink-0">
                <span
                  :class="[
                    'px-2 py-0.5 text-[10px] font-black rounded-md uppercase tracking-wider',
                    song.played
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : song.scheduled
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-zinc-800 text-zinc-500'
                  ]"
                >
                  {{ getStatusText(song) }}
                </span>
              </div>
            </div>

            <!-- Right side: Actions -->
            <div
              class="col-span-12 lg:col-span-2 flex items-center justify-end gap-1 lg:gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-auto"
            >
              <button
                class="p-2 bg-zinc-800/50 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all border border-zinc-700/30"
                :title="locale.actions.edit"
                @click="editSong(song)"
              >
                <Edit2 :size="14" />
              </button>

              <button
                v-if="!song.played"
                class="p-2 bg-zinc-800/50 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl transition-all border border-zinc-700/30"
                :title="locale.actions.markPlayed"
                @click="markAsPlayed(song.id)"
              >
                <Check :size="14" />
              </button>
              <button
                v-else
                class="p-2 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-600 hover:text-white rounded-xl transition-all border border-zinc-700/30"
                :title="locale.actions.markUnplayed"
                @click="markAsUnplayed(song.id)"
              >
                <RotateCcw :size="14" />
              </button>

              <button
                class="p-2 bg-zinc-800/50 text-amber-500 hover:bg-amber-600 hover:text-white rounded-xl transition-all border border-zinc-700/30"
                :title="locale.actions.reject"
                @click="rejectSong(song.id)"
              >
                <X :size="14" />
              </button>
              <button
                class="p-2 bg-zinc-800/50 text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all border border-zinc-700/30"
                :title="locale.actions.deleteSong"
                @click="deleteSong(song.id)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页区域 -->
    <Pagination
      v-model:current-page="currentPage"
      :total-pages="totalPages"
      :total-items="filteredSongs.length"
      :item-name="locale.paginationItemName"
    />

    <!-- 移动端悬浮批量操作栏 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-full"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-full"
    >
      <div
        v-if="selectedSongs.length > 0"
        class="sm:hidden fixed bottom-[70px] left-4 right-4 z-40 bg-zinc-900/95 border border-zinc-800 rounded-2xl p-2 shadow-[0_8px_30px_rgb(0,0,0,0.5)] backdrop-blur-xl flex items-center justify-between"
      >
        <div class="px-3 flex flex-col">
          <span class="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{{ locale.selected }}</span>
          <span class="text-sm font-bold text-blue-400">{{ getLocaleMessage('selectedSongs', selectedSongs.length) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="flex flex-col items-center justify-center w-14 h-12 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded-xl border border-zinc-700/50 transition-all active:scale-95"
            @click="openDownloadDialog"
          >
            <Download :size="16" class="mb-1" />
            <span class="text-[9px] font-bold">{{ locale.actions.download }}</span>
          </button>
          <button
            class="flex flex-col items-center justify-center w-14 h-12 bg-zinc-800 hover:bg-zinc-700 text-red-400 rounded-xl border border-zinc-700/50 transition-all active:scale-95"
            @click="batchDelete"
          >
            <Trash2 :size="16" class="mb-1" />
            <span class="text-[9px] font-bold">{{ locale.actions.delete }}</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Modals (模态框) -->
    <!-- 确认删除对话框 -->
    <ConfirmDialog
      :show="showDeleteDialog"
      :title="deleteDialogTitle"
      :message="deleteDialogMessage"
      :loading="loading"
      type="danger"
      :confirm-text="locale.dialog.confirmDelete"
      :cancel-text="locale.dialog.cancel"
      @confirm="confirmDelete"
      @close="showDeleteDialog = false"
    />

    <SubmissionRemarkDialog
      :show="submissionRemarkDialog.show"
      :song-title="submissionRemarkDialog.songTitle"
      :content="submissionRemarkDialog.content"
      :is-public="submissionRemarkDialog.isPublic"
      :is-updating-public="submissionRemarkDialog.isUpdatingPublic"
      @close="submissionRemarkDialog.show = false"
      @update:is-public="updateSubmissionNotePublic"
    />

    <!-- 驳回歌曲对话框 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showRejectDialog"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
      >
        <div
          class="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
          @click.stop
        >
          <div class="px-8 py-6 border-b border-zinc-800/50 flex items-center justify-between">
            <h3 class="text-xl font-black text-zinc-100">{{ locale.rejectDialog.title }}</h3>
            <button
              class="text-zinc-500 hover:text-zinc-300 transition-colors"
              @click="cancelReject"
            >
              <X :size="20" />
            </button>
          </div>

          <div class="p-8 space-y-6">
            <div class="p-5 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center gap-4">
              <div
                class="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/10"
              >
                <Music :size="18" />
              </div>
              <div>
                <h4 class="font-bold text-zinc-100 text-sm">{{ rejectSongInfo.title }}</h4>
                <p class="text-xs text-zinc-500">{{ locale.rejectDialog.requester(rejectSongInfo.requester) }}</p>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >{{ locale.rejectDialog.reason }}</label
              >
              <textarea
                v-model="rejectReason"
                :placeholder="locale.rejectDialog.reasonPlaceholder"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-4 text-sm text-zinc-200 focus:outline-none focus:border-red-500/30 min-h-[120px] resize-none transition-all"
              />
            </div>

            <label class="flex items-center gap-3 cursor-pointer group px-1">
              <input
                v-model="addToBlacklist"
                type="checkbox"
                class="w-4 h-4 rounded border-zinc-800 bg-zinc-950 accent-red-600"
              >
              <div>
                <span
                  class="text-xs font-bold text-zinc-300 group-hover:text-red-400 transition-colors"
                  >{{ locale.rejectDialog.addToBlacklist }}</span
                >
                <p class="text-[10px] text-zinc-600 font-medium">
                  {{ locale.rejectDialog.blacklistHint }}
                </p>
              </div>
            </label>
          </div>

          <div class="px-8 py-6 bg-zinc-900/50 border-t border-zinc-800/50 flex gap-3 justify-end">
            <button
              class="px-6 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-300"
              @click="cancelReject"
            >
              {{ locale.dialog.cancel }}
            </button>
            <button
              :disabled="rejectLoading"
              class="px-8 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-lg transition-all disabled:opacity-50"
              @click="confirmReject"
            >
              {{ rejectLoading ? locale.rejectDialog.processing : locale.rejectDialog.confirm }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 投票人员弹窗 -->
    <VotersModal :show="showVotersModal" :song-id="selectedSongId" @close="closeVotersModal" />

    <!-- 下载歌曲对话框 -->
    <SongDownloadDialog
      :show="showDownloadDialog"
      :songs="selectedSongsForDownload"
      @close="closeDownloadDialog"
    />

    <!-- 编辑/添加歌曲模态框 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showEditModal || showAddSongModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm overflow-y-auto"
      >
        <div
          class="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden my-auto"
          @click.stop
        >
          <div class="px-8 py-6 border-b border-zinc-800/50 flex items-center justify-between">
            <h3 class="text-xl font-black text-zinc-100">
              {{ showEditModal ? locale.editModal.editTitle : locale.editModal.addTitle }}
            </h3>
            <button
              class="text-zinc-500 hover:text-zinc-300 transition-colors"
              @click="showEditModal ? cancelEditSong() : cancelAddSong()"
            >
              <X :size="20" />
            </button>
          </div>

          <div class="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                  >{{ locale.editModal.titleLabel }}</label
                >
                <input
                  v-if="showEditModal"
                  v-model="editForm.title"
                  type="text"
                  :placeholder="locale.editModal.titlePlaceholder"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                >
                <input
                  v-else
                  v-model="addForm.title"
                  type="text"
                  :placeholder="locale.editModal.titlePlaceholder"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                >
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                  >{{ locale.editModal.artistLabel }}</label
                >
                <input
                  v-if="showEditModal"
                  v-model="editForm.artist"
                  type="text"
                  :placeholder="locale.editModal.artistPlaceholder"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                >
                <input
                  v-else
                  v-model="addForm.artist"
                  type="text"
                  :placeholder="locale.editModal.artistPlaceholder"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                >
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >{{ locale.editModal.requester }}</label
              >
              <div class="relative user-search-container">
                <div class="relative">
                  <input
                    v-if="showEditModal"
                    v-model="editUserSearchQuery"
                    type="text"
                    :placeholder="locale.editModal.userSearchPlaceholder"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                    @focus="showEditUserDropdown = true"
                    @input="searchEditUsers()"
                  >
                  <input
                    v-else
                    v-model="userSearchQuery"
                    type="text"
                    :placeholder="locale.editModal.userSearchPlaceholder"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                    @focus="showUserDropdown = true"
                    @input="searchUsers()"
                  >
                  <div
                    v-if="showEditModal ? editUserSearchLoading : userSearchLoading"
                    class="absolute right-4 top-1/2 -translate-y-1/2"
                  >
                    <div
                      class="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"
                    />
                  </div>
                </div>

                <!-- 用户下拉列表 -->
                <div
                  v-if="
                    showEditModal
                      ? showEditUserDropdown && filteredEditUsers.length > 0
                      : showUserDropdown && filteredUsers.length > 0
                  "
                  class="absolute z-10 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto"
                >
                  <div
                    v-for="user in showEditModal
                      ? filteredEditUsers.slice(0, 10)
                      : filteredUsers.slice(0, 10)"
                    :key="user.id"
                    class="px-4 py-3 hover:bg-zinc-800 cursor-pointer transition-colors flex items-center justify-between group"
                    @click="showEditModal ? selectEditUser(user) : selectUser(user)"
                  >
                    <div class="flex flex-col">
                      <span class="text-sm font-bold text-zinc-200">{{ user.name }}</span>
                      <span class="text-[10px] text-zinc-500">@{{ user.username }}</span>
                    </div>
                    <Check
                      v-if="
                        showEditModal
                          ? selectedEditUser?.id === user.id
                          : selectedUser?.id === user.id
                      "
                      :size="14"
                      class="text-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div
                v-if="showEditModal ? selectedEditUser : selectedUser"
                class="flex items-center gap-2 mt-2 px-1"
              >
                <span class="text-[10px] font-bold text-blue-500"
                  >{{ locale.editModal.selectedUser((showEditModal ? selectedEditUser : selectedUser).name) }}
                  <template v-if="(showEditModal ? selectedEditUser : selectedUser).username">
                    (@{{ (showEditModal ? selectedEditUser : selectedUser).username }})
                  </template></span
                >
                <button
                  class="text-zinc-600 hover:text-zinc-400"
                  @click="showEditModal ? clearSelectedEditUser() : clearSelectedUser()"
                >
                  <X :size="12" />
                </button>
              </div>
            </div>

            <div v-if="showEditModal" class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >{{ locale.editModal.collaborators }}</label
              >
              <div class="space-y-3 user-search-container">
                <div
                  v-if="selectedEditCollaborators.length > 0"
                  class="flex flex-wrap gap-2"
                >
                  <span
                    v-for="collaborator in selectedEditCollaborators"
                    :key="collaborator.id"
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
                  >
                    {{ getCollaboratorDisplayName(collaborator) }}
                    <button
                      class="text-zinc-500 hover:text-red-400 transition-colors"
                      @click="removeEditCollaborator(collaborator.id)"
                    >
                      <X :size="12" />
                    </button>
                  </span>
                </div>
                <div class="relative">
                  <input
                    v-model="editCollaboratorSearchQuery"
                    type="text"
                    :placeholder="locale.editModal.collaboratorSearchPlaceholder"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                    @focus="showEditCollaboratorDropdown = true"
                    @input="searchEditCollaborators()"
                  >
                  <div
                    v-if="editCollaboratorSearchLoading"
                    class="absolute right-4 top-1/2 -translate-y-1/2"
                  >
                    <div
                      class="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"
                    />
                  </div>
                  <div
                    v-if="showEditCollaboratorDropdown && filteredEditCollaborators.length > 0"
                    class="absolute z-10 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto"
                  >
                    <div
                      v-for="user in filteredEditCollaborators.slice(0, 10)"
                      :key="user.id"
                      class="px-4 py-3 hover:bg-zinc-800 cursor-pointer transition-colors flex items-center justify-between group"
                      @click="selectEditCollaborator(user)"
                    >
                      <div class="flex flex-col">
                        <span class="text-sm font-bold text-zinc-200">{{ user.name }}</span>
                        <span class="text-[10px] text-zinc-500">@{{ user.username }}</span>
                      </div>
                      <Plus :size="14" class="text-blue-500 opacity-70 group-hover:opacity-100" />
                    </div>
                  </div>
                </div>
                <p class="text-[10px] text-zinc-600 font-medium px-1">
                  {{ locale.editModal.collaboratorHint }}
                </p>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                  >{{ locale.filters.semester }}</label
                >
                <CustomSelect
                  v-if="showEditModal"
                  v-model="editForm.semester"
                  :options="availableSemesters"
                  label-key="name"
                  value-key="name"
                  :placeholder="locale.filters.selectSemester"
                />
                <CustomSelect
                  v-else
                  v-model="addForm.semester"
                  :options="availableSemesters"
                  label-key="name"
                  value-key="name"
                  :placeholder="locale.filters.selectSemester"
                />
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                  >{{ locale.editModal.preferredPlayTime }}</label
                >
                <CustomSelect
                  v-if="showEditModal"
                  v-model="editForm.preferredPlayTimeId"
                  :options="availablePlayTimes.filter(p => p.id !== 'all')"
                  label-key="name"
                  value-key="id"
                  :placeholder="locale.editModal.selectPreferredPlayTime"
                />
                <CustomSelect
                  v-else
                  v-model="addForm.preferredPlayTimeId"
                  :options="availablePlayTimes.filter(p => p.id !== 'all')"
                  label-key="name"
                  value-key="id"
                  :placeholder="locale.editModal.selectPreferredPlayTime"
                />
              </div>
            </div>


            <div v-if="showEditModal" class="space-y-3">
              <div class="flex items-center justify-between gap-3 px-1">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest"
                  >{{ locale.editModal.submissionNote }}</label
                >
                <button
                  :disabled="!canClearEditSubmissionNote && !submissionNoteClearRequested"
                  class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black tracking-widest uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  :class="
                    submissionNoteClearRequested
                      ? 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-600'
                      : 'border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                  "
                  @click="
                    submissionNoteClearRequested
                      ? cancelClearSubmissionNote()
                      : requestClearSubmissionNote()
                  "
                >
                  {{ submissionNoteClearRequested ? locale.editModal.cancelClearNote : locale.editModal.clearNote }}
                </button>
              </div>
              <textarea
                v-model="editForm.submissionNote"
                :disabled="submissionNoteClearRequested"
                :placeholder="locale.editModal.submissionNotePlaceholder"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-4 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 min-h-[120px] resize-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label
                class="flex items-center gap-3 px-1 transition-opacity"
                :class="submissionNoteClearRequested ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'"
              >
                <input
                  v-model="editForm.submissionNotePublic"
                  :disabled="submissionNoteClearRequested"
                  type="checkbox"
                  class="w-4 h-4 rounded border-zinc-800 bg-zinc-950 accent-blue-500"
                >
                <div>
                  <span
                    class="text-xs font-bold transition-colors"
                    :class="submissionNoteClearRequested ? 'text-zinc-500' : 'text-zinc-300 group-hover:text-blue-400'"
                    >{{ locale.editModal.publicNote }}</span
                  >
                  <p class="text-[10px] text-zinc-600 font-medium">
                    {{ locale.editModal.publicNoteHint }}
                  </p>
                </div>
              </label>
              <div
                v-if="submissionNoteClearRequested"
                class="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
              >
                <div class="text-xs font-bold text-amber-300">
                  {{ locale.editModal.clearNoteHint }}
                </div>
                <textarea
                  v-model="submissionNoteClearReason"
                  :placeholder="locale.editModal.clearNoteReasonPlaceholder"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/30 min-h-[96px] resize-none transition-all"
                />
                <label class="flex items-center gap-3 cursor-pointer group">
                  <input
                    v-model="notifyOnSubmissionNoteClear"
                    type="checkbox"
                    class="w-4 h-4 rounded border-zinc-800 bg-zinc-950 accent-amber-500"
                  >
                  <div>
                    <span class="text-xs font-bold text-zinc-300 group-hover:text-amber-300 transition-colors"
                      >{{ locale.editModal.notifyAfterClear }}</span
                    >
                    <p class="text-[10px] text-zinc-600 font-medium">
                      {{ locale.editModal.notifyAfterClearHint }}
                    </p>
                  </div>
                </label>
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-zinc-800/50">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                  >{{ locale.editModal.musicPlatform }}</label
                >
                <CustomSelect
                  v-if="showEditModal"
                  v-model="editForm.musicPlatform"
                  :options="[
                    { label: locale.platforms.netease, value: 'netease' },
                    { label: locale.platforms.tencent, value: 'tencent' },
                    { label: locale.platforms.bilibili, value: 'bilibili' }
                  ]"
                  :placeholder="locale.editModal.selectPlatform"
                />
                <CustomSelect
                  v-else
                  v-model="addForm.musicPlatform"
                  :options="[
                    { label: locale.platforms.netease, value: 'netease' },
                    { label: locale.platforms.tencent, value: 'tencent' },
                    { label: locale.platforms.bilibili, value: 'bilibili' }
                  ]"
                  :placeholder="locale.editModal.selectPlatform"
                />
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                  >{{ locale.editModal.musicId }}</label
                >
                <input
                  v-if="showEditModal"
                  v-model="editForm.musicId"
                  type="text"
                  :placeholder="locale.editModal.musicIdPlaceholder"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
                >
                <input
                  v-else
                  v-model="addForm.musicId"
                  type="text"
                  :placeholder="locale.editModal.musicIdPlaceholder"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
                >
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >{{ locale.editModal.coverUrl }}</label
              >
              <input
                v-if="showEditModal"
                v-model="editForm.cover"
                type="text"
                placeholder="http://..."
                class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
              >
              <input
                v-else
                v-model="addForm.cover"
                type="text"
                placeholder="http://..."
                class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
              >
              <p
                v-if="
                  (showEditModal ? editCoverValidation.valid : addCoverValidation.valid) &&
                  (showEditModal ? editForm.cover : addForm.cover)
                "
                class="text-[10px] text-emerald-500/80 font-bold px-1 flex items-center gap-1"
              >
                <Check :size="10" /> {{ locale.editModal.validUrl }}
              </p>
              <p
                v-if="
                  !(showEditModal ? editCoverValidation.valid : addCoverValidation.valid) &&
                  (showEditModal ? editForm.cover : addForm.cover)
                "
                class="text-[10px] text-red-500/80 font-bold px-1 flex items-center gap-1"
              >
                <X :size="10" />
                {{ showEditModal ? editCoverValidation.error : addCoverValidation.error }}
              </p>
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                >{{ locale.editModal.playUrl }}</label
              >
              <input
                v-if="showEditModal"
                v-model="editForm.playUrl"
                type="text"
                placeholder="http://..."
                class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
              >
              <input
                v-else
                v-model="addForm.playUrl"
                type="text"
                placeholder="http://..."
                class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
              >
              <p
                v-if="
                  (showEditModal ? editPlayUrlValidation.valid : addPlayUrlValidation.valid) &&
                  (showEditModal ? editForm.playUrl : addForm.playUrl)
                "
                class="text-[10px] text-emerald-500/80 font-bold px-1 flex items-center gap-1"
              >
                <Check :size="10" /> {{ locale.editModal.validUrl }}
              </p>
              <p
                v-if="
                  !(showEditModal ? editPlayUrlValidation.valid : addPlayUrlValidation.valid) &&
                  (showEditModal ? editForm.playUrl : addForm.playUrl)
                "
                class="text-[10px] text-red-500/80 font-bold px-1 flex items-center gap-1"
              >
                <X :size="10" />
                {{ showEditModal ? editPlayUrlValidation.error : addPlayUrlValidation.error }}
              </p>
            </div>
          </div>

          <div class="px-8 py-6 bg-zinc-900/50 border-t border-zinc-800/50 flex gap-3 justify-end">
            <button
              class="px-6 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-300"
              @click="showEditModal ? cancelEditSong() : cancelAddSong()"
            >
              {{ locale.dialog.cancel }}
            </button>
            <button
              :disabled="showEditModal ? editLoading : !canSubmitAddForm || addLoading"
              class="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg transition-all disabled:opacity-50"
              @click="showEditModal ? saveEditSong() : saveAddSong()"
            >
              {{
                showEditModal
                  ? editLoading
                    ? locale.editModal.saving
                    : locale.editModal.saveChanges
                  : addLoading
                    ? locale.editModal.adding
                    : locale.editModal.addSong
              }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch, onUnmounted } from 'vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import VotersModal from '~/components/Admin/VotersModal.vue'
import SongDownloadDialog from '~/components/Admin/SongDownloadDialog.vue'
import SubmissionRemarkDialog from '~/components/Admin/SubmissionRemarkDialog.vue'
import Pagination from '~/components/UI/Common/Pagination.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import {
  Search,
  Plus,
  RotateCcw,
  Edit2,
  Check,
  X,
  Trash2,
  Music,
  Heart,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  MessageSquare
} from '@lucide/vue'
import { useSongs } from '~/composables/useSongs'
import { useAdmin } from '~/composables/useAdmin'
import { useAuth } from '~/composables/useAuth'
import { useToast } from '~/composables/useToast'
import { useSemesters } from '~/composables/useSemesters'
import { useSongPlayer } from '~/composables/useSongPlayer'
import { useLocale } from '~/utils/locale'
import { isBilibiliSong } from '~/utils/bilibiliSource'
import { validateUrl, convertToHttps } from '~/utils/url'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

// 响应式数据
const { showToast: showNotification } = useToast()
const { admin } = useLocale()
const locale = computed(() => admin.value?.songManagement || {})
const getLocaleMessage = (key, ...args) => {
  const message = locale.value?.[key]
  return typeof message === 'function' ? message(...args) : (message || '')
}
const getNestedMessage = (section, key, ...args) => {
  const message = locale.value?.[section]?.[key]
  return typeof message === 'function' ? message(...args) : (message || '')
}
const loading = ref(false)
const searchQuery = ref('')
const statusFilter = ref('all')
const sortOption = ref('time-desc')
const selectedSongs = ref([])
const currentPage = ref(1)
const pageSize = ref(20)

// 音频播放器
const { playSong } = useSongPlayer()

// 学期相关
const selectedSemester = ref('all')
const availableSemesters = ref([])

// 时段相关
const selectedPlayTime = ref('all')
const availablePlayTimes = ref([])

// 选项配置
const statusOptions = computed(() => [
  { label: getNestedMessage('options', 'allStatus'), value: 'all' },
  { label: getNestedMessage('options', 'pending'), value: 'pending' },
  { label: getNestedMessage('options', 'scheduled'), value: 'scheduled' },
  { label: getNestedMessage('options', 'played'), value: 'played' },
  { label: getNestedMessage('options', 'hasNote'), value: 'has-note' }
])

const sortOptions = computed(() => [
  { label: getNestedMessage('options', 'newest'), value: 'time-desc' },
  { label: getNestedMessage('options', 'oldest'), value: 'time-asc' },
  { label: getNestedMessage('options', 'hotDesc'), value: 'votes-desc' },
  { label: getNestedMessage('options', 'hotAsc'), value: 'votes-asc' },
  { label: getNestedMessage('options', 'titleAsc'), value: 'title-asc' },
  { label: getNestedMessage('options', 'titleDesc'), value: 'title-desc' }
])

// 删除对话框相关
const showDeleteDialog = ref(false)
const deleteDialogTitle = ref('')
const deleteDialogMessage = ref('')
const deleteAction = ref(null)

// 投票人员弹窗相关
const showVotersModal = ref(false)
const selectedSongId = ref(null)

// 下载对话框相关
const showDownloadDialog = ref(false)
const selectedSongsForDownload = ref([])
const submissionRemarkDialog = ref({
  show: false,
  songId: null,
  title: '',
  artist: '',
  songTitle: '',
  content: '',
  isPublic: false,
  isUpdatingPublic: false
})

// 驳回歌曲相关
const showRejectDialog = ref(false)
const rejectLoading = ref(false)
const rejectReason = ref('')
const addToBlacklist = ref(false)
const rejectSongInfo = ref({
  id: null,
  title: '',
  artist: '',
  requester: ''
})

// 编辑歌曲相关
const showEditModal = ref(false)
const editLoading = ref(false)
const editForm = ref({
  id: null,
  title: '',
  artist: '',
  requester: '',
  semester: '',
  preferredPlayTimeId: 'none',
  submissionNote: '',
  submissionNotePublic: false,
  musicPlatform: '',
  musicId: '',
  cover: '',
  playUrl: ''
})
const originalEditSubmissionNote = ref('')
const submissionNoteClearRequested = ref(false)
const submissionNoteClearReason = ref('')
const notifyOnSubmissionNoteClear = ref(true)

// 添加歌曲相关
const showAddSongModal = ref(false)
const addLoading = ref(false)
const searchLoading = ref(false)
const addForm = ref({
  title: '',
  artist: '',
  requester: '',
  semester: '',
  preferredPlayTimeId: 'none',
  musicPlatform: '',
  musicId: '',
  cover: '',
  playUrl: ''
})

// URL验证状态
const addCoverValidation = ref({ valid: true, error: '', validating: false })
const addPlayUrlValidation = ref({ valid: true, error: '', validating: false })
const editCoverValidation = ref({ valid: true, error: '', validating: false })
const editPlayUrlValidation = ref({ valid: true, error: '', validating: false })

// 用户搜索相关
const userSearchQuery = ref('')
const showUserDropdown = ref(false)
const selectedUser = ref(null)
const filteredUsers = ref([])
const userSearchLoading = ref(false)

// 编辑模态框的用户搜索
const editUserSearchQuery = ref('')
const showEditUserDropdown = ref(false)
const selectedEditUser = ref(null)
const filteredEditUsers = ref([])
const editUserSearchLoading = ref(false)

// 联合投稿人搜索相关
const selectedEditCollaborators = ref([])
const editCollaboratorSearchQuery = ref('')
const filteredEditCollaborators = ref([])
const showEditCollaboratorDropdown = ref(false)
const editCollaboratorSearchLoading = ref(false)
let editCollaboratorSearchTimeout = null

// 数据
const songs = ref([])

// 服务
let songsService = null
let adminService = null
let auth = null
let formatPlayTimeDisplay = (pt) => pt?.name || ''

// 计算属性
const baseFilteredSongs = computed(() => {
  if (!songs.value) return []

  let filtered = [...songs.value]

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (song) =>
        song.title?.toLowerCase().includes(query) ||
        song.artist?.toLowerCase().includes(query) ||
        song.requester?.toLowerCase().includes(query)
    )
  }

  // 学期过滤
  if (selectedSemester.value && selectedSemester.value !== 'all') {
    filtered = filtered.filter((song) => song.semester === selectedSemester.value)
  }

  // 时段过滤
  if (selectedPlayTime.value && selectedPlayTime.value !== 'all') {
    filtered = filtered.filter((song) => {
      if (selectedPlayTime.value === 'none') {
        return !song.preferredPlayTimeId
      }
      return song.preferredPlayTimeId === selectedPlayTime.value
    })
  }

  return filtered
})

const filteredSongs = computed(() => {
  let filtered = [...baseFilteredSongs.value]

  // 状态过滤
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter((song) => {
      switch (statusFilter.value) {
        case 'pending':
          // 待排期：未播放且未排期
          return !song.played && !song.scheduled
        case 'scheduled':
          // 已排期：未播放但已排期
          return !song.played && song.scheduled
        case 'played':
          // 已播放
          return song.played
        case 'has-note':
          return Boolean(song.submissionNote && song.submissionNote.trim())
        default:
          return true
      }
    })
  }

  // 排序
  filtered.sort((a, b) => {
    switch (sortOption.value) {
      case 'time-desc':
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      case 'time-asc':
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      case 'votes-desc':
        return (b.voteCount || 0) - (a.voteCount || 0)
      case 'votes-asc':
        return (a.voteCount || 0) - (b.voteCount || 0)
      case 'title-asc':
        return (a.title || '').localeCompare(b.title || '')
      case 'title-desc':
        return (b.title || '').localeCompare(a.title || '')
      default:
        return 0
    }
  })

  return filtered
})

const paginatedSongs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredSongs.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredSongs.value.length / pageSize.value)
})

// 显示的分页按钮
const playedCount = computed(() => {
  return baseFilteredSongs.value.filter((song) => song.played).length
})

const pendingCount = computed(() => {
  return baseFilteredSongs.value.filter((song) => !song.played).length
})

const isAllSelected = computed(() => {
  return (
    paginatedSongs.value.length > 0 &&
    paginatedSongs.value.every((song) => selectedSongs.value.includes(song.id))
  )
})

// 计算属性：检查添加歌曲表单是否可以提交
const canSubmitAddForm = computed(() => {
  // 必填字段检查
  if (
    !addForm.value.title.trim() ||
    !addForm.value.artist.trim() ||
    !selectedUser.value ||
    !addForm.value.semester
  ) {
    return false
  }

  // 可选字段验证检查
  if (
    addForm.value.cover &&
    (!addCoverValidation.value.valid || addCoverValidation.value.validating)
  ) {
    return false
  }

  if (
    addForm.value.playUrl &&
    (!addPlayUrlValidation.value.valid || addPlayUrlValidation.value.validating)
  ) {
    return false
  }

  return true
})

const canClearEditSubmissionNote = computed(() => {
  return Boolean(originalEditSubmissionNote.value || editForm.value.submissionNote)
})

// 方法
const formatDate = (dateString) => {
  const date = new Date(dateString)
  const now = getSyncedDate()
  const diff = now - date

  if (diff < 60000) return getNestedMessage('timeAgo', 'justNow')
  if (diff < 3600000) return getNestedMessage('timeAgo', 'minutes', Math.floor(diff / 60000))
  if (diff < 86400000) return getNestedMessage('timeAgo', 'hours', Math.floor(diff / 3600000))
  return getNestedMessage('timeAgo', 'days', Math.floor(diff / 86400000))
}

const getPlayTimeName = (playTimeId) => {
  if (!playTimeId || !availablePlayTimes.value) return ''
  const playTime = availablePlayTimes.value.find((pt) => pt.id === playTimeId)
  if (!playTime) return ''

  return formatPlayTimeDisplay(playTime)
}

const getStatusText = (song) => {
  if (song.played) return getNestedMessage('options', 'played')
  if (song.scheduled) {
    // 如果有排期日期，在待播放后显示排期日期（月/日）
    if (song.scheduleDate) {
      // API返回的日期格式为 "YYYY/M/D H:mm:ss"（如 "2024/1/15 14:30:00"）
      const date = dayjs(song.scheduleDate, 'YYYY/M/D H:mm:ss')
      if (date.isValid()) {
        return getLocaleMessage('scheduledWithDate', date.format('M/D'))
      }
    }
    return getNestedMessage('options', 'scheduled')
  }
  return getNestedMessage('options', 'pending')
}

const getCollaboratorDisplayName = (user) => {
  return user?.displayName || user?.name || user?.username || getLocaleMessage('unknownUser')
}

const openSubmissionRemark = (song) => {
  if (!song?.submissionNote) return
  submissionRemarkDialog.value = {
    show: true,
    songId: song.id,
    title: song.title,
    artist: song.artist,
    songTitle: `${song.title} - ${song.artist}`,
    content: song.submissionNote,
    isPublic: song.submissionNotePublic === true
  }
}

const updateSubmissionNotePublic = async (isPublic) => {
  const dialogData = submissionRemarkDialog.value
  if (!dialogData.songId || dialogData.isUpdatingPublic) return

  dialogData.isUpdatingPublic = true
  dialogData.isPublic = isPublic

  try {
    await adminService.updateSong(dialogData.songId, {
      title: dialogData.title,
      artist: dialogData.artist,
      submissionNotePublic: isPublic
    })

    const songIndex = songs.value.findIndex(s => s.id === dialogData.songId)
    if (songIndex !== -1) {
      songs.value[songIndex].submissionNotePublic = isPublic
    }

    if (window.$showNotification) {
      window.$showNotification(getNestedMessage('messages', 'remarkVisibilityUpdated'), 'success')
    }
  } catch (error) {
    console.error('更新备注可见性失败:', error)
    if (window.$showNotification) {
      window.$showNotification(getNestedMessage('errors', 'remarkVisibilityUpdateFailed'), 'error')
    }
    dialogData.isPublic = !isPublic
  } finally {
    dialogData.isUpdatingPublic = false
  }
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedSongs.value = selectedSongs.value.filter(
      (id) => !paginatedSongs.value.some((song) => song.id === id)
    )
  } else {
    const newSelections = paginatedSongs.value
      .map((song) => song.id)
      .filter((id) => !selectedSongs.value.includes(id))
    selectedSongs.value.push(...newSelections)
  }
}

const toggleSelectSong = (songId) => {
  const index = selectedSongs.value.indexOf(songId)
  if (index > -1) {
    selectedSongs.value.splice(index, 1)
  } else {
    selectedSongs.value.push(songId)
  }
}

const refreshSongs = async (bypassCache = false) => {
  loading.value = true
  try {
    await songsService.fetchSongs(false, undefined, false, bypassCache)
    songs.value = songsService.songs.value || []
    selectedSongs.value = []
  } catch (error) {
    console.error('刷新歌曲失败:', error)
  } finally {
    loading.value = false
  }
}

const markAsPlayed = async (songId) => {
  try {
    await songsService.markPlayed(songId)
    await refreshSongs()
  } catch (error) {
      console.error('标记已播放失败:', error)
      showNotification(getNestedMessage('errors', 'markFailed', error?.data?.message || error?.message || error?.statusMessage || getLocaleMessage('unknownError')), 'error')
    }
}

const markAsUnplayed = async (songId) => {
  try {
    await songsService.unmarkPlayed(songId)
    await refreshSongs()
  } catch (error) {
      console.error('标记未播放失败:', error)
      showNotification(getNestedMessage('errors', 'markFailed', error?.data?.message || error?.message || error?.statusMessage || getLocaleMessage('unknownError')), 'error')
    }
}

const deleteSong = async (songId) => {
  const song = songs.value.find((s) => s.id === songId)
  if (!song) return

  deleteDialogTitle.value = getNestedMessage('dialog', 'deleteSongTitle')
  deleteDialogMessage.value = getNestedMessage('dialog', 'deleteSongMessage', song.title)
  deleteAction.value = async () => {
    try {
      await adminService.deleteSong(songId)
      await refreshSongs()

      const index = selectedSongs.value.indexOf(songId)
      if (index > -1) {
        selectedSongs.value.splice(index, 1)
      }

      showNotification(getNestedMessage('messages', 'deleteSuccess'), 'success')
    } catch (error) {
        console.error('删除歌曲失败:', error)
        showNotification(getNestedMessage('errors', 'deleteFailed', error?.data?.message || error?.message || error?.statusMessage || getLocaleMessage('unknownError')), 'error')
      }
  }
  showDeleteDialog.value = true
}

const batchDelete = async () => {
  if (selectedSongs.value.length === 0) return

  deleteDialogTitle.value = getNestedMessage('dialog', 'batchDeleteTitle')
  deleteDialogMessage.value = getNestedMessage('dialog', 'batchDeleteMessage', selectedSongs.value.length)
  deleteAction.value = async () => {
    try {
      loading.value = true

      for (const songId of selectedSongs.value) {
        await adminService.deleteSong(songId)
      }

      await refreshSongs()
      selectedSongs.value = []

      showNotification(getNestedMessage('messages', 'batchDeleteSuccess'), 'success')
    } catch (error) {
        console.error('批量删除失败:', error)
        showNotification(getNestedMessage('errors', 'batchDeleteFailed', error?.data?.message || error?.message || error?.statusMessage || getLocaleMessage('unknownError')), 'error')
      } finally {
      loading.value = false
    }
  }
  showDeleteDialog.value = true
}

// 显示投票人员弹窗
const showVoters = (songId) => {
  selectedSongId.value = songId
  showVotersModal.value = true
}

// 关闭投票人员弹窗
const closeVotersModal = () => {
  showVotersModal.value = false
  selectedSongId.value = null
}

// 打开下载对话框
const openDownloadDialog = () => {
  selectedSongsForDownload.value = selectedSongs.value.map((songId) => {
    const song = songs.value.find((s) => s.id === songId)
    return {
      id: `temp-${song.id}`,
      song: {
        id: song.id,
        title: song.title,
        artist: song.artist,
        musicPlatform: song.musicPlatform || 'unknown',
        requester: song.requester || getLocaleMessage('unknown'),
        musicId: song.musicId,
        playUrl: song.playUrl
      }
    }
  })
  showDownloadDialog.value = true
}

// 关闭下载对话框
const closeDownloadDialog = () => {
  showDownloadDialog.value = false
  selectedSongsForDownload.value = []
}

// 确认删除
const confirmDelete = async () => {
  if (deleteAction.value) {
    await deleteAction.value()
  }
  showDeleteDialog.value = false
  deleteAction.value = null
}

// 驳回歌曲
const rejectSong = (songId) => {
  const song = songs.value.find((s) => s.id === songId)
  if (!song) return

  rejectSongInfo.value = {
    id: song.id,
    title: song.title || '',
    artist: song.artist || '',
    requester: song.requester || song.requester_name || getLocaleMessage('unknown')
  }

  rejectReason.value = ''
  addToBlacklist.value = false
  showRejectDialog.value = true
}

// 确认驳回
const confirmReject = async () => {
  if (!rejectReason.value.trim()) {
    showNotification(getNestedMessage('errors', 'rejectReasonRequired'), 'error')
    return
  }

  rejectLoading.value = true
  try {
    await $fetch('/api/admin/songs/reject', {
      method: 'POST',
      body: {
        songId: rejectSongInfo.value.id,
        reason: rejectReason.value.trim(),
        addToBlacklist: addToBlacklist.value
      }
    })

    await refreshSongs(true)

    const index = selectedSongs.value.indexOf(rejectSongInfo.value.id)
    if (index > -1) {
      selectedSongs.value.splice(index, 1)
    }

    showRejectDialog.value = false

    showNotification(getNestedMessage('messages', 'rejectSuccess'), 'success')
  } catch (error) {
    console.error('驳回歌曲失败:', error)
    showNotification(getNestedMessage('errors', 'rejectFailed', error.data?.message || error.message), 'error')
  } finally {
    rejectLoading.value = false
  }
}

// 取消驳回
const cancelReject = () => {
  showRejectDialog.value = false
  rejectReason.value = ''
  addToBlacklist.value = false
  rejectSongInfo.value = {
    id: null,
    title: '',
    artist: '',
    requester: ''
  }
}

// 编辑歌曲
const editSong = (song) => {
  editForm.value = {
    id: song.id,
    title: song.title || '',
    artist: song.artist || '',
    requester: song.requesterId || song.requester_id || song.requester || '',
    semester: song.semester || '',
    preferredPlayTimeId: song.preferredPlayTimeId || 'none',
    submissionNote: song.submissionNote || '',
    submissionNotePublic: song.submissionNotePublic === true,
    musicPlatform: song.musicPlatform || '',
    musicId: song.musicId || '',
    cover: song.cover || '',
    playUrl: song.playUrl || ''
  }
  originalEditSubmissionNote.value = song.submissionNote || ''
  submissionNoteClearRequested.value = false
  submissionNoteClearReason.value = ''
  notifyOnSubmissionNoteClear.value = true

  if (song.requesterId || song.requester_id || song.requester_name || song.requester) {
    selectedEditUser.value = {
      id: song.requesterId || song.requester_id || song.requester,
      name: song.requester_name || song.requester || locale.value.unknown,
      username: song.requester_username || song.user?.username || song.requester?.username || ''
    }
    editUserSearchQuery.value = song.requester_name || song.requester || ''
  } else {
    clearSelectedEditUser()
  }

  if (song.collaborators && Array.isArray(song.collaborators)) {
    selectedEditCollaborators.value = [...song.collaborators]
  } else {
    selectedEditCollaborators.value = []
  }

  showEditModal.value = true
}

const saveEditSong = async () => {
  if (!editForm.value.title || !editForm.value.artist) {
    showNotification(getNestedMessage('errors', 'songInfoRequired'), 'error')
    return
  }

  if (editForm.value.cover && !editCoverValidation.value.valid) {
    showNotification(getNestedMessage('errors', 'coverUrlInvalidOrPending'), 'error')
    return
  }

  if (editForm.value.playUrl && !editPlayUrlValidation.value.valid) {
    showNotification(getNestedMessage('errors', 'playUrlInvalidOrPending'), 'error')
    return
  }

  if (editCoverValidation.value.validating || editPlayUrlValidation.value.validating) {
    showNotification(getNestedMessage('messages', 'validatingUrl'), 'warning')
    return
  }

  editLoading.value = true
  try {
    const { updateSong } = adminService
    await updateSong(editForm.value.id, {
      title: editForm.value.title,
      artist: editForm.value.artist,
      requester: editForm.value.requester,
      collaborators: selectedEditCollaborators.value.map((u) => u.id),
      semester: editForm.value.semester,
      preferredPlayTimeId: editForm.value.preferredPlayTimeId === 'none' ? null : (editForm.value.preferredPlayTimeId || null),
      submissionNote: submissionNoteClearRequested.value ? null : editForm.value.submissionNote,
      submissionNotePublic: submissionNoteClearRequested.value ? false : editForm.value.submissionNotePublic,
      clearSubmissionNote: submissionNoteClearRequested.value,
      submissionNoteClearReason: submissionNoteClearReason.value.trim(),
      notifyOnSubmissionNoteClear: submissionNoteClearRequested.value && notifyOnSubmissionNoteClear.value,
      musicPlatform: editForm.value.musicPlatform || null,
      musicId: editForm.value.musicId || null,
      cover: editForm.value.cover || null,
      playUrl: editForm.value.playUrl || null
    })

    await refreshSongs()
    showEditModal.value = false

    showNotification(getNestedMessage('messages', 'updateSuccess'), 'success')
  } catch (error) {
    console.error('更新歌曲失败:', error)
    let errorMessage = getNestedMessage('errors', 'updateFailed')
    if (error.data && error.data.message) {
      errorMessage = error.data.message
    } else if (error.message) {
      errorMessage = error.message
    }
    showNotification(errorMessage, 'error')
  } finally {
    editLoading.value = false
  }
}

const cancelEditSong = () => {
  showEditModal.value = false
  editForm.value = {
    id: null,
    title: '',
    artist: '',
    requester: '',
    semester: '',
    preferredPlayTimeId: 'none',
    submissionNote: '',
    submissionNotePublic: false,
    musicPlatform: '',
    musicId: '',
    cover: '',
    playUrl: ''
  }
  originalEditSubmissionNote.value = ''
  submissionNoteClearRequested.value = false
  submissionNoteClearReason.value = ''
  notifyOnSubmissionNoteClear.value = true
  editCoverValidation.value = { valid: true, error: '', validating: false }
  editPlayUrlValidation.value = { valid: true, error: '', validating: false }
  clearSelectedEditUser()
  selectedEditCollaborators.value = []
  editCollaboratorSearchQuery.value = ''
}

const requestClearSubmissionNote = () => {
  if (!canClearEditSubmissionNote.value) {
    return
  }

  submissionNoteClearRequested.value = true
  submissionNoteClearReason.value = ''
  notifyOnSubmissionNoteClear.value = true
}

const cancelClearSubmissionNote = () => {
  submissionNoteClearRequested.value = false
  submissionNoteClearReason.value = ''
  notifyOnSubmissionNoteClear.value = true
}

const openAddSongModal = () => {
  addForm.value = {
    title: '',
    artist: '',
    requester: '',
    semester: selectedSemester.value !== 'all' ? selectedSemester.value : '',
    preferredPlayTimeId: selectedPlayTime.value !== 'all' && selectedPlayTime.value !== 'none' ? selectedPlayTime.value : 'none',
    musicPlatform: '',
    musicId: '',
    cover: ''
  }
  showAddSongModal.value = true
}

const saveAddSong = async () => {
  if (!addForm.value.title || !addForm.value.artist) {
    showNotification(getNestedMessage('errors', 'songInfoRequired'), 'error')
    return
  }

  if (!selectedUser.value || !addForm.value.requester) {
    showNotification(getNestedMessage('errors', 'requesterRequired'), 'error')
    return
  }

  if (!addForm.value.semester) {
    showNotification(getNestedMessage('errors', 'semesterRequired'), 'error')
    return
  }

  if (addForm.value.cover) {
    if (!addCoverValidation.value.valid) {
      showNotification(getNestedMessage('errors', 'coverUrlInvalid'), 'error')
      return
    }
    if (addCoverValidation.value.validating) {
      showNotification(getNestedMessage('messages', 'validatingCoverUrl'), 'warning')
      return
    }
  }

  if (addForm.value.playUrl) {
    if (!addPlayUrlValidation.value.valid) {
      showNotification(getNestedMessage('errors', 'playUrlInvalid'), 'error')
      return
    }
    if (addPlayUrlValidation.value.validating) {
      showNotification(getNestedMessage('messages', 'validatingPlayUrl'), 'warning')
      return
    }
  }

  addLoading.value = true
  try {
    const { addSong } = adminService
    await addSong({
      title: addForm.value.title,
      artist: addForm.value.artist,
      requester: addForm.value.requester,
      semester: addForm.value.semester,
      preferredPlayTimeId: addForm.value.preferredPlayTimeId === 'none' ? null : (addForm.value.preferredPlayTimeId || null),
      musicPlatform: addForm.value.musicPlatform || null,
      musicId: addForm.value.musicId || null,
      cover: addForm.value.cover || null,
      playUrl: addForm.value.playUrl || null
    })

    await refreshSongs()
    showAddSongModal.value = false

    addForm.value = {
      title: '',
      artist: '',
      requester: '',
      semester: '',
      preferredPlayTimeId: 'none',
      musicPlatform: '',
      musicId: '',
      cover: '',
      playUrl: ''
    }
    clearSelectedUser()

    showNotification(getNestedMessage('messages', 'addSuccess'), 'success')
  } catch (error) {
    console.error('添加歌曲失败:', error)
    let errorMessage = getNestedMessage('errors', 'addFailed')
    if (error.data && error.data.message) {
      errorMessage = error.data.message
    } else if (error.message) {
      errorMessage = error.message
    }
    showNotification(errorMessage, 'error')
  } finally {
    addLoading.value = false
  }
}

const cancelAddSong = () => {
  showAddSongModal.value = false
  addForm.value = {
    title: '',
    artist: '',
    requester: '',
    semester: '',
    preferredPlayTimeId: 'none',
    musicPlatform: '',
    musicId: '',
    cover: '',
    playUrl: ''
  }
  addCoverValidation.value = { valid: true, error: '', validating: false }
  addPlayUrlValidation.value = { valid: true, error: '', validating: false }
  clearSelectedUser()
}

// 用户搜索功能
let searchTimeout = null

const searchUsersFromAPI = async (query) => {
  if (!query.trim()) {
    return []
  }

  try {
    const response = await $fetch('/api/admin/users', {
      method: 'GET',
      query: {
        search: query,
        limit: 20
      }
    })
    return response.users || []
  } catch (error) {
    console.error('搜索用户失败:', error)
    return []
  }
}

const searchUsers = async () => {
  if (!userSearchQuery.value.trim()) {
    filteredUsers.value = []
    showUserDropdown.value = false
    userSearchLoading.value = false
    return
  }

  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = setTimeout(async () => {
    userSearchLoading.value = true
    try {
      const users = await searchUsersFromAPI(userSearchQuery.value)
      filteredUsers.value = users
      showUserDropdown.value = users.length > 0
    } catch (error) {
      console.error('搜索用户失败:', error)
      filteredUsers.value = []
      showUserDropdown.value = false
    } finally {
      userSearchLoading.value = false
    }
  }, 300)
}

const selectUser = (user) => {
  selectedUser.value = user
  addForm.value.requester = user.id
  userSearchQuery.value = user.name
  showUserDropdown.value = false
}

const clearSelectedUser = () => {
  selectedUser.value = null
  addForm.value.requester = ''
  userSearchQuery.value = ''
  showUserDropdown.value = false
}

// 编辑模态框的用户搜索功能
let editSearchTimeout = null

const searchEditUsers = async () => {
  if (!editUserSearchQuery.value.trim()) {
    filteredEditUsers.value = []
    showEditUserDropdown.value = false
    editUserSearchLoading.value = false
    return
  }

  if (editSearchTimeout) {
    clearTimeout(editSearchTimeout)
  }

  editSearchTimeout = setTimeout(async () => {
    editUserSearchLoading.value = true
    try {
      const users = await searchUsersFromAPI(editUserSearchQuery.value)
      filteredEditUsers.value = users
      showEditUserDropdown.value = users.length > 0
    } catch (error) {
      console.error('搜索用户失败:', error)
      filteredEditUsers.value = []
      showEditUserDropdown.value = false
    } finally {
      editUserSearchLoading.value = false
    }
  }, 300)
}

const selectEditUser = (user) => {
  selectedEditUser.value = user
  editForm.value.requester = user.id
  editUserSearchQuery.value = user.name
  showEditUserDropdown.value = false
}

const clearSelectedEditUser = () => {
  selectedEditUser.value = null
  editForm.value.requester = ''
  editUserSearchQuery.value = ''
  showEditUserDropdown.value = false
}

// 联合投稿人搜索相关
const searchEditCollaborators = async () => {
  if (!editCollaboratorSearchQuery.value.trim()) {
    filteredEditCollaborators.value = []
    showEditCollaboratorDropdown.value = false
    editCollaboratorSearchLoading.value = false
    return
  }

  if (editCollaboratorSearchTimeout) {
    clearTimeout(editCollaboratorSearchTimeout)
  }

  editCollaboratorSearchTimeout = setTimeout(async () => {
    editCollaboratorSearchLoading.value = true
    try {
      const users = await searchUsersFromAPI(editCollaboratorSearchQuery.value)
      filteredEditCollaborators.value = users.filter(
        (u) =>
          (!selectedEditUser.value || u.id !== selectedEditUser.value.id) &&
          !selectedEditCollaborators.value.some((c) => c.id === u.id)
      )
      showEditCollaboratorDropdown.value = filteredEditCollaborators.value.length > 0
    } catch (error) {
      console.error('搜索联合投稿人失败:', error)
      filteredEditCollaborators.value = []
      showEditCollaboratorDropdown.value = false
    } finally {
      editCollaboratorSearchLoading.value = false
    }
  }, 300)
}

const selectEditCollaborator = (user) => {
  selectedEditCollaborators.value.push(user)
  editCollaboratorSearchQuery.value = ''
  showEditCollaboratorDropdown.value = false
}

const removeEditCollaborator = (userId) => {
  const index = selectedEditCollaborators.value.findIndex((u) => u.id === userId)
  if (index > -1) {
    selectedEditCollaborators.value.splice(index, 1)
  }
}

// 点击外部关闭下拉框
const handleClickOutside = (event) => {
  if (!event.target.closest('.user-search-container')) {
    showUserDropdown.value = false
    showEditUserDropdown.value = false
    showEditCollaboratorDropdown.value = false
  }
}


// 监听器
watch([searchQuery, statusFilter, sortOption, selectedSemester, selectedPlayTime], () => {
  currentPage.value = 1
})

// 生命周期
const { semesters, fetchSemesters, semesterUpdateEvent } = useSemesters()

watch(semesterUpdateEvent, async () => {
  await fetchSemesters()
  availableSemesters.value = semesters.value || []
})

onMounted(async () => {
  songsService = useSongs()
  adminService = useAdmin()
  auth = useAuth()

  const { fetchCurrentSemester, currentSemester } = useSemesters()
  await fetchSemesters()
  await fetchCurrentSemester()

  availableSemesters.value = semesters.value || []
  availableSemesters.value.unshift({ id: 'all', name: locale.value.allSemesters })

  if (currentSemester.value) {
    selectedSemester.value = currentSemester.value.name
  }

  const { fetchPlayTimes, playTimes, formatPlayTimeDisplay: formatter } = songsService
  formatPlayTimeDisplay = formatter
  await fetchPlayTimes()
  availablePlayTimes.value = [...(playTimes.value || [])]
  availablePlayTimes.value.unshift({ id: 'none', name: locale.value.unspecifiedPlayTime })
  availablePlayTimes.value.unshift({ id: 'all', name: locale.value.allPlayTimes })

  document.addEventListener('click', handleClickOutside)

  await refreshSongs()
})

// URL验证函数
const validateAddCoverUrl = async (url) => {
  if (!url) {
    addCoverValidation.value = { valid: true, error: '', validating: false }
    return
  }

  addCoverValidation.value.validating = true
  const result = validateUrl(url)
  addCoverValidation.value = {
    valid: result.valid,
    error: result.error || '',
    validating: false
  }
}

const validateAddPlayUrl = async (url) => {
  if (!url) {
    addPlayUrlValidation.value = { valid: true, error: '', validating: false }
    return
  }

  addPlayUrlValidation.value.validating = true
  const result = validateUrl(url)
  addPlayUrlValidation.value = {
    valid: result.valid,
    error: result.error || '',
    validating: false
  }
}

const validateEditCoverUrl = async (url) => {
  if (!url) {
    editCoverValidation.value = { valid: true, error: '', validating: false }
    return
  }

  editCoverValidation.value.validating = true
  const result = validateUrl(url)
  editCoverValidation.value = {
    valid: result.valid,
    error: result.error || '',
    validating: false
  }
}

const validateEditPlayUrl = async (url) => {
  if (!url) {
    editPlayUrlValidation.value = { valid: true, error: '', validating: false }
    return
  }

  editPlayUrlValidation.value.validating = true
  const result = validateUrl(url)
  editPlayUrlValidation.value = {
    valid: result.valid,
    error: result.error || '',
    validating: false
  }
}

// 监听URL变化并验证
watch(
  () => addForm.value.cover,
  (newUrl) => {
    if (newUrl) {
      clearTimeout(addCoverValidation.value.debounceTimer)
      addCoverValidation.value.debounceTimer = setTimeout(() => {
        validateAddCoverUrl(newUrl)
      }, 1000)
    } else {
      addCoverValidation.value = { valid: true, error: '', validating: false }
    }
  }
)

watch(
  () => addForm.value.playUrl,
  (newUrl) => {
    if (newUrl) {
      clearTimeout(addPlayUrlValidation.value.debounceTimer)
      addPlayUrlValidation.value.debounceTimer = setTimeout(() => {
        validateAddPlayUrl(newUrl)
      }, 1000)
    } else {
      addPlayUrlValidation.value = { valid: true, error: '', validating: false }
    }
  }
)

watch(
  () => editForm.value.cover,
  (newUrl) => {
    if (newUrl) {
      clearTimeout(editCoverValidation.value.debounceTimer)
      editCoverValidation.value.debounceTimer = setTimeout(() => {
        validateEditCoverUrl(newUrl)
      }, 1000)
    } else {
      editCoverValidation.value = { valid: true, error: '', validating: false }
    }
  }
)

watch(
  () => editForm.value.playUrl,
  (newUrl) => {
    if (newUrl) {
      clearTimeout(editPlayUrlValidation.value.debounceTimer)
      editPlayUrlValidation.value.debounceTimer = setTimeout(() => {
        validateEditPlayUrl(newUrl)
      }, 1000)
    } else {
      editPlayUrlValidation.value = { valid: true, error: '', validating: false }
    }
  }
)

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}
</style>
