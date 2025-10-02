<template>
  <div class="song-management">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="search-section">
        <div class="search-input-wrapper">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索歌曲标题、艺术家或投稿人..."
            class="search-input"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="clear-search-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="filter-section">
        <select v-model="selectedSemester" class="filter-select semester-select">
          <option value="all">全部学期</option>
          <option v-for="semester in availableSemesters" :key="semester.id" :value="semester.name">
            {{ semester.name }}
          </option>
        </select>
        
        <select v-model="statusFilter" class="filter-select">
          <option value="all">全部状态</option>
          <option value="pending">待排期</option>
          <option value="scheduled">已排期</option>
          <option value="played">已播放</option>
        </select>
        
        <select v-model="sortOption" class="filter-select">
          <option value="time-desc">最新投稿</option>
          <option value="time-asc">最早投稿</option>
          <option value="votes-desc">热度最高</option>
          <option value="votes-asc">热度最低</option>
          <option value="title-asc">标题A-Z</option>
          <option value="title-desc">标题Z-A</option>
        </select>
      </div>
      
      <div class="action-section">
        <button
          @click="showAddSongModal = true"
          class="filter-select add-song-btn"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          手动添加
        </button>
        
        <button
          @click="refreshSongs"
          class="refresh-btn"
          :disabled="loading"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23,4 23,10 17,10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          刷新
        </button>
        
        <button
          v-if="selectedSongs.length > 0"
          @click="openDownloadDialog"
          class="batch-download-btn"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          下载选中 ({{ selectedSongs.length }})
        </button>
        
        <button
          v-if="selectedSongs.length > 0"
          @click="batchDelete"
          class="batch-delete-btn"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
          </svg>
          删除选中 ({{ selectedSongs.length }})
        </button>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">总计:</span>
        <span class="stat-value">{{ filteredSongs.length }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已播放:</span>
        <span class="stat-value">{{ playedCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">待播放:</span>
        <span class="stat-value">{{ pendingCount }}</span>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <div class="loading-text">正在加载歌曲...</div>
    </div>

    <!-- 歌曲列表 -->
    <div v-else class="song-list">
      <div v-if="filteredSongs.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 12h8"/>
        </svg>
        <div class="empty-text">
          {{ searchQuery ? '没有找到匹配的歌曲' : '暂无歌曲数据' }}
        </div>
      </div>
      
      <div v-else class="song-table">
        <!-- 表头 -->
        <div class="table-header">
          <div class="header-cell checkbox-cell">
            <input
              type="checkbox"
              :checked="isAllSelected"
              @change="toggleSelectAll"
              class="checkbox"
            />
          </div>
          <div class="header-cell song-info-cell">歌曲信息</div>
          <div class="header-cell submitter-cell">投稿人</div>
          <div class="header-cell stats-cell">统计</div>
          <div class="header-cell status-cell">状态</div>
          <div class="header-cell actions-cell">操作</div>
        </div>
        
        <!-- 歌曲行 -->
        <div
          v-for="song in paginatedSongs"
          :key="song.id"
          :class="['song-row', { selected: selectedSongs.includes(song.id) }]"
        >
          <div class="cell checkbox-cell">
            <input
              type="checkbox"
              :checked="selectedSongs.includes(song.id)"
              @change="toggleSelectSong(song.id)"
              class="checkbox"
            />
          </div>
          
          <div class="cell song-info-cell">
            <div class="song-info">
              <div class="song-title">{{ song.title }}</div>
              <div class="song-artist">{{ song.artist }}</div>
              <div class="song-meta">
                <span class="song-time">{{ formatDate(song.createdAt) }}</span>
                <span v-if="song.url" class="song-url">有音频</span>
              </div>
            </div>
          </div>
          
          <div class="cell submitter-cell">
            <div class="submitter-info">
              <div class="submitter-name">{{ song.requester || '未知' }}</div>
              <div v-if="song.user" class="submitter-username">@{{ song.user.username }}</div>
            </div>
          </div>
          
          <div class="cell stats-cell">
            <div class="song-stats">
              <div class="stat-item clickable" @click="showVoters(song.id)" :title="song.voteCount > 0 ? '点击查看投票人员' : '暂无投票'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                {{ song.voteCount || 0 }}
              </div>
            </div>
          </div>
          
          <div class="cell status-cell">
            <span :class="['status-badge', getStatusClass(song)]">
              {{ getStatusText(song) }}
            </span>
          </div>
          
          <div class="cell actions-cell">
            <div class="action-buttons">
              <button
                @click="editSong(song)"
                class="action-btn edit-btn"
                title="编辑歌曲"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              
              <button
                v-if="!song.played"
                @click="markAsPlayed(song.id)"
                class="action-btn played-btn"
                title="标记为已播放"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
              </button>
              
              <button
                v-else
                @click="markAsUnplayed(song.id)"
                class="action-btn unplayed-btn"
                title="标记为未播放"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </button>
              
              <button
                @click="rejectSong(song.id)"
                class="action-btn reject-btn"
                title="驳回歌曲"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </button>
              
              <button
                @click="deleteSong(song.id)"
                class="action-btn delete-btn"
                title="删除歌曲"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 分页 -->
      <div v-if="totalPages > 1" class="pagination">
        <button
          @click="currentPage = 1"
          :disabled="currentPage === 1"
          class="page-btn"
        >
          首页
        </button>
        <button
          @click="currentPage--"
          :disabled="currentPage === 1"
          class="page-btn"
        >
          上一页
        </button>
        
        <div class="page-info">
          第 {{ currentPage }} 页，共 {{ totalPages }} 页
        </div>
        
        <button
          @click="currentPage++"
          :disabled="currentPage === totalPages"
          class="page-btn"
        >
          下一页
        </button>
        <button
          @click="currentPage = totalPages"
          :disabled="currentPage === totalPages"
          class="page-btn"
        >
          末页
        </button>
      </div>
    </div>
  </div>

  <!-- 确认删除对话框 -->
  <ConfirmDialog
    :show="showDeleteDialog"
    :title="deleteDialogTitle"
    :message="deleteDialogMessage"
    type="danger"
    confirm-text="删除"
    cancel-text="取消"
    :loading="loading"
    @confirm="confirmDelete"
    @close="showDeleteDialog = false"
  />

  <!-- 驳回歌曲对话框 -->
  <div v-if="showRejectDialog" class="modal-overlay" @click="cancelReject">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>驳回歌曲</h3>
        <button @click="cancelReject" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="reject-song-info">
          <div class="song-title">{{ rejectSongInfo.title }}</div>
          <div class="song-artist">{{ rejectSongInfo.artist }}</div>
          <div class="song-submitter">投稿人：{{ rejectSongInfo.requester }}</div>
        </div>
        <form @submit.prevent="confirmReject">
          <div class="form-group">
            <label>驳回原因</label>
            <textarea
              v-model="rejectReason"
              class="form-textarea"
              placeholder="请输入驳回原因，将通过系统通知发送给投稿人..."
              rows="4"
              required
            ></textarea>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input
                v-model="addToBlacklist"
                type="checkbox"
                class="checkbox"
              />
              <span class="checkbox-text">同时将此歌曲加入黑名单</span>
            </label>
            <div class="field-hint">
              加入黑名单后，该歌曲将无法再次被投稿
            </div>
          </div>
          <div class="form-actions">
            <button type="button" @click="cancelReject" class="btn-cancel">取消</button>
            <button type="submit" class="btn-danger" :disabled="rejectLoading">
              {{ rejectLoading ? '驳回中...' : '确认驳回' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

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

  <!-- 编辑歌曲模态框 -->
  <div v-if="showEditModal" class="modal-overlay" @click="cancelEditSong">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>编辑歌曲</h3>
        <button @click="cancelEditSong" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <form @submit.prevent="saveEditSong">
          <div class="form-group">
            <label>歌曲名称</label>
            <input
              v-model="editForm.title"
              type="text"
              class="form-input"
              placeholder="请输入歌曲名称"
              required
            />
          </div>
          <div class="form-group">
            <label>歌手</label>
            <input
              v-model="editForm.artist"
              type="text"
              class="form-input"
              placeholder="请输入歌手名称"
              required
            />
          </div>
          <div class="form-group">
            <label>投稿人</label>
            <div class="user-search-container">
              <div class="search-input-wrapper">
                <input
                  v-model="editUserSearchQuery"
                  type="text"
                  class="form-input"
                  placeholder="搜索用户姓名或用户名"
                  @input="searchEditUsers"
                  @focus="showEditUserDropdown = true"
                />
                <div v-if="editUserSearchLoading" class="search-loading">
                  <svg class="loading-spinner" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                      <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                      <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                    </circle>
                  </svg>
                </div>
              </div>
              <div v-if="showEditUserDropdown && filteredEditUsers.length > 0" class="user-dropdown">
                <div
                  v-for="user in filteredEditUsers.slice(0, 10)"
                  :key="user.id"
                  class="user-option"
                  @click="selectEditUser(user)"
                >
                  <div class="user-info">
                    <span class="user-name">{{ user.name }}</span>
                    <span class="user-username">@{{ user.username }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="selectedEditUser" class="selected-user">
              <span>已选择: {{ selectedEditUser.name }} (@{{ selectedEditUser.username }})</span>
              <button type="button" @click="clearSelectedEditUser" class="clear-user-btn">×</button>
            </div>
          </div>
          <div class="form-group">
            <label>学期</label>
            <select v-model="editForm.semester" class="form-select">
              <option v-for="semester in availableSemesters" :key="semester.id" :value="semester.name">
                {{ semester.name }}
              </option>
            </select>
          </div>
          
          <!-- 音乐平台和ID（可选） -->
          <div class="form-group">
            <label>音乐平台 <span class="optional-label">（可选）</span></label>
            <select v-model="editForm.musicPlatform" class="form-select">
              <option value="">请选择平台</option>
              <option value="netease">网易云音乐</option>
              <option value="tencent">QQ音乐</option>
            </select>
          </div>
          <div class="form-group">
            <label>音乐ID <span class="optional-label">（可选）</span></label>
            <input
              v-model="editForm.musicId"
              type="text"
              class="form-input"
              placeholder="请输入音乐平台上的歌曲ID"
            />
            <div class="field-hint">
              音乐ID是歌曲在对应平台上的唯一标识符，用于播放功能
            </div>
          </div>
          <div class="form-group">
            <label>歌曲封面URL <span class="optional-label">（可选）</span></label>
            <div class="input-wrapper">
              <input
                v-model="editForm.cover"
                type="url"
                class="form-input"
                placeholder="请输入歌曲封面图片的URL地址"
                :class="{ 'error': editForm.cover && !editCoverValidation.valid }"
              />
              <div v-if="editCoverValidation.validating" class="validation-loading">
                验证中...
              </div>
              <div v-if="editForm.cover && !editCoverValidation.valid && !editCoverValidation.validating" class="validation-error">
                {{ editCoverValidation.error }}
              </div>
              <div v-if="editForm.cover && editCoverValidation.valid && !editCoverValidation.validating" class="validation-success">
                ✓ URL有效
              </div>
              <div class="field-hint">
                歌曲封面将显示在歌曲列表中，建议使用高质量的图片链接
              </div>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" @click="cancelEditSong" class="btn-cancel">取消</button>
            <button type="submit" class="btn-primary" :disabled="editLoading">
              {{ editLoading ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- 手动添加歌曲模态框 -->
  <div v-if="showAddSongModal" class="modal-overlay" @click="cancelAddSong">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>手动添加歌曲</h3>
        <button @click="cancelAddSong" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <form @submit.prevent="saveAddSong">
          <div class="form-group">
            <label>歌曲名称</label>
            <input
              v-model="addForm.title"
              type="text"
              class="form-input"
              placeholder="请输入歌曲名称"
              required
            />
          </div>
          <div class="form-group">
            <label>歌手</label>
            <input
              v-model="addForm.artist"
              type="text"
              class="form-input"
              placeholder="请输入歌手名称"
              required
            />
          </div>
          <div class="form-group">
            <label>投稿人</label>
            <div class="user-search-container">
              <div class="search-input-wrapper">
                <input
                  v-model="userSearchQuery"
                  type="text"
                  class="form-input"
                  placeholder="搜索用户姓名或用户名"
                  @input="searchUsers"
                  @focus="showUserDropdown = true"
                />
                <div v-if="userSearchLoading" class="search-loading">
                  <svg class="loading-spinner" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                      <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                      <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                    </circle>
                  </svg>
                </div>
              </div>
              <div v-if="showUserDropdown && filteredUsers.length > 0" class="user-dropdown">
                <div
                  v-for="user in filteredUsers.slice(0, 10)"
                  :key="user.id"
                  class="user-option"
                  @click="selectUser(user)"
                >
                  <div class="user-info">
                    <span class="user-name">{{ user.name }}</span>
                    <span class="user-username">@{{ user.username }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="selectedUser" class="selected-user">
              <span>已选择: {{ selectedUser.name }} (@{{ selectedUser.username }})</span>
              <button type="button" @click="clearSelectedUser" class="clear-user-btn">×</button>
            </div>
          </div>
          <div class="form-group">
            <label>学期</label>
            <select v-model="addForm.semester" class="form-select">
              <option v-for="semester in availableSemesters" :key="semester.id" :value="semester.name">
                {{ semester.name }}
              </option>
            </select>
          </div>
          
          <!-- 音乐平台和ID（可选） -->
          <div class="form-group">
            <label>音乐平台 <span class="optional-label">（可选）</span></label>
            <select v-model="addForm.musicPlatform" class="form-select">
              <option value="">请选择平台</option>
              <option value="netease">网易云音乐</option>
              <option value="tencent">QQ音乐</option>
            </select>
          </div>
          <div class="form-group">
            <label>音乐ID <span class="optional-label">（可选）</span></label>
            <input
              v-model="addForm.musicId"
              type="text"
              class="form-input"
              placeholder="请输入音乐平台上的歌曲ID"
            />
            <div class="field-hint">
              音乐ID是歌曲在对应平台上的唯一标识符，用于播放功能
            </div>
          </div>
          <div class="form-group">
            <label>歌曲封面URL <span class="optional-label">（可选）</span></label>
            <div class="input-wrapper">
              <input
                v-model="addForm.cover"
                type="url"
                class="form-input"
                placeholder="请输入歌曲封面图片的URL地址"
                :class="{ 'error': addForm.cover && !addCoverValidation.valid }"
              />
              <div v-if="addCoverValidation.validating" class="validation-loading">
                验证中...
              </div>
              <div v-if="addForm.cover && !addCoverValidation.valid && !addCoverValidation.validating" class="validation-error">
                {{ addCoverValidation.error }}
              </div>
              <div v-if="addForm.cover && addCoverValidation.valid && !addCoverValidation.validating" class="validation-success">
                ✓ URL有效
              </div>
              <div class="field-hint">
                歌曲封面将显示在歌曲列表中，建议使用高质量的图片链接
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>播放地址URL <span class="optional-label">（可选）</span></label>
            <div class="input-wrapper">
              <input
                v-model="addForm.playUrl"
                type="url"
                class="form-input"
                placeholder="请输入歌曲播放的URL地址"
                :class="{ 'error': addForm.playUrl && !addPlayUrlValidation.valid }"
              />
              <div v-if="addPlayUrlValidation.validating" class="validation-loading">
                验证中...
              </div>
              <div v-if="addForm.playUrl && !addPlayUrlValidation.valid && !addPlayUrlValidation.validating" class="validation-error">
                {{ addPlayUrlValidation.error }}
              </div>
              <div v-if="addForm.playUrl && addPlayUrlValidation.valid && !addPlayUrlValidation.validating" class="validation-success">
                ✓ URL有效
              </div>
              <div class="field-hint">
                播放地址是音乐播放器直接播放的链接，如果提供将优先使用此地址播放
              </div>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" @click="cancelAddSong" class="btn-cancel">取消</button>
            <button type="submit" class="btn-primary" :disabled="!canSubmitAddForm || addLoading">
              {{ addLoading ? '添加中...' : '添加歌曲' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import VotersModal from '~/components/Admin/VotersModal.vue'
import SongDownloadDialog from '~/components/Admin/SongDownloadDialog.vue'
import { useSongs } from '~/composables/useSongs'
import { useAdmin } from '~/composables/useAdmin'
import { useAuth } from '~/composables/useAuth'
import { useSemesters } from '~/composables/useSemesters'
import { validateUrl } from '~/utils/url'

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
  cover: ''
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
  return 'pending'
}

const getStatusText = (song) => {
  if (song.played) return '已播放'
  return '待播放'
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
    cover: song.cover || ''
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

  // 检查是否正在验证中
  if (editCoverValidation.value.validating) {
    if (window.$showNotification) {
      window.$showNotification('正在验证URL，请稍候...', 'warning')
    }
    return
  }

  editLoading.value = true
  try {
    const { updateSong } = adminService
    // 传递投稿人字段，支持修改投稿人
    await updateSong(editForm.value.id, {
      title: editForm.value.title,
      artist: editForm.value.artist,
      requester: editForm.value.requester,
      semester: editForm.value.semester,
      musicPlatform: editForm.value.musicPlatform || null,
      musicId: editForm.value.musicId || null,
      cover: editForm.value.cover || null
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
    cover: ''
  }
  // 重置验证状态
  editCoverValidation.value = { valid: true, error: '', validating: false }
  clearSelectedEditUser()
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
    const { addSong } = adminService
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
  addCoverValidation.value = { valid: true, error: '', validating: false }
  addPlayUrlValidation.value = { valid: true, error: '', validating: false }
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

// 点击外部关闭下拉框
const handleClickOutside = (event) => {
  if (!event.target.closest('.user-search-container')) {
    showUserDropdown.value = false
    showEditUserDropdown.value = false
  }
}

// 监听器
watch([searchQuery, statusFilter, sortOption, selectedSemester], () => {
  currentPage.value = 1
})

// 生命周期
// 监听学期更新事件
const { semesters, fetchSemesters, semesterUpdateEvent } = useSemesters()

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
  const { fetchCurrentSemester, currentSemester } = useSemesters()
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

// 监听URL变化并验证
watch(() => addForm.value.cover, (newUrl) => {
  if (newUrl) {
    // 防抖处理，避免频繁验证
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
    // 防抖处理，避免频繁验证
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
    // 防抖处理，避免频繁验证
    clearTimeout(editCoverValidation.value.debounceTimer)
    editCoverValidation.value.debounceTimer = setTimeout(() => {
      validateEditCoverUrl(newUrl)
    }, 1000)
  } else {
    editCoverValidation.value = { valid: true, error: '', validating: false }
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
