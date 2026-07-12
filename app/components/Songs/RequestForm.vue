<template>
  <div class="request-form">
    <div class="rules-section desktop-only-rules">
      <h2 class="section-title">{{ locale.guidelinesTitle }}</h2>
      <div class="rules-content-desktop">
        <div v-if="submissionGuidelines" class="guidelines-content">
          {{ submissionGuidelines }}
        </div>
        <div v-else class="default-guidelines">
          <p v-for="(rule, index) in locale.defaultGuidelines" :key="`desktop-rule-${index}`">
            {{ index + 1 }}. {{ rule }}
          </p>
        </div>
      </div>
    </div>

    <!-- 移动端投稿须知 -->
    <div class="rules-section mobile-only-rules">
      <h3 class="rules-title">
        <Icon :size="16" class="rules-icon" name="bell" />
        {{ locale.guidelinesTitle }}
      </h3>
      <div class="rules-content">
        <div v-if="submissionGuidelines" class="guidelines-content">
          {{ submissionGuidelines }}
        </div>
        <div v-else class="default-guidelines">
          <div
            v-for="(rule, index) in locale.mobileDefaultGuidelines"
            :key="`mobile-rule-${index}`"
            class="rule-item"
          >
            <span>{{ index + 1 }}.</span> {{ rule }}
          </div>
        </div>
      </div>
    </div>

    <div class="form-container">
      <form class="song-request-form" @submit.prevent="handleSearch">
        <!-- 顶部行：搜索和联合投稿 -->
        <div class="form-header-row">
          <!-- 歌曲搜索区域 -->
          <div class="search-section">
            <div class="search-label">{{ locale.searchLabel }}</div>
            <div class="search-input-group">
              <input
                id="title"
                v-model="title"
                class="search-input"
                :placeholder="locale.searchPlaceholder"
                required
                type="text"
              >
              <button
                :disabled="loading || searching || !title.trim()"
                class="search-button"
                type="submit"
              >
                {{ loading || searching ? locale.processing : locale.search }}
              </button>
              <button
                :disabled="loading || searching"
                :aria-label="locale.audioMatch"
                class="audio-match-btn"
                :title="locale.audioMatch"
                type="button"
                @click="openAudioMatchModal"
              >
                <Icon :size="16" name="mic" />
                <span class="btn-text">{{ locale.audioMatchShort }}</span>
              </button>
            </div>
            <button
              v-if="showImportSemesterBtn"
              class="import-semester-btn"
              type="button"
              :title="locale.importFromPast"
              @click="showImportSongsModal = true"
            >
              <Icon :size="16" name="history" />
              <span class="btn-text">{{ locale.importFromPast }}</span>
            </button>
          </div>

          <!-- 联合投稿人区域 -->
          <div v-if="user && enableCollaborativeSubmission" class="collaborators-section">
            <div class="section-label">{{ locale.collaborators }}</div>
            <div class="collaborators-list">
              <div v-for="user in collaborators" :key="user.id" class="collaborator-tag">
                <span class="collaborator-name">{{ user.name }}</span>
                <button
                  class="remove-collaborator"
                  type="button"
                  @click="removeCollaborator(user.id)"
                >
                  <Icon :size="12" name="close" />
                </button>
              </div>
              <button
                class="add-collaborator-btn"
                type="button"
                @click="showUserSearchModal = true"
              >
                <Icon :size="14" name="plus" />
                {{ locale.add }}
              </button>
            </div>
          </div>
        </div>

        <!-- 搜索结果容器 -->
        <div class="search-results-container">
          <div v-if="!user" class="submission-status-horizontal login-required-notice">
            <Lock class="notice-icon" :size="14" />
            <span class="notice-text">{{ locale.loginRequiredNotice }}</span>
            <button class="login-link-btn" type="button" @click="handleLoginRedirect">
              {{ locale.loginNow }}
            </button>
          </div>
          <!-- 投稿状态显示 - 横向布局，只在设置了限额时显示 -->
          <div
            v-if="user && submissionStatus && (submissionStatus.limitEnabled || submissionStatus.timeLimitationEnabled || submissionStatus.submissionClosed)"
            class="submission-status-horizontal"
          >
            <!-- 超级管理员提示 -->
            <div
              v-if="user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')"
              class="admin-notice-horizontal"
            >
              <span class="admin-icon">👑</span>
              <span class="admin-text">{{ locale.adminUnlimited }}</span>
            </div>

            <!-- 投稿关闭提示 -->
            <div v-else-if="submissionStatus.submissionClosed" class="submission-closed-notice">
              <span class="closed-icon">🚫</span>
              <span class="closed-text">
                {{
                  submissionStatus.timeLimitationEnabled && !submissionStatus.currentTimePeriod
                    ? locale.outsideRequestTime
                    : locale.submissionClosed
                }}
              </span>
            </div>

            <!-- 投稿状态内容 -->
            <div v-else class="status-content-horizontal">
              <!-- 当前时段信息 -->
              <div
                v-if="submissionStatus.timeLimitationEnabled && submissionStatus.currentTimePeriod"
                class="status-item-horizontal"
              >
                <span class="status-label">{{ locale.currentPeriod }}</span>
                <span class="status-value">{{ submissionStatus.currentTimePeriod.name }}</span>
                <span
                  v-if="submissionStatus.currentTimePeriod.expected > 0"
                  class="status-remaining"
                >
                  ({{ locale.accepted }} {{ submissionStatus.currentTimePeriod.accepted }} /
                  {{ submissionStatus.currentTimePeriod.expected }})
                </span>
              </div>

              <div v-if="submissionStatus.dailyLimit" class="status-item-horizontal">
                <span class="status-label">{{ locale.todayRequests }}</span>
                <span class="status-value"
                  >{{ submissionStatus.dailyUsed }} / {{ submissionStatus.dailyLimit }}</span
                >
                <span class="status-remaining"
                  >{{ locale.remaining }}
                  {{ Math.max(0, submissionStatus.dailyLimit - submissionStatus.dailyUsed) }}</span
                >
              </div>

              <div v-if="submissionStatus.weeklyLimit" class="status-item-horizontal">
                <span class="status-label">{{ locale.weeklyRequests }}</span>
                <span class="status-value"
                  >{{ submissionStatus.weeklyUsed }} / {{ submissionStatus.weeklyLimit }}</span
                >
                <span class="status-remaining"
                  >{{ locale.remaining }}
                  {{
                    Math.max(0, submissionStatus.weeklyLimit - submissionStatus.weeklyUsed)
                  }}</span
                >
              </div>

              <div v-if="submissionStatus.monthlyLimit" class="status-item-horizontal">
                <span class="status-label">{{ locale.monthlyRequests }}</span>
                <span class="status-value"
                  >{{ submissionStatus.monthlyUsed }} / {{ submissionStatus.monthlyLimit }}</span
                >
                <span class="status-remaining"
                  >{{ locale.remaining }}
                  {{
                    Math.max(0, submissionStatus.monthlyLimit - submissionStatus.monthlyUsed)
                  }}</span
                >
              </div>
              <div v-if="cardCodeLimitBypassActive" class="status-item-horizontal">
                <span class="status-label">{{ locale.cardCodeLabel }}</span>
                <span class="status-value">{{ locale.cardCodeBypassesLimit }}</span>
              </div>
            </div>
          </div>

          <!-- 音乐平台选择按钮 -->
          <div class="platform-selection-container">
            <div class="platform-selection">
              <button
                :class="['platform-btn', { active: platform === 'netease' }]"
                type="button"
                @click="switchPlatform('netease')"
              >
                {{ locale.platforms.netease }}
              </button>
              <button
                :class="['platform-btn', { active: platform === 'tencent' }]"
                type="button"
                @click="switchPlatform('tencent')"
              >
                {{ locale.platforms.tencent }}
              </button>
              <button
                :class="['platform-btn', { active: platform === 'bilibili' }]"
                type="button"
                @click="switchPlatform('bilibili')"
              >
                {{ locale.platforms.bilibili }}
              </button>
            </div>

            <!-- 网易云音乐登录状态和选项 -->
            <div v-if="platform === 'netease'" class="netease-options">
              <!-- 加载中状态 -->
              <div v-if="checkingNeteaseLogin" class="netease-loading-state">
                <div class="loading-content">
                  <div class="loading-spinner" />
                  <span class="loading-text">{{ locale.refreshing }}</span>
                </div>
              </div>

              <!-- 未登录状态 -->
              <div v-else-if="!isNeteaseLoggedIn" class="login-entry">
                <div class="login-desc">
                  <p class="login-title">{{ locale.neteaseLoginTitle }}</p>
                </div>
                <div class="login-actions">
                  <button class="login-btn" type="button" @click="showLoginModal = true">
                    {{ locale.loginNow }}
                  </button>
                  <button class="import-btn" type="button" @click="handleImportClick">
                    <Icon :size="14" name="upload" />
                    {{ locale.importData }}
                  </button>
                </div>
              </div>

              <!-- 已登录状态 -->
              <div v-else class="user-status">
                <div class="user-compact-row">
                  <div class="user-profile">
                    <img
                      v-if="neteaseUser?.avatarUrl"
                      :src="convertToHttps(neteaseUser.avatarUrl)"
                      alt="avatar"
                      class="user-avatar"
                    >
                    <span class="user-name">{{ neteaseUser?.nickname || locale.loggedIn }}</span>
                  </div>

                  <div class="search-type-switch">
                    <label :class="['radio-label', { active: searchType === 1 }]">
                      <input v-model="searchType" :value="1" type="radio" > {{ locale.single }}
                    </label>
                    <label :class="['radio-label', { active: searchType === 1009 }]">
                      <input v-model="searchType" :value="1009" type="radio" > {{ locale.podcast }}
                    </label>
                  </div>

                  <div class="user-actions-row">
                    <button
                      class="action-btn-compact"
                      :title="locale.recent"
                      type="button"
                      @click="showRecentSongsModal = true"
                    >
                      <Icon :size="14" name="history" />
                      <span>{{ locale.recent }}</span>
                    </button>
                    <button
                      class="action-btn-compact"
                      :title="locale.playlist"
                      type="button"
                      @click="showPlaylistModal = true"
                    >
                      <Icon :size="14" name="playlist" />
                      <span>{{ locale.playlist }}</span>
                    </button>
                    <button
                      class="action-btn-compact"
                      :aria-label="locale.exportCookie"
                      :title="locale.exportCookie"
                      type="button"
                      @click="handleExportData"
                    >
                      <Icon :size="14" name="download" />
                    </button>
                    <button
                      class="action-btn-compact text-red-400 hover:text-red-300 hover:bg-red-400/10"
                      :aria-label="locale.logout"
                      :title="locale.logout"
                      type="button"
                      @click="handleLogoutNetease"
                    >
                      <Icon :size="14" name="logout" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- QQ音乐登录状态和选项 -->
            <div v-if="platform === 'tencent'" class="netease-options">
              <div v-if="!isQQMusicLoggedIn" class="login-entry">
                <div class="login-desc">
                  <p class="login-title">{{ locale.qqLoginTitle }}</p>
                </div>
                <div class="login-actions">
                  <button
                    class="login-btn qq-login-btn"
                    type="button"
                    @click="showQQLoginModal = true"
                  >
                    {{ locale.loginNow }}
                  </button>
                </div>
              </div>

              <div v-else class="user-status">
                <div class="user-compact-row">
                  <div class="user-profile">
                    <img
                      v-if="qqMusicUser?.avatarUrl"
                      :src="convertToHttps(qqMusicUser.avatarUrl)"
                      alt="avatar"
                      class="user-avatar"
                    >
                    <div v-else class="qq-user-avatar">
                      <Icon :size="14" name="music" />
                    </div>
                    <span class="user-name">{{ qqMusicUser?.nickname || locale.qqLoggedIn }}</span>
                  </div>

                  <div class="user-actions-row">
                    <button
                      class="action-btn-compact text-red-400 hover:bg-red-400/10 hover:text-red-300"
                      :aria-label="locale.logoutQQ"
                      :title="locale.logoutQQ"
                      type="button"
                      @click="handleLogoutQQMusic"
                    >
                      <Icon :size="14" name="logout" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="results-content">
            <!-- 播出时段、备注和点歌券 -->
            <div v-if="playTimeSelectionEnabled" class="form-row mb-4">
              <!-- 播出时段选择 -->
              <div class="form-group">
                <div class="input-wrapper">
                  <CustomSelect
                    v-model="preferredPlayTimeId"
                    :options="formattedPlayTimes"
                    :label="locale.preferredPlayTime"
                    label-key="displayName"
                    value-key="id"
                    :placeholder="locale.choosePlayTime"
                  />
                </div>
              </div>
            </div>

            <div
              v-if="enableSubmissionRemarks || cardCodeEnabled"
              class="form-row submission-meta-row"
            >
              <div v-if="enableSubmissionRemarks" class="form-group submission-note-group">
                <div class="input-wrapper">
                  <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <label for="submission-note" class="text-[12px] font-bold text-zinc-300"
                      >{{ locale.submissionNote }}</label
                    >
                    <div class="flex items-center gap-2">
                      <button
                        v-if="cardCodeEnabled"
                        :class="[
                          'mobile-card-code-chip',
                          trimmedCardCode
                            ? cardCodeValidation.valid
                              ? 'is-valid'
                              : cardCodeValidation.valid === false
                                ? 'is-invalid'
                                : 'has-code'
                            : cardCodeFieldMeta.required
                              ? 'is-required'
                              : ''
                        ]"
                        type="button"
                        @click="openCardCodeModal"
                      >
                        <Icon
                          :size="12"
                          :name="cardCodeValidation.checking ? 'loader' : trimmedCardCode ? (cardCodeValidation.valid === false ? 'close' : 'check') : 'plus'"
                        />
                        <span>{{ mobileCardCodeLabel }}</span>
                      </button>
                      <label class="custom-checkbox-wrapper">
                        <input
                          v-model="submissionNotePublic"
                          type="checkbox"
                          class="custom-checkbox-input"
                        >
                        <span class="custom-checkbox-box">
                          <svg
                            class="custom-checkbox-icon"
                            viewBox="0 0 12 10"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M1 5L4.5 8.5L11 1.5"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                        </span>
                        <span class="custom-checkbox-text">{{ locale.publicToUsers }}</span>
                      </label>
                    </div>
                  </div>
                  <textarea
                    id="submission-note"
                    v-model="submissionNote"
                    maxlength="300"
                    class="w-full min-h-[60px] rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 resize-y transition-all"
                  />
                  <div class="mt-1 flex justify-end text-[11px] text-zinc-500">
                    <span>{{ submissionNote.length }}/300</span>
                  </div>
                </div>
              </div>

              <div
                v-if="cardCodeEnabled"
                :class="[
                  'form-group card-code-form-group',
                  { 'mobile-hidden-card-code-group': enableSubmissionRemarks }
                ]"
              >
                <div class="desktop-card-code-panel">
                  <div class="flex min-w-0 items-center gap-2">
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-xs font-black text-zinc-200">{{ locale.cardCode }}</span>
                        <span
                          :class="[
                            'rounded-full border px-1.5 py-0.5 text-[9px] font-black',
                            cardCodeFieldMeta.required
                              ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                              : 'border-zinc-700 bg-zinc-800/70 text-zinc-400'
                          ]"
                        >
                          {{ cardCodeFieldMeta.required ? locale.required : locale.optional }}
                        </span>
                      </div>
                      <p
                        :class="[
                          'mt-1 truncate text-[11px]',
                          cardCodeValidation.valid
                            ? 'text-emerald-300/80'
                            : cardCodeValidation.valid === false
                              ? 'text-red-300/80'
                              : cardCodeFieldMeta.required
                                ? 'text-yellow-300/80'
                                : 'text-zinc-500'
                        ]"
                      >
                        {{ cardCodeStatusText }}
                      </p>
                    </div>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <button
                      class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-3 text-xs font-black text-yellow-200 transition-all hover:border-yellow-400/40 hover:bg-yellow-500/15"
                      type="button"
                      @click="openCardCodeModal"
                    >
                      <Icon :size="13" :name="trimmedCardCode ? 'edit' : 'plus'" />
                      {{ trimmedCardCode ? locale.editCardCode : locale.addCardCode }}
                    </button>
                    <button
                      v-if="trimmedCardCode"
                      class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-500 transition-all hover:border-red-500/30 hover:text-red-300"
                      :title="locale.clearCardCode"
                      type="button"
                      @click="clearCardCode"
                    >
                      <Icon :size="13" name="close" />
                    </button>
                  </div>
                </div>

                <button
                  v-if="!enableSubmissionRemarks"
                  :class="[
                    'mobile-card-code-button',
                    trimmedCardCode
                      ? cardCodeValidation.valid
                        ? 'is-valid'
                        : cardCodeValidation.valid === false
                          ? 'is-invalid'
                          : 'has-code'
                      : cardCodeFieldMeta.required
                        ? 'is-required'
                        : ''
                  ]"
                  type="button"
                  @click="openCardCodeModal"
                >
                  <span class="flex min-w-0 items-center gap-2">
                    <Icon
                      :size="14"
                      :name="cardCodeValidation.checking ? 'loader' : trimmedCardCode ? (cardCodeValidation.valid === false ? 'close' : 'check') : 'plus'"
                    />
                    <span class="truncate">{{ cardCodeStatusText }}</span>
                  </span>
                  <Icon :size="13" name="chevron-right" />
                </button>
              </div>
            </div>

            <!-- 加载状态 -->
            <div v-if="searching" class="loading-state">
              <div class="loading-spinner" />
              <p class="loading-text">{{ locale.processing }}</p>
            </div>

            <!-- 搜索结果列表 -->
            <Transition mode="out-in" name="results-fade">
              <div v-if="searchResults.length > 0 && !searching" key="results" class="results-list">
                <TransitionGroup class="results-grid" name="result-item" tag="div">
                  <div
                    v-for="(result, index) in searchResults"
                    :key="`${platform}-${result.id || index}`"
                    class="result-item group"
                  >
                    <div
                      class="result-cover"
                      @click.stop="isBilibiliMultiP(result) ? submitSong(result) : playSong(result)"
                    >
                      <img
                        :src="convertToHttps(result.cover)"
                        :alt="locale.coverAlt"
                        class="cover-img"
                        referrerpolicy="no-referrer"
                      >
                      <div v-if="!isBilibiliMultiP(result)" class="play-overlay-container">
                        <div class="play-button-wrapper">
                          <Icon name="play" :size="20" class="play-icon" />
                        </div>
                      </div>
                    </div>
                    <div class="result-info">
                      <h4 class="result-title">{{ result.song || result.title }}</h4>
                      <p class="result-artist">{{ result.singer || result.artist }}</p>
                      <p
                        v-if="result.album"
                        :class="['result-album', { 'clickable-album': isNeteaseAlbum(result) }]"
                        :title="isNeteaseAlbum(result) ? locale.albumDetailsTitle : result.album"
                        @click.stop="isNeteaseAlbum(result) ? openAlbumDetails(result) : null"
                      >
                        <span class="album-label">{{ locale.album }}</span>
                        <span class="album-name">{{ result.album }}</span>
                        <Icon
                          v-if="isNeteaseAlbum(result)"
                          name="external-link"
                          :size="12"
                          class="album-link-icon"
                        />
                      </p>
                    </div>
                    <div class="result-actions">
                      <!-- QQ音乐上传到网易云按钮（仅当结果确实来自QQ音乐时显示） -->
                      <button
                        v-if="isTencentSource(result)"
                        class="cloud-disk-btn"
                        :title="locale.uploadToNeteaseCloud"
                        @click.stop.prevent="openUploadDialog(result)"
                      >
                        <Icon name="cloud-upload" :size="18" />
                      </button>

                      <!-- 多P视频的特殊处理 -->
                      <div
                        v-if="
                          isBilibiliMultiP(result) && getBilibiliEpisodeStatus(result)?.allSubmitted
                        "
                        class="similar-song-info"
                      >
                        <span class="similar-text">{{ locale.allEpisodesSubmitted }}</span>
                      </div>
                      <div
                        v-else-if="
                          isBilibiliMultiP(result) &&
                          getBilibiliEpisodeStatus(result)?.partialSubmitted
                        "
                        class="similar-song-info"
                      >
                        <span class="similar-text">{{ locale.partialEpisodesSubmitted }}</span>
                        <button
                          :disabled="submitting"
                          class="select-btn"
                          @click.stop.prevent="submitSong(result)"
                        >
                          {{ locale.chooseEpisodes }}
                        </button>
                      </div>
                      <!-- 检查是否已存在相似歌曲 -->
                      <div v-else-if="getSimilarSong(result)" class="similar-song-info">
                        <!-- 根据歌曲状态显示不同的文本 -->
                        <span
                          v-if="getSimilarSong(result)?.played"
                          class="similar-text status-played"
                        >
                          {{
                            isSuperAdmin
                              ? locale.songPlayed
                              : enableReplayRequests
                                ? locale.songPlayed
                                : locale.songPlayed
                          }}
                        </span>
                        <span
                          v-else-if="getSimilarSong(result)?.scheduled"
                          class="similar-text status-scheduled"
                          >{{ locale.songScheduled }}</span
                        >
                        <span v-else class="similar-text">{{ locale.songExists }}</span>

                        <!-- 超级管理员对已播放的相似歌曲：显示继续投稿 -->
                        <button
                          v-if="getSimilarSong(result)?.played && isSuperAdmin"
                          :disabled="submitting"
                          class="select-btn"
                          @click.stop.prevent="submitSong(result, { forceResubmit: true })"
                        >
                          {{ locale.continueSubmit }}
                        </button>

                        <!-- 开启重播申请且非管理员对已播放的相似歌曲：显示申请重播 -->
                        <button
                          v-else-if="getSimilarSong(result)?.played && enableReplayRequests"
                          :disabled="isReplayButtonDisabled(getSimilarSong(result))"
                          :title="getReplayButtonTitle(getSimilarSong(result))"
                          class="replay-btn"
                          @click.stop.prevent="handleRequestReplay(getSimilarSong(result))"
                        >
                          {{ getReplayButtonText(getSimilarSong(result)) }}
                        </button>

                        <!-- 其他用户：显示点赞按钮，根据状态设置不同样式 -->
                        <button
                          v-else
                          :class="{
                            disabled:
                              getSimilarSong(result)?.played ||
                              getSimilarSong(result)?.scheduled ||
                              getSimilarSong(result)?.voted ||
                              submitting
                          }"
                          :disabled="
                            getSimilarSong(result)?.played ||
                            getSimilarSong(result)?.scheduled ||
                            getSimilarSong(result)?.voted ||
                            submitting
                          "
                          :title="
                            getSimilarSong(result)?.played
                              ? locale.playedCannotLike
                              : getSimilarSong(result)?.scheduled
                                ? locale.scheduledCannotLike
                                : getSimilarSong(result)?.voted
                                  ? locale.liked
                                  : locale.like
                          "
                          class="like-btn"
                          @click.stop.prevent="
                            getSimilarSong(result)?.played || getSimilarSong(result)?.scheduled
                              ? null
                              : handleLikeFromSearch(getSimilarSong(result), result)
                          "
                        >
                          <svg
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                            />
                          </svg>
                          {{
                            getSimilarSong(result)?.played
                              ? locale.played
                              : getSimilarSong(result)?.scheduled
                                ? locale.scheduled
                                : getSimilarSong(result)?.voted
                                  ? locale.liked
                                  : locale.like
                          }}
                        </button>
                      </div>
                      <button
                        v-else-if="!user"
                        class="select-btn login-btn"
                        @click.stop.prevent="handleLoginRedirect"
                      >
                        {{ locale.loginRequiredToSubmit }}
                      </button>
                      <button
                        v-else
                        :disabled="submitting"
                        class="select-btn"
                        @click.stop.prevent="submitSong(result)"
                      >
                        {{
                          submitting
                            ? locale.processing
                            : platform === 'netease' && searchType === 1009
                              ? locale.chooseProgram
                              : isBilibiliMultiP(result)
                                ? locale.chooseEpisodes
                                : locale.chooseSubmit
                        }}
                      </button>
                    </div>
                  </div>
                </TransitionGroup>

                <!-- 手动输入按钮 -->
                <div class="no-results-action">
                  <button v-if="!user" class="manual-submit-btn" type="button" @click="handleLoginRedirect">
                    {{ locale.loginRequiredToSubmit }}
                  </button>
                  <button v-else class="manual-submit-btn" type="button" @click="showManualModal = true">
                    {{ locale.manualSubmitLong }}
                  </button>
                </div>
              </div>

              <!-- 空状态 -->
              <div v-else-if="!searching && hasSearched" key="empty" class="empty-state">
                <div class="empty-icon">🔍</div>
                <p class="empty-text">{{ locale.noResults }}</p>
                <p class="empty-hint">{{ locale.noResultsHint }}</p>
                <button v-if="!user" class="manual-submit-btn" type="button" @click="handleLoginRedirect">
                  {{ locale.loginRequiredToSubmit }}
                </button>
                <button v-else class="manual-submit-btn" type="button" @click="showManualModal = true">
                  {{ locale.manualSubmit }}
                </button>
              </div>

              <!-- 初始状态 -->
              <div v-else-if="!searching" key="initial" class="initial-state">
                <div class="search-illustration">
                  <img :alt="locale.searchSongsAlt" class="search-svg" :src="searchIcon" >
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </form>
    </div>

    <!-- 历史学期导入弹窗 -->
    <ImportSongsModal
      :show="showImportSongsModal"
      @close="showImportSongsModal = false"
      @import-success="handleImportSuccess"
    />

    <!-- 网易云音乐登录弹窗 -->
    <NeteaseLoginModal
      :show="showLoginModal"
      @close="showLoginModal = false"
      @login-success="handleLoginSuccess"
    />

    <!-- QQ音乐登录弹窗 -->
    <QQMusicLoginModal
      :show="showQQLoginModal"
      @close="showQQLoginModal = false"
      @login-success="handleQQLoginSuccess"
    />

    <!-- 播客节目列表弹窗 -->
    <PodcastEpisodesModal
      ref="podcastModalRef"
      :cookie="podcastCookie"
      :radio-id="selectedPodcastId"
      :radio-name="selectedPodcastName"
      :show="showPodcastModal"
      @close="showPodcastModal = false"
      @play="handlePodcastPlay"
      @submit="handlePodcastSubmit"
    />

    <!-- Bilibili 剧集选择弹窗 -->
    <BilibiliEpisodesModal
      ref="bilibiliModalRef"
      :show="showBilibiliEpisodesModal"
      :video="selectedBilibiliVideo"
      :episodes="bilibiliEpisodes"
      :submitted-episodes="getBilibiliEpisodeStatus(selectedBilibiliVideo)?.submittedEpisodes || []"
      :current-user-id="user?.id"
      @close="showBilibiliEpisodesModal = false"
      @play="handleBilibiliEpisodePlay"
      @submit="handleBilibiliEpisodeSelect"
      @vote="handleEpisodeVote"
    />

    <!-- 专辑详情弹窗 -->
    <AlbumDetailsModal
      ref="albumModalRef"
      :show="showAlbumDetailsModal"
      :album-id="selectedAlbumId"
      :album-name="selectedAlbumName"
      :platform="selectedAlbumPlatform"
      :submitted-songs="songService.songs.value || []"
      :current-user-id="user?.id"
      @close="showAlbumDetailsModal = false"
      @play="handleAlbumSongPlay"
      @submit="handleAlbumSongSubmit"
      @vote="handleAlbumSongVote"
    />

    <!-- 上传到网易云音乐弹窗 -->
    <NeteaseUploadDialog
      :show="showUploadDialog"
      :song="selectedUploadSong"
      @close="showUploadDialog = false"
      @show-login="handleShowLogin"
    />

    <!-- 最近播放歌曲弹窗 -->
    <RecentSongsModal
      ref="recentSongsModalRef"
      :cookie="neteaseCookie"
      :show="showRecentSongsModal"
      @close="showRecentSongsModal = false"
      @play="handleRecentSongPlay"
      @submit="handleRecentSongSubmit"
    />

    <!-- 歌单选择弹窗 -->
    <PlaylistSelectionModal
      ref="playlistModalRef"
      :cookie="neteaseCookie"
      :show="showPlaylistModal"
      :uid="neteaseUser?.userId || neteaseUser?.id"
      @close="showPlaylistModal = false"
      @play="handlePlaylistPlay"
      @submit="handlePlaylistSubmit"
    />

    <!-- 用户搜索弹窗 -->
    <UserSearchModal
      v-if="enableCollaborativeSubmission"
      v-model:show="showUserSearchModal"
      :exclude-ids="[user?.id, ...collaborators.map((u) => u.id)]"
      :multiple="true"
      :title="locale.addCollaboratorTitle"
      @select="handleUserSelect"
    />

    <!-- 点歌券输入弹窗 -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showCardCodeModal"
          class="fixed inset-0 z-[105] flex items-end justify-center bg-zinc-950/80 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          @click.self="closeCardCodeModal"
        >
          <div
            class="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
            @click.stop
          >
            <div class="flex items-center justify-between border-b border-zinc-800/70 px-5 py-4">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-base font-black text-zinc-100">{{ locale.cardCode }}</h3>
                  <span
                    :class="[
                      'rounded-full border px-1.5 py-0.5 text-[9px] font-black',
                      cardCodeFieldMeta.required
                        ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                        : 'border-zinc-700 bg-zinc-800/70 text-zinc-400'
                    ]"
                  >
                    {{ cardCodeFieldMeta.required ? locale.required : locale.optional }}
                  </span>
                </div>
                <p class="mt-1 text-[11px] text-zinc-500">{{ cardCodeFieldMeta.helper }}</p>
              </div>
              <button
                class="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800/60 text-zinc-400 transition-all hover:bg-zinc-800 hover:text-zinc-100"
                type="button"
                @click="closeCardCodeModal"
              >
                <Icon :size="15" name="close" />
              </button>
            </div>

            <div class="px-5 py-5">
              <label
                for="card-code-modal"
                class="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-600"
              >
                {{ locale.cardCodeLabel }}
              </label>
              <input
                id="card-code-modal"
                ref="cardCodeInputRef"
                v-model="cardCodeDraft"
                :placeholder="cardCodeFieldMeta.placeholder"
                class="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-bold text-zinc-100 placeholder-zinc-600 transition-all focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/20"
                type="text"
                @keydown.enter.prevent="saveCardCode"
              >
              <p
                :class="[
                  'mt-2 px-1 text-[11px]',
                  cardCodeValidation.valid
                    ? 'text-emerald-300/80'
                    : cardCodeValidation.valid === false
                      ? 'text-red-300/80'
                      : 'text-zinc-500'
                ]"
              >
                {{ cardCodeModalHint }}
              </p>
            </div>

            <div
              class="flex flex-col-reverse gap-2 border-t border-zinc-800/70 bg-zinc-900/70 px-5 py-4 sm:flex-row sm:justify-end"
            >
              <button
                class="rounded-lg px-4 py-2.5 text-xs font-bold text-zinc-500 transition-all hover:text-zinc-300"
                type="button"
                @click="closeCardCodeModal"
              >
                {{ locale.cancel }}
              </button>
              <button
                v-if="trimmedCardCode"
                class="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs font-bold text-zinc-400 transition-all hover:border-red-500/30 hover:text-red-300"
                type="button"
                @click="clearCardCode"
              >
                {{ locale.clear }}
              </button>
              <button
                :disabled="cardCodeValidation.checking"
                class="rounded-lg bg-yellow-500 px-5 py-2.5 text-xs font-black text-zinc-950 transition-all hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                @click="saveCardCode"
              >
                {{ cardCodeValidation.checking ? locale.validatingCardCode : locale.save }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showAudioMatchModal"
          class="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-zinc-950/85 backdrop-blur-sm"
        >
          <div
            class="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            @click.stop
          >
            <div class="px-8 py-7 flex flex-col items-center text-center">
              <div class="relative">
                <div
                  class="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500"
                  :class="
                    audioMatchRecording
                      ? 'bg-red-500/20 text-red-400 scale-110'
                      : audioMatchError
                        ? 'bg-zinc-800/50 text-zinc-500'
                        : 'bg-blue-500/10 text-blue-400'
                  "
                >
                  <Icon :size="32" name="mic" />
                </div>
                <div
                  v-if="audioMatchRecording"
                  class="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-30"
                />
              </div>

              <h3 class="mt-6 text-xl font-bold text-zinc-100 tracking-tight">{{ locale.audioMatch }}</h3>

              <p class="mt-2 text-sm text-zinc-400 max-w-[260px]">
                {{
                  audioMatchStatus ||
                  (audioMatchError ? audioMatchError : locale.audioMatchHint)
                }}
              </p>

              <div class="mt-8 flex items-center gap-4">
                <button
                  v-if="!audioMatchRecording"
                  :disabled="audioMatchPreparing || audioMatchProcessing"
                  class="audio-match-primary-btn"
                  type="button"
                  @click="startAudioMatchRecording"
                >
                  {{
                    audioMatchPreparing
                      ? locale.preparing
                      : audioMatchProcessing
                        ? locale.recognizing
                        : locale.startAudioMatch
                  }}
                </button>
                <button
                  v-else
                  :disabled="!audioMatchRecording"
                  class="audio-match-record-btn"
                  type="button"
                  @click="stopAudioMatchRecording"
                >
                  <span class="recording-dot" />
                  {{ locale.recording }}
                </button>
                <button class="audio-match-cancel-btn" type="button" @click="closeAudioMatchModal">
                  {{ locale.cancel }}
                </button>
              </div>
            </div>

            <div
              v-if="audioMatchResults.length"
              class="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar"
            >
              <div class="border-t border-zinc-800/60 pt-5">
                <h4 class="text-sm font-semibold text-zinc-300 mb-4">{{ locale.audioMatchResults }}</h4>
                <div class="space-y-2">
                  <button
                    v-for="match in audioMatchResults"
                    :key="match.key"
                    class="audio-match-result-item group/item w-full"
                    type="button"
                    @click="useAudioMatchResult(match)"
                  >
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        class="relative shrink-0 w-11 h-11 rounded-xl overflow-hidden group/cover bg-zinc-800/50 flex items-center justify-center"
                        @click.stop="playAudioMatchResult(match)"
                      >
                        <img
                          v-if="match.cover"
                          :src="match.cover"
                          class="w-full h-full object-cover"
                        >
                        <Music v-else class="w-5 h-5 text-zinc-500" />
                        <div
                          class="absolute inset-0 bg-black/50 opacity-0 group-hover/cover:opacity-100 flex items-center justify-center transition-all"
                        >
                          <Play class="w-4 h-4 text-white fill-white" />
                        </div>
                      </div>
                      <div class="min-w-0 text-left flex-1">
                        <p class="truncate text-sm font-medium text-zinc-100">{{ match.name }}</p>
                        <p class="truncate text-xs text-zinc-400 mt-0.5">{{ match.artist }}</p>
                      </div>
                      <div class="shrink-0 text-right">
                        <span class="text-[11px] font-mono text-blue-400">
                          {{ (match.startTime / 1000).toFixed(1) }}s
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 手动输入弹窗 -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showManualModal"
          class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-zinc-950/80 backdrop-blur-sm"
          @click.self="showManualModal = false"
        >
          <div
            class="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            @click.stop
          >
            <!-- Header -->
            <div
              class="px-8 py-6 border-b border-zinc-800/50 flex items-center justify-between shrink-0"
            >
              <div class="flex items-center gap-4">
                <div
                  class="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500"
                >
                  <Edit3 :size="24" />
                </div>
                <h3 class="text-xl font-black text-zinc-100 tracking-tight">{{ locale.manualTitle }}</h3>
              </div>
              <button
                class="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
                @click="showManualModal = false"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Body -->
            <div class="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div class="grid grid-cols-1 gap-6">
                <!-- 歌曲名称 -->
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                    >{{ locale.songName }}</label
                  >
                  <div class="relative group">
                    <input
                      :value="title"
                      class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-400 font-bold focus:outline-none cursor-not-allowed transition-all"
                      readonly
                      type="text"
                    >
                    <div class="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                      <Lock class="w-4 h-4 text-zinc-600" />
                    </div>
                  </div>
                </div>

                <!-- 歌手名称 -->
                <div class="space-y-2">
                  <label
                    for="modal-artist"
                    class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                    >{{ locale.artistName }}</label
                  >
                  <input
                    id="modal-artist"
                    v-model="manualArtist"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/30 transition-all"
                    :placeholder="locale.artistPlaceholder"
                    required
                    type="text"
                  >
                </div>

                <!-- 歌曲封面地址 -->
                <div class="space-y-2">
                  <label
                    for="modal-cover"
                    class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                    >{{ locale.coverUrl }}</label
                  >
                  <div class="relative group">
                    <input
                      id="modal-cover"
                      v-model="manualCover"
                      :class="[
                        'w-full bg-zinc-950 border rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none transition-all',
                        manualCover && !coverValidation.valid
                          ? 'border-red-500/50 focus:border-red-500/50'
                          : 'border-zinc-800 focus:border-blue-500/30'
                      ]"
                      :placeholder="locale.coverPlaceholder"
                      type="url"
                    >
                    <div
                      v-if="coverValidation.validating"
                      class="absolute inset-y-0 right-4 flex items-center"
                    >
                      <Loader2 class="w-4 h-4 text-zinc-400 animate-spin" />
                    </div>
                  </div>
                  <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="opacity-0 -translate-y-1"
                    enter-to-class="opacity-100 translate-y-0"
                  >
                    <div v-if="manualCover && !coverValidation.validating" class="px-1 pt-1">
                      <p
                        v-if="!coverValidation.valid"
                        class="text-[10px] font-bold text-red-500/80 flex items-center gap-1"
                      >
                        <X class="w-3 h-3" /> {{ coverValidation.error }}
                      </p>
                      <p
                        v-else
                        class="text-[10px] font-bold text-emerald-500/80 flex items-center gap-1"
                      >
                        <Check class="w-3 h-3" /> {{ locale.validUrl }}
                      </p>
                    </div>
                  </Transition>
                </div>

                <!-- 播放地址 -->
                <div class="space-y-2">
                  <label
                    for="modal-play-url"
                    class="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1"
                    >{{ locale.playUrl }}</label
                  >
                  <div class="relative group">
                    <input
                      id="modal-play-url"
                      v-model="manualPlayUrl"
                      :class="[
                        'w-full bg-zinc-950 border rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none transition-all',
                        manualPlayUrl && !playUrlValidation.valid
                          ? 'border-red-500/50 focus:border-red-500/50'
                          : 'border-zinc-800 focus:border-blue-500/30'
                      ]"
                      :placeholder="locale.playUrlPlaceholder"
                      type="url"
                    >
                    <div
                      v-if="playUrlValidation.validating"
                      class="absolute inset-y-0 right-4 flex items-center"
                    >
                      <Loader2 class="w-4 h-4 text-zinc-400 animate-spin" />
                    </div>
                  </div>
                  <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="opacity-0 -translate-y-1"
                    enter-to-class="opacity-100 translate-y-0"
                  >
                    <div v-if="manualPlayUrl && !playUrlValidation.validating" class="px-1 pt-1">
                      <p
                        v-if="!playUrlValidation.valid"
                        class="text-[10px] font-bold text-red-500/80 flex items-center gap-1"
                      >
                        <X class="w-3 h-3" /> {{ playUrlValidation.error }}
                      </p>
                      <p
                        v-else
                        class="text-[10px] font-bold text-emerald-500/80 flex items-center gap-1"
                      >
                        <Check class="w-3 h-3" /> {{ locale.validUrl }}
                      </p>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div
              class="px-8 py-6 bg-zinc-900/50 border-t border-zinc-800/50 flex gap-3 justify-end shrink-0"
            >
              <button
                class="px-6 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-all"
                type="button"
                @click="showManualModal = false"
              >
                {{ locale.cancel }}
              </button>
              <button
                :disabled="!canSubmitManualForm || submitting"
                class="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg transition-all disabled:opacity-50"
                type="button"
                @click="handleManualSubmit"
              >
                {{ submitting ? locale.submitting : locale.confirmSubmit }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <!-- 隐藏的文件输入框 -->
    <input
      ref="fileInput"
      accept=".json"
      style="display: none"
      type="file"
      @change="handleImportData"
    >
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import searchIcon from '~~/public/images/search.svg'
import { X, Lock, Loader2, Check, Edit3, Music, Play } from '@lucide/vue'
import { useSongs } from '~/composables/useSongs'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useAudioPlayerControl } from '~/composables/useAudioPlayerControl'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { useAuth } from '~/composables/useAuth'
import { useSemesters } from '~/composables/useSemesters'
import { useMusicSources } from '~/composables/useMusicSources'
import { useAudioQuality } from '~/composables/useAudioQuality'
import { useLocale } from '~/utils/locale'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import Icon from '../UI/Icon.vue'
import { convertToHttps, validateUrl } from '~/utils/url'
import { isBilibiliSong } from '~/utils/bilibiliSource'
import { getLoginStatus } from '~/utils/neteaseApi'
import { getMusicUrl as resolveMusicUrl } from '~/utils/musicUrl'

