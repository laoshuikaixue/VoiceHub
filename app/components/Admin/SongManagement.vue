<template>
  <div class="space-y-10 max-w-[1600px] mx-auto pb-20">
    <!-- 顶部标题和工具栏区域 -->
    <div class="space-y-6">
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div class="space-y-1">
          <h2 class="text-3xl font-black text-zinc-100 tracking-tight">歌曲管理</h2>
          <div class="flex items-center gap-6 mt-4">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">总计</span>
              <span class="text-sm font-bold text-zinc-300">{{ filteredSongs.length }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">已播放</span>
              <span class="text-sm font-bold text-emerald-500">{{ playedCount }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">待播放</span>
              <span class="text-sm font-bold text-blue-500">{{ pendingCount }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- 批量操作 -->
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 scale-95 translate-x-10"
            enter-to-class="opacity-100 scale-100 translate-x-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 scale-100 translate-x-0"
            leave-to-class="opacity-0 scale-95 translate-x-10"
          >
            <div v-if="selectedSongs.length > 0" class="flex items-center gap-2 p-1.5 bg-zinc-900/90 border border-zinc-800 rounded-lg backdrop-blur-xl shadow-2xl">
              <button
                @click="openDownloadDialog"
                class="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-[11px] font-black rounded-lg border border-zinc-700/50 transition-all active:scale-95 uppercase tracking-widest"
              >
                <Download :size="14" class="text-emerald-500/70" /> 下载 ({{ selectedSongs.length }})
              </button>
              <button
                @click="batchDelete"
                class="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 text-[11px] font-black rounded-lg border border-zinc-700/50 transition-all active:scale-95 uppercase tracking-widest"
              >
                <Trash2 :size="14" class="text-red-500/70" /> 删除 ({{ selectedSongs.length }})
              </button>
            </div>
          </Transition>

          <button
            @click="openAddSongModal"
            class="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-bold rounded-lg transition-all active:scale-95"
          >
            <Plus :size="16" /> 手动添加
          </button>
          <button
            @click="refreshSongs(true)"
            :disabled="loading"
            class="flex items-center gap-2 px-5 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-bold rounded-lg border border-blue-500/20 transition-all disabled:opacity-50"
          >
            <RotateCcw :size="16" :class="{ 'animate-spin': loading }" /> 刷新
          </button>
        </div>
      </div>

      <!-- 过滤器栏 -->
      <div class="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-4 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
        <div class="relative flex-1 group w-full lg:w-auto">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-blue-500 transition-colors" :size="18" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索歌曲标题、艺术家或投稿人..."
            class="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-lg pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500/30 transition-all placeholder:text-zinc-800 text-zinc-200"
          />
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:flex lg:items-center gap-3 w-full lg:w-auto">
          <CustomSelect
            v-model="selectedSemester"
            label="学期"
            :options="availableSemesters"
            label-key="name"
            value-key="name"
            placeholder="选择学期"
            className="w-full lg:w-40"
          />
          <CustomSelect
            v-model="statusFilter"
            label="状态"
            :options="statusOptions"
            placeholder="选择状态"
            className="w-full lg:w-32"
          />
          <CustomSelect
            v-model="sortOption"
            label="排序"
            :options="sortOptions"
            placeholder="选择排序"
            className="w-full lg:w-36 col-span-2 md:col-span-1"
          />
        </div>
      </div>
    </div>

    <!-- 歌曲表格 -->
    <div class="bg-zinc-900/10 border border-zinc-800/40 rounded-xl overflow-hidden shadow-2xl relative">
      <!-- 加载遮罩 -->
      <div v-if="loading" class="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm z-10 flex items-center justify-center">
        <div class="flex flex-col items-center gap-3">
          <div class="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <span class="text-xs font-bold text-zinc-400 tracking-widest uppercase">正在加载...</span>
        </div>
      </div>

      <!-- 表头 -->
      <div class="hidden lg:grid grid-cols-12 gap-4 px-8 py-5 border-b border-zinc-800/60 bg-zinc-900/40">
        <div class="col-span-1 flex items-center">
          <input
            type="checkbox"
            :checked="isAllSelected"
            @change="toggleSelectAll"
            class="w-5 h-5 rounded-lg border-2 border-zinc-800 bg-zinc-950 accent-blue-600 transition-all cursor-pointer"
          />
        </div>
        <div class="col-span-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">歌曲信息</div>
        <div class="col-span-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest">投稿人</div>
        <div class="col-span-1 text-[10px] font-black text-zinc-600 uppercase tracking-widest text-center">统计</div>
        <div class="col-span-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest text-center">状态</div>
        <div class="col-span-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest text-right pr-4">操作</div>
      </div>

      <!-- 空状态 -->
      <div v-if="filteredSongs.length === 0 && !loading" class="py-20 flex flex-col items-center justify-center text-zinc-500">
        <Music :size="48" class="text-zinc-800 mb-4" />
        <p class="text-sm font-bold">{{ searchQuery ? '没有找到匹配的歌曲' : '暂无歌曲数据' }}</p>
      </div>

      <!-- 列表内容 -->
      <div v-else class="divide-y divide-zinc-800/40">
        <div
          v-for="song in paginatedSongs"
          :key="song.id"
          :class="[
            'grid grid-cols-1 lg:grid-cols-12 gap-4 px-6 lg:px-8 py-5 transition-all items-center group relative',
            selectedSongs.includes(song.id) ? 'bg-blue-600/5' : 'hover:bg-zinc-800/20'
          ]"
        >
          <div class="hidden lg:flex col-span-1 items-center">
            <input
              type="checkbox"
              :checked="selectedSongs.includes(song.id)"
              @change="toggleSelectSong(song.id)"
              class="w-5 h-5 rounded-lg border-2 border-zinc-800 bg-zinc-950 accent-blue-600 transition-all cursor-pointer"
            />
          </div>

          <div class="col-span-12 lg:col-span-4 flex items-center gap-4">
            <div :class="[
              'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all overflow-hidden bg-zinc-800/40 border-zinc-700/30 group-hover:border-zinc-600',
              selectedSongs.includes(song.id) ? 'border-blue-500/50' : ''
            ]">
              <img v-if="song.cover" :src="convertToHttps(song.cover)" class="w-full h-full object-cover" referrerpolicy="no-referrer" />
              <Music v-else :size="20" class="text-zinc-600" />
            </div>
            <div class="min-w-0">
              <h4 :class="[
                'font-bold truncate transition-colors',
                selectedSongs.includes(song.id) ? 'text-blue-400' : 'text-zinc-100 group-hover:text-blue-400'
              ]">
                <a 
                  v-if="song.musicPlatform === 'bilibili'" 
                  :href="getBilibiliUrl(song)" 
                  target="_blank" 
                  @click.stop
                  class="flex items-center gap-1 hover:underline"
                >
                  {{ song.title }}
                  <ExternalLink :size="12" class="opacity-50" />
                </a>
                <span v-else>{{ song.title }}</span>
              </h4>
              <p class="text-xs text-zinc-500 font-medium truncate mt-0.5">{{ song.artist }}</p>
              <span class="lg:hidden text-[9px] font-black text-zinc-700 uppercase tracking-wider mt-1 inline-block">{{ formatDate(song.createdAt) }}</span>
            </div>
          </div>

          <div class="col-span-6 lg:col-span-2 flex flex-col lg:items-start">
            <span class="text-xs font-bold text-zinc-400">{{ song.requester || '未知' }}</span>
            <span v-if="song.user" class="text-[10px] font-bold text-zinc-600">@{{ song.user.username }}</span>
            <span class="hidden lg:inline text-[9px] font-black text-zinc-700 uppercase tracking-widest mt-1 opacity-60">{{ formatDate(song.createdAt) }}</span>
          </div>

          <div class="col-span-3 lg:col-span-1 text-center">
            <button
              @click="showVoters(song.id)"
              :disabled="!(song.voteCount > 0)"
              :class="[
                'inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg transition-all',
                song.voteCount > 0 ? 'bg-pink-500/10 text-pink-500 hover:bg-pink-500/20 cursor-pointer' : 'bg-zinc-950/30 text-zinc-700 cursor-default'
              ]"
            >
              <Heart :size="12" :class="song.voteCount > 0 ? 'fill-pink-500/20' : ''" />
              {{ song.voteCount || 0 }}
            </button>
          </div>

          <div class="col-span-3 lg:col-span-2 text-center">
            <span :class="[
              'px-2 py-0.5 text-[10px] font-black rounded-md uppercase tracking-wider',
              song.played ? 'bg-emerald-500/10 text-emerald-500' :
              song.scheduled ? 'bg-blue-500/10 text-blue-500' : 'bg-zinc-800 text-zinc-500'
            ]">
              {{ getStatusText(song) }}
            </span>
          </div>

          <div class="col-span-12 lg:col-span-2 flex items-center justify-end gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all">
            <button
              @click="editSong(song)"
              class="p-2 bg-zinc-800/50 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all border border-zinc-700/30"
              title="编辑歌曲"
            >
              <Edit2 :size="14" />
            </button>

            <button
              v-if="!song.played"
              @click="markAsPlayed(song.id)"
              class="p-2 bg-zinc-800/50 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl transition-all border border-zinc-700/30"
              title="标记为已播放"
            >
              <Check :size="14" />
            </button>
            <button
              v-else
              @click="markAsUnplayed(song.id)"
              class="p-2 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-600 hover:text-white rounded-xl transition-all border border-zinc-700/30"
              title="标记为未播放"
            >
              <RotateCcw :size="14" />
            </button>

            <button
              @click="rejectSong(song.id)"
              class="p-2 bg-zinc-800/50 text-amber-500 hover:bg-amber-600 hover:text-white rounded-xl transition-all border border-zinc-700/30"
              title="驳回歌曲"
            >
              <X :size="14" />
            </button>
            <button
              @click="deleteSong(song.id)"
              class="p-2 bg-zinc-800/50 text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all border border-zinc-700/30"
              title="删除歌曲"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页区域 -->
    <div v-if="totalPages > 1" class="flex items-center justify-between px-2">
      <div class="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">
        第 {{ currentPage }} 页 / 共 {{ totalPages }} 页
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="currentPage = 1"
          :disabled="currentPage === 1"
          class="p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 rounded-xl transition-all"
        >
          <ChevronsLeft :size="16" />
        </button>
        <button
          @click="currentPage--"
          :disabled="currentPage === 1"
          class="p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 rounded-xl transition-all"
        >
          <ChevronLeft :size="16" />
        </button>
        <div class="flex items-center gap-1 mx-2">
          <button
            v-for="p in displayedPages"
            :key="p"
            @click="currentPage = p"
            :class="[
              'w-8 h-8 rounded-xl text-xs font-bold transition-all',
              currentPage === p ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-500 hover:text-zinc-300'
            ]"
          >
            {{ p }}
          </button>
        </div>
        <button
          @click="currentPage++"
          :disabled="currentPage === totalPages"
          class="p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 rounded-xl transition-all"
        >
          <ChevronRight :size="16" />
        </button>
        <button
          @click="currentPage = totalPages"
          :disabled="currentPage === totalPages"
          class="p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 rounded-xl transition-all"
        >
          <ChevronsRight :size="16" />
        </button>
      </div>
    </div>

    <!-- Modals (模态框) -->
    <!-- 确认删除对话框 -->
    <ConfirmDialog
      :show="showDeleteDialog"
      :title="deleteDialogTitle"
      :message="deleteDialogMessage"
      :loading="loading"
      type="danger"
      confirm-text="确认删除"
      cancel-text="取消"
      @confirm="confirmDelete"
      @close="showDeleteDialog = false"
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
      <div v-if="showRejectDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
        <div class="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden" @click.stop>
          <div class="px-8 py-6 border-b border-zinc-800/50 flex items-center justify-between">
            <h3 class="text-xl font-black text-zinc-100">驳回歌曲</h3>
            <button @click="cancelReject" class="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X :size="20" />
            </button>
          </div>

          <div class="p-8 space-y-6">
            <div class="p-5 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center gap-4">
              <div class="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/10">
                <Music :size="18" />
              </div>
              <div>
                <h4 class="font-bold text-zinc-100 text-sm">{{ rejectSongInfo.title }}</h4>
                <p class="text-xs text-zinc-500">投稿人: {{ rejectSongInfo.requester }}</p>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">驳回原因</label>
              <textarea
                v-model="rejectReason"
                placeholder="请输入驳回原因，将通过系统通知发送给投稿人..."
                class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-4 text-sm text-zinc-200 focus:outline-none focus:border-red-500/30 min-h-[120px] resize-none transition-all"
              />
            </div>

            <label class="flex items-center gap-3 cursor-pointer group px-1">
              <input v-model="addToBlacklist" type="checkbox" class="w-4 h-4 rounded border-zinc-800 bg-zinc-950 accent-red-600" />
              <div>
                <span class="text-xs font-bold text-zinc-300 group-hover:text-red-400 transition-colors">同时将此歌曲加入黑名单</span>
                <p class="text-[10px] text-zinc-600 font-medium">加入黑名单后，该歌曲将无法再次被投稿</p>
              </div>
            </label>
          </div>

          <div class="px-8 py-6 bg-zinc-900/50 border-t border-zinc-800/50 flex gap-3 justify-end">
            <button @click="cancelReject" class="px-6 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-300">取消</button>
            <button
              @click="confirmReject"
              :disabled="rejectLoading"
              class="px-8 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-lg transition-all disabled:opacity-50"
            >
              {{ rejectLoading ? '处理中...' : '确认驳回' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 投票人员弹窗 -->
    <VotersModal
      :show="showVotersModal"
      :song-id="selectedSongId"
      @close="closeVotersModal"
    />

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
      <div v-if="showEditModal || showAddSongModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm overflow-y-auto">
        <div class="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden my-auto" @click.stop>
          <div class="px-8 py-6 border-b border-zinc-800/50 flex items-center justify-between">
            <h3 class="text-xl font-black text-zinc-100">{{ showEditModal ? '编辑歌曲' : '手动添加歌曲' }}</h3>
            <button @click="showEditModal ? cancelEditSong() : cancelAddSong()" class="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X :size="20" />
            </button>
          </div>

          <div class="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">歌曲名称</label>
                <input
                  v-if="showEditModal"
                  v-model="editForm.title"
                  type="text"
                  placeholder="输入歌曲标题"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                />
                <input
                  v-else
                  v-model="addForm.title"
                  type="text"
                  placeholder="输入歌曲标题"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                />
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">歌手</label>
                <input
                  v-if="showEditModal"
                  v-model="editForm.artist"
                  type="text"
                  placeholder="输入歌手姓名"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                />
                <input
                  v-else
                  v-model="addForm.artist"
                  type="text"
                  placeholder="输入歌手姓名"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                />
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">投稿人</label>
              <div class="relative user-search-container">
                <div class="relative">
                  <input
                    v-if="showEditModal"
                    v-model="editUserSearchQuery"
                    @focus="showEditUserDropdown = true"
                    @input="searchEditUsers()"
                    type="text"
                    placeholder="搜索用户姓名或用户名"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                  />
                  <input
                    v-else
                    v-model="userSearchQuery"
                    @focus="showUserDropdown = true"
                    @input="searchUsers()"
                    type="text"
                    placeholder="搜索用户姓名或用户名"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                  />
                  <div v-if="(showEditModal ? editUserSearchLoading : userSearchLoading)" class="absolute right-4 top-1/2 -translate-y-1/2">
                    <div class="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                  </div>
                </div>

                <!-- 用户下拉列表 -->
                <div v-if="(showEditModal ? showEditUserDropdown && filteredEditUsers.length > 0 : showUserDropdown && filteredUsers.length > 0)"
                     class="absolute z-10 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                  <div
                    v-for="user in (showEditModal ? filteredEditUsers.slice(0, 10) : filteredUsers.slice(0, 10))"
                    :key="user.id"
                    @click="(showEditModal ? selectEditUser(user) : selectUser(user))"
                    class="px-4 py-3 hover:bg-zinc-800 cursor-pointer transition-colors flex items-center justify-between group"
                  >
                    <div class="flex flex-col">
                      <span class="text-sm font-bold text-zinc-200">{{ user.name }}</span>
                      <span class="text-[10px] text-zinc-500">@{{ user.username }}</span>
                    </div>
                    <Check v-if="(showEditModal ? selectedEditUser?.id === user.id : selectedUser?.id === user.id)" :size="14" class="text-blue-500" />
                  </div>
                </div>
              </div>
              <div v-if="(showEditModal ? selectedEditUser : selectedUser)" class="flex items-center gap-2 mt-2 px-1">
                <span class="text-[10px] font-bold text-blue-500">已选择: {{ (showEditModal ? selectedEditUser : selectedUser).name }} (@{{ (showEditModal ? selectedEditUser : selectedUser).username }})</span>
                <button @click="(showEditModal ? clearSelectedEditUser() : clearSelectedUser())" class="text-zinc-600 hover:text-zinc-400">
                  <X :size="12" />
                </button>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">学期</label>
              <CustomSelect
                v-if="showEditModal"
                v-model="editForm.semester"
                :options="availableSemesters"
                label-key="name"
                value-key="name"
                placeholder="选择学期"
              />
              <CustomSelect
                v-else
                v-model="addForm.semester"
                :options="availableSemesters"
                label-key="name"
                value-key="name"
                placeholder="选择学期"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-zinc-800/50">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">音乐平台 (可选)</label>
                <CustomSelect
                  v-if="showEditModal"
                  v-model="editForm.musicPlatform"
                  :options="[
                    { label: '网易云音乐', value: 'netease' },
                    { label: 'QQ音乐', value: 'tencent' },
                    { label: '哔哩哔哩', value: 'bilibili' }
                  ]"
                  placeholder="选择平台"
                />
                <CustomSelect
                  v-else
                  v-model="addForm.musicPlatform"
                  :options="[
                    { label: '网易云音乐', value: 'netease' },
                    { label: 'QQ音乐', value: 'tencent' },
                    { label: '哔哩哔哩', value: 'bilibili' }
                  ]"
                  placeholder="选择平台"
                />
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">音乐ID (可选)</label>
                <input
                  v-if="showEditModal"
                  v-model="editForm.musicId"
                  type="text"
                  placeholder="输入平台唯一标识符"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
                />
                <input
                  v-else
                  v-model="addForm.musicId"
                  type="text"
                  placeholder="输入平台唯一标识符"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">封面URL (可选)</label>
              <input
                v-if="showEditModal"
                v-model="editForm.cover"
                type="text"
                placeholder="http://..."
                class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
              />
              <input
                v-else
                v-model="addForm.cover"
                type="text"
                placeholder="http://..."
                class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
              />
              <p v-if="(showEditModal ? editCoverValidation.valid : addCoverValidation.valid) && (showEditModal ? editForm.cover : addForm.cover)"
                 class="text-[10px] text-emerald-500/80 font-bold px-1 flex items-center gap-1">
                <Check :size="10"/> URL有效
              </p>
              <p v-if="!(showEditModal ? editCoverValidation.valid : addCoverValidation.valid) && (showEditModal ? editForm.cover : addForm.cover)"
                 class="text-[10px] text-red-500/80 font-bold px-1 flex items-center gap-1">
                <X :size="10"/> {{ (showEditModal ? editCoverValidation.error : addCoverValidation.error) }}
              </p>
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">播放地址URL (可选)</label>
              <input
                v-if="showEditModal"
                v-model="editForm.playUrl"
                type="text"
                placeholder="http://..."
                class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
              />
              <input
                v-else
                v-model="addForm.playUrl"
                type="text"
                placeholder="http://..."
                class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
              />
              <p v-if="(showEditModal ? editPlayUrlValidation.valid : addPlayUrlValidation.valid) && (showEditModal ? editForm.playUrl : addForm.playUrl)"
                 class="text-[10px] text-emerald-500/80 font-bold px-1 flex items-center gap-1">
                <Check :size="10"/> URL有效
              </p>
              <p v-if="!(showEditModal ? editPlayUrlValidation.valid : addPlayUrlValidation.valid) && (showEditModal ? editForm.playUrl : addForm.playUrl)"
                 class="text-[10px] text-red-500/80 font-bold px-1 flex items-center gap-1">
                <X :size="10"/> {{ (showEditModal ? editPlayUrlValidation.error : addPlayUrlValidation.error) }}
              </p>
            </div>
          </div>

          <div class="px-8 py-6 bg-zinc-900/50 border-t border-zinc-800/50 flex gap-3 justify-end">
            <button @click="showEditModal ? cancelEditSong() : cancelAddSong()" class="px-6 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-300">取消</button>
            <button
              @click="showEditModal ? saveEditSong() : saveAddSong()"
              :disabled="(showEditModal ? editLoading : !canSubmitAddForm || addLoading)"
              class="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg transition-all disabled:opacity-50"
            >
              {{ (showEditModal ? (editLoading ? '保存中...' : '保存更改') : (addLoading ? '添加中...' : '添加歌曲')) }}
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
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import {
  Search, Plus, RotateCcw, Edit2, Check, X, Trash2,
  Music, Heart, Download, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, ExternalLink
} from 'lucide-vue-next'
import { useSongs } from '~/composables/useSongs'
import { useAdmin } from '~/composables/useAdmin'
import { useAuth } from '~/composables/useAuth'
import { useToast } from '~/composables/useToast'
import { useSemesters } from '~/composables/useSemesters'
import { validateUrl, getBilibiliUrl, convertToHttps } from '~/utils/url'

