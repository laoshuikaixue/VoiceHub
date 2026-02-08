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
            <div v-if="selectedSongs.length > 0" class="flex items-center gap-2 p-1.5 bg-zinc-900/90 border border-zinc-800 rounded-2xl backdrop-blur-xl shadow-2xl">
              <button
                @click="openDownloadDialog"
                class="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-[11px] font-black rounded-xl border border-zinc-700/50 transition-all active:scale-95 uppercase tracking-widest"
              >
                <Download :size="14" class="text-emerald-500/70" /> 下载 ({{ selectedSongs.length }})
              </button>
              <button
                @click="batchDelete"
                class="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 text-[11px] font-black rounded-xl border border-zinc-700/50 transition-all active:scale-95 uppercase tracking-widest"
              >
                <Trash2 :size="14" class="text-red-500/70" /> 删除 ({{ selectedSongs.length }})
              </button>
            </div>
          </Transition>

          <button
            @click="showAddSongModal = true"
            class="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all active:scale-95"
          >
            <Plus :size="16" /> 手动添加
          </button>
          <button
            @click="refreshSongs(true)"
            :disabled="loading"
            class="flex items-center gap-2 px-5 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-bold rounded-xl border border-blue-500/20 transition-all disabled:opacity-50"
          >
            <RotateCcw :size="16" :class="{ 'animate-spin': loading }" /> 刷新
          </button>
        </div>
      </div>

      <!-- 过滤器栏 -->
      <div class="bg-zinc-900/30 border border-zinc-800/60 rounded-[2.5rem] p-4 flex flex-col lg:flex-row gap-4 items-center">
        <div class="relative flex-1 group w-full lg:w-auto">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-blue-500 transition-colors" :size="18" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索歌曲标题、艺术家或投稿人..."
            class="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500/30 transition-all placeholder:text-zinc-800 text-zinc-200"
          />
        </div>
        <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          <!-- 学期选择 -->
          <div class="relative min-w-[160px]">
            <CustomSelect
              v-model="selectedSemester"
              :options="semesterOptions"
              className="w-full"
            />
          </div>

          <!-- 状态过滤 -->
          <div class="relative min-w-[140px]">
            <CustomSelect
              v-model="statusFilter"
              :options="statusOptions"
              className="w-full"
            />
          </div>

          <!-- 排序方式 -->
          <div class="relative min-w-[140px]">
            <CustomSelect
              v-model="sortOption"
              :options="sortOptions"
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 歌曲表格 -->
    <div class="bg-zinc-900/10 border border-zinc-800/40 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
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
              'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all overflow-hidden bg-zinc-800/40 border-zinc-700/30 group-hover:border-zinc-600',
              selectedSongs.includes(song.id) ? 'border-blue-500/50' : ''
            ]">
              <img v-if="song.cover" :src="song.cover" class="w-full h-full object-cover" />
              <Music v-else :size="20" class="text-zinc-600" />
            </div>
            <div class="min-w-0">
              <h4 :class="[
                'font-bold truncate transition-colors',
                selectedSongs.includes(song.id) ? 'text-blue-400' : 'text-zinc-100 group-hover:text-blue-400'
              ]">
                {{ song.title }}
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
            v-for="p in totalPages"
            :key="p"
            v-show="Math.abs(p - currentPage) <= 2 || p === 1 || p === totalPages"
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
        <div class="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden" @click.stop>
          <div class="px-8 py-6 border-b border-zinc-800/50 flex items-center justify-between">
            <h3 class="text-xl font-black text-zinc-100">驳回歌曲</h3>
            <button @click="cancelReject" class="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X :size="20" />
            </button>
          </div>

          <div class="p-8 space-y-6">
            <div class="p-5 bg-zinc-950 border border-zinc-800 rounded-[1.5rem] flex items-center gap-4">
              <div class="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/10">
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
                class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-4 text-sm text-zinc-200 focus:outline-none focus:border-red-500/30 min-h-[120px] resize-none transition-all"
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
              class="px-8 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-xl transition-all disabled:opacity-50"
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
        <div class="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden my-auto" @click.stop>
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
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                />
                <input
                  v-else
                  v-model="addForm.title"
                  type="text"
                  placeholder="输入歌曲标题"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                />
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">歌手</label>
                <input
                  v-if="showEditModal"
                  v-model="editForm.artist"
                  type="text"
                  placeholder="输入歌手姓名"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                />
                <input
                  v-else
                  v-model="addForm.artist"
                  type="text"
                  placeholder="输入歌手姓名"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                />
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">投稿人</label>
              <div class="relative">
                <input
                  v-if="showEditModal"
                  v-model="editUserSearchQuery"
                  @focus="showEditUserDropdown = true"
                  @input="searchEditUsers()"
                  type="text"
                  placeholder="搜索用户姓名或用户名"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                />
                <input
                  v-else
                  v-model="userSearchQuery"
                  @focus="showUserDropdown = true"
                  @input="searchUsers()"
                  type="text"
                  placeholder="搜索用户姓名或用户名"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all"
                />
                <div v-if="(showEditModal ? editUserSearchLoading : userSearchLoading)" class="absolute right-4 top-1/2 -translate-y-1/2">
                  <div class="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                </div>

                <!-- 用户下拉列表 -->
                <div v-if="(showEditModal ? showEditUserDropdown && filteredEditUsers.length > 0 : showUserDropdown && filteredUsers.length > 0)"
                     class="absolute z-10 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
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
                :options="editSemesterOptions"
              />
              <CustomSelect
                v-else
                v-model="addForm.semester"
                :options="editSemesterOptions"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-zinc-800/50">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">音乐平台 (可选)</label>
                <CustomSelect
                  v-if="showEditModal"
                  v-model="editForm.musicPlatform"
                  :options="platformOptions"
                />
                <CustomSelect
                  v-else
                  v-model="addForm.musicPlatform"
                  :options="platformOptions"
                />
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">音乐ID (可选)</label>
                <input
                  v-if="showEditModal"
                  v-model="editForm.musicId"
                  type="text"
                  placeholder="输入平台唯一标识符"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
                />
                <input
                  v-else
                  v-model="addForm.musicId"
                  type="text"
                  placeholder="输入平台唯一标识符"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
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
                class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
              />
              <input
                v-else
                v-model="addForm.cover"
                type="text"
                placeholder="http://..."
                class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
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
                class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
              />
              <input
                v-else
                v-model="addForm.playUrl"
                type="text"
                placeholder="http://..."
                class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 focus:outline-none transition-all"
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
              class="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all disabled:opacity-50"
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
import {computed, onMounted, ref, watch} from 'vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import VotersModal from '~/components/Admin/VotersModal.vue'
import SongDownloadDialog from '~/components/Admin/SongDownloadDialog.vue'
import CustomSelect from './Common/CustomSelect.vue'
import {
  Search, Plus, RotateCcw, Edit2, Check, X, Trash2,
  Music, Heart, Download, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight
} from 'lucide-vue-next'
import {useSongs} from '~/composables/useSongs'
import {useAdmin} from '~/composables/useAdmin'
import {useAuth} from '~/composables/useAuth'
import {useSemesters} from '~/composables/useSemesters'
import {validateUrl} from '~/utils/url'