import ImportSongsModal from './ImportSongsModal.vue'
import NeteaseLoginModal from './NeteaseLoginModal.vue'
import QQMusicLoginModal from './QQMusicLoginModal.vue'
import PodcastEpisodesModal from './PodcastEpisodesModal.vue'
import BilibiliEpisodesModal from './BilibiliEpisodesModal.vue'
import AlbumDetailsModal from './AlbumDetailsModal.vue'
import RecentSongsModal from './RecentSongsModal.vue'
import PlaylistSelectionModal from './PlaylistSelectionModal.vue'
import UserSearchModal from '../Common/UserSearchModal.vue'
import NeteaseUploadDialog from './NeteaseUploadDialog.vue'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['request', 'vote'])
const { songs: songsLocale } = useLocale()
const locale = computed(() => useSafeLocale(songsLocale.value?.requestForm || {}))
const getErrorMessage = (error) => {
  if (!error) return ''
  if (typeof error === 'string') return error
  return error?.data?.message || error?.message || error?.statusMessage || ''
}
const callLocale = (key, fallback = '', ...args) => {
  const value = String(key).split('.').reduce((target, part) => target?.[part], locale.value)
  if (typeof value === 'function') return value(...args)
  if (typeof value === 'string') {
    return value.replace(/{(\d+)}/g, (match, index) =>
      args[index] !== undefined ? String(args[index]) : match
    )
  }
  return value || fallback
}