// 响应式数据
const { showToast: showNotification } = useToast()
const loading = ref(false)
const searchQuery = ref('')
const statusFilter = ref('all')
const sortOption = ref('time-desc')
const selectedSongs = ref([])
const currentPage = ref(1)
const pageSize = ref(20)

// 学期相关
const selectedSemester = ref('all')
const availableSemesters = ref([])

// 选项配置
const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '待排期', value: 'pending' },
  { label: '已排期', value: 'scheduled' },
  { label: '已播放', value: 'played' }
]

const sortOptions = [
  { label: '最新投稿', value: 'time-desc' },
  { label: '最早投稿', value: 'time-asc' },
  { label: '热度最高', value: 'votes-desc' },
  { label: '热度最低', value: 'votes-asc' },
  { label: '标题 A-Z', value: 'title-asc' },
  { label: '标题 Z-A', value: 'title-desc' }
]

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
  musicPlatform: '',
  musicId: '',
  cover: '',
  playUrl: ''
})

// 添加歌曲相关
const showAddSongModal = ref(false)
const addLoading = ref(false)
const searchLoading = ref(false)
const addForm = ref({
  title: '',
  artist: '',
  requester: '',
  semester: '',
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

// 计算属性
const filteredSongs = computed(() => {
  if (!songs.value) return []

  let filtered = [...songs.value]

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(song =>
      song.title?.toLowerCase().includes(query) ||
      song.artist?.toLowerCase().includes(query) ||
      song.requester?.toLowerCase().includes(query)
    )
  }

  // 学期过滤
  if (selectedSemester.value && selectedSemester.value !== 'all') {
    filtered = filtered.filter(song => song.semester === selectedSemester.value)
  }

  // 状态过滤
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(song => {
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
const displayedPages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const pages = []
  
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i)
      pages.push('...')
      pages.push(total)
    } else if (current >= total - 3) {
      pages.push(1)
      pages.push('...')
      for (let i = total - 4; i <= total; i++) pages.push(i)
    } else {
      pages.push(1)
      pages.push('...')
      for (let i = current - 1; i <= current + 1; i++) pages.push(i)
      pages.push('...')
      pages.push(total)
    }
  }
  return pages.filter(p => typeof p === 'number')
})