// 响应式数据
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

const semesterOptions = computed(() => {
  const opts = [{ label: '全部学期', value: 'all' }]
  if (availableSemesters.value) {
    opts.push(...availableSemesters.value.map(s => ({ label: s.name, value: s.name })))
  }
  return opts
})

const editSemesterOptions = computed(() => {
  if (availableSemesters.value) {
    return availableSemesters.value.map(s => ({ label: s.name, value: s.name }))
  }
  return []
})

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
  { label: '标题A-Z', value: 'title-asc' },
  { label: '标题Z-A', value: 'title-desc' }
]

const platformOptions = [
  { label: '请选择平台', value: '' },
  { label: '网易云音乐', value: 'netease' },
  { label: 'QQ音乐', value: 'tencent' },
  { label: '哔哩哔哩', value: 'bilibili' }
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
const addCoverValidation = ref({valid: true, error: '', validating: false})
const addPlayUrlValidation = ref({valid: true, error: '', validating: false})
const editCoverValidation = ref({valid: true, error: '', validating: false})
const editPlayUrlValidation = ref({valid: true, error: '', validating: false})

// 用户搜索相关
const userSearchQuery = ref('')
const showUserDropdown = ref(false)
const selectedUser = ref(null)
const allUsers = ref([])
const filteredUsers = ref([])
const userSearchLoading = ref(false)

// 编辑模态框的用户搜索
const editUserSearchQuery = ref('')
const showEditUserDropdown = ref(false)
const selectedEditUser = ref(null)
const filteredEditUsers = ref([])
const editUserSearchLoading = ref(false)

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
  if (selectedSemester.value !== 'all') {
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
  // 如果输入了封面URL，必须验证通过且不在验证中
  if (addForm.value.cover && (!addCoverValidation.value.valid || addCoverValidation.value.validating)) {
    return false
  }

  // 如果输入了播放URL，必须验证通过且不在验证中
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

const getStatusClass = (song) => {
  if (song.played) return 'played'
  if (song.scheduled) return 'pending'
  return 'unscheduled'
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
    if (window.$showNotification) {
      window.$showNotification('标记失败: ' + error.message, 'error')
    }
  }
}

const markAsUnplayed = async (songId) => {
  try {
    await songsService.unmarkPlayed(songId)
    await refreshSongs()
  } catch (error) {
    console.error('标记未播放失败:', error)
    if (window.$showNotification) {
      window.$showNotification('标记失败: ' + error.message, 'error')
    }
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

      // 从选中列表中移除
      const index = selectedSongs.value.indexOf(songId)
      if (index > -1) {
        selectedSongs.value.splice(index, 1)
      }

      if (window.$showNotification) {
        window.$showNotification('歌曲删除成功', 'success')
      }
    } catch (error) {
      console.error('删除歌曲失败:', error)
      if (window.$showNotification) {
        window.$showNotification('删除失败: ' + error.message, 'error')
      }
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

      if (window.$showNotification) {
        window.$showNotification('批量删除成功', 'success')
      }
    } catch (error) {
      console.error('批量删除失败:', error)
      if (window.$showNotification) {
        window.$showNotification('批量删除失败: ' + error.message, 'error')
      }
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
  // 将选中的歌曲转换为下载对话框需要的格式（与ScheduleManager保持一致）
  selectedSongsForDownload.value = selectedSongs.value.map(songId => {
    const song = songs.value.find(s => s.id === songId)
    return {
      id: `temp-${song.id}`, // 临时ID，因为这不是真正的排期
      song: {
        id: song.id,
        title: song.title,
        artist: song.artist,
        musicPlatform: song.musicPlatform || 'unknown',
        requester: song.requester || '未知',
        musicId: song.musicId,
        playUrl: song.playUrl  // 添加缺失的playUrl字段
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
    if (window.$showNotification) {
      window.$showNotification('请填写驳回原因', 'error')
    }
    return
  }

  rejectLoading.value = true
  try {
    const response = await $fetch('/api/admin/songs/reject', {
      method: 'POST',
      body: {
        songId: rejectSongInfo.value.id,
        reason: rejectReason.value.trim(),
        addToBlacklist: addToBlacklist.value
      }
    })

    // 强制绕过缓存刷新歌曲列表
    await refreshSongs(true)

    // 从选中列表中移除
    const index = selectedSongs.value.indexOf(rejectSongInfo.value.id)
    if (index > -1) {
      selectedSongs.value.splice(index, 1)
    }

    showRejectDialog.value = false

    if (window.$showNotification) {
      window.$showNotification('歌曲驳回成功，已通知投稿人', 'success')
    }
  } catch (error) {
    console.error('驳回歌曲失败:', error)
    if (window.$showNotification) {
      window.$showNotification('驳回失败: ' + (error.data?.message || error.message), 'error')
    }
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

  // 设置编辑时的用户信息
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

  // 设置联合投稿人
  if (song.collaborators && Array.isArray(song.collaborators)) {
    selectedEditCollaborators.value = [...song.collaborators]
  } else {
    selectedEditCollaborators.value = []
  }

  showEditModal.value = true
}

const saveEditSong = async () => {
  if (!editForm.value.title || !editForm.value.artist) {
    if (window.$showNotification) {
      window.$showNotification('请填写歌曲名称和歌手', 'error')
    }
    return
  }

  // 检查封面URL验证状态
  if (editForm.value.cover && !editCoverValidation.value.valid) {
    if (window.$showNotification) {
      window.$showNotification('请等待封面URL验证完成或修正无效的URL', 'error')
    }
    return
  }

  // 检查播放URL验证状态
  if (editForm.value.playUrl && !editPlayUrlValidation.value.valid) {
    if (window.$showNotification) {
      window.$showNotification('请等待播放URL验证完成或修正无效的URL', 'error')
    }
    return
  }

  // 检查是否正在验证中
  if (editCoverValidation.value.validating || editPlayUrlValidation.value.validating) {
    if (window.$showNotification) {
      window.$showNotification('正在验证URL，请稍候...', 'warning')
    }
    return
  }

  editLoading.value = true
  try {
    const {updateSong} = adminService
    // 传递投稿人字段，支持修改投稿人
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

    if (window.$showNotification) {
      window.$showNotification('歌曲信息更新成功', 'success')
    }
  } catch (error) {
    console.error('更新歌曲失败:', error)

    // 提取具体的错误信息
    let errorMessage = '更新失败'
    if (error.data && error.data.message) {
      errorMessage = error.data.message
    } else if (error.message) {
      errorMessage = error.message
    } else if (error.statusMessage) {
      errorMessage = error.statusMessage
    }

    if (window.$showNotification) {
      window.$showNotification(errorMessage, 'error')
    }
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
  // 重置验证状态
  editCoverValidation.value = {valid: true, error: '', validating: false}
  editPlayUrlValidation.value = {valid: true, error: '', validating: false}
  clearSelectedEditUser()
  selectedEditCollaborators.value = []
  editCollaboratorSearchQuery.value = ''
}

// 添加歌曲
const openAddSongModal = () => {
  addForm.value = {
    title: '',
    artist: '',
    requester: '',
    semester: '',
    musicPlatform: '',
    musicId: '',
    cover: ''
  }
  showAddSongModal.value = true
}


const saveAddSong = async () => {
  // 验证必填字段
  if (!addForm.value.title || !addForm.value.artist) {
    if (window.$showNotification) {
      window.$showNotification('请填写歌曲名称和歌手', 'error')
    }
    return
  }

  // 验证投稿人是否已选择
  if (!selectedUser.value || !addForm.value.requester) {
    if (window.$showNotification) {
      window.$showNotification('请选择投稿人', 'error')
    }
    return
  }

  // 验证学期是否已选择
  if (!addForm.value.semester) {
    if (window.$showNotification) {
      window.$showNotification('请选择学期', 'error')
    }
    return
  }

  // 验证可选字段URL有效性 - 如果输入了可选字段，必须验证通过
  if (addForm.value.cover) {
    if (!addCoverValidation.value.valid) {
      if (window.$showNotification) {
        window.$showNotification('歌曲封面URL无效，请检查后重试', 'error')
      }
      return
    }
    if (addCoverValidation.value.validating) {
      if (window.$showNotification) {
        window.$showNotification('正在验证封面URL，请稍候...', 'warning')
      }
      return
    }
  }

  if (addForm.value.playUrl) {
    if (!addPlayUrlValidation.value.valid) {
      if (window.$showNotification) {
        window.$showNotification('播放地址URL无效，请检查后重试', 'error')
      }
      return
    }
    if (addPlayUrlValidation.value.validating) {
      if (window.$showNotification) {
        window.$showNotification('正在验证播放地址URL，请稍候...', 'warning')
      }
      return
    }
  }

  addLoading.value = true
  try {
    const {addSong} = adminService
    await addSong({
      title: addForm.value.title,
      artist: addForm.value.artist,
      requester: addForm.value.requester, // 这里应该是用户ID
      semester: addForm.value.semester,
      musicPlatform: addForm.value.musicPlatform || null,
      musicId: addForm.value.musicId || null,
      cover: addForm.value.cover || null,
      playUrl: addForm.value.playUrl || null
    })

    await refreshSongs()
    showAddSongModal.value = false

    // 清空表单内容
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

    if (window.$showNotification) {
      window.$showNotification('歌曲添加成功', 'success')
    }
  } catch (error) {
    console.error('添加歌曲失败:', error)

    // 提取具体的错误信息
    let errorMessage = '添加失败'
    if (error.data && error.data.message) {
      errorMessage = error.data.message
    } else if (error.message) {
      errorMessage = error.message
    } else if (error.statusMessage) {
      errorMessage = error.statusMessage
    }

    if (window.$showNotification) {
      window.$showNotification(errorMessage, 'error')
    }
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
  // 重置URL验证状态
  addCoverValidation.value = {valid: true, error: '', validating: false}
  addPlayUrlValidation.value = {valid: true, error: '', validating: false}
  clearSelectedUser()
}

// 用户搜索功能
// 防抖定时器
let searchTimeout = null

// API搜索用户函数
const searchUsersFromAPI = async (query) => {
  if (!query.trim()) {
    return []
  }

  try {
    const response = await $fetch('/api/admin/users', {
      method: 'GET',
      query: {
        search: query,
        limit: 20 // 限制返回数量，提高性能
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

  // 清除之前的定时器
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  // 设置防抖
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
  }, 300) // 300ms防抖延迟
}

const selectUser = (user) => {
  selectedUser.value = user
  addForm.value.requester = user.id // 存储用户ID
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
// 编辑模态框防抖定时器
let editSearchTimeout = null

const searchEditUsers = async () => {
  if (!editUserSearchQuery.value.trim()) {
    filteredEditUsers.value = []
    showEditUserDropdown.value = false
    editUserSearchLoading.value = false
    return
  }

  // 清除之前的定时器
  if (editSearchTimeout) {
    clearTimeout(editSearchTimeout)
  }

  // 设置防抖
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
  }, 300) // 300ms防抖延迟
}

const selectEditUser = (user) => {
  selectedEditUser.value = user
  editForm.value.requester = user.id // 存储用户ID
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
const selectedEditCollaborators = ref([])
const editCollaboratorSearchQuery = ref('')
const filteredEditCollaborators = ref([])
const showEditCollaboratorDropdown = ref(false)
const editCollaboratorSearchLoading = ref(false)
let editCollaboratorSearchTimeout = null

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
      // 过滤掉已经是主投稿人或已在联合投稿人列表中的用户
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
  }
  if (!event.target.closest('.collaborator-search-container')) {
    showEditCollaboratorDropdown.value = false
  }
}

// 监听器
watch([searchQuery, statusFilter, sortOption, selectedSemester], () => {
  currentPage.value = 1
})

// 生命周期
// 监听学期更新事件
const {semesters, fetchSemesters, semesterUpdateEvent} = useSemesters()

watch(semesterUpdateEvent, async () => {
  // 当学期更新时，重新获取学期列表
  await fetchSemesters()
  availableSemesters.value = semesters.value || []
})

onMounted(async () => {
  songsService = useSongs()
  adminService = useAdmin()
  auth = useAuth()

  // 获取可用学期
  const {fetchCurrentSemester, currentSemester} = useSemesters()
  await fetchSemesters()
  await fetchCurrentSemester()

  availableSemesters.value = semesters.value || []

  // 设置默认学期为当前学期
  if (currentSemester.value) {
    selectedSemester.value = currentSemester.value.name
  }

  // 用户搜索改为实时API搜索，不再预加载用户列表

  // 添加点击外部关闭下拉框的事件监听
  document.addEventListener('click', handleClickOutside)

  await refreshSongs()
})

// URL验证函数
const validateAddCoverUrl = async (url) => {
  if (!url) {
    addCoverValidation.value = {valid: true, error: '', validating: false}
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
    addPlayUrlValidation.value = {valid: true, error: '', validating: false}
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
    editCoverValidation.value = {valid: true, error: '', validating: false}
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
    editPlayUrlValidation.value = {valid: true, error: '', validating: false}
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
    // 防抖处理，避免频繁验证
    clearTimeout(addCoverValidation.value.debounceTimer)
    addCoverValidation.value.debounceTimer = setTimeout(() => {
      validateAddCoverUrl(newUrl)
    }, 1000)
  } else {
    addCoverValidation.value = {valid: true, error: '', validating: false}
  }
})

watch(() => addForm.value.playUrl, (newUrl) => {
  if (newUrl) {
    // 防抖处理，避免频繁验证
    clearTimeout(addPlayUrlValidation.value.debounceTimer)
    addPlayUrlValidation.value.debounceTimer = setTimeout(() => {
      validateAddPlayUrl(newUrl)
    }, 1000)
  } else {
    addPlayUrlValidation.value = {valid: true, error: '', validating: false}
  }
})

watch(() => editForm.value.cover, (newUrl) => {
  if (newUrl) {
    // 防抖处理，避免频繁验证
    clearTimeout(editCoverValidation.value.debounceTimer)
    editCoverValidation.value.debounceTimer = setTimeout(() => {
      validateEditCoverUrl(newUrl)
    }, 1000)
  } else {
    editCoverValidation.value = {valid: true, error: '', validating: false}
  }
})

watch(() => editForm.value.playUrl, (newUrl) => {
  if (newUrl) {
    // 防抖处理，避免频繁验证
    clearTimeout(editPlayUrlValidation.value.debounceTimer)
    editPlayUrlValidation.value.debounceTimer = setTimeout(() => {
      validateEditPlayUrl(newUrl)
    }, 1000)
  } else {
    editPlayUrlValidation.value = {valid: true, error: '', validating: false}
  }
})

// 组件卸载时移除事件监听
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.song-management {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  background: var(--bg-primary);
  border-radius: 12px;
  border: 1px solid #1f1f1f;
  color: #e2e8f0;
  min-height: 100vh;
}

/* 工具栏 */
.toolbar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 20px;
  background: #1a1a1a;
  border-radius: 12px;
  border: 1px solid #2a2a2a;
  flex-wrap: wrap;
}

.toolbar h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #f8fafc;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.search-section {
  flex: 1;
  min-width: 300px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 16px;
  width: 20px;
  height: 20px;
  color: #666666;
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 12px 16px 12px 48px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-input::placeholder {
  color: #666666;
}

.clear-search-btn {
  position: absolute;
  right: 12px;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: #666666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.clear-search-btn:hover {
  background: #3a3a3a;
  color: #ffffff;
}

.clear-search-btn svg {
  width: 16px;
  height: 16px;
}

.filter-section {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 12px 16px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: #667eea;
}

.semester-select {
  width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-section {
  display: flex;
  gap: 12px;
}

.refresh-btn,
.batch-download-btn,
.batch-delete-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.refresh-btn {
  background: #667eea;
  color: #ffffff;
}

.refresh-btn:hover:not(:disabled) {
  background: #5a67d8;
}

.refresh-btn:disabled {
  background: #3a3a3a;
  color: #666666;
  cursor: not-allowed;
}

.batch-download-btn {
  background: #10b981;
  color: #ffffff;
}

.batch-download-btn:hover {
  background: #059669;
}

.batch-delete-btn {
  background: #ef4444;
  color: #ffffff;
}

.batch-delete-btn:hover {
  background: #dc2626;
}

.refresh-btn svg,
.batch-download-btn svg,
.batch-delete-btn svg {
  width: 16px;
  height: 16px;
}

/* 统计栏 */
.stats-bar {
  display: flex;
  gap: 32px;
  padding: 16px 20px;
  background: #1a1a1a;
  border-radius: 8px;
  border: 1px solid #2a2a2a;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-size: 14px;
  color: #888888;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

/* 加载状态 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #2a2a2a;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: #888888;
  font-size: 14px;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
}

.empty-state svg {
  width: 48px;
  height: 48px;
  color: #444444;
}

.empty-text {
  color: #666666;
  font-size: 16px;
  text-align: center;
}

/* 歌曲表格 */
.song-table {
  background: #1a1a1a;
  border-radius: 12px;
  border: 1px solid #2a2a2a;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 50px 2fr 150px 100px 100px 160px;
  gap: 16px;
  padding: 16px 20px;
  background: #2a2a2a;
  border-bottom: 1px solid #3a3a3a;
}

.header-cell {
  font-size: 14px;
  font-weight: 600;
  color: #cccccc;
  display: flex;
  align-items: center;
}

.song-row {
  display: grid;
  grid-template-columns: 50px 2fr 150px 100px 100px 160px;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid #2a2a2a;
  transition: all 0.2s ease;
}

.song-row:hover {
  background: #1f1f1f;
}

.song-row.selected {
  background: rgba(102, 126, 234, 0.1);
  border-color: #667eea;
}

.song-row:last-child {
  border-bottom: none;
}

.cell {
  display: flex;
  align-items: center;
}

.checkbox-cell {
  justify-content: center;
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: #667eea;
}

.song-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.song-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  line-height: 1.2;
}

.song-artist {
  font-size: 14px;
  color: #cccccc;
}

.song-meta {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}

.song-time {
  font-size: 12px;
  color: #888888;
}

.song-url {
  font-size: 12px;
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.submitter-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.submitter-name {
  font-size: 14px;
  color: #ffffff;
  font-weight: 500;
}

.submitter-username {
  font-size: 12px;
  color: #888888;
}

.song-stats {
  display: flex;
  align-items: center;
  gap: 4px;
}

.song-stats .stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #888888;
}

.song-stats .stat-item.clickable {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.song-stats .stat-item.clickable:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.song-stats .stat-item.clickable:hover svg {
  color: #ef4444;
}

.song-stats svg {
  width: 14px;
  height: 14px;
  color: #ef4444;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

.status-badge.pending {
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.2);
}

.status-badge.unscheduled {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
  border: 1px solid rgba(107, 114, 128, 0.2);
}

.status-badge.played {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.action-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
}

.action-btn {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.played-btn {
  background: #10b981;
  color: #ffffff;
}

.played-btn:hover {
  background: #059669;
}

.unplayed-btn {
  background: #f59e0b;
  color: #ffffff;
}

.unplayed-btn:hover {
  background: #d97706;
}

.delete-btn {
  background: #ef4444;
  color: #ffffff;
}

.delete-btn:hover {
  background: #dc2626;
}

.reject-btn {
  background: #f59e0b;
  color: #ffffff;
}

.reject-btn:hover {
  background: #d97706;
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
}

.page-btn {
  padding: 8px 16px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  color: #cccccc;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-btn:hover:not(:disabled) {
  background: #3a3a3a;
  color: #ffffff;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #888888;
  margin: 0 16px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .search-section {
    min-width: auto;
  }

  .filter-section,
  .action-section {
    justify-content: flex-start;
  }

  .table-header,
  .song-row {
    grid-template-columns: 50px 2fr 120px 80px 80px 140px;
    gap: 12px;
    padding: 12px 16px;
  }
}

@media (max-width: 768px) {
  .song-management {
    padding: 16px;
  }

  .stats-bar {
    flex-direction: column;
    gap: 12px;
  }

  .table-header,
  .song-row {
    grid-template-columns: 40px 1fr 60px 80px;
    gap: 8px;
    padding: 12px;
  }

  .submitter-cell,
  .stats-cell {
    display: none;
  }

  .song-meta {
    flex-direction: column;
    gap: 4px;
  }

  .action-buttons {
    flex-direction: column;
    gap: 4px;
  }

  .action-btn {
    width: 28px;
    height: 28px;
  }

  .pagination {
    flex-wrap: wrap;
    gap: 8px;
  }
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: #1a1a1a;
  border-radius: 12px;
  border: 1px solid #2a2a2a;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #2a2a2a;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #f8fafc;
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: #888888;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: #2a2a2a;
  color: #ffffff;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #e2e8f0;
}

.form-input,
.form-select {
  width: 100%;
  padding: 12px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 14px;
  transition: all 0.2s ease;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-textarea {
  width: 100%;
  padding: 12px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 14px;
  transition: all 0.2s ease;
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
}

.form-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input::placeholder {
  color: #666666;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
}

.auto-match-section {
  display: flex;
  gap: 12px;
  align-items: end;
}

.auto-match-section .form-group {
  flex: 1;
  margin-bottom: 0;
}

.auto-match-btn {
  padding: 12px 16px;
  background: #667eea;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 8px;
}

.auto-match-btn:hover:not(:disabled) {
  background: #5a67d8;
}

.auto-match-btn:disabled {
  background: #3a3a3a;
  color: #666666;
  cursor: not-allowed;
}

.modal-footer {
  padding: 20px 24px;
  border-top: 1px solid #2a2a2a;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.modal-btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-btn.primary {
  background: #667eea;
  color: #ffffff;
}

.modal-btn.primary:hover:not(:disabled) {
  background: #5a67d8;
}

.modal-btn.secondary {
  background: #2a2a2a;
  color: #e2e8f0;
  border: 1px solid #3a3a3a;
}

.modal-btn.secondary:hover {
  background: #3a3a3a;
}

.modal-btn:disabled {
  background: #3a3a3a;
  color: #666666;
  cursor: not-allowed;
}

.edit-btn {
  background: #667eea;
  color: #ffffff;
}

.edit-btn:hover {
  background: #5a67d8;
}

.add-song-btn {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-song-btn svg {
  width: 16px;
  height: 16px;
}

/* 模态框按钮样式 */
.close-btn {
  background: none;
  border: none;
  color: #888888;
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #2a2a2a;
  color: #ffffff;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #2a2a2a;
}

.btn-cancel {
  padding: 12px 24px;
  background: #2a2a2a;
  color: #e2e8f0;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cancel:hover {
  background: #3a3a3a;
}

.btn-primary {
  padding: 12px 24px;
  background: #667eea;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover:not(:disabled) {
  background: #5a67d8;
}

.btn-primary:disabled {
  background: #3a3a3a;
  color: #666666;
  cursor: not-allowed;
}

.btn-danger {
  padding: 12px 24px;
  background: #ef4444;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-danger:disabled {
  background: #3a3a3a;
  color: #666666;
  cursor: not-allowed;
}

/* 驳回歌曲对话框样式 */
.reject-song-info {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.reject-song-info .song-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 4px;
}

.reject-song-info .song-artist {
  font-size: 14px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.reject-song-info .song-submitter {
  font-size: 13px;
  color: #64748b;
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  margin-bottom: 0;
}

.checkbox-label .checkbox {
  margin: 0;
  margin-top: 2px;
}

.checkbox-text {
  font-size: 14px;
  color: #e2e8f0;
  line-height: 1.4;
}

.search-input-group {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-input-group .form-input {
  flex: 1;
}

.auto-fill-btn {
  padding: 12px 16px;
  background: #10b981;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.auto-fill-btn:hover:not(:disabled) {
  background: #059669;
}

.auto-fill-btn:disabled {
  background: #3a3a3a;
  color: #666666;
  cursor: not-allowed;
}

/* 用户搜索样式 */
.user-search-container {
  position: relative;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-loading {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  color: #667eea;
}

.user-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
}

.user-option {
  padding: 12px;
  cursor: pointer;
  border-bottom: 1px solid #3a3a3a;
  transition: background-color 0.2s;
}

.user-option:hover {
  background-color: #3a3a3a;
}

.user-option:last-child {
  border-bottom: none;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-weight: 500;
  color: #ffffff;
}

.user-username {
  font-size: 0.875rem;
  color: #888888;
}

.selected-user {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid #667eea;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: #667eea;
}

.clear-user-btn {
  background: none;
  border: none;
  color: #888888;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.clear-user-btn:hover {
  background: #3a3a3a;
  color: #ffffff;
}

/* 联合投稿人列表样式 */
.selected-users-list {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selected-user-tag {
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid #667eea;
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #667eea;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.selected-user-tag:hover {
  background: rgba(102, 126, 234, 0.15);
  transform: translateY(-1px);
}

.remove-user-btn {
  background: none;
  border: none;
  color: #888888;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
  line-height: 1;
}

.remove-user-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* 可选字段样式 */
.optional-label {
  font-size: 0.75rem;
  color: #888888;
  font-weight: normal;
}

.field-hint {
  margin-top: 4px;
  font-size: 0.75rem;
  color: #888888;
  line-height: 1.4;
}

/* URL验证状态样式 */
.validation-loading {
  margin-top: 4px;
  font-size: 0.75rem;
  color: #667eea;
  display: flex;
  align-items: center;
  gap: 4px;
}

.validation-error {
  margin-top: 4px;
  font-size: 0.75rem;
  color: #ef4444;
  line-height: 1.4;
}

.validation-success {
  margin-top: 4px;
  font-size: 0.75rem;
  color: #10b981;
  line-height: 1.4;
}

.input-wrapper .form-input.error {
  border-color: #ef4444;
}
</style>