// 站点配置
const {
  guidelines: submissionGuidelines,
  initSiteConfig,
  enableReplayRequests,
  enableCollaborativeSubmission,
  enableSubmissionRemarks,
  enableSubmissionLimit,
  enableCardCodeRequests,
  requireCardCodeForRequests,
  enableCardCodeLimitBypass
} = useSiteConfig()

// 用户认证
const auth = useAuth()
const user = computed(() => auth.user.value)
const isSuperAdmin = computed(() => user.value?.role === 'SUPER_ADMIN')

// 学期管理
const { fetchCurrentSemester, currentSemester, fetchSemesterOptions, semesters } = useSemesters()

// 是否显示“从往期导入”按钮：只有在有多个学期的情况下才显示
const showImportSemesterBtn = computed(() => semesters.value && semesters.value.length > 1)
const AUDIO_MATCH_DURATION = 3

const title = ref('')
const artist = ref('')
const platform = ref('netease') // 默认使用网易云音乐
const preferredPlayTimeId = ref('')
const submissionNote = ref('')
const submissionNotePublic = ref(true)
const cardCode = ref('')
const cardCodeDraft = ref('')
const showCardCodeModal = ref(false)
const cardCodeInputRef = ref(null)
const cardCodeValidation = ref({
  checking: false,
  valid: null,
  message: ''
})
const error = ref('')
const success = ref('')
const submitting = ref(false)
const voting = ref(false)
const requestingReplay = ref(false)

const showImportSongsModal = ref(false)
const showLoginModal = ref(false)
const showQQLoginModal = ref(false)
const isNeteaseLoggedIn = ref(false)
const neteaseUser = ref(null)
const neteaseCookie = ref('')
const isQQMusicLoggedIn = ref(false)
const qqMusicUser = ref(null)
const qqMusicCookie = ref('')
const searchType = ref(1) // 1: 单曲, 1009: 播客/电台

// 播客弹窗相关
const showPodcastModal = ref(false)
const selectedPodcastId = ref('')
const selectedPodcastName = ref('')
const podcastCookie = ref('')

const showRecentSongsModal = ref(false)
const showPlaylistModal = ref(false)
const showUserSearchModal = ref(false)
const collaborators = ref([])

const songService = useSongs()
const playTimes = ref([])
const playTimeSelectionEnabled = ref(false)
const loadingPlayTimes = ref(false)

const cardCodeEnabled = computed(() => enableCardCodeRequests.value || requireCardCodeForRequests.value)
const cardCodeLimitBypassActive = computed(
  () => enableSubmissionLimit.value && cardCodeEnabled.value && enableCardCodeLimitBypass.value
)

const cardCodeFieldMeta = computed(() => ({
  required: requireCardCodeForRequests.value,
  helper: requireCardCodeForRequests.value
    ? cardCodeLimitBypassActive.value
      ? locale.value.cardCodeRequiredBypassHelper
      : locale.value.cardCodeRequiredHelper
    : cardCodeLimitBypassActive.value
      ? locale.value.cardCodeOptionalBypassHelper
      : locale.value.cardCodeOptionalHelper,
  placeholder: locale.value.cardCodePlaceholder
}))

const trimmedCardCode = computed(() => cardCode.value.trim())
const cardCodeStatusText = computed(() => {
  if (cardCodeValidation.value.checking) return locale.value.validatingCardCode
  if (trimmedCardCode.value) {
    if (cardCodeValidation.value.valid && cardCodeLimitBypassActive.value) {
      return locale.value.cardCodeAvailableBypass
    }
    return cardCodeValidation.value.message || locale.value.cardCodeWillValidate
  }
  return cardCodeFieldMeta.value.required ? locale.value.cardCodeRequiredStatus : locale.value.cardCodeOptionalStatus
})
const mobileCardCodeLabel = computed(() => {
  if (cardCodeValidation.value.checking) return locale.value.validatingShort
  if (trimmedCardCode.value) {
    if (cardCodeValidation.value.valid === false) return locale.value.cardCodeInvalid
    if (cardCodeValidation.value.valid) return locale.value.cardCodeAvailable
    return locale.value.cardCodeFilled
  }
  return cardCodeFieldMeta.value.required ? locale.value.cardCodeRequiredShort : locale.value.cardCodeOptionalShort
})
const cardCodeModalHint = computed(() => {
  if (cardCodeValidation.value.checking) return locale.value.validatingCardCode
  if (cardCodeValidation.value.message) return cardCodeValidation.value.message
  return locale.value.cardCodeSaveHint
})

const cardCodeMessageMap = computed(() => ({
  CARD_CODE_AVAILABLE: locale.value.cardCodeAvailable,
  CARD_CODE_AUTH_REQUIRED: locale.value.cardCodeAuthRequired,
  CARD_CODE_REQUIRED: locale.value.cardCodeRequiredWarning,
  CARD_CODE_DISABLED: locale.value.cardCodeDisabled,
  CARD_CODE_INVALID_OR_USED: locale.value.cardCodeInvalidOrUsed,
  CARD_CODE_LOCKED_OR_UNAVAILABLE: locale.value.cardCodeLockedOrUnavailable,
  CARD_CODE_REQUIRED_FOR_SITE: locale.value.cardCodeRequiredForSite,
  CARD_CODE_TOO_LONG: locale.value.cardCodeTooLong
}))

const getLocalizedCardCodeMessage = (code, fallback) => {
  if (code && cardCodeMessageMap.value[code]) {
    return cardCodeMessageMap.value[code]
  }

  return fallback || locale.value.cardCodeValidateFailed
}

const getCardCodeErrorCode = (err) =>
  err?.data?.data?.code || err?.data?.code || err?.statusMessage || err?.data?.statusMessage

const resetCardCodeValidation = () => {
  cardCodeValidation.value = {
    checking: false,
    valid: null,
    message: ''
  }
}

const openCardCodeModal = async () => {
  cardCodeDraft.value = cardCode.value
  showCardCodeModal.value = true
  await nextTick()
  cardCodeInputRef.value?.focus()
}

const closeCardCodeModal = () => {
  const draftChanged = cardCodeDraft.value.trim() !== cardCode.value.trim()
  showCardCodeModal.value = false
  cardCodeDraft.value = cardCode.value
  if (draftChanged) {
    resetCardCodeValidation()
  }
}

const validateCardCode = async (code) => {
  const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : ''
  if (!normalizedCode) {
    resetCardCodeValidation()
    return !requireCardCodeForRequests.value
  }

  cardCodeValidation.value = {
    checking: true,
    valid: null,
    message: locale.value.validatingCardCode
  }

  try {
    const response = await $fetch('/api/card-codes/validate', {
      method: 'POST',
      body: { cardCode: normalizedCode },
      ...auth.getAuthConfig()
    })

    cardCodeValidation.value = {
      checking: false,
      valid: true,
      message: getLocalizedCardCodeMessage(response?.code, locale.value.cardCodeAvailable)
    }
    return true
  } catch (err) {
    const message = getLocalizedCardCodeMessage(getCardCodeErrorCode(err))
    cardCodeValidation.value = {
      checking: false,
      valid: false,
      message
    }
    if (window.$showNotification) {
      window.$showNotification(message, 'error')
    }
    return false
  }
}

const saveCardCode = async () => {
  const draft = cardCodeDraft.value.trim().toUpperCase()
  if (requireCardCodeForRequests.value && !draft) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.cardCodeRequiredWarning, 'warning')
    }
    return
  }

  if (!draft) {
    clearCardCode()
    return
  }

  if (!(await validateCardCode(draft))) {
    return
  }

  cardCode.value = draft
  showCardCodeModal.value = false
}

const clearCardCode = () => {
  cardCode.value = ''
  cardCodeDraft.value = ''
  showCardCodeModal.value = false
  resetCardCodeValidation()
}

const ensureCardCodeForSubmit = async () => {
  if (!cardCodeEnabled.value) {
    return true
  }

  if (!trimmedCardCode.value) {
    if (!requireCardCodeForRequests.value) {
      return true
    }

    await openCardCodeModal()
    if (window.$showNotification) {
      window.$showNotification(locale.value.cardCodeRequiredWarning, 'warning')
    }
    return false
  }

  // 已验证过且未变动则跳过重复验证
  if (cardCodeValidation.value.valid === true) {
    return true
  }

  return await validateCardCode(trimmedCardCode.value)
}

// 投稿状态
const submissionStatus = ref(null)
const loadingSubmissionStatus = ref(false)

// 搜索相关
const searching = ref(false)
const searchResults = ref([])
const selectedCover = ref('')
const selectedUrl = ref('')
const audioPlayer = useAudioPlayer() // 使用全局音频播放器

// 搜索请求控制器
const searchAbortController = ref(null)
const showAudioMatchModal = ref(false)
const audioMatchPreparing = ref(false)
const audioMatchRecording = ref(false)
const audioMatchProcessing = ref(false)
const audioMatchStatus = ref('')
const audioMatchError = ref('')
const audioMatchResults = ref([])
let audioMatchScriptsPromise = null
let audioMatchContext = null
let audioMatchRecorderNode = null
let audioMatchMicStream = null
let audioMatchMicSourceNode = null
let audioMatchSilentNode = null

// 音源管理器
const musicSources = useMusicSources()
const { currentSource, sourceStatus, sourceStatusSummary, currentSourceInfo } = musicSources
const { checkNeteaseLoginStatus: updateGlobalNeteaseStatus } = useAudioQuality()
const searchError = ref('')

// 手动输入相关
const showManualModal = ref(false)

const showBilibiliEpisodesModal = ref(false)
const selectedBilibiliVideo = ref(null)
const bilibiliEpisodes = ref([])

// 专辑详情相关
const showAlbumDetailsModal = ref(false)
const selectedAlbumId = ref(null)
const selectedAlbumName = ref(null)
const selectedAlbumPlatform = ref('netease')

const manualArtist = ref('')
const manualCover = ref('')
const manualPlayUrl = ref('')
const hasSearched = ref(false)

// 上传到网易云相关
const showUploadDialog = ref(false)
const selectedUploadSong = ref(null)

// URL验证相关
const coverValidation = ref({ valid: true, error: '', validating: false })
const playUrlValidation = ref({ valid: true, error: '', validating: false })

// 网易云音乐登录检查状态
const checkingNeteaseLogin = ref(false)

const resetAudioMatchState = () => {
  audioMatchPreparing.value = false
  audioMatchRecording.value = false
  audioMatchProcessing.value = false
  audioMatchStatus.value = ''
  audioMatchError.value = ''
  audioMatchResults.value = []
}

const stopAudioMatchSession = async () => {
  audioMatchRecording.value = false
  audioMatchProcessing.value = false

  if (audioMatchMicStream) {
    audioMatchMicStream.getTracks().forEach((track) => track.stop())
    audioMatchMicStream = null
  }

  audioMatchMicSourceNode?.disconnect()
  audioMatchRecorderNode?.disconnect()
  audioMatchSilentNode?.disconnect()

  audioMatchMicSourceNode = null
  audioMatchRecorderNode = null
  audioMatchSilentNode = null

  if (audioMatchContext) {
    try {
      await audioMatchContext.close()
    } catch {
      // ignore close failures
    }
    audioMatchContext = null
  }
}

const loadAudioMatchScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-audio-match="${src}"]`)) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.audioMatch = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(callLocale('audioMatchScriptLoadFailed', '', src)))
    document.head.appendChild(script)
  })

const ensureAudioMatchScripts = async () => {
  if (!import.meta.client) return

  if (typeof window.GenerateFP === 'function') {
    return
  }

  if (!audioMatchScriptsPromise) {
    audioMatchScriptsPromise = loadAudioMatchScript('/audio-match/afp.wasm.js')
      .then(() => loadAudioMatchScript('/audio-match/afp.js'))
      .then(() => {
        if (typeof window.GenerateFP !== 'function') {
          throw new Error(locale.value.audioMatchEngineFailed)
        }
      })
      .catch((err) => {
        audioMatchScriptsPromise = null
        throw err
      })
  }

  await audioMatchScriptsPromise
}

const parseAudioMatchResults = (response) => {
  const resultList =
    response?.data?.result ||
    response?.result ||
    response?.body?.data?.result ||
    response?.body?.result ||
    []

  return resultList.map((item, index) => {
    const song = item?.song || {}
    const artists = Array.isArray(song.artists)
      ? song.artists.map((artistItem) => artistItem?.name).filter(Boolean)
      : []

    return {
      key: `${song.id || 'unknown'}-${index}`,
      id: song.id,
      name: song.name || locale.value.unknownSong,
      artist: artists.join(' / ') || locale.value.unknownArtist,
      album: song.album?.name || '',
      cover: song.album?.picUrl || song.al?.picUrl || '',
      startTime: typeof item?.startTime === 'number' ? item.startTime : 0
    }
  })
}

const handleAudioMatchFingerprint = async (recording) => {
  try {
    audioMatchProcessing.value = true
    audioMatchStatus.value = locale.value.audioMatchGenerating

    const fingerprint = await window.GenerateFP(recording)
    const response = await $fetch('/api/api-enhanced/netease/audio/match', {
      method: 'POST',
      body: {
        duration: AUDIO_MATCH_DURATION,
        audioFP: fingerprint
      }
    })

    const matches = parseAudioMatchResults(response)
    if (!matches.length) {
      throw new Error(locale.value.audioMatchNoMatch)
    }

    audioMatchResults.value = matches
    audioMatchStatus.value = callLocale('audioMatchDone', '', matches.length)
  } catch (err) {
    console.error('听歌识曲失败:', err)
    audioMatchError.value = err?.message || locale.value.audioMatchFailed
    audioMatchStatus.value = ''
    audioMatchResults.value = []
  } finally {
    audioMatchProcessing.value = false
  }
}

const initializeAudioMatch = async () => {
  await ensureAudioMatchScripts()
  await stopAudioMatchSession()

  audioMatchPreparing.value = true
  audioMatchStatus.value = locale.value.microphoneRequesting

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    audioMatchContext = new AudioContextClass({ sampleRate: 8000 })
    if (audioMatchContext.state === 'suspended') {
      await audioMatchContext.resume()
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(locale.value.microphoneUnsupported)
    }

    if (audioMatchContext.audioWorklet) {
      await audioMatchContext.audioWorklet.addModule('/audio-match/rec.js')
      audioMatchRecorderNode = new AudioWorkletNode(audioMatchContext, 'timed-recorder')

      audioMatchRecorderNode.port.onmessage = async (event) => {
        switch (event.data.message) {
          case 'bufferhealth': {
            const progress = Math.min(1, Number(event.data.health) || 0)
            const currentSeconds = (AUDIO_MATCH_DURATION * progress).toFixed(1)
            audioMatchStatus.value = callLocale('audioMatchRecordingProgress', '', currentSeconds, AUDIO_MATCH_DURATION)
            break
          }
          case 'finished':
            audioMatchRecording.value = false
            await handleAudioMatchFingerprint(event.data.recording)
            break
          default:
            break
        }
      }
    } else {
      // 兼容不支持 AudioWorklet 的浏览器 (如旧版 Safari)
      const bufferSize = 4096
      const scriptNode = audioMatchContext.createScriptProcessor(bufferSize, 1, 1)

      let maxLength = 0
      let recbuffer = new Float32Array()
      let recording = false
      let bufIndex = 0

      scriptNode.onaudioprocess = (e) => {
        if (!recording) return

        const channelL = e.inputBuffer.getChannelData(0)
        const progress = bufIndex / maxLength
        const currentSeconds = (AUDIO_MATCH_DURATION * progress).toFixed(1)

        // 提高更新频率以改善用户体验
        if (bufIndex % bufferSize === 0) {
          audioMatchStatus.value = callLocale('audioMatchRecordingProgress', '', currentSeconds, AUDIO_MATCH_DURATION)
        }

        if (bufIndex + channelL.length > maxLength) {
          recording = false
          audioMatchRecording.value = false

          // 确保包含最后一块数据
          const remaining = maxLength - bufIndex
          if (remaining > 0) {
            recbuffer.set(channelL.subarray(0, remaining), bufIndex)
          }

          bufIndex = 0
          handleAudioMatchFingerprint(recbuffer)
        } else {
          recbuffer.set(channelL, bufIndex)
          bufIndex += channelL.length
        }
      }

      // 模拟 AudioWorkletNode 接口
      audioMatchRecorderNode = scriptNode
      audioMatchRecorderNode.port = {
        postMessage: (msg) => {
          if (msg.message === 'start') {
            maxLength = msg.duration * 8000
            recbuffer = new Float32Array(maxLength)
            bufIndex = 0
            recording = true
          }
        }
      }
    }

    audioMatchSilentNode = audioMatchContext.createGain()
    audioMatchSilentNode.gain.value = 0
    audioMatchRecorderNode.connect(audioMatchSilentNode)
    audioMatchSilentNode.connect(audioMatchContext.destination)

    const GET_USER_MEDIA_TIMEOUT_MS = 15000

    audioMatchMicStream = await Promise.race([
      navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          latency: 0
        }
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(locale.value.microphoneTimeout)),
          GET_USER_MEDIA_TIMEOUT_MS
        )
      )
    ])

    audioMatchMicSourceNode = audioMatchContext.createMediaStreamSource(audioMatchMicStream)
    audioMatchMicSourceNode.connect(audioMatchRecorderNode)
    audioMatchStatus.value = locale.value.microphoneReady
  } catch (err) {
    await stopAudioMatchSession()
    throw err
  } finally {
    audioMatchPreparing.value = false
  }
}

const openAudioMatchModal = async () => {
  showAudioMatchModal.value = true
  resetAudioMatchState()

  try {
    await initializeAudioMatch()
  } catch (err) {
    console.error('初始化听歌识曲失败:', err)
    audioMatchError.value = err?.message || locale.value.audioMatchInitFailed
  }
}

const closeAudioMatchModal = async () => {
  showAudioMatchModal.value = false
  resetAudioMatchState()
  await stopAudioMatchSession()
}

const playAudioMatchResult = async (match) => {
  try {
    const result = {
      id: match.id,
      musicId: match.id,
      song: match.name,
      singer: match.artist,
      cover: match.cover || null,
      musicPlatform: 'netease',
      hasUrl: false
    }

    await playSong(result)

    if (match.startTime > 0) {
      const audioPlayerControl = useAudioPlayerControl()
      audioPlayerControl.seekAndPlay(match.startTime / 1000)
    }
  } catch (err) {
    console.error('播放听歌识曲片段失败:', err)
  }
}

const startAudioMatchRecording = async () => {
  if (audioMatchPreparing.value || audioMatchRecording.value || audioMatchProcessing.value) return

  audioMatchError.value = ''
  audioMatchResults.value = []

  if (!audioMatchRecorderNode) {
    try {
      await initializeAudioMatch()
    } catch (err) {
      console.error('重新初始化听歌识曲失败:', err)
      audioMatchError.value = err?.message || locale.value.microphoneAccessFailed
      return
    }
  }

  audioMatchStatus.value = callLocale('audioMatchRecordingProgress', '', '0.0', AUDIO_MATCH_DURATION)
  audioMatchRecording.value = true
  audioMatchRecorderNode.port.postMessage({
    message: 'start',
    duration: AUDIO_MATCH_DURATION
  })
}

const stopAudioMatchRecording = () => {
  if (audioMatchRecorderNode?.port) {
    audioMatchRecorderNode.port.postMessage({ message: 'stop' })
  }
}

const useAudioMatchResult = async (match) => {
  platform.value = 'netease'
  searchType.value = 1
  title.value = `${match.name} ${match.artist}`.trim()
  error.value = ''
  success.value = ''

  await closeAudioMatchModal()
  await nextTick()
  await handleSearch()
}

onBeforeUnmount(() => {
  stopAudioMatchSession()
})

const handleImportSuccess = async () => {
  // 不自动关闭弹窗，等待用户在结果页点击完成
  // showImportSongsModal.value = false
  // 刷新歌曲列表以便检查相似歌曲
  try {
    await songService.fetchSongs(true, currentSemester.value?.name, false, true)
  } catch (error) {
    console.error('刷新歌曲列表失败:', error)
  }
}

const handleUserSelect = (users) => {
  if (Array.isArray(users)) {
    // 过滤掉已存在的
    const newUsers = users.filter((u) => !collaborators.value.some((c) => c.id === u.id))
    collaborators.value.push(...newUsers)
  } else if (users) {
    if (!collaborators.value.some((c) => c.id === users.id)) {
      collaborators.value.push(users)
    }
  }
}

const removeCollaborator = (userId) => {
  collaborators.value = collaborators.value.filter((c) => c.id !== userId)
}

// 获取播出时段
const fetchPlayTimes = async () => {
  loadingPlayTimes.value = true
  try {
    const response = await fetch('/api/play-times')
    if (response.ok) {
      const data = await response.json()
      playTimes.value = data.playTimes || []
      playTimeSelectionEnabled.value = data.enabled || false
    }
  } catch (err) {
    console.error('获取播出时段失败:', err)
  } finally {
    loadingPlayTimes.value = false
  }
}

const fileInput = ref(null)

const checkNeteaseLoginStatus = async () => {
  if (import.meta.client) {
    const cookie = localStorage.getItem('netease_cookie')
    // const userStr = localStorage.getItem('netease_user')
    if (cookie) {
      checkingNeteaseLogin.value = true
      try {
        const res = await getLoginStatus(cookie)
        const dataObj = res.body?.data || res.body
        if (dataObj && dataObj.account) {
          neteaseCookie.value = cookie
          isNeteaseLoggedIn.value = true
          neteaseUser.value = dataObj.profile || dataObj.account
          localStorage.setItem('netease_user', JSON.stringify(neteaseUser.value))
          // 同步全局网易云登录状态
          updateGlobalNeteaseStatus()
        } else {
          // 登录失效
          handleLogoutNetease()
        }
      } catch (e) {
        console.error('检查登录状态失败', e)
        // 如果网络请求失败，暂时保留本地状态，或者根据需求清除
        // 这里选择保守策略，只有明确失效才清除，除非是401等错误
        // 但鉴于用户要求“失效了就清除”，如果API通了但返回无效则清除。
        // 如果API不通，可能不清除。这里假设getLoginStatus返回正常结构。
      } finally {
        checkingNeteaseLogin.value = false
      }
    } else {
      // 同步全局网易云登录状态
      updateGlobalNeteaseStatus()
    }
  }
}

const handleExportData = () => {
  if (!neteaseCookie.value) return
  const data = {
    cookie: neteaseCookie.value,
    timestamp: Date.now()
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `netease_cookie_${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  if (window.$showNotification) {
    window.$showNotification(locale.value.notifications.exportSuccess, 'success')
  }
}

const handleImportClick = () => {
  fileInput.value.click()
}

const handleImportData = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (data.cookie) {
      checkingNeteaseLogin.value = true
      if (window.$showNotification) {
        window.$showNotification(locale.value.notifications.validatingCookie, 'info')
      }

      const res = await getLoginStatus(data.cookie)
      const dataObj = res.body?.data || res.body
      if (dataObj && dataObj.account) {
        handleLoginSuccess({
          cookie: data.cookie,
          user: dataObj.profile || dataObj.account
        })
        if (window.$showNotification) {
          window.$showNotification(locale.value.notifications.importSuccess, 'success')
        }
      } else {
        if (window.$showNotification) {
          window.$showNotification(locale.value.notifications.cookieInvalid, 'error')
        }
      }
    } else {
      if (window.$showNotification) {
        window.$showNotification(locale.value.notifications.fileFormatError, 'error')
      }
    }
  } catch (e) {
    console.error('导入失败', e)
    if (window.$showNotification) {
      window.$showNotification(callLocale('notifications.importFailed', '', getErrorMessage(e)), 'error')
    }
  } finally {
    checkingNeteaseLogin.value = false
  }
  // 重置input
  event.target.value = ''
}

const handleLoginSuccess = (data) => {
  neteaseCookie.value = data.cookie
  neteaseUser.value = data.user
  isNeteaseLoggedIn.value = true

  if (import.meta.client) {
    localStorage.setItem('netease_cookie', data.cookie)
    localStorage.setItem('netease_user', JSON.stringify(data.user))
    updateGlobalNeteaseStatus()
  }
}

const handleLogoutNetease = () => {
  neteaseCookie.value = ''
  neteaseUser.value = null
  isNeteaseLoggedIn.value = false
  searchType.value = 1

  if (import.meta.client) {
    localStorage.removeItem('netease_cookie')
    localStorage.removeItem('netease_user')
    updateGlobalNeteaseStatus()
  }
}

const checkQQMusicLoginStatus = () => {
  if (!import.meta.client) return

  const cookie = localStorage.getItem('qq_music_cookie')
  const userStr = localStorage.getItem('qq_music_user')

  if (!cookie) {
    handleLogoutQQMusic()
    return
  }

  qqMusicCookie.value = cookie
  isQQMusicLoggedIn.value = true

  try {
    qqMusicUser.value = userStr ? JSON.parse(userStr) : { nickname: locale.value.qqLoggedIn }
  } catch {
    qqMusicUser.value = { nickname: locale.value.qqLoggedIn }
  }
}

const handleQQLoginSuccess = (data) => {
  qqMusicCookie.value = data.cookie
  qqMusicUser.value = data.user || { nickname: locale.value.qqLoggedIn }
  isQQMusicLoggedIn.value = true

  if (import.meta.client) {
    localStorage.setItem('qq_music_cookie', data.cookie)
    localStorage.setItem('qq_music_user', JSON.stringify(qqMusicUser.value))
  }
}

const handleLogoutQQMusic = () => {
  qqMusicCookie.value = ''
  qqMusicUser.value = null
  isQQMusicLoggedIn.value = false

  if (import.meta.client) {
    localStorage.removeItem('qq_music_cookie')
    localStorage.removeItem('qq_music_user')
  }
}

watch(
  () => searchType.value,
  () => {
    if (platform.value !== 'netease') return

    // 记录当前状态，判断是否需要重新搜索
    // 如果已经有搜索结果(hasSearched)或正在搜索中(searching)，且有关键词，则应该重新搜索
    const shouldResearch = title.value.trim() && (hasSearched.value || searching.value)

    // 如果有正在进行的搜索请求，立即取消
    if (searchAbortController.value) {
      searchAbortController.value.abort()
      searchAbortController.value = null
      searching.value = false
    }

    // 清空之前的搜索结果，避免显示错误的类型结果
    searchResults.value = []

    // 自动重新搜索
    if (shouldResearch) {
      handleSearch()
    }
  }
)

onMounted(async () => {
  checkNeteaseLoginStatus()
  checkQQMusicLoginStatus()
  fetchPlayTimes()
  initSiteConfig()
  fetchSubmissionStatus()
  // 获取当前学期和所有学期选项
  await Promise.all([fetchCurrentSemester(), fetchSemesterOptions()])
  // 只有在用户已登录时才加载歌曲列表以便检查相似歌曲
  if (auth.isAuthenticated.value) {
    try {
      const currentSemesterName = currentSemester.value?.name
      await songService.fetchSongs(false, currentSemesterName)
    } catch (error) {
      console.error('加载歌曲列表失败:', error)
    }

    try {
      const pendingSearch = sessionStorage.getItem('pending_search')
      if (pendingSearch) {
        const saved = JSON.parse(pendingSearch)
        sessionStorage.removeItem('pending_search')
        if (saved.title) {
          title.value = saved.title
          if (saved.platform) platform.value = saved.platform
          await checkNeteaseLoginStatus()
          await handleSearch()
        }
      }
    } catch {
      // 浏览器禁用会话存储时不影响页面初始化。
    }
  }
  // 音源健康检查功能已移除
})

// 过滤出启用的播出时段
const enabledPlayTimes = computed(() => {
  return playTimes.value.filter((pt) => pt.enabled)
})

const formattedPlayTimes = computed(() => {
  const options = enabledPlayTimes.value.map((pt) => ({
    ...pt,
    displayName: pt.startTime || pt.endTime ? `${pt.name} (${formatPlayTimeRange(pt)})` : pt.name
  }))
  return [{ id: '', displayName: locale.value.choosePlayTime }, ...options]
})

// 格式化播出时段时间范围
const formatPlayTimeRange = (playTime) => {
  if (!playTime) return ''

  if (playTime.startTime && playTime.endTime) {
    return `${playTime.startTime} - ${playTime.endTime}`
  } else if (playTime.startTime) {
    return `${playTime.startTime}`
  } else if (playTime.endTime) {
    return `${playTime.endTime}`
  }

  return locale.value.choosePlayTime
}

// 监听用户状态变化，当用户登录后重新获取投稿状态
watch(
  () => user.value,
  (newUser) => {
    if (newUser) {
      fetchSubmissionStatus()
    } else {
      submissionStatus.value = null
    }
  }
)

watch(enableCollaborativeSubmission, (enabled) => {
  if (!enabled) {
    showUserSearchModal.value = false
    collaborators.value = []
  }
})

watch(enableSubmissionRemarks, (enabled) => {
  if (!enabled) {
    submissionNote.value = ''
    submissionNotePublic.value = true
  }
})

watch([enableCardCodeRequests, requireCardCodeForRequests], ([enabled, required]) => {
  if (!enabled && !required) {
    clearCardCode()
  }
})

watch(cardCodeDraft, (value) => {
  if (value.trim() !== cardCode.value.trim()) {
    resetCardCodeValidation()
  }
})

// 处理剧集投票
const handleEpisodeVote = async (episode) => {
  if (!episode.songId) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.missingSongId, 'error')
    }
    return
  }

  if (episode.voted) {
    return
  }

  voting.value = true

  try {
    await songService.voteSong(episode.songId)

    // 只有在后端成功返回后才更新前端状态
    episode.voted = true
    episode.voteCount = (episode.voteCount || 0) + 1

    // 刷新歌曲列表
    await songService.refreshSongsSilent().catch((err) => {
      console.error('刷新歌曲列表失败', err)
    })
  } catch (err) {
    if (window.$showNotification) {
      window.$showNotification(getErrorMessage(err) || locale.value.notifications.likeFailed, 'error')
    }
  } finally {
    voting.value = false
  }
}