const playedCount = computed(() => {
  return songs.value.filter(song => song.played).length
})

const pendingCount = computed(() => {
  return songs.value.filter(song => !song.played).length
})

const isAllSelected = computed(() => {
  return paginatedSongs.value.length > 0 &&
    paginatedSongs.value.every(song => selectedSongs.value.includes(song.id))
})

// 计算属性：检查添加歌曲表单是否可以提交
const canSubmitAddForm = computed(() => {
  // 必填字段检查
  if (!addForm.value.title.trim() ||
    !addForm.value.artist.trim() ||
    !selectedUser.value ||
    !addForm.value.semester) {
    return false
  }

  // 可选字段验证检查
  if (addForm.value.cover && (!addCoverValidation.value.valid || addCoverValidation.value.validating)) {
    return false
  }

  if (addForm.value.playUrl && (!addPlayUrlValidation.value.valid || addPlayUrlValidation.value.validating)) {
    return false
  }

  return true
})

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

const getStatusText = (song) => {
  if (song.played) return '已播放'
  if (song.scheduled) return '待播放'
  return '未排期'
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedSongs.value = selectedSongs.value.filter(id =>
      !paginatedSongs.value.some(song => song.id === id)
    )
  } else {
    const newSelections = paginatedSongs.value
      .map(song => song.id)
      .filter(id => !selectedSongs.value.includes(id))
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
    showNotification('标记失败: ' + error.message, 'error')
  }
}