// 检查搜索结果是否已存在完全匹配的歌曲
// 标准化字符串（与useSongs中的逻辑保持一致）
const normalizeString = (str) => {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/\b(feat\.?|ft\.?)\b/gi, '')
    .replace(/[\s\-_\(\)\[\]【】（）「」『』《》〈〉"'、，。！？：；～·]/g, '')
    .replace(/[&＆]/g, 'and')
    .trim()
}

const getSimilarSong = (result) => {
  // 多P视频不在这里检查相似性，使用专门的 getBilibiliEpisodeStatus
  if (isBilibiliMultiP(result)) {
    return null
  }

  const title = result.song || result.title
  const artist = result.singer || result.artist

  if (!title || !artist) return null

  const normalizedTitle = normalizeString(title)
  const normalizedArtist = normalizeString(artist)

  // 获取当前学期名称
  const currentSemesterName = currentSemester.value?.name

  // 检查完全匹配的歌曲（标准化后），只检查当前学期的歌曲
  return songService.songs.value.find((song) => {
    const songTitle = normalizeString(song.title)
    const songArtist = normalizeString(song.artist)
    const titleMatch = songTitle === normalizedTitle && songArtist === normalizedArtist

    // 如果有当前学期信息，只检查当前学期的歌曲
    if (currentSemesterName) {
      return titleMatch && song.semester === currentSemesterName
    }

    // 如果没有学期信息，检查所有歌曲（向后兼容）
    return titleMatch
  })
}

// 从搜索结果中点赞已存在的歌曲
const handleLikeFromSearch = async (song, originalResult = null) => {
  if (!song || song.voted) {
    return
  }

  if (song.played || song.scheduled) {
    if (window.$showNotification) {
      const message = song.played
        ? locale.value.playedCannotLike
        : locale.value.scheduledCannotLike
      window.$showNotification(message, 'warning')
    }
    return
  }

  // 如果原始结果是多P视频，打开剧集选择弹窗
  if (originalResult && isBilibiliMultiP(originalResult)) {
    selectedBilibiliVideo.value = originalResult
    bilibiliEpisodes.value = originalResult.pages
    showBilibiliEpisodesModal.value = true
    return
  }

  try {
    await songService.voteSong(song.id)
  } catch (error) {
    console.error('点赞失败:', error)
  }
}

// 平台切换函数
const switchPlatform = (newPlatform) => {
  if (platform.value === newPlatform) return

  // 如果有正在进行的搜索请求，立即取消
  if (searchAbortController.value) {
    searchAbortController.value.abort()
    searchAbortController.value = null
    searching.value = false
  }

  platform.value = newPlatform

  // 清空之前的搜索结果，避免显示错误的平台来源
  searchResults.value = []

  // 如果已经有搜索结果，自动重新搜索
  if (title.value.trim() && hasSearched.value) {
    handleSearch()
  }
}

// 搜索歌曲
const handleSearch = async () => {
  error.value = ''
  success.value = ''
  searchError.value = ''

  if (!title.value.trim()) {
    error.value = locale.value.notifications.songNameRequired
    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.songNameRequired, 'error')
    }
    return
  }

  // 如果有正在进行的搜索请求，先取消
  if (searchAbortController.value) {
    searchAbortController.value.abort()
    searchAbortController.value = null
  }

  // 创建新的AbortController
  searchAbortController.value = new AbortController()
  const signal = searchAbortController.value.signal

  // 记录请求时的上下文，用于结果校验
  const requestPlatform = platform.value
  const requestSearchType = searchType.value

  searching.value = true
  try {
    // 使用多音源搜索
    const searchParams = {
      keywords: title.value.trim(),
      platform: requestPlatform,
      limit: 20,
      signal: signal, // 传递AbortSignal
      type: requestPlatform === 'netease' ? requestSearchType : 1,
      cookie: requestPlatform === 'netease'
        ? neteaseCookie.value
        : requestPlatform === 'tencent'
          ? qqMusicCookie.value
          : undefined
    }

    console.log('开始多音源搜索:', searchParams)
    const results = await musicSources.searchSongs(searchParams)

    // 再次检查是否被中断，防止竞态条件
    if (signal.aborted) return

    // 额外的安全检查：如果用户已经切换了平台或类型，丢弃结果
    if (platform.value !== requestPlatform) {
      console.log('平台已切换，丢弃旧结果', requestPlatform, '->', platform.value)
      return
    }
    if (requestPlatform === 'netease' && searchType.value !== requestSearchType) {
      console.log('搜索类型已切换，丢弃旧结果', requestSearchType, '->', searchType.value)
      return
    }

    if (results && results.success && results.data && results.data.length > 0) {
      // 转换搜索结果格式以兼容现有UI
      searchResults.value = results.data.map((item) => ({
        ...item,
        musicId: item.id,
        hasUrl: false,
        // 统一字段名称
        song: item.title || item.song,
        singer: item.artist || item.singer,
        // 保存实际的平台来源信息
        actualSource: results.source,
        musicPlatform:
          item.musicPlatform || (results.source === 'netease-backup' ? 'netease' : results.source),
        actualMusicPlatform:
          item.musicPlatform || (results.source === 'netease-backup' ? 'netease' : results.source)
      }))

      // 如果QQ音乐搜索降级到网易云，自动切换选项卡
      if (platform.value === 'tencent' && searchResults.value.length > 0) {
        const firstPlatform =
          searchResults.value[0].actualMusicPlatform || searchResults.value[0].musicPlatform || ''
        if (firstPlatform.includes('netease')) {
          platform.value = 'netease'
        }
      }

      console.log('搜索成功，找到', results.data.length, '首歌曲')
    } else {
      searchResults.value = []
      const errorMsg = results && results.error ? results.error : locale.value.noMatchingSongs
      error.value = errorMsg
      if (window.$showNotification) {
        window.$showNotification(errorMsg, 'info')
      }
    }
  } catch (err) {
    // 如果请求被取消，不显示错误信息
    if (err.name === 'AbortError' || signal.aborted) {
      console.log('搜索请求已被取消')
      return
    }

    console.error('搜索错误:', err)
    searchError.value = getErrorMessage(err) || locale.value.searchRequestFailed
    error.value = searchError.value

    if (window.$showNotification) {
      window.$showNotification(error.value, 'error')
    }
  } finally {
    // 只有在请求没有被取消的情况下才更新状态
    if (!signal.aborted) {
      searching.value = false
      hasSearched.value = true
      // 清理AbortController
      searchAbortController.value = null
    }
  }
}

// 获取音乐播放URL
const getAudioUrl = async (result) => {
  if (result.hasUrl || result.url) return result

  try {
    // 根据搜索结果的sourceInfo.source字段判断音源类型
    const sourceType = result.sourceInfo?.source || result.actualSource || ''

    // 哔哩哔哩
    if (sourceType === 'bilibili' || isBilibiliSong(result)) {
      try {
        const songId = result.musicId || result.id
        if (!songId) throw new Error(locale.value.notifications.missingSongId)

        const options = result.bilibiliCid ? { bilibiliCid: String(result.bilibiliCid) } : undefined
        const urlResult = await musicSources.getSongUrl(songId, 0, 'bilibili', undefined, options)

        if (urlResult && urlResult.success && urlResult.url) {
          result.url = urlResult.url
          result.hasUrl = true
          return result
        }
      } catch (error) {
        console.error('Bilibili获取播放链接失败:', error)
      }
    }

    // 对于 vkeys v3（QQ音乐），调用统一的 getSongUrl 获取播放链接
    if (sourceType === 'vkeys-v3') {
      try {
        const songId = result.musicId || result.id
        if (!songId) throw new Error(locale.value.notifications.missingSongId)

        const { getQuality } = useAudioQuality()
        const quality = getQuality(platform.value) || 8
        const urlResult = await musicSources.getSongUrl(songId, quality, 'tencent')

        if (urlResult && urlResult.success && urlResult.url) {
          result.url = urlResult.url
          result.hasUrl = true

          // 更新搜索结果中的对应项
          const index = searchResults.value.findIndex(
            (item) => (item.musicId || item.id) === (result.musicId || result.id)
          )
          if (index !== -1) {
            searchResults.value[index] = { ...result }
          }
          return result
        } else {
          // vkeys v3 未获取到有效链接，继续回退逻辑
        }
      } catch (qqV3Error) {
        // vkeys v3 获取失败，继续回退其它逻辑
      }
    }

    // 对于vkeys音源的处理
    if (sourceType === 'vkeys') {
      if (result.url) {
        result.hasUrl = true
        return result
      } else {
        // 根据平台直接尝试对应的备用源
        if (platform.value === 'tencent') {
          try {
            const songId = result.musicId || result.id
            if (!songId) throw new Error(locale.value.notifications.missingSongId)

            const { getQuality } = useAudioQuality()
            const quality = getQuality(platform.value) || 8
            const urlResult = await musicSources.getSongUrl(songId, quality, platform.value)

            if (urlResult && urlResult.success && urlResult.url) {
              result.url = urlResult.url
              result.hasUrl = true
              return result
            } else {
              // QQ音乐 vkeys 系无法获取URL，继续回退
            }
          } catch (qqError) {
            // QQ音乐播放链接获取失败，继续回退
          }
        } else if (platform.value === 'netease') {
          try {
            const { getQuality } = useAudioQuality()
            const quality = getQuality(platform.value)
            const songDetail = await musicSources.getSongDetail({
              ids: [result.musicId || result.id],
              quality: quality
            })

            if (songDetail && songDetail.url) {
              result.url = songDetail.url
              result.hasUrl = true
              if (songDetail.cover) result.cover = songDetail.cover
              if (songDetail.duration) result.duration = songDetail.duration
              return result
            }
          } catch (error) {
            // vkeys getSongDetail 失败，继续回退
          }

          // 如果getSongDetail失败，尝试网易云备用源
          try {
            const { getQuality } = useAudioQuality()
            const quality = getQuality(platform.value)
            const songId = result.musicId || result.id

            const urlResult = await musicSources.getSongUrl(songId, quality, platform.value)

            if (urlResult && urlResult.success && urlResult.url) {
              result.url = urlResult.url
              result.hasUrl = true
              return result
            } else {
              // 备用源也无法获取URL
            }
          } catch (backupError) {
            // 备用源获取失败
          }
        }
      }
    }

    // 对于网易云备用源，直接调用getSongUrl获取播放链接
    if (sourceType === 'netease-backup') {
      const targetPlatform = 'netease'
      const { getQuality } = useAudioQuality()
      const quality = getQuality(targetPlatform)
      const songId = result.musicId || result.id

      // 检查是否为播客内容
      const isPodcast = result.sourceInfo?.type === 'voice' || searchType.value === 1009

      try {
        const urlResult = await musicSources.getSongUrl(
          songId,
          quality,
          targetPlatform,
          neteaseCookie.value,
          { unblock: isPodcast ? false : undefined } // 播客内容 unblock=false，普通歌曲使用默认逻辑（登录则false，未登录则true）
        )

        if (urlResult && urlResult.success && urlResult.url) {
          // 更新结果中的URL和其他信息
          result.url = urlResult.url
          result.hasUrl = true

          // 更新搜索结果中的对应项
          const index = searchResults.value.findIndex(
            (item) => (item.musicId || item.id) === (result.musicId || result.id)
          )
          if (index !== -1) {
            searchResults.value[index] = { ...result }
          }
        } else {
          // 未能获取到有效的歌曲URL
        }
      } catch (urlError) {
        // 调用 getSongUrl 失败
      }
    }

    // 如果是网易云音乐且没有被前面特殊的 sourceType 处理（比如听歌识曲的普通结果）
    if (result.musicPlatform === 'netease' && !result.url) {
      try {
        const { getQuality } = useAudioQuality()
        const quality = getQuality('netease')
        const songDetail = await musicSources.getSongDetail({
          ids: [result.musicId || result.id],
          quality: quality
        })

        if (songDetail && songDetail.url) {
          result.url = songDetail.url
          result.hasUrl = true
          if (songDetail.cover) result.cover = songDetail.cover
          if (songDetail.duration) result.duration = songDetail.duration
          return result
        }
      } catch (error) {
        console.error('获取网易云音乐详情失败:', error)
      }

      // 如果getSongDetail失败，尝试网易云备用源
      try {
        const { getQuality } = useAudioQuality()
        const quality = getQuality('netease')
        const songId = result.musicId || result.id

        const urlResult = await musicSources.getSongUrl(songId, quality, 'netease')

        if (urlResult && urlResult.success && urlResult.url) {
          result.url = urlResult.url
          result.hasUrl = true
          return result
        }
      } catch (backupError) {
        console.error('备用源获取失败:', backupError)
      }
    }

    // 最终回退：使用统一的 resolveMusicUrl（包含 vkeys API 回退）
    // 对于未登录用户或音源获取失败时使用第三方 API 获取播放链接
    if (!result.url && result.musicPlatform && result.musicId) {
      try {
        const fallbackUrl = await resolveMusicUrl(
          result.musicPlatform,
          result.musicId,
          result.playUrl,
          {
            mediaId:
              result.sourceInfo?.strMediaMid ||
              result.sourceInfo?.mediaId ||
              result.sourceInfo?.mediaMid
          }
        )
        if (fallbackUrl) {
          result.url = fallbackUrl
          result.hasUrl = true
        }
      } catch (fallbackError) {
        console.error('resolveMusicUrl 回退获取失败:', fallbackError)
      }
    }

    return result
  } catch (err) {
    error.value = locale.value.notifications.musicUrlFailedRetry
    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.musicUrlFailedRetry, 'error')
    }
    return result
  }
}

// 播放歌曲
const playSong = async (result, playlist, playlistIndex) => {
  // 如果还没有获取URL，先获取
  if (!result.hasUrl && !result.url) {
    result = await getAudioUrl(result)
  }

  // 对于非哔哩哔哩平台，如果没有URL则提示错误
  if (!result.url && !isBilibiliSong(result)) {
    error.value = locale.value.notifications.songUnavailable
    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.songUnavailable, 'error')
    }
    return
  }

  let finalMusicId = result.musicId ? String(result.musicId) : null
  if (isBilibiliSong(result) && result.bilibiliCid) {
    finalMusicId = `${result.musicId}:${result.bilibiliCid}`
    // 如果有分P信息，也添加到 musicId
    if (result.bilibiliPage || result.page) {
      const page = result.bilibiliPage || result.page
      if (Number(page) > 1) {
        finalMusicId += `:${page}`
      }
    }
  }

  // 准备播放所需的数据
  const song = {
    id: finalMusicId || result.musicId || Date.now(),
    title: result.song || result.title,
    artist: result.singer || result.artist,
    cover: result.cover || null,
    musicUrl: result.url || null, // 哔哩哔哩可能没有音频URL
    musicPlatform: result.musicPlatform || platform.value,
    musicId: finalMusicId,
    albumId: result.albumId,
    sourceInfo: result.sourceInfo,
    bilibiliCid: result.bilibiliCid // 确保传递 cid
  }

  console.log('[RequestForm] 准备播放歌曲:', song)

  // 处理播放列表：如果提供了playlist，将其转换为audioPlayer需要的格式
  let finalPlaylist
  let finalIndex
  if (playlist && playlist.length > 0) {
    finalPlaylist = playlist.map((s) => ({
      ...s,
      id: String(s.id),
      musicId: String(s.musicId || s.id),
      musicUrl: s.musicUrl || s.url || null
    }))
    // 如果提供了playlistIndex则使用，否则自动查找
    finalIndex =
      typeof playlistIndex === 'number'
        ? playlistIndex
        : finalPlaylist.findIndex((s) => s.id === String(song.id))
    if (finalIndex < 0) finalIndex = 0
  }

  // 使用全局播放器播放歌曲
  const playResult = audioPlayer.playSong(song, finalPlaylist, finalIndex)

  if (!playResult) {
    console.error('[RequestForm] 播放器返回 false，播放失败')
    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.playFailed, 'error')
    }
    return
  }

  console.log('[RequestForm] 播放器已启动')

  // 如果有音乐平台信息，请求歌词
  if (song.musicPlatform && song.musicId) {
    try {
      const { useLyrics } = await import('~/composables/useLyrics')
      const lyrics = useLyrics()
      // 请求歌词（对于bilibili，传递原始的bvid，不包含cid）
      const lyricMusicId = result.bilibiliCid ? result.musicId : song.musicId
      await lyrics.fetchLyrics(song.musicPlatform, lyricMusicId, {
        title: song.title,
        artist: song.artist,
        album: result.album || ''
      })
    } catch (error) {
      console.error('获取歌词失败:', error)
      // 歌词获取失败不影响播放
    }
  }
}

// 选择搜索结果
const selectResult = async (result) => {
  // 防止重复点击和事件冒泡
  event?.stopPropagation()

  // 先获取完整信息
  if (!result.hasUrl) {
    result = await getAudioUrl(result)
  }

  // 标准化属性名称（处理不同API返回格式的差异）
  const songTitle = result.song || result.title
  const singerName = result.singer || result.artist

  title.value = songTitle
  artist.value = singerName
  selectedCover.value = result.cover || ''
  selectedUrl.value = result.url || ''

  // 如果没有URL，给出提示
  if (!result.url) {
    success.value = locale.value.notifications.songSelectedMaybeLimited
    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.songSelectedMaybeLimited, 'info')
    }
  }

  console.log('已选择歌曲:', songTitle, '- 填充表单但不自动提交')
}

// 打开上传到网易云对话框
const openUploadDialog = (result) => {
  console.log('QQ音乐搜索结果 - 完整对象:', result)
  console.log('QQ音乐搜索结果 - 所有键:', Object.keys(result))

  // 转换QQ音乐搜索结果为上传对话框需要的格式
  // 直接传递整个 result 对象，让上传对话框自己提取需要的字段
  selectedUploadSong.value = result

  console.log('准备上传的歌曲数据:', selectedUploadSong.value)
  showUploadDialog.value = true
}

// 显示登录弹窗
const handleShowLogin = () => {
  showUploadDialog.value = false
  showLoginModal.value = true
}

const handleLoginRedirect = async () => {
  if (title.value.trim()) {
    try {
      sessionStorage.setItem('pending_search', JSON.stringify({
        title: title.value.trim(),
        platform: platform.value
      }))
    } catch {
      // 浏览器禁用会话存储时仍可继续登录。
    }
  }
  await navigateTo(`/login?redirect=${encodeURIComponent('/?tab=request')}`)
}

// 提交选中的歌曲
const submitSong = async (result, options = {}) => {
  // 防止重复点击和重复提交
  if (submitting.value) return

  // 如果是播客/电台模式，且是在网易云平台下，且不是具体的单集提交
  if (
    platform.value === 'netease' &&
    searchType.value === 1009 &&
    !options.isPodcastEpisode &&
    !options.isDirectSubmit
  ) {
    console.log('打开播客节目列表:', result)
    // 打开播客节目列表弹窗
    selectedPodcastId.value = result.id || result.musicId
    selectedPodcastName.value = result.title || result.song || result.name
    podcastCookie.value = neteaseCookie.value
    showPodcastModal.value = true
    return
  }

  // 如果是 Bilibili 平台，且有多个剧集，且不是具体的剧集提交
  if (
    platform.value === 'bilibili' &&
    result.pages &&
    result.pages.length > 1 &&
    !options.isBilibiliEpisode
  ) {
    console.log('打开 Bilibili 剧集列表:', result)
    selectedBilibiliVideo.value = result
    bilibiliEpisodes.value = result.pages
    showBilibiliEpisodesModal.value = true
    return
  }

  console.log('执行submitSong，提交歌曲:', result.title || result.song)

  if (!(await ensureCardCodeForSubmit())) {
    return false
  }

  // 检查投稿限额
  const limitCheck = checkSubmissionLimit()
  if (!limitCheck.canSubmit) {
    error.value = limitCheck.message
    if (window.$showNotification) {
      window.$showNotification(limitCheck.message, 'error')
    }
    return
  }

  // 使用搜索结果中的数据
  const songTitle = result.song || result.title
  const songArtist = result.singer || result.artist

  // 只有在用户已登录且歌曲列表已加载时才检查是否已存在完全匹配的歌曲
  if (auth.isAuthenticated.value && songService.songs.value && songService.songs.value.length > 0) {
    // 对于哔哩哔哩多P视频，使用 musicId 进行精确匹配
    if (platform.value === 'bilibili' && result.musicId) {
      // 构建完整的 musicId
      let fullMusicId = String(result.musicId)
      if (options.isBilibiliEpisode && options.episode) {
        const bvId = fullMusicId.split(':')[0]
        const musicIdParts = [bvId, options.episode.cid]
        if (options.episode.page && Number(options.episode.page) > 1) {
          musicIdParts.push(String(options.episode.page))
        }
        fullMusicId = musicIdParts.join(':')
      }

      // 检查是否已有相同 musicId 的歌曲
      const existingSong = songService.songs.value.find(
        (song) => isBilibiliSong(song) && song.musicId === fullMusicId
      )

      if (existingSong) {
        const allowOverride =
          options.forceResubmit === true || (isSuperAdmin.value && existingSong.played)
        if (!allowOverride) {
          if (window.$showNotification) {
            window.$showNotification(
              locale.value.notifications.duplicateSong,
              'warning'
            )
          }
          return
        }
      }
    } else {
      // 对于其他平台，使用标题和艺术家进行匹配
      const existingSong = songService.songs.value.find(
        (song) =>
          song.title.toLowerCase() === songTitle.toLowerCase() &&
          song.artist.toLowerCase() === songArtist.toLowerCase()
      )

      if (existingSong) {
        const allowOverride =
          options.forceResubmit === true || (isSuperAdmin.value && existingSong.played)
        if (!allowOverride) {
          if (window.$showNotification) {
            window.$showNotification(
              locale.value.notifications.duplicateSong,
              'warning'
            )
          }
          return
        }
      }
    }
  }

  submitting.value = true
  error.value = ''

  title.value = songTitle
  artist.value = songArtist
  selectedCover.value = result.cover || ''
  selectedUrl.value = result.url || result.file || ''

  // 管理员不受黑名单限制
  if (!auth.isAdmin.value) {
    try {
      // 检查黑名单
      const blacklistCheck = await $fetch('/api/blacklist/check', {
        method: 'POST',
        body: {
          title: title.value,
          artist: artist.value
        }
      })

      if (blacklistCheck.isBlocked) {
        const reasons = blacklistCheck.reasons.map((r) => r.reason).join('; ')
        error.value = callLocale('notifications.blacklistedSong', '', reasons)
        if (window.$showNotification) {
          window.$showNotification(error.value, 'error')
        }
        submitting.value = false
        return
      }
    } catch (err) {
      console.error('黑名单检查失败:', err)
      // 黑名单检查失败不阻止提交，只记录错误
    }
  }

  // 确保获取完整的URL
  if (!selectedUrl.value && result.musicId) {
    const fullResult = await getAudioUrl(result)
    selectedUrl.value = fullResult.url || ''
  }

  // 处理 Bilibili 分 P 信息
  let bilibiliCid = result.bilibiliCid
  let bilibiliPage = result.bilibiliPage || null

  if (options.isBilibiliEpisode && options.episode) {
    bilibiliCid = options.episode.cid
    bilibiliPage = options.episode.page
    // 追加分P标题
    if (options.episode.part && !title.value.includes(options.episode.part)) {
      title.value += ` - ${options.episode.part}`
    }
  }

  try {
    // 构建歌曲数据对象
    const songData = {
      title: title.value,
      artist: artist.value,
      preferredPlayTimeId: preferredPlayTimeId.value ? parseInt(preferredPlayTimeId.value) : null,
      cover: selectedCover.value,
      musicPlatform: result.actualMusicPlatform || result.musicPlatform || platform.value, // 优先使用搜索结果的实际平台来源
      musicId: result.musicId ? String(result.musicId) : null,
      submissionNote: submissionNote.value.trim() || null,
      submissionNotePublic: submissionNotePublic.value,
      collaborators: collaborators.value.map((u) => u.id),
      bilibiliCid: bilibiliCid || null,
      bilibiliPage: bilibiliPage
    }
      // 如果用户填写了点歌券，传递给后端
      if (cardCode.value && cardCode.value.trim()) {
        songData.cardCode = cardCode.value.trim()
      }

    // 只emit事件，让父组件处理实际的API调用
    emit('request', songData)

    // 成功提示由父组件处理，这里只重置表单
    resetForm()
    return true
  } catch (err) {
    error.value = getErrorMessage(err) || locale.value.notifications.submitFailed
    if (window.$showNotification) {
      window.$showNotification(error.value, 'error')
    }
    return false
  } finally {
    submitting.value = false
  }
}

// 直接提交表单
const handleSubmit = async () => {
  if (submitting.value) return

  if (!(await ensureCardCodeForSubmit())) {
    return
  }

  // 检查投稿限额
  const limitCheck = checkSubmissionLimit()
  if (!limitCheck.canSubmit) {
    error.value = limitCheck.message
    if (window.$showNotification) {
      window.$showNotification(limitCheck.message, 'error')
    }
    return
  }

  submitting.value = true
  error.value = ''

  try {
    // 构建歌曲数据对象
    const songData = {
      title: title.value,
      artist: artist.value,
      preferredPlayTimeId: preferredPlayTimeId.value ? parseInt(preferredPlayTimeId.value) : null,
      cover: selectedCover.value,
      musicPlatform: platform.value,
      musicId: null, // 手动输入时没有musicId
      submissionNote: submissionNote.value.trim() || null,
      submissionNotePublic: submissionNotePublic.value,
      collaborators: collaborators.value.map((u) => u.id)
    }
    if (cardCode.value && cardCode.value.trim()) {
      songData.cardCode = cardCode.value.trim()
    }

    // 只emit事件，让父组件处理实际的API调用
    emit('request', songData)

    // 成功提示由父组件处理，这里只重置表单
    resetForm()
  } catch (err) {
    error.value = getErrorMessage(err) || locale.value.notifications.submitFailed
    if (window.$showNotification) {
      window.$showNotification(error.value, 'error')
    }
  } finally {
    submitting.value = false
  }
}

const isBilibiliMultiP = (result) => {
  return result && platform.value === 'bilibili' && result.pages && result.pages.length > 1
}

const getBilibiliEpisodeStatus = (result) => {
  if (!result || !isBilibiliMultiP(result)) return null

  const currentSemesterName = currentSemester.value?.name
  const bvid = result.id

  const submittedEpisodes = songService.songs.value.filter((song) => {
    if (song.musicPlatform !== 'bilibili') return false
    if (!song.musicId) return false

    const songBvid = song.musicId.includes(':') ? song.musicId.split(':')[0] : song.musicId

    const isSameBvid = songBvid === bvid

    if (currentSemesterName) {
      return isSameBvid && song.semester === currentSemesterName
    }

    return isSameBvid
  })

  const totalEpisodes = result.pages.length
  const submittedCount = submittedEpisodes.length

  return {
    submittedEpisodes,
    submittedCount,
    totalEpisodes,
    allSubmitted: submittedCount === totalEpisodes,
    partialSubmitted: submittedCount > 0 && submittedCount < totalEpisodes,
    noneSubmitted: submittedCount === 0
  }
}

const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

const handleBilibiliEpisodeSelect = async (episode) => {
  if (!selectedBilibiliVideo.value) return

  const episodeResult = {
    ...selectedBilibiliVideo.value,
    title: `${selectedBilibiliVideo.value.title} - ${episode.part}`,
    bilibiliCid: episode.cid,
    duration: episode.duration
  }

  const success = await submitSong(episodeResult, {
    isBilibiliEpisode: true,
    episode: episode
  })

  if (success) {
    showBilibiliEpisodesModal.value = false
    if (bilibiliModalRef.value && bilibiliModalRef.value.resetSubmissionState) {
      bilibiliModalRef.value.resetSubmissionState()
    }
  } else {
    if (bilibiliModalRef.value && bilibiliModalRef.value.resetSubmissionState) {
      bilibiliModalRef.value.resetSubmissionState()
    }
  }
}

const handleBilibiliEpisodePlay = async ({ song: episodeData, playlist, playlistIndex }) => {
  // 与 biliPlaylist 使用相同的 ID 构建逻辑，确保匹配
  const bvid = episodeData.bvid || episodeData.id
  let finalId = bvid
  if (episodeData.cid) {
    finalId = bvid + ':' + episodeData.cid
    const page = episodeData.bilibiliPage || episodeData.page
    if (page && Number(page) > 1) {
      finalId += ':' + page
    }
  }

  const episodeResult = {
    id: finalId,
    title: `${episodeData.title} - ${episodeData.part}`,
    artist: episodeData.artist,
    cover: episodeData.cover || '',
    musicId: finalId,
    musicPlatform: 'bilibili',
    bilibiliCid: episodeData.cid,
    duration: episodeData.duration,
    sourceInfo: { source: 'bilibili' }
  }

  // 转换播放列表为统一格式
  let biliPlaylist
  let biliIndex
  if (playlist && playlist.length > 0) {
    biliPlaylist = playlist.map((e) => {
      const bvid = e.bvid || e.id
      let finalId = bvid
      if (e.cid) {
        finalId = bvid + ':' + e.cid
        const page = e.bilibiliPage || e.page
        if (page && Number(page) > 1) {
          finalId += ':' + page
        }
      }
      return {
        id: finalId,
        title: `${e.title} - ${e.part}`,
        artist: e.artist,
        cover: e.cover || '',
        musicId: finalId,
        musicPlatform: 'bilibili',
        bilibiliCid: e.cid,
        duration: e.duration,
        sourceInfo: { source: 'bilibili' }
      }
    })
    biliIndex =
      typeof playlistIndex === 'number'
        ? playlistIndex
        : playlist.findIndex((e) => e.cid === episodeData.cid)
    if (biliIndex < 0) biliIndex = 0
  }

  await playSong(episodeResult, biliPlaylist, biliIndex)
}

// 引用模态框组件
const bilibiliModalRef = ref(null)
const podcastModalRef = ref(null)
const recentSongsModalRef = ref(null)
const playlistModalRef = ref(null)
const albumModalRef = ref(null)

// 判断搜索结果是否为网易云专辑（仅网易云支持专辑详情弹窗）
const isNeteaseAlbum = (result) => {
  const p = result.actualMusicPlatform || result.musicPlatform || platform.value
  return !!(result.albumId && p && p.includes('netease'))
}

// 判断结果是否来自QQ音乐（用于显示上传按钮）
const isTencentSource = (result) => {
  const p = result.actualMusicPlatform || result.musicPlatform || ''
  return p.includes('vkeys') || p === 'tencent'
}

// 打开专辑详情（标准化平台名称，AlbumDetailsModal 只识别 netease/tencent）
const openAlbumDetails = (result) => {
  if (!result.albumId) return

  selectedAlbumId.value = result.albumId
  selectedAlbumName.value = result.album || result.albumName
  const rawPlatform = result.actualMusicPlatform || result.musicPlatform || platform.value
  selectedAlbumPlatform.value = rawPlatform.includes('netease') ? 'netease' : 'tencent'
  showAlbumDetailsModal.value = true
}

// 处理专辑歌曲播放
const handleAlbumSongPlay = async ({ song, playlist, playlistIndex }) => {
  await playSong(song, playlist, playlistIndex)
}

// 处理专辑歌曲投稿
const handleAlbumSongSubmit = async (songData) => {
  const success = await submitSong(songData, { isDirectSubmit: true })

  if (success) {
    showAlbumDetailsModal.value = false
  }

  if (albumModalRef.value && albumModalRef.value.resetSubmissionState) {
    albumModalRef.value.resetSubmissionState()
  }
}

// 处理专辑歌曲点赞
const handleAlbumSongVote = async (song) => {
  if (voting.value) return
  if (!song.songId) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.missingSongId, 'error')
    }
    return
  }

  if (song.voted) {
    return
  }

  voting.value = true
  try {
    await songService.voteSong(song.songId)

    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.likeSuccess, 'success')
    }

    // 静默刷新歌曲列表
    songService.refreshSongsSilent().catch((err) => {
      console.error('刷新歌曲列表失败', err)
    })
  } catch (error) {
    console.error('点赞失败:', error)
    if (window.$showNotification) {
      window.$showNotification(getErrorMessage(error) || locale.value.notifications.likeFailedRetry, 'error')
    }
  } finally {
    voting.value = false
  }
}

// 处理播客单集提交
const handlePodcastSubmit = async (song) => {
  const success = await submitSong(song, { isPodcastEpisode: true })
  if (success) {
    showPodcastModal.value = false
  } else {
    // 如果失败，重置模态框内的提交状态
    if (podcastModalRef.value && podcastModalRef.value.resetSubmissionState) {
      podcastModalRef.value.resetSubmissionState()
    }
  }
}

// 处理播客单集播放
const handlePodcastPlay = async (song) => {
  console.log('播放播客单集:', song.title)
  await playSong(song)
}

// 处理最近播放歌曲提交
const handleRecentSongSubmit = async (song) => {
  const success = await submitSong(song, { isPodcastEpisode: false, isDirectSubmit: true })
  if (success) {
    showRecentSongsModal.value = false
  } else {
    // 如果失败，重置模态框内的提交状态
    if (recentSongsModalRef.value && recentSongsModalRef.value.resetSubmissionState) {
      recentSongsModalRef.value.resetSubmissionState()
    }
  }
}

// 处理最近播放歌曲播放
const handleRecentSongPlay = async (song) => {
  await playSong(song)
}

// 处理歌单歌曲提交
const handlePlaylistSubmit = async (song) => {
  const success = await submitSong(song, { isPodcastEpisode: false, isDirectSubmit: true })
  if (success) {
    showPlaylistModal.value = false
  } else {
    // 如果失败，重置模态框内的提交状态
    if (playlistModalRef.value && playlistModalRef.value.resetSubmissionState) {
      playlistModalRef.value.resetSubmissionState()
    }
  }
}

// 处理歌单歌曲播放
const handlePlaylistPlay = async (song) => {
  await playSong(song)
}

// 手动输入相关方法
const handleManualSubmit = async () => {
  if (!title.value.trim() || !manualArtist.value.trim()) {
    error.value = locale.value.notifications.completeSongInfoRequired
    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.completeSongInfoRequired, 'error')
    }
    return
  }

  // 验证URL
  if (manualCover.value && !coverValidation.value.valid) {
    error.value = locale.value.notifications.fixCoverUrl
    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.fixCoverUrl, 'error')
    }
    return
  }

  if (manualPlayUrl.value && !playUrlValidation.value.valid) {
    error.value = locale.value.notifications.fixPlayUrl
    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.fixPlayUrl, 'error')
    }
    return
  }

  if (!(await ensureCardCodeForSubmit())) {
    return
  }

  // 检查投稿限额
  const limitCheck = checkSubmissionLimit()
  if (!limitCheck.canSubmit) {
    error.value = limitCheck.message
    if (window.$showNotification) {
      window.$showNotification(limitCheck.message, 'error')
    }
    return
  }

  submitting.value = true
  error.value = ''

  // 管理员不受黑名单限制
  if (!auth.isAdmin.value) {
    try {
      // 检查黑名单
      const blacklistCheck = await $fetch('/api/blacklist/check', {
        method: 'POST',
        body: {
          title: title.value,
          artist: manualArtist.value
        }
      })

      if (blacklistCheck.isBlocked) {
        const reasons = blacklistCheck.reasons.map((r) => r.reason).join('; ')
        error.value = callLocale('notifications.blacklistedSong', '', reasons)
        if (window.$showNotification) {
          window.$showNotification(error.value, 'error')
        }
        submitting.value = false
        return
      }
    } catch (err) {
      console.error('黑名单检查失败:', err)
      // 黑名单检查失败不阻止提交，只记录错误
    }
  }

  try {
    // 构建歌曲数据对象
    // 如果手动填入了 playUrl，则不保留平台标识符
    const trimmedPlayUrl = manualPlayUrl.value?.trim() || ''
    const hasManualPlayUrl = !!trimmedPlayUrl
    const songData = {
      title: title.value,
      artist: manualArtist.value,
      preferredPlayTimeId: preferredPlayTimeId.value ? parseInt(preferredPlayTimeId.value) : null,
      cover: manualCover.value?.trim() || '',
      playUrl: trimmedPlayUrl,
      musicPlatform: hasManualPlayUrl ? null : platform.value,
      musicId: null, // 手动输入时没有musicId
      submissionNote: submissionNote.value.trim() || null,
      submissionNotePublic: submissionNotePublic.value
    }

    if (cardCode.value && cardCode.value.trim()) {
      songData.cardCode = cardCode.value.trim()
    }

    // 只emit事件，让父组件处理实际的API调用
    emit('request', songData)

    // 成功提示由父组件处理，这里只重置表单和关闭弹窗
    resetForm()
    showManualModal.value = false
  } catch (err) {
    error.value = getErrorMessage(err) || locale.value.notifications.submitFailed
    if (window.$showNotification) {
      window.$showNotification(error.value, 'error')
    }
  } finally {
    submitting.value = false
  }
}

// 申请重播
const handleRequestReplay = async (song) => {
  if (requestingReplay.value || !song) return

  // 如果已经申请过，不执行
  if (song.replayRequested) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.replayAlreadyRequested, 'info')
    }
    return
  }

  requestingReplay.value = true
  try {
    await songService.requestReplay(song.id)
    // 刷新歌曲状态
    setTimeout(() => {
      songService.refreshSongsSilent().catch(console.error)
    }, 500)
    if (window.$showNotification) {
      window.$showNotification(locale.value.notifications.replayRequestSuccess, 'success')
    }
  } catch (err) {
    console.error('申请重播失败:', err)
    if (window.$showNotification) {
      window.$showNotification(callLocale('notifications.replayRequestFailed', '', getErrorMessage(err)), 'error')
    }
  } finally {
    requestingReplay.value = false
  }
}

// 获取重播按钮文本
const getReplayButtonText = (song) => {
  if (requestingReplay.value) return locale.value.replayRequesting
  if (!song) return locale.value.requestReplay

  // 检查学期
  if (currentSemester.value && song.semester !== currentSemester.value.name) {
    return locale.value.notCurrentSemester
  }

  // 检查重播申请状态
  if (song.replayRequestStatus === 'REJECTED') {
    // 如果在冷却期内
    if (song.replayRequestCooldownRemaining && song.replayRequestCooldownRemaining > 0) {
      return callLocale('replayRejectedCooldown', '', song.replayRequestCooldownRemaining)
    }
    // 冷却期已过
    return locale.value.requestReplay
  }

  if (song.replayRequestStatus === 'FULFILLED') {
    return locale.value.replayed
  }

  if (song.replayRequested || song.replayRequestStatus === 'PENDING') {
    return locale.value.alreadyRequestedReplay
  }

  return locale.value.requestReplay
}

// 获取重播按钮标题（tooltip）
const getReplayButtonTitle = (song) => {
  if (!song) return locale.value.requestReplay

  // 检查学期
  if (currentSemester.value && song.semester !== currentSemester.value.name) {
    return locale.value.onlyCurrentSemesterReplay
  }

  // 检查重播申请状态
  if (song.replayRequestStatus === 'REJECTED') {
    if (song.replayRequestCooldownRemaining && song.replayRequestCooldownRemaining > 0) {
      return callLocale('replayRejectedTooltip', '', song.replayRequestCooldownRemaining)
    }
    return locale.value.requestReplay
  }

  if (song.replayRequestStatus === 'FULFILLED') {
    return locale.value.alreadyReplayed
  }

  if (song.replayRequested || song.replayRequestStatus === 'PENDING') {
    return locale.value.alreadyRequestedReplay
  }

  return locale.value.requestReplay
}

// 检查重播按钮是否应该禁用
const isReplayButtonDisabled = (song) => {
  if (requestingReplay.value || !song) return true

  // 检查学期
  if (currentSemester.value && song.semester !== currentSemester.value.name) {
    return true
  }

  // 检查重播申请状态
  if (song.replayRequestStatus === 'REJECTED') {
    // 如果在冷却期内，禁用按钮
    if (song.replayRequestCooldownRemaining && song.replayRequestCooldownRemaining > 0) {
      return true
    }
    // 冷却期已过，允许重新申请
    return false
  }

  if (song.replayRequestStatus === 'FULFILLED') {
    return true
  }

  if (song.replayRequested || song.replayRequestStatus === 'PENDING') {
    return true
  }

  return false
}

// 重置表单
const resetForm = () => {
  title.value = ''
  artist.value = ''
  preferredPlayTimeId.value = ''
  searchResults.value = []
  selectedCover.value = ''
  selectedUrl.value = ''
  showManualModal.value = false
  manualArtist.value = ''
  manualCover.value = ''
  manualPlayUrl.value = ''
  hasSearched.value = false
  collaborators.value = []
  submissionNote.value = ''
  submissionNotePublic.value = true
  cardCode.value = ''
  cardCodeDraft.value = ''
  showCardCodeModal.value = false
  resetCardCodeValidation()
  // 重置URL验证状态
  coverValidation.value = { valid: true, error: '', validating: false }
  playUrlValidation.value = { valid: true, error: '', validating: false }
}