const markAsUnplayed = async (songId) => {
  try {
    await songsService.unmarkPlayed(songId)
    await refreshSongs()
  } catch (error) {
    console.error('标记未播放失败:', error)
    showNotification('标记失败: ' + error.message, 'error')
  }
}

const deleteSong = async (songId) => {
  const song = songs.value.find(s => s.id === songId)
  if (!song) return

  deleteDialogTitle.value = '删除歌曲'
  deleteDialogMessage.value = `确定要删除歌曲 "${song.title}" 吗？此操作不可撤销。`
  deleteAction.value = async () => {
    try {
      await adminService.deleteSong(songId)
      await refreshSongs()

      const index = selectedSongs.value.indexOf(songId)
      if (index > -1) {
        selectedSongs.value.splice(index, 1)
      }

      showNotification('歌曲删除成功', 'success')
    } catch (error) {
      console.error('删除歌曲失败:', error)
      showNotification('删除失败: ' + error.message, 'error')
    }
  }
  showDeleteDialog.value = true
}

const batchDelete = async () => {
  if (selectedSongs.value.length === 0) return

  deleteDialogTitle.value = '批量删除歌曲'
  deleteDialogMessage.value = `确定要删除选中的 ${selectedSongs.value.length} 首歌曲吗？此操作不可撤销。`
  deleteAction.value = async () => {
    try {
      loading.value = true

      for (const songId of selectedSongs.value) {
        await adminService.deleteSong(songId)
      }

      await refreshSongs()
      selectedSongs.value = []

      showNotification('批量删除成功', 'success')
    } catch (error) {
      console.error('批量删除失败:', error)
      showNotification('批量删除失败: ' + error.message, 'error')
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
  selectedSongsForDownload.value = selectedSongs.value.map(songId => {
    const song = songs.value.find(s => s.id === songId)
    return {
      id: `temp-${song.id}`,
      song: {
        id: song.id,
        title: song.title,
        artist: song.artist,
        musicPlatform: song.musicPlatform || 'unknown',
        requester: song.requester || '未知',
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
  const song = songs.value.find(s => s.id === songId)
  if (!song) return

  rejectSongInfo.value = {
    id: song.id,
    title: song.title || '',
    artist: song.artist || '',
    requester: song.requester || song.requester_name || '未知'
  }

  rejectReason.value = ''
  addToBlacklist.value = false
  showRejectDialog.value = true
}

// 确认驳回
const confirmReject = async () => {
  if (!rejectReason.value.trim()) {
    showNotification('请填写驳回原因', 'error')
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

    showNotification('歌曲驳回成功，已通知投稿人', 'success')
  } catch (error) {
    console.error('驳回歌曲失败:', error)
    showNotification('驳回失败: ' + (error.data?.message || error.message), 'error')
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
    requester: song.requester_id || song.requester || '',
    semester: song.semester || '',
    musicPlatform: song.musicPlatform || '',
    musicId: song.musicId || '',
    cover: song.cover || '',
    playUrl: song.playUrl || ''
  }

  if (song.requester_name) {
    selectedEditUser.value = {
      id: song.requester_id || song.requester,
      name: song.requester_name,
      username: song.requester_username || ''
    }
    editUserSearchQuery.value = song.requester_name
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
    showNotification('请填写歌曲名称和歌手', 'error')
    return
  }

  if (editForm.value.cover && !editCoverValidation.value.valid) {
    showNotification('请等待封面URL验证完成或修正无效的URL', 'error')
    return
  }

  if (editForm.value.playUrl && !editPlayUrlValidation.value.valid) {
    showNotification('请等待播放URL验证完成或修正无效的URL', 'error')
    return
  }

  if (editCoverValidation.value.validating || editPlayUrlValidation.value.validating) {
    showNotification('正在验证URL，请稍候...', 'warning')
    return
  }

  editLoading.value = true
  try {
    const { updateSong } = adminService
    await updateSong(editForm.value.id, {
      title: editForm.value.title,
      artist: editForm.value.artist,
      requester: editForm.value.requester,
      collaborators: selectedEditCollaborators.value.map(u => u.id),
      semester: editForm.value.semester,
      musicPlatform: editForm.value.musicPlatform || null,
      musicId: editForm.value.musicId || null,
      cover: editForm.value.cover || null,
      playUrl: editForm.value.playUrl || null
    })

    await refreshSongs()
    showEditModal.value = false

    showNotification('歌曲信息更新成功', 'success')
  } catch (error) {
    console.error('更新歌曲失败:', error)
    let errorMessage = '更新失败'
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
    musicPlatform: '',
    musicId: '',
    cover: '',
    playUrl: ''
  }
  editCoverValidation.value = { valid: true, error: '', validating: false }
  editPlayUrlValidation.value = { valid: true, error: '', validating: false }
  clearSelectedEditUser()
  selectedEditCollaborators.value = []
  editCollaboratorSearchQuery.value = ''
}

const openAddSongModal = () => {
  addForm.value = {
    title: '',
    artist: '',
    requester: '',
    semester: selectedSemester.value !== 'all' ? selectedSemester.value : '',
    musicPlatform: '',
    musicId: '',
    cover: ''
  }
  showAddSongModal.value = true
}

const saveAddSong = async () => {
  if (!addForm.value.title || !addForm.value.artist) {
    showNotification('请填写歌曲名称和歌手', 'error')
    return
  }

  if (!selectedUser.value || !addForm.value.requester) {
    showNotification('请选择投稿人', 'error')
    return
  }

  if (!addForm.value.semester) {
    showNotification('请选择学期', 'error')
    return
  }

  if (addForm.value.cover) {
    if (!addCoverValidation.value.valid) {
      showNotification('歌曲封面URL无效，请检查后重试', 'error')
      return
    }
    if (addCoverValidation.value.validating) {
      showNotification('正在验证封面URL，请稍候...', 'warning')
      return
    }
  }

  if (addForm.value.playUrl) {
    if (!addPlayUrlValidation.value.valid) {
      showNotification('播放地址URL无效，请检查后重试', 'error')
      return
    }
    if (addPlayUrlValidation.value.validating) {
      showNotification('正在验证播放地址URL，请稍候...', 'warning')
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
      musicPlatform: '',
      musicId: '',
      cover: '',
      playUrl: ''
    }
    clearSelectedUser()

    showNotification('歌曲添加成功', 'success')
  } catch (error) {
    console.error('添加歌曲失败:', error)
    let errorMessage = '添加失败'
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
      filteredEditCollaborators.value = users.filter(u => 
        (!selectedEditUser.value || u.id !== selectedEditUser.value.id) &&
        !selectedEditCollaborators.value.some(c => c.id === u.id)
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
  const index = selectedEditCollaborators.value.findIndex(u => u.id === userId)
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
watch([searchQuery, statusFilter, sortOption, selectedSemester], () => {
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
  availableSemesters.value.unshift({ id: 'all', name: '全部学期' })

  if (currentSemester.value) {
    selectedSemester.value = currentSemester.value.name
  }

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
watch(() => addForm.value.cover, (newUrl) => {
  if (newUrl) {
    clearTimeout(addCoverValidation.value.debounceTimer)
    addCoverValidation.value.debounceTimer = setTimeout(() => {
      validateAddCoverUrl(newUrl)
    }, 1000)
  } else {
    addCoverValidation.value = { valid: true, error: '', validating: false }
  }
})

watch(() => addForm.value.playUrl, (newUrl) => {
  if (newUrl) {
    clearTimeout(addPlayUrlValidation.value.debounceTimer)
    addPlayUrlValidation.value.debounceTimer = setTimeout(() => {
      validateAddPlayUrl(newUrl)
    }, 1000)
  } else {
    addPlayUrlValidation.value = { valid: true, error: '', validating: false }
  }
})

watch(() => editForm.value.cover, (newUrl) => {
  if (newUrl) {
    clearTimeout(editCoverValidation.value.debounceTimer)
    editCoverValidation.value.debounceTimer = setTimeout(() => {
      validateEditCoverUrl(newUrl)
    }, 1000)
  } else {
    editCoverValidation.value = { valid: true, error: '', validating: false }
  }
})

watch(() => editForm.value.playUrl, (newUrl) => {
  if (newUrl) {
    clearTimeout(editPlayUrlValidation.value.debounceTimer)
    editPlayUrlValidation.value.debounceTimer = setTimeout(() => {
      validateEditPlayUrl(newUrl)
    }, 1000)
  } else {
    editPlayUrlValidation.value = { valid: true, error: '', validating: false }
  }
})

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