// 停止播放
const stopPlaying = () => {
  audioPlayer.stopSong()
}

// 获取投稿状态
const fetchSubmissionStatus = async () => {
  if (!user.value) return

  loadingSubmissionStatus.value = true

  try {
    const authConfig = auth.getAuthConfig()
    const response = await $fetch('/api/songs/submission-status', authConfig)
    submissionStatus.value = response
  } catch (err) {
    console.error('获取投稿状态失败:', err)
  } finally {
    loadingSubmissionStatus.value = false
  }
}

// 检查投稿限额
const checkSubmissionLimit = () => {
  // 超级管理员不受投稿限制
  if (user.value && (user.value.role === 'SUPER_ADMIN' || user.value.role === 'ADMIN')) {
    return { canSubmit: true, message: '' }
  }

  if (!submissionStatus.value) {
    return { canSubmit: true, message: '' }
  }

  // 检查投稿是否已关闭
  if (submissionStatus.value.submissionClosed) {
    let message = locale.value.submissionClosed
    if (submissionStatus.value.timeLimitationEnabled && !submissionStatus.value.currentTimePeriod) {
      message = locale.value.outsideRequestTime
    }
    return {
      canSubmit: false,
      message: message
    }
  }

  // 检查投稿时段名额限制
  if (submissionStatus.value.timeLimitationEnabled && submissionStatus.value.currentTimePeriod) {
    const { expected, accepted } = submissionStatus.value.currentTimePeriod
    if (expected > 0 && accepted >= expected) {
      return {
        canSubmit: false,
        message: callLocale('notifications.periodQuotaFull', '', accepted, expected)
      }
    }
  }


  if (!submissionStatus.value.limitEnabled) {
    return { canSubmit: true, message: '' }
  }

  if (cardCodeLimitBypassActive.value && trimmedCardCode.value && cardCodeValidation.value.valid === true) {
    return { canSubmit: true, message: '' }
  }

  const { dailyLimit, weeklyLimit, monthlyLimit, dailyUsed, weeklyUsed, monthlyUsed } =
    submissionStatus.value

  // 检查日限额
  if (dailyLimit && dailyUsed >= dailyLimit) {
    return {
      canSubmit: false,
      message: callLocale('notifications.dailyLimitReached', '', dailyUsed, dailyLimit)
    }
  }

  // 检查周限额
  if (weeklyLimit && weeklyUsed >= weeklyLimit) {
    return {
      canSubmit: false,
      message: callLocale('notifications.weeklyLimitReached', '', weeklyUsed, weeklyLimit)
    }
  }

  // 检查月限额
  if (monthlyLimit && monthlyUsed >= monthlyLimit) {
    return {
      canSubmit: false,
      message: callLocale('notifications.monthlyLimitReached', '', monthlyUsed, monthlyLimit)
    }
  }

  return { canSubmit: true, message: '' }
}

// URL验证函数
const validateCoverUrl = async (url) => {
  if (!url) {
    coverValidation.value = { valid: true, error: '', validating: false }
    return
  }

  coverValidation.value.validating = true
  const result = validateUrl(url)
  coverValidation.value = {
    valid: result.valid,
    error: result.error || '',
    validating: false
  }
}

const validatePlayUrl = async (url) => {
  if (!url) {
    playUrlValidation.value = { valid: true, error: '', validating: false }
    return
  }

  playUrlValidation.value.validating = true
  const result = validateUrl(url)
  playUrlValidation.value = {
    valid: result.valid,
    error: result.error || '',
    validating: false
  }
}

// 监听URL变化并验证
watch(manualCover, (newUrl) => {
  if (newUrl) {
    // 防抖处理，避免频繁验证
    clearTimeout(coverValidation.value.debounceTimer)
    coverValidation.value.debounceTimer = setTimeout(() => {
      validateCoverUrl(newUrl)
    }, 1000)
  } else {
    coverValidation.value = { valid: true, error: '', validating: false }
  }
})

watch(manualPlayUrl, (newUrl) => {
  if (newUrl) {
    // 防抖处理，避免频繁验证
    clearTimeout(playUrlValidation.value.debounceTimer)
    playUrlValidation.value.debounceTimer = setTimeout(() => {
      validatePlayUrl(newUrl)
    }, 1000)
  } else {
    playUrlValidation.value = { valid: true, error: '', validating: false }
  }
})

// 计算属性：检查手动表单是否可以提交
const canSubmitManualForm = computed(() => {
  // 必填字段检查
  if (!manualArtist.value.trim()) {
    return false
  }

  // 可选字段验证检查
  // 如果输入了封面URL，必须验证通过且不在验证中
  if (manualCover.value && (!coverValidation.value.valid || coverValidation.value.validating)) {
    return false
  }

  // 如果输入了播放URL，必须验证通过且不在验证中
  if (
    manualPlayUrl.value &&
    (!playUrlValidation.value.valid || playUrlValidation.value.validating)
  ) {
    return false
  }

  return true
})

// 暴露方法给父组件
defineExpose({
  refreshSubmissionStatus: fetchSubmissionStatus
})
</script>

<style scoped>
.request-form {
  width: 100%;
  color: #ffffff;
  display: flex;
  gap: 2rem;
  height: calc(100vh - 160px);
  min-height: 650px;
}

/* 桌面端样式 */
.desktop-only-rules {
  display: block;
}

.mobile-only-rules {
  display: none;
}

.rules-section {
  background: rgba(0, 0, 0, 0.4);
  border-radius: 13px;
  padding: 1.25rem;
  flex: 0 0 35%; /* 稍微缩小规则区域占比 */
  min-width: 300px;
  height: 100%;
  overflow-y: auto;
}

.section-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 15px;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 0.75rem;
}

.rules-content-desktop {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 15px;
  line-height: 1.7;
  letter-spacing: 0.04em;
  color: #fff;
}

.rules-content-desktop p {
  margin-bottom: 0.6rem;
}

.guidelines-content {
  white-space: pre-line;
  overflow-wrap: anywhere;
}

/* 移动端样式 */
.rules-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 15px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 1.25rem;
}

.rules-icon {
  color: #f59e0b;
}

.rules-content {
  font-family: 'MiSans', sans-serif;
  font-size: 13px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.5);
}

.rule-item {
  display: flex;
  margin-bottom: 0.75rem;
}

.rule-item span {
  margin-right: 0.5rem;
  color: rgba(255, 255, 255, 0.3);
  font-weight: 600;
}

.form-container {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.song-request-form {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 1rem;
  position: relative;
}

/* 搜索区域样式 */
.form-header-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
  padding-top: 4px; /* 为按钮悬停上浮留出空间 */
  flex-wrap: wrap; /* 允许在窄屏下换行 */
}

.search-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1.5;
  min-width: 400px; /* 增加最小宽度，确保搜索框、标签和按钮有足够空间 */
}

.search-label {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 15px;
  color: #ffffff;
  white-space: nowrap;
  flex-shrink: 0; /* 防止标签被压缩 */
}

.search-input-group {
  display: flex;
  gap: 0.5rem;
  flex: 1;
  min-width: 0; /* 允许内部元素正常压缩 */
}

.search-input {
  background: #040e15;
  border: 1px solid #242f38;
  border-radius: 8px;
  padding: 0.6rem 0.85rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.6);
  flex: 1;
  min-width: 100px; /* 确保输入框不会缩到太小 */
}

.search-input:focus {
  outline: none;
  border-color: #0b5afe;
}

.search-button {
  background: linear-gradient(180deg, #0043f8 0%, #0075f8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.3s ease;
  flex-shrink: 0; /* 确保搜索按钮始终完整显示，不被重叠 */
}

.search-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 67, 248, 0.3);
}

.search-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.audio-match-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 0.75rem 0.9rem;
  color: rgba(255, 255, 255, 0.85);
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.audio-match-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.18);
  border-color: rgba(96, 165, 250, 0.35);
  color: #ffffff;
}

.audio-match-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 联合投稿人区域 */
.collaborators-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 200px; /* 增加最小宽度，防止在窄屏下与搜索框重叠 */
}

.section-label {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: #ffffff;
  white-space: nowrap;
  flex-shrink: 0; /* 防止标签被压缩 */
}

.collaborators-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.collaborator-tag {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(11, 90, 254, 0.1);
  border: 1px solid rgba(11, 90, 254, 0.2);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  font-size: 14px;
  color: #fff;
}

.remove-collaborator {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0;
}

.remove-collaborator:hover {
  color: #fff;
}

.add-collaborator-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 0.25rem 0.75rem;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s;
}

.add-collaborator-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* 自定义复选框样式 */
.custom-checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.custom-checkbox-input {
  display: none;
}

.custom-checkbox-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid #3f3f46;
  background: rgba(24, 24, 27, 0.5);
  transition: all 0.2s ease;
}

.custom-checkbox-icon {
  width: 8px;
  height: 8px;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  color: white;
}

.custom-checkbox-input:checked + .custom-checkbox-box {
  background: #3b82f6;
  border-color: #3b82f6;
}

.custom-checkbox-input:checked + .custom-checkbox-box .custom-checkbox-icon {
  opacity: 1;
  transform: scale(1);
}

.custom-checkbox-text {
  font-size: 11px;
  color: #9ca3af;
  transition: color 0.2s ease;
}

.custom-checkbox-input:checked ~ .custom-checkbox-text {
  color: #d1d5db;
}

.custom-checkbox-wrapper:hover .custom-checkbox-box {
  border-color: #60a5fa;
}

/* 横向投稿状态样式 */
.login-required-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
}

.login-required-notice .notice-icon {
  flex-shrink: 0;
  color: #60a5fa;
}

.login-required-notice .notice-text {
  color: #93c5fd;
  font-size: 13px;
  font-weight: 500;
}

.login-required-notice .login-link-btn {
  padding: 0.2rem 0.6rem;
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.login-required-notice .login-link-btn:hover {
  background: rgba(59, 130, 246, 0.35);
  color: #bfdbfe;
}

.submission-status-horizontal {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  margin-bottom: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.admin-notice-horizontal {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  justify-content: center;
}

.admin-notice-horizontal .admin-icon {
  font-size: 14px;
}

.admin-notice-horizontal .admin-text {
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  font-size: 13px;
  color: #ffd700;
}

.submission-closed-notice {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  justify-content: center;
}

.submission-closed-notice .closed-icon {
  font-size: 14px;
}

.submission-closed-notice .closed-text {
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  font-size: 13px;
  color: #ff6b6b;
}

.status-content-horizontal {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.status-item-horizontal {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.status-item-horizontal .status-label {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 13px;
  color: #ffffff;
}

.status-item-horizontal .status-value {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 13px;
  color: #0b5afe;
}

.status-item-horizontal .status-remaining {
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(11, 90, 254, 0.1);
  border: 1px solid rgba(11, 90, 254, 0.3);
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
}

.form-row {
  display: flex;
  gap: 1rem;
  width: 100%;
}

.form-row .form-group {
  flex: 1;
  min-width: 0;
}

.submission-meta-row {
  align-items: stretch;
}

.submission-note-group,
.card-code-form-group {
  flex-basis: 0;
}

.desktop-card-code-panel {
  min-height: 94px;
  height: 100%;
  border: 1px solid rgba(39, 39, 42, 0.8);
  border-radius: 12px;
  background: rgba(24, 24, 27, 0.35);
  padding: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.mobile-card-code-chip,
.mobile-card-code-button {
  display: none;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-shrink: 0; /* 防止被压缩 */
  position: relative;
  z-index: 10;
}

.form-group label {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 0.25rem;
}

.input-wrapper {
  width: 100%;
}

.form-input,
.form-select {
  background: #040e15;
  border: 1px solid #242f38;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  width: 100%;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #0b5afe;
}

/* 平台选择按钮样式 */
.platform-selection-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.platform-selection {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* 网易云音乐登录选项 - 内联风格 */
.netease-options {
  position: relative;
  background: transparent;
  border-radius: 0;
  padding: 0;
  border: none;
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1;
  min-width: 300px;
  justify-content: center;
}

.netease-options:hover {
  background: transparent;
  border-color: transparent;
}

.netease-options::before {
  display: none;
}

.login-entry {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  background: transparent;
  padding: 0;
  border: none;
}

.login-desc {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.login-title {
  font-size: 13px;
  font-weight: 500;
  color: #a1a1aa;
  margin: 0;
}

.login-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  margin: 2px 0 0 0;
  line-height: 1.3;
}

.login-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border: none;
  padding: 0.45rem 0.85rem;
  border-radius: 7px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.15);
}

.login-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 5px 14px rgba(59, 130, 246, 0.25);
  filter: brightness(1.1);
}

.qq-login-btn {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  box-shadow: 0 4px 10px rgba(6, 182, 212, 0.15);
}

.qq-login-btn:hover {
  box-shadow: 0 5px 14px rgba(6, 182, 212, 0.25);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.header-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

.login-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.import-btn {
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.45rem 0.75rem;
  border-radius: 7px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.import-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.user-status {
  display: flex;
  flex-direction: column;
}

.user-compact-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.1);
}

.qq-user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 50%;
  color: #22d3ee;
  background: rgba(6, 182, 212, 0.12);
  border: 1.5px solid rgba(6, 182, 212, 0.22);
}

.user-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-actions-row {
  display: flex;
  gap: 0.4rem;
}

.action-btn-compact {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  white-space: nowrap;
}

.action-btn-compact:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.12);
}

.audio-waveform {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 24px;
}

.audio-waveform .wave-bar {
  display: block;
  width: 3px;
  height: 100%;
  background: linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: 2px;
  animation: wave 1.2s ease-in-out infinite;
}

.audio-waveform .wave-bar:nth-child(1) {
  animation-delay: 0s;
  height: 45%;
}
.audio-waveform .wave-bar:nth-child(2) {
  animation-delay: 0.1s;
  height: 70%;
}
.audio-waveform .wave-bar:nth-child(3) {
  animation-delay: 0.2s;
  height: 100%;
}
.audio-waveform .wave-bar:nth-child(4) {
  animation-delay: 0.3s;
  height: 60%;
}
.audio-waveform .wave-bar:nth-child(5) {
  animation-delay: 0.4s;
  height: 40%;
}

@keyframes wave {
  0%,
  100% {
    transform: scaleY(0.3);
    opacity: 0.5;
  }
  50% {
    transform: scaleY(1);
    opacity: 1;
  }
}

.audio-match-primary-btn,
.audio-match-cancel-btn,
.audio-match-record-btn,
.audio-match-result-item {
  transition: all 0.2s ease;
}

.audio-match-primary-btn {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  border: none;
  border-radius: 12px;
  padding: 0.875rem 2rem;
  color: #ffffff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
}

.audio-match-primary-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.45);
}

.audio-match-primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.audio-match-record-btn {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  border: none;
  border-radius: 12px;
  padding: 0.875rem 2rem;
  color: #ffffff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);
  display: flex;
  align-items: center;
  gap: 8px;
}

.audio-match-record-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(220, 38, 38, 0.45);
}

.recording-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffffff;
  animation: pulse-dot 1s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}

.audio-match-cancel-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 0.875rem 1.5rem;
  color: #a1a1aa;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
}

.audio-match-cancel-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #e4e4e7;
  border-color: rgba(255, 255, 255, 0.15);
}

.audio-match-result-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 0.95rem 1rem;
  cursor: pointer;
}

.audio-match-result-item:hover {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(96, 165, 250, 0.22);
  transform: translateY(-1px);
}

.search-type-switch {
  display: flex;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 2px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.radio-label {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.radio-label.active {
  color: #ffffff;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.radio-label input {
  display: none;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.logout-btn:hover {
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.05);
}

.platform-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 0.45rem 0.85rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.platform-btn.active {
  background: linear-gradient(180deg, #0043f8 0%, #0075f8 100%);
  border-color: rgba(255, 255, 255, 0.16);
  color: #ffffff;
}

.platform-btn:hover:not(.active) {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
}

/* 音源状态显示 */
.source-status-display {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
  backdrop-filter: blur(10px);
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.status-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  font-family: 'MiSans', sans-serif;
}

.status-summary {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
}

.status-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.source-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-size: 12px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
}

.source-item.healthy {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.3);
  color: #4ade80;
}

.source-item.unhealthy {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.source-item.checking {
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.3);
  color: #fbbf24;
}

.source-item.current {
  box-shadow: 0 0 0 2px rgba(11, 90, 254, 0.4);
  transform: scale(1.02);
}

.source-name {
  font-weight: 600;
}

.source-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.source-item.healthy .source-indicator {
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
}

.source-item.unhealthy .source-indicator {
  background: #ef4444;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
}

.source-item.checking .source-indicator {
  background: #fbbf24;
  box-shadow: 0 0 6px rgba(251, 191, 36, 0.6);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #f87171;
  font-size: 12px;
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
}

/* 搜索结果容器样式 */
.search-results-container {
  flex: 1;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 13px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0.5rem 1rem 1rem 1rem;
  position: relative;
  z-index: 1;
}

.results-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 1rem;
  min-height: 200px; /* 添加最小高度 */
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(11, 90, 254, 0.2);
  border-top-color: #0b5afe;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  color: rgba(255, 255, 255, 0.6);
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  margin: 0;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 搜索结果列表 */
.results-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.results-grid {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-right: 0.5rem;
  min-height: 0;
}

/* 滚动条样式 */
.results-grid::-webkit-scrollbar {
  width: 6px;
}

.results-grid::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.results-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.results-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* 空状态和初始状态 */
.empty-state,
.initial-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  gap: 0.75rem;
  padding: 1.5rem;
  min-height: 200px; /* 增加最小高度 */
}

.empty-icon,
.initial-icon {
  font-size: 2.5rem;
  margin-bottom: 0.25rem;
}

.empty-text,
.initial-text {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 15px;
  color: #ffffff;
  margin: 0;
}

.empty-hint,
.initial-hint {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  margin: 0;
}

/* 搜索插图样式 */
.search-illustration {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 120px;
}

.search-svg {
  width: 25%;
  max-width: 300px;
  min-width: 150px;
  height: auto;
  object-fit: contain;
  opacity: 0.8;
}

/* 手动输入触发按钮 */
.manual-input-trigger {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.manual-submit-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1.5rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.3s ease;
}

.manual-submit-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.form-notice {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 0.5rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.submit-button {
  background: linear-gradient(180deg, #0043f8 0%, #0075f8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1.5rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.3s ease;
}

.submit-button:hover {
  transform: translateY(-2px);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.alert-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.alert-header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.alert-icon {
  color: #f59e0b;
  flex-shrink: 0;
}

.alert-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: #ffffff;
}

.alert-content {
  margin-bottom: 1rem;
}

.similar-songs-list {
  margin-bottom: 0.5rem;
  max-height: 120px;
  overflow-y: auto;
}

.similar-song-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.similar-song-item:last-child {
  border-bottom: none;
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-title {
  margin: 0 0 0.25rem 0;
  font-size: 14px;
  color: #ffffff;
  font-weight: 500;
}

.song-actions {
  margin-left: 1rem;
  flex-shrink: 0;
}

.vote-btn.small,
.replay-btn.small {
  padding: 0.3rem 0.6rem;
  font-size: 12px;
}

/* 歌曲状态样式 */
.song-status {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  margin-left: 0.5rem;
}

.status-played {
  color: #ef4444;
}

.status-scheduled {
  color: #f59e0b;
}

.alert-hint {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  margin-top: 0.5rem;
}

.voted-status {
  color: #10b981;
  font-size: 14px;
  font-weight: 600;
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.alert-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.vote-btn {
  background: linear-gradient(180deg, #0043f8 0%, #0075f8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.vote-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 67, 248, 0.3);
}

.vote-btn:disabled {
  background: rgba(255, 255, 255, 0.2);
  cursor: not-allowed;
  transform: none;
}

.ignore-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

/* 桌面端继续投稿按钮 */
.desktop-continue-btn {
  display: none;
}

/* 移动端继续投稿按钮 */
.mobile-continue-actions {
  display: block;
}

.mobile-continue-btn {
  display: block;
}

/* 宽屏时的样式 */
@media (min-width: 768px) {
  .desktop-continue-btn {
    display: inline-flex;
    padding: 6px 12px;
    font-size: 12px;
    border-radius: 6px;
  }

  .mobile-continue-actions {
    display: none;
  }

  .similar-songs-list {
    max-height: 80px;
  }
}

/* 移动端时增加相似歌曲列表高度 */
@media (max-width: 767px) {
  .similar-songs-list {
    max-height: 150px;
  }
}

/* 动画样式 */
.results-fade-enter-active,
.results-fade-leave-active {
  transition: all 0.3s ease;
}

.results-fade-enter-from,
.results-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.result-item-enter-active {
  transition: all 0.4s ease;
}

.result-item-leave-active {
  transition: all 0.3s ease;
}

.result-item-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.result-item-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.result-item-move {
  transition: transform 0.3s ease;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  transition: all 0.3s ease;
}

.modal-content {
  background: rgba(20, 20, 25, 0.95);
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transform-origin: center;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.02);
}

.modal-header h3 {
  margin: 0;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 18px;
  letter-spacing: 0.02em;
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  transform: rotate(90deg);
}

.modal-body {
  padding: 1.5rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
}

.btn {
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn:active {
  transform: scale(0.96);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.2);
}

.btn-primary {
  background: linear-gradient(135deg, #0043f8 0%, #0075f8 100%);
  border-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 67, 248, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 67, 248, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.readonly {
  background: rgba(0, 0, 0, 0.2) !important;
  color: rgba(255, 255, 255, 0.5) !important;
  cursor: not-allowed;
  border-color: transparent !important;
}

/* 弹窗动画 */
.modal-animation-enter-active,
.modal-animation-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-animation-enter-from,
.modal-animation-leave-to {
  opacity: 0;
}

.modal-animation-enter-from .modal-content,
.modal-animation-leave-to .modal-content {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

.result-item {
  display: flex;
  padding: 0.6rem 1rem; /* 缩小内边距以提高信息密度 */
  gap: 1rem;
  transition: all 0.2s ease;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.result-item:last-child {
  border-bottom: none;
}

.result-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.result-cover {
  width: 70px;
  height: 70px;
  position: relative;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  background: #18181b;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.result-item:hover .cover-img {
  transform: scale(1.1);
}

.play-overlay-container {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 2;
}

.result-item:hover .play-overlay-container {
  opacity: 1;
}

.play-button-wrapper {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
}

.play-icon {
  fill: currentColor;
  margin-left: 2px;
}

.result-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.result-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 15px;
  color: #ffffff;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.result-artist {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  margin: 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-album,
.result-quality,
.result-pay {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  margin: 0.15rem 0;
}

.result-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: row;
  gap: 0.8rem;
  margin-right: 0.25rem;
  flex-shrink: 0;
}

.cloud-disk-btn {
  background: linear-gradient(180deg, #ec4141 0%, #d83030 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  -webkit-appearance: none;
  appearance: none;
}

.cloud-disk-btn:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 4px 12px rgba(236, 65, 65, 0.5);
  background: linear-gradient(180deg, #d83030 0%, #c52020 100%);
  border-color: rgba(255, 255, 255, 0.4);
}

.cloud-disk-btn:active {
  transform: translateY(0) scale(0.95);
  box-shadow: 0 2px 4px rgba(236, 65, 65, 0.3);
}

.similar-song-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
}

.similar-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
}

.similar-text.status-played {
  color: #ef4444;
  font-weight: 600;
}

.similar-text.status-scheduled {
  color: #f59e0b;
  font-weight: 600;
}

.like-btn {
  background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  padding: 0.4rem 0.8rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transition: all 0.2s ease;
}

.like-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.like-btn:disabled {
  background: rgba(255, 255, 255, 0.2);
  cursor: not-allowed;
  transform: none;
}

.like-btn.disabled {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  cursor: not-allowed;
  opacity: 0.5;
}

.like-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.select-btn {
  background: linear-gradient(180deg, #0043f8 0%, #0075f8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

.replay-btn {
  background: rgba(0, 117, 248, 0.1);
  border: 1px solid rgba(0, 117, 248, 0.3);
  border-radius: 6px;
  padding: 0.4rem 0.8rem;
  color: #3b82f6;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.replay-btn:hover:not(:disabled) {
  background: rgba(0, 117, 248, 0.2);
  border-color: rgba(0, 117, 248, 0.5);
  color: #60a5fa;
  transform: translateY(-1px);
}

.replay-btn:disabled {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.3);
  cursor: not-allowed;
  transform: none;
}

/* 音频播放器现在使用全局组件 */

/* 手动提交按钮样式 */
.no-results-action {
  margin-top: 1rem;
  text-align: center;
  padding: 1rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.manual-submit-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1.5rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.3s ease;
}

.manual-submit-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

/* 手动输入区域样式 */
.manual-input-section {
  margin-top: 2rem;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 13px;
  padding: 1.5rem;
}

.manual-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 18px;
  margin-bottom: 1rem;
  color: #ffffff;
}

.manual-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.manual-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.manual-cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.manual-cancel-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.manual-confirm-btn {
  background: linear-gradient(180deg, #0043f8 0%, #0075f8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.manual-confirm-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 67, 248, 0.3);
}

.manual-confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 响应式调整 */
@media (max-width: 768px) {
  /* Netease Options Mobile Optimization */
  .netease-options {
    padding: 0.75rem;
  }

  .user-compact-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .user-profile {
    width: 100%;
    justify-content: flex-start;
  }

  .search-type-switch {
    width: 100%;
    display: flex;
  }

  .radio-label {
    flex: 1;
    text-align: center;
  }

  .user-actions-row {
    display: flex;
    flex-direction: row;
    gap: 0.5rem;
    width: 100%;
  }

  /* 移动端下让按钮平分宽度 */
  .user-actions-row .action-btn-compact {
    flex: 1;
    width: auto;
    justify-content: center;
    padding: 0.6rem 0.4rem;
  }

  /* 移动端显示/隐藏控制 */
  .desktop-only-rules {
    display: none;
  }

  .mobile-only-rules {
    display: block;
  }

  .request-form {
    flex-direction: column;
    height: auto;
    max-height: none;
    overflow: visible;
    padding: 0; /* 移除可能的内边距 */
  }

  .rules-section {
    width: 100%;
    height: auto;
    margin-bottom: 1.5rem;
    padding: 1.25rem;
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
  }

  .rules-title {
    font-size: 15px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 1.25rem;
    letter-spacing: normal;
  }

  .rules-icon {
    display: block;
    color: #f59e0b;
  }

  .form-container {
    width: 100%;
    flex: none; /* 改为不占用flex空间，让内容自然撑开 */
    display: flex;
    flex-direction: column;
    height: auto;
    overflow-x: hidden; /* 防止横向溢出 */
    max-width: 100%; /* 确保不超过父容器宽度 */
  }

  .song-request-form {
    flex: none; /* 改为不占用flex空间，让内容自然撑开 */
    display: flex;
    flex-direction: column;
    height: auto;
    gap: 1.25rem;
    max-width: 100%; /* 确保不超过父容器宽度 */
  }

  .form-header-row {
    flex-direction: column;
    gap: 1rem;
    width: 100%; /* 确保占满宽度 */
    max-width: 100%; /* 防止超出 */
  }

  .search-results-container {
    flex: none; /* 改为不占用flex空间，让内容自然撑开 */
    height: auto;
    max-height: none; /* 移除最大高度限制 */
    padding: 0.75rem;
    overflow: visible;
    display: flex;
    flex-direction: column;
    margin-bottom: 2rem;
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    /* 允许容器内容触发页面滚动 */
    touch-action: pan-y;
  }

  .results-content {
    height: auto;
    min-height: 200px; /* 减小最小高度 */
    max-height: none; /* 移除最大高度限制 */
    overflow: visible;
    flex: none; /* 改为不占用flex空间 */
  }

  /* 移动端搜索区域 */
  .form-header-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    margin-bottom: 0;
  }

  .login-entry {
    flex-direction: column;
    align-items: stretch;
    padding: 0.85rem;
    gap: 0.6rem;
  }

  .login-desc {
    width: 100%;
  }

  .login-title {
    /* 不缩小字号 */
  }

  .login-hint {
    white-space: normal;
    word-break: break-word;
    line-height: 1.3;
  }

  .login-actions {
    width: 100%;
    justify-content: flex-start;
    gap: 0.5rem;
  }

  .login-btn,
  .import-btn {
    flex: 1;
    justify-content: center;
    padding: 0.5rem 0.4rem;
  }

  .search-section {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
    flex: none;
    width: 100%;
    min-width: unset; /* 移除桌面端的最小宽度限制 */
  }

  .collaborators-section {
    flex-direction: row;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    flex: none;
    width: 100%;
    flex-wrap: wrap;
  }

  .section-label {
    font-size: 14px;
  }

  .search-label {
    font-size: 14px;
  }

  .search-input-group {
    flex-direction: row;
    gap: 0.5rem;
    width: 100%; /* 确保占满父容器宽度 */
    max-width: 100%; /* 防止超出 */
  }

  .search-input {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    font-size: 15px;
    flex: 1;
    min-width: 0; /* 允许输入框在必要时缩小 */
    max-width: 100%; /* 防止超出 */
  }

  .search-button {
    padding: 0.75rem 1rem; /* 减小按钮的左右内边距 */
    border-radius: 12px;
    flex-shrink: 0; /* 防止按钮被压缩 */
    white-space: nowrap; /* 防止按钮文字换行 */
    font-size: 14px; /* 稍微减小字体 */
  }

  .audio-match-btn {
    padding: 0.75rem;
    min-width: 48px;
  }

  .audio-match-btn .btn-text {
    display: none;
  }

  /* 移动端平台选择按钮 */
  .platform-selection-container {
    flex-direction: column;
    align-items: stretch;
  }

  .platform-selection {
    background: rgba(0, 0, 0, 0.2);
    padding: 4px;
    border-radius: 12px;
    margin-bottom: 0.5rem;
    display: flex;
    overflow: visible;
  }

  .platform-btn {
    flex: 1;
    padding: 0.5rem;
    font-size: 13px;
    border-radius: 10px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    min-width: auto;
  }

  .platform-btn.active {
    background: #0b5afe;
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(11, 90, 254, 0.3);
  }

  /* 移动端音源状态显示 */
  .source-status-display {
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .status-header {
    margin-bottom: 0.5rem;
  }

  .status-title {
    font-size: 13px;
  }

  .status-summary {
    font-size: 11px;
    padding: 0.2rem 0.4rem;
  }

  .status-sources {
    gap: 0.4rem;
  }

  .source-item {
    padding: 0.4rem 0.6rem;
    font-size: 11px;
  }

  .source-indicator {
    width: 6px;
    height: 6px;
  }

  .error-message {
    margin-top: 0.5rem;
    padding: 0.4rem 0.6rem;
    font-size: 11px;
  }

  .form-row {
    flex-direction: column;
    gap: 1rem;
  }

  .submission-meta-row {
    gap: 0.75rem;
  }

  .card-code-form-group {
    margin-bottom: 0;
  }

  .mobile-hidden-card-code-group {
    display: none;
  }

  .desktop-card-code-panel {
    display: none;
  }

  .mobile-card-code-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 28px;
    border-radius: 999px;
    border: 1px solid rgba(113, 113, 122, 0.45);
    background: rgba(39, 39, 42, 0.75);
    color: rgba(212, 212, 216, 0.9);
    padding: 0.25rem 0.55rem;
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
  }

  .mobile-card-code-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-height: 42px;
    border-radius: 12px;
    border: 1px solid rgba(113, 113, 122, 0.4);
    background: rgba(24, 24, 27, 0.65);
    color: rgba(228, 228, 231, 0.9);
    padding: 0.65rem 0.85rem;
    font-size: 13px;
    font-weight: 800;
  }

  .mobile-card-code-chip.is-required,
  .mobile-card-code-button.is-required {
    border-color: rgba(234, 179, 8, 0.35);
    background: rgba(234, 179, 8, 0.1);
    color: #fde68a;
  }

  .mobile-card-code-chip.has-code,
  .mobile-card-code-button.has-code {
    border-color: rgba(234, 179, 8, 0.3);
    color: #facc15;
  }

  .mobile-card-code-chip.is-valid,
  .mobile-card-code-button.is-valid {
    border-color: rgba(16, 185, 129, 0.35);
    background: rgba(16, 185, 129, 0.1);
    color: #6ee7b7;
  }

  .mobile-card-code-chip.is-invalid,
  .mobile-card-code-button.is-invalid {
    border-color: rgba(248, 113, 113, 0.35);
    background: rgba(248, 113, 113, 0.1);
    color: #fca5a5;
  }

  .form-group label {
    font-size: 18px;
  }

  .form-actions {
    justify-content: center;
  }

  .submit-button {
    width: 100%;
    padding: 0.75rem;
  }

  .alert-actions {
    flex-direction: column;
    gap: 0.5rem;
  }

  .vote-btn,
  .ignore-btn {
    width: 100%;
  }

  .audio-player {
    flex-direction: column;
    padding: 0.75rem;
  }

  .player-info {
    width: 100%;
  }

  .audio-player audio {
    width: 100%;
  }

  .close-player {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
  }

  /* 移动端平台选择Tab */
  .tab-header {
    gap: 2px;
  }

  .tab-btn {
    padding: 0.6rem 0.8rem;
    font-size: 13px;
  }

  /* 移动端搜索结果优化 */
  .result-item {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    margin-bottom: 0.5rem;
    padding: 10px;
    flex-direction: row;
    gap: 10px;
    align-items: center;
  }

  .result-cover {
    width: 64px;
    height: 64px;
    align-self: flex-start;
  }

  .result-info {
    text-align: left;
    flex: 1;
  }

  .result-title {
    font-size: 15px;
    font-weight: 600;
  }

  .result-artist {
    font-size: 12px;
    opacity: 0.6;
    margin: 4px 0;
  }

  .result-actions {
    flex-direction: row;
    width: auto;
  }

  .select-btn {
    padding: 0.5rem 0.75rem;
    font-size: 12px;
    border-radius: 10px;
    width: auto;
  }

  /* 移动端弹窗优化 */
  .modal-content {
    width: 95%;
    max-width: none;
  }

  .modal-actions {
    flex-direction: column;
    gap: 0.75rem;
  }

  .btn {
    width: 100%;
    padding: 0.75rem;
  }

  /* 移动端搜索插图 */
  .search-svg {
    width: 50%;
    max-width: 250px;
    min-width: 120px;
  }

  .search-illustration {
    padding: 0.5rem;
    min-height: 120px;
  }

  /* 移动端搜索结果列表 */
  .results-list {
    flex: none; /* 改为不占用flex空间 */
    height: auto;
    max-height: none; /* 移除最大高度限制 */
    overflow: visible;
  }

  .results-grid {
    max-height: 60vh; /* 保持合理的最大高度，防止结果过长 */
    overflow-y: auto; /* 当结果超过最大高度时允许滚动 */
    -webkit-overflow-scrolling: touch;
    padding-bottom: 2rem; /* 减小底部内边距 */
    padding-right: 0;
    /* 优化触摸滚动体验 */
    overscroll-behavior: contain; /* 防止滚动穿透 */
  }

  /* 当没有搜索结果时，移除滚动容器的高度限制 */
  .initial-state,
  .empty-state,
  .loading-state {
    min-height: 300px;
    max-height: none;
    overflow: visible;
  }

  /* 移动端期望排期选择 */
  .form-group {
    margin-bottom: 1rem;
    z-index: 10;
    position: relative;
  }

  .form-select {
    position: relative;
    z-index: 10;
  }
}

/* 网易云音乐账号加载状态样式 */
.netease-loading-state {
  padding: 0;
  background-color: transparent;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin: 0;
  border: none;
  height: 32px; /* 匹配旁边按钮的高度 */
}

.loading-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.netease-loading-state .loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(239, 68, 68, 0.2);
  border-top-color: #ef4444;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.netease-loading-state .loading-text {
  color: #a1a1aa;
  font-size: 13px;
  font-weight: 500;
  margin: 0;
}

/* URL验证状态样式 */
.validation-loading {
  color: #fbbf24;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.validation-error {
  color: #ef4444;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.validation-success {
  color: #10b981;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.form-input.error {
  border-color: #ef4444;
  box-shadow: 0 0 0 1px #ef4444;
}

.import-semester-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 0.6rem 0.8rem;
  color: rgba(255, 255, 255, 0.8);
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  height: 42px; /* 使匹配搜索输入框的大致高度 */
  flex-shrink: 0;
}

.import-semester-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.2);
}

@media (max-width: 768px) {
  .import-semester-btn {
    width: 100%;
    justify-content: center;
  }
}

.bilibili-episodes-container {
  max-height: 60vh;
  overflow-y: auto;
}

.video-info {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 1rem;
}

.video-info h3 {
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  font-size: 16px;
  color: #fff;
  margin-bottom: 0.5rem;
}

.video-author {
  font-family: 'MiSans', sans-serif;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.episodes-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0 1rem 1rem;
}

.episode-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.episode-item:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateX(4px);
}

.episode-number {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.1);
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  min-width: 40px;
  text-align: center;
}

.episode-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.episode-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  font-size: 14px;
  color: #fff;
}

.episode-duration {
  font-family: 'MiSans', sans-serif;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

/* 专辑详情样式 */
.clickable-album {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
  position: relative;
}

.clickable-album:hover .album-name {
  color: #3b82f6;
  text-decoration: underline;
}

.album-label {
  color: rgba(255, 255, 255, 0.4);
}

.album-link-icon {
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.clickable-album:hover .album-link-icon {
  opacity: 1;
}
</style>
