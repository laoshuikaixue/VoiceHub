<template>
  <div class="home">
    <Transition name="home-boot-loader">
      <AppLoadingScreen
        v-if="showBootLoading"
        :message="bootMessage"
        :progress="bootProgress"
        title="Loading..."
      />
    </Transition>

    <div class="ellipse-effect" />
    <div class="main-content">
      <div class="top-bar">
        <div class="logo-section">
          <NuxtLink class="logo-link" to="/">
            <img alt="VoiceHub Logo" class="logo-image" :src="getLogo()" />
          </NuxtLink>
          <!-- 横线和学校logo -->
          <div v-if="schoolLogoHomeDisplayUrl" class="logo-divider-container">
            <div class="logo-divider" />
            <img :src="schoolLogoHomeDisplayUrl" :alt="locale.schoolLogoAlt" class="school-logo" />
          </div>
        </div>

        <!-- 用户信息区域 -->
        <div class="user-section">
          <ClientOnly>
            <div class="user-actions-row">
              <div class="theme-switcher">
                <button
                  type="button"
                  class="theme-switcher-trigger"
                  :class="{ 'is-open': showThemeMenu }"
                  :aria-label="'主题'"
                  :aria-expanded="showThemeMenu"
                  @click="toggleThemeMenu"
                >
                  <Icon name="gift" :size="19" />
                </button>

                <Transition name="dropdown-fade">
                  <div v-if="showThemeMenu" class="theme-dropdown" role="listbox">
                    <button
                      v-for="themeItem in themes"
                      :key="themeItem"
                      type="button"
                      role="option"
                      class="theme-option"
                      :class="{ 'is-active': selectedTheme === themeItem }"
                      :aria-selected="selectedTheme === themeItem"
                      @click="selectTheme(themeItem)"
                    >
                      {{ getThemeLabel(themeItem) }}
                    </button>
                  </div>
                </Transition>
              </div>

              <div class="language-switcher">
                <button
                  type="button"
                  class="language-switcher-trigger"
                  :class="{ 'is-open': showLanguageMenu }"
                  :aria-label="common.language"
                  :aria-expanded="showLanguageMenu"
                  aria-haspopup="listbox"
                  @click="toggleLanguageMenu"
                >
                  <Icon name="translate" :size="19" />
                </button>

                <Transition name="dropdown-fade">
                  <div v-if="showLanguageMenu" class="language-dropdown" role="listbox">
                    <button
                      type="button"
                      role="option"
                      class="language-option"
                      :class="{ 'is-active': isFollowingSystem }"
                      :aria-selected="isFollowingSystem"
                      @click="selectFollowSystem"
                    >
                      <span class="language-option-label">{{ common.followSystem }}</span>
                    </button>
                    <button
                      v-for="localeOption in supportedLocales"
                      :key="localeOption.code"
                      type="button"
                      role="option"
                      class="language-option"
                      :class="{ 'is-active': currentLocale === localeOption.code }"
                      :aria-selected="currentLocale === localeOption.code"
                      @click="selectLocale(localeOption.code)"
                    >
                      <span class="language-option-label">{{ localeOption.label }}</span>
                    </button>
                  </div>
                </Transition>
              </div>

              <div v-if="isClientAuthenticated" class="user-info">
                <div class="user-details-desktop">
                  <span class="user-name">{{ user?.name || locale.userFallback }}</span>
                  <span v-if="isAdmin" class="user-badge admin">{{ roleName }}</span>
                  <span v-else class="user-badge">{{ userClassInfo }}</span>
                </div>

                <div class="user-avatar-wrapper" @click="toggleUserActions">
                  <img
                    v-if="user?.avatar && !avatarError"
                    :src="user.avatar"
                    class="user-avatar"
                    @error="avatarError = true"
                  >
                  <div v-else class="user-avatar-placeholder">
                    {{ user?.name?.[0] || 'U' }}
                  </div>
                </div>

                <Transition name="dropdown-fade">
                  <div v-if="showUserActions" class="user-actions-dropdown">
                    <NuxtLink class="action-item" to="/account">
                      <Icon name="user" :size="16" />
                      <span>{{ locale.account }}</span>
                    </NuxtLink>
                    <NuxtLink v-if="isAdmin" class="action-item" to="/dashboard">
                      <Icon name="settings" :size="16" />
                      <span>{{ locale.dashboard }}</span>
                    </NuxtLink>
                    <button class="action-item logout" @click="handleLogout">
                      <Icon name="logout" :size="16" />
                      <span>{{ locale.logout }}</span>
                    </button>
                  </div>
                </Transition>
              </div>

              <div v-else class="login-options">
                <NuxtLink class="login-btn" to="/login">
                  <Icon name="user" :size="16" />
                  <span>{{ locale.login }}</span>
                </NuxtLink>
              </div>
            </div>
          </ClientOnly>
        </div>
      </div>

      <div v-if="siteTitle" class="site-title">
        <div class="title-container">
          <h2 class="main-title">{{ siteTitle }}</h2>
          <div class="title-divider" />
          <span class="sub-title">{{ locale.subtitle }}</span>
        </div>
      </div>

      <!-- 中间主体内容区域 -->
      <div class="content-area">
        <!-- 选项卡区域-->
        <div class="tabs-row">
          <div
            :class="{ active: activeTab === 'schedule' }"
            class="section-tab"
            @click="handleTabClick('schedule')"
          >
            <Icon class="tab-icon" name="calendar" :size="20" />
            <span class="tab-text">{{ locale.tabs.schedule }}</span>
          </div>
          <div
            :class="{ active: activeTab === 'songs' }"
            class="section-tab"
            @click="handleTabClick('songs')"
          >
            <Icon class="tab-icon" name="music" :size="20" />
            <span class="tab-text">{{ locale.tabs.songs }}</span>
          </div>
          <div
            :class="{ active: activeTab === 'request' }"
            class="section-tab"
            @click="handleTabClick('request')"
          >
            <Icon class="tab-icon" name="search" :size="20" />
            <span class="tab-text">{{ locale.tabs.request }}</span>
          </div>
          <ClientOnly>
            <div
              ref="notificationTabRef"
              :class="{ active: activeTab === 'notification', disabled: !isClientAuthenticated }"
              class="section-tab"
              data-tab="notification"
              @click="isClientAuthenticated ? handleTabClick('notification') : showLoginNotice()"
            >
              <div class="icon-wrapper">
                <Icon class="tab-icon" name="message-circle" :size="20" />
                <span
                  v-if="isClientAuthenticated && hasUnreadNotifications"
                  class="notification-badge-tab"
                />
              </div>
              <span class="tab-text">
                {{ locale.tabs.notification }}
                <span
                  v-if="isClientAuthenticated && hasUnreadNotifications"
                  class="notification-badge-desktop"
                />
              </span>
            </div>
            <template #fallback>
              <div class="section-tab disabled" data-tab="notification">
                <Icon class="tab-icon" name="message-circle" :size="20" />
                <span class="tab-text">{{ locale.tabs.notification }}</span>
              </div>
            </template>
          </ClientOnly>
        </div>

        <!-- 内容区域 -->
        <div class="tab-content-container">
          <ClientOnly>
            <!-- 播出排期内容 -->
            <div v-if="activeTab === 'schedule'" key="schedule" class="tab-pane schedule-tab-pane">
              <div class="full-width">
                <SongsScheduleList
                  :error="error"
                  :loading="loading"
                  :schedules="publicSchedules"
                  @semester-change="handleSemesterChange"
                />
              </div>
            </div>

            <!-- 歌曲列表内容 -->
            <div v-else-if="activeTab === 'songs'" key="songs" class="tab-pane">
              <div class="song-list-container">
                <SongsSongList
                  :error="error"
                  :is-admin="isAdmin"
                  :loading="loading"
                  :songs="filteredSongs"
                  @refresh="refreshSongs"
                  @vote="handleVote"
                  @withdraw="handleWithdraw"
                  @cancel-replay="handleCancelReplay"
                  @semester-change="handleSemesterChange"
                />
              </div>
            </div>

            <!-- 投稿歌曲内容 -->
            <div v-else-if="activeTab === 'request'" key="request" class="tab-pane request-pane">
              <SongsRequestForm
                ref="requestFormRef"
                :loading="loading"
                @request="handleRequest"
                @vote="handleVote"
              />
            </div>

            <!-- 通知内容 -->
            <div
              v-else-if="activeTab === 'notification'"
              key="notification"
              class="tab-pane notification-pane"
            >
              <div v-if="!isClientAuthenticated" class="login-required-container">
                <div class="login-required-content">
                  <div class="login-icon">🔒</div>
                  <h3>{{ locale.loginRequired }}</h3>
                  <p>{{ locale.loginRequiredDesc }}</p>
                  <button class="login-button" @click="navigateToLogin">{{ locale.loginNow }}</button>
                </div>
              </div>
              <div v-else class="notification-container">
                <!-- 标题和设置按钮-->
                <div class="notification-header">
                  <div class="notification-header-main">
                    <h2 class="notification-title">{{ locale.notificationCenter }}</h2>
                    <div
                      :aria-label="locale.notificationFilterLabel"
                      class="notification-filter"
                      role="group"
                    >
                      <button
                        :aria-pressed="notificationsService.currentFilter.value === 'all'"
                        :class="{ active: notificationsService.currentFilter.value === 'all' }"
                        type="button"
                        @click="notificationsService.changeFilter('all')"
                      >
                        {{ locale.allNotifications }}
                      </button>
                      <button
                        :aria-pressed="notificationsService.currentFilter.value === 'unread'"
                        :class="{ active: notificationsService.currentFilter.value === 'unread' }"
                        type="button"
                        @click="notificationsService.changeFilter('unread')"
                      >
                        {{ locale.unread }}
                      </button>
                    </div>
                    <div class="notification-search">
                      <Icon :size="17" aria-hidden="true" name="search" />
                      <input
                        v-model="notificationSearchInput"
                        :aria-label="locale.searchNotifications"
                        :placeholder="locale.searchNotificationsPlaceholder"
                        autocomplete="off"
                        maxlength="100"
                        type="search"
                        @input="handleNotificationSearchInput"
                        @keydown.enter.prevent="runNotificationSearch"
                      >
                      <button
                        v-if="notificationSearchInput"
                        :aria-label="locale.clearNotificationSearch"
                        :title="locale.clearNotificationSearch"
                        type="button"
                        @click="clearNotificationSearch"
                      >
                        <Icon :size="15" name="x" />
                      </button>
                    </div>
                  </div>
                  <div class="notification-header-actions">
                    <button
                      :class="{ disabled: !hasUnreadNotifications }"
                      :disabled="!hasUnreadNotifications"
                      class="mark-all-read-header"
                      @click="markAllNotificationsAsRead"
                    >
                      <Icon :size="15" name="check" />
                      <span>{{ locale.markAllRead }}</span>
                    </button>
                    <button class="settings-icon" @click="toggleNotificationSettings">
                      <svg
                        fill="none"
                        height="20"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                        width="20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <circle cx="12" cy="12" r="3" />
                        <path
                          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <button
                  :aria-label="formatLocaleValue(
                    locale.unreadCountSummary,
                    notificationsService.unreadCount.value
                  )"
                  :class="{ empty: !hasUnreadNotifications }"
                  :disabled="!hasUnreadNotifications"
                  class="notification-unread-summary"
                  type="button"
                  @click="notificationsService.changeFilter('unread')"
                >
                  <span class="notification-unread-summary-icon">
                    <Icon :size="21" aria-hidden="true" name="bell-ring" />
                  </span>
                  <span class="notification-unread-summary-copy">
                    <span>{{ locale.unreadOverview }}</span>
                    <strong>
                      {{
                        formatLocaleValue(
                          locale.unreadCountSummary,
                          notificationsService.unreadCount.value
                        )
                      }}
                    </strong>
                  </span>
                  <span v-if="hasUnreadNotifications" class="notification-unread-summary-action">
                    <span>{{ locale.viewUnreadNotifications }}</span>
                    <Icon :size="17" aria-hidden="true" name="chevron-right" />
                  </span>
                </button>

                <!-- 通知列表 -->
                <div class="notification-list">
                  <div v-if="notificationsLoading" class="loading-indicator">
                    <AppSpinner :size="32" />
                    <span>{{ locale.loading }}</span>
                  </div>

                  <div v-else-if="userNotifications.length === 0" class="empty-notification">
                    <div class="empty-icon">
                      <Icon :size="48" color="var(--text-muted)" name="bell" />
                    </div>
                    <p>
                      {{
                        notificationsService.currentSearch.value
                          ? locale.noMatchingNotifications
                          : notificationsService.currentFilter.value === 'unread'
                            ? locale.noUnreadNotifications
                            : locale.noNotifications
                      }}
                    </p>
                  </div>

                  <Transition mode="out-in" name="notification-list-fade">
                    <div
                      v-if="userNotifications.length > 0"
                      :key="`${notificationsService.currentPage.value}-${notificationsService.currentFilter.value}-${notificationsService.currentSearch.value}`"
                      class="notification-items"
                    >
                      <div
                        v-for="(notification, index) in userNotifications"
                        :key="notification.id"
                        :class="{ unread: !notification.read }"
                        :style="{ '--animation-delay': index * 0.1 + 's' }"
                        class="notification-card"
                        @click="viewNotification(notification)"
                      >
                        <div class="notification-card-header">
                          <div class="notification-icon-type">
                            <Icon
                              v-if="notification.type === 'SONG_SELECTED'"
                              :size="20"
                              color="var(--color-indigo-hover)"
                              name="check"
                            />
                            <Icon
                              v-else-if="notification.type === 'SONG_PLAYED'"
                              :size="20"
                              color="var(--color-success)"
                              name="play"
                            />
                            <Icon
                              v-else-if="notification.type === 'SONG_VOTED'"
                              :size="20"
                              color="var(--color-warning)"
                              name="thumbs-up"
                            />
                            <Icon
                              v-else-if="notification.type === 'SONG_REJECTED'"
                              :size="20"
                              color="var(--color-error)"
                              name="x-circle"
                            />
                            <Icon
                              v-else-if="notification.type === 'COLLABORATION_INVITE'"
                              :size="20"
                              color="var(--color-accent)"
                              name="users"
                            />
                            <Icon
                              v-else-if="notification.type === 'COLLABORATION_RESPONSE'"
                              :size="20"
                              color="var(--color-collab)"
                              name="message-circle"
                            />
                            <Icon v-else :size="20" color="var(--text-muted)" name="bell" />
                          </div>
                          <div class="notification-title-row">
                            <div class="notification-heading-row">
                              <div class="notification-title">
                                <span v-if="notification.type === 'SONG_SELECTED'">{{ locale.notificationTypes.SONG_SELECTED }}</span>
                                <span v-else-if="notification.type === 'SONG_PLAYED'"
                                  >{{ locale.notificationTypes.SONG_PLAYED }}</span
                                >
                                <span v-else-if="notification.type === 'SONG_VOTED'">{{ locale.notificationTypes.SONG_VOTED }}</span>
                                <span v-else-if="notification.type === 'SONG_REJECTED'"
                                  >{{ locale.notificationTypes.SONG_REJECTED }}</span
                                >
                                <span v-else-if="notification.type === 'COLLABORATION_INVITE'">
                                  {{ locale.notificationTypes.COLLABORATION_INVITE }}
                                  <span
                                    v-if="notification.handled"
                                    :class="[
                                      'status-tag',
                                      notification.status === 'ACCEPTED'
                                        ? 'accepted'
                                        : notification.status === 'INVALID'
                                          ? 'invalid'
                                          : 'rejected'
                                    ]"
                                  >
                                    {{
                                      notification.status === 'ACCEPTED'
                                        ? locale.inviteStatus.accepted
                                        : notification.status === 'INVALID'
                                          ? locale.inviteStatus.invalid
                                          : locale.inviteStatus.rejected
                                    }}
                                  </span>
                                </span>
                                <span v-else-if="notification.type === 'COLLABORATION_RESPONSE'"
                                  >{{ locale.notificationTypes.COLLABORATION_RESPONSE }}</span
                                >
                                <span v-else>{{ locale.notificationTypes.SYSTEM }}</span>
                                <span v-if="!notification.read" class="unread-indicator" />
                              </div>
                              <span
                                class="notification-read-status"
                                :class="notification.read ? 'is-read' : 'is-unread'"
                              >
                                <Icon :size="14" name="eye" />
                                {{ notification.read ? locale.read : locale.unread }}
                              </span>
                            </div>
                            <div class="notification-time">
                              {{ formatNotificationTime(notification.createdAt) }}
                            </div>
                            <div class="notification-sender">
                              <Icon :size="13" aria-hidden="true" name="user" />
                              <span>{{ locale.sender }}：{{ getNotificationSenderName(notification) }}</span>
                            </div>
                          </div>
                        </div>
                        <div class="notification-card-body">
                          <!-- 仅管理员手动发送的通知渲染 Markdown，系统自动通知含用户可控内容，保持纯文本 -->
                          <div
                            v-if="isAdminManualNotification(notification)"
                            class="notification-text markdown-body"
                            v-html="renderedNotificationMessages[notification.id]"
                          />
                          <div v-else class="notification-text">
                            {{ notification.message }}
                          </div>

                          <!-- 联合投稿邀请操作按钮-->
                          <div
                            v-if="
                              notification.type === 'COLLABORATION_INVITE' && !notification.handled
                            "
                            class="invite-actions"
                          >
                            <button
                              :disabled="notification.processing"
                              class="action-button accept-btn"
                              @click.stop="handleCollaborationReply(notification, true)"
                            >
                              {{ notification.processing ? locale.processing : locale.acceptInvite }}
                            </button>
                            <button
                              :disabled="notification.processing"
                              class="action-button reject-btn"
                              @click.stop="handleCollaborationReply(notification, false)"
                            >
                              {{ locale.reject }}
                            </button>
                          </div>
                        </div>
                        <div class="notification-card-actions">
                          <button
                            class="action-button delete"
                            :title="locale.delete"
                            @click.stop="deleteNotification(notification.id)"
                          >
                            <svg
                              fill="none"
                              height="16"
                              stroke="currentColor"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              viewBox="0 0 24 24"
                              width="16"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path
                                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                              />
                            </svg>
                            <span>{{ locale.delete }}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </Transition>
                </div>

                <!-- 分页控件 -->
                <div
                  v-if="notificationsService.totalCount.value > 0"
                  class="notification-pagination"
                >
                  <div class="pagination-info">
                    <span class="pagination-text">
                      {{
                        formatLocaleValue(
                          locale.paginationInfo,
                          notificationsService.totalCount.value,
                          notificationsService.currentPage.value,
                          notificationsService.totalPages.value
                        )
                      }}
                    </span>
                  </div>

                  <div class="pagination-controls">
                    <!-- 每页显示数量选择器-->
                    <div class="page-size-selector">
                      <label for="pageSize">{{ locale.pageSize }}</label>
                      <CustomSelect
                        id="pageSize"
                        :model-value="notificationsService.pageSize.value"
                        :options="pageSizeOptions"
                        class="page-size-custom-select"
                        @update:model-value="handlePageSizeChange"
                      />
                    </div>

                    <!-- 页码导航 -->
                    <div class="page-navigation">
                      <button
                        :disabled="
                          !notificationsService.hasPrevPage.value ||
                          notificationsService.isPaginationLoading.value
                        "
                        class="page-nav-button"
                        :title="locale.previousPage"
                        @click="notificationsService.prevPage()"
                      >
                        <svg
                          fill="none"
                          height="16"
                          stroke="currentColor"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          viewBox="0 0 24 24"
                          width="16"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </button>

                      <!-- 页码按钮 -->
                      <div class="page-numbers">
                        <template v-for="page in getVisiblePages()" :key="page">
                          <button
                            v-if="page !== '...'"
                            :class="[
                              'page-number-button',
                              { active: page === notificationsService.currentPage.value }
                            ]"
                            :disabled="notificationsService.isPaginationLoading.value"
                            @click="notificationsService.goToPage(page)"
                          >
                            {{ page }}
                          </button>
                          <span v-else class="page-ellipsis">...</span>
                        </template>
                      </div>

                      <button
                        :disabled="
                          !notificationsService.hasNextPage.value ||
                          notificationsService.isPaginationLoading.value
                        "
                        class="page-nav-button"
                        :title="locale.nextPage"
                        @click="notificationsService.nextPage()"
                      >
                        <svg
                          fill="none"
                          height="16"
                          stroke="currentColor"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          viewBox="0 0 24 24"
                          width="16"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <!-- 分页加载状态-->
                  <div
                    v-if="notificationsService.isPaginationLoading.value"
                    class="pagination-loading"
                  >
                    <AppSpinner :size="16" />
                    <span>{{ locale.loading }}</span>
                  </div>
                </div>

                <!-- 底部操作按钮 -->
                <div v-if="userNotifications.length > 0" class="notification-actions-bar">
                  <button
                    :class="{ disabled: !hasUnreadNotifications }"
                    :disabled="!hasUnreadNotifications"
                    class="action-button-large"
                    @click="markAllNotificationsAsRead"
                  >
                    {{ locale.markAllRead }}
                  </button>
                  <button class="action-button-large danger" @click="clearAllNotifications">
                    {{ locale.clearAllMessages }}
                  </button>
                </div>

                <!-- 确认对话框-->
                <ConfirmDialog
                  v-model:show="showConfirmDialog"
                  :cancel-text="confirmDialogConfig.cancelText"
                  :confirm-text="confirmDialogConfig.confirmText"
                  :message="confirmDialogConfig.message"
                  :title="confirmDialogConfig.title"
                  :type="confirmDialogConfig.type"
                  @cancel="handleCancelAction"
                  @confirm="handleConfirmAction"
                />
              </div>
            </div>
          </ClientOnly>
        </div>
      </div>

      <!-- 页脚信息显示 -->
      <SiteFooter />
    </div>

    <!-- 规则弹窗 -->
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
          v-if="showRules"
          class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-bg-primary-80 backdrop-blur-sm"
          @click.self="showRules = false"
        >
          <div
            class="bg-bg-secondary border border-border-secondary w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div class="p-8 pb-4 flex items-center justify-between">
              <div>
                <h3 class="text-xl font-black text-text-primary tracking-tight flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-2xl bg-primary-hover-10 flex items-center justify-center text-primary"
                  >
                    <Icon name="bell" :size="20" />
                  </div>
                  {{ locale.rulesTitle }}
                </h3>
                <p class="text-xs text-text-tertiary mt-1 ml-13">{{ locale.rulesDesc }}</p>
              </div>
              <button
                class="p-3 bg-bg-tertiary-50 hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary rounded-2xl transition-all"
                @click="showRules = false"
              >
                <Icon name="x" :size="20" />
              </button>
            </div>

            <div class="p-8 pt-4 space-y-8">
              <div class="rules-group space-y-4">
                <h4
                  class="text-[10px] font-black text-text-tertiary uppercase tracking-widest flex items-center gap-2"
                >
                  <Icon name="message-circle" :size="12" />
                  {{ locale.submissionGuidelines }}
                </h4>
                <div
                  v-if="submissionGuidelines"
                  class="guidelines-rendered markdown-body text-sm text-text-tertiary leading-relaxed font-medium bg-bg-primary-50 p-6 rounded-3xl border border-border-secondary-50"
                  v-html="renderedGuidelines"
                />
                <div
                  v-else
                  class="space-y-3 bg-bg-primary-50 p-6 rounded-3xl border border-border-secondary-50"
                >
                  <div class="flex gap-3 text-sm text-text-tertiary font-medium">
                    <span class="text-primary font-black">01</span>
                    <p>{{ locale.defaultRules[0] }}</p>
                  </div>
                  <div class="flex gap-3 text-sm text-text-tertiary font-medium">
                    <span class="text-primary font-black">02</span>
                    <p>{{ locale.defaultRules[1] }}</p>
                  </div>
                  <div class="flex gap-3 text-sm text-text-tertiary font-medium">
                    <span class="text-primary font-black">03</span>
                    <p>{{ locale.defaultRules[2] }}</p>
                  </div>
                </div>
              </div>

              <div class="rules-group space-y-4">
                <h4
                  class="text-[10px] font-black text-text-tertiary uppercase tracking-widest flex items-center gap-2"
                >
                  <Icon name="calendar" :size="12" />
                  {{ locale.playbackTime }}
                </h4>
                <div
                  class="bg-primary-hover-10 border border-primary-20 p-6 rounded-3xl flex items-center gap-4"
                >
                  <div
                    class="w-12 h-12 rounded-2xl bg-primary-hover flex items-center justify-center text-text-primary shadow-lg shadow-[var(--primary-glow-40)]"
                  >
                    <Icon name="clock" :size="24" />
                  </div>
                  <div>
                    <p class="text-sm font-black text-text-primary">{{ locale.playbackTimeDesc }}</p>
                    <p class="text-[10px] text-text-tertiary font-bold uppercase tracking-widest mt-0.5">
                      PLAYBACK TIME
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div class="p-8 pt-0">
              <button
                class="w-full px-6 py-4 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-black rounded-2xl transition-all uppercase tracking-widest shadow-lg active:scale-95"
                @click="showRules = false"
              >
                {{ locale.gotIt }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import Icon from '~/components/UI/Icon.vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import AppLoadingScreen from '~/components/UI/AppLoadingScreen.vue'

import { useNotifications } from '~/composables/useNotifications'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { useToast } from '~/composables/useToast'
import { renderMarkdown } from '~/utils/markdown'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useLocale } from '~/utils/locale'
import { useTheme } from '~/composables/useTheme'
import { useThemeImage } from '~/composables/useThemeImage'

// 获取运行时配置
const config = useRuntimeConfig()
const router = useRouter()
const route = useRoute()
const { pages, common, currentLocale, setLocale, supportedLocales, isFollowingSystem, followSystemLocale } =
  useLocale()
const locale = computed(() => pages.value?.home || {})
const getHomeText = (section, key, ...args) => formatLocaleValue(locale.value?.[section]?.[key], ...args)
const getMessage = (key, ...args) => getHomeText('messages', key, ...args)

// 站点配置
const {
  isLoaded,
  siteTitle,
  description: siteDescription,
  guidelines: submissionGuidelines,
  icp: icpNumber,
  schoolLogoHomeDisplayUrl,
  initSiteConfig
} = useSiteConfig()

// 将投稿须知 Markdown 渲染为安全 HTML
const renderedGuidelines = computed(() => renderMarkdown(submissionGuidelines.value))

const auth = useAuth()
const { showToast } = useToast()
const { getLogo } = useThemeImage()
const isClientAuthenticated = computed(() => auth?.isAuthenticated?.value || false)
const isAdmin = computed(() => auth?.isAdmin?.value || false)
const user = computed(() => auth?.user?.value || null)

const roleName = computed(() => {
  const role = user.value?.role
  return locale.value.roles[role] || locale.value.defaultRole
})

const userClassInfo = computed(() => {
  if (user.value?.grade && user.value?.class) {
    return `${user.value.grade} ${user.value.class}`
  }
  return locale.value.classFallback
})

const songs = useSongs()
// 立即初始化通知服务，避免时序问题
const notificationsService = useNotifications()
const unreadNotificationCount = ref(0)

// 模拟数据初初始化
const songCount = ref(0)
const scheduleCount = ref(0)
const isRequestOpen = ref(true)

// 弹窗状态
const showRequestModal = ref(false)
const showRules = ref(false)
const showUserActions = ref(false)
const showLanguageMenu = ref(false)
const showThemeMenu = ref(false)
const avatarError = ref(false)

const BOOT_PROGRESS = {
  INITIAL: 8,
  START: 14,
  CONFIG: 28,
  AUTH: 46,
  SLOW_NETWORK: 58,
  CONTENT: 68,
  FALLBACK: 82,
  FINALIZING: 88,
  COMPLETE: 100
}
const MIN_BOOT_TIME_MS = 720
const BOOT_EXIT_DELAY_MS = 180
const BOOT_SLOW_THRESHOLD_MS = 8000
const showBootLoading = ref(true)
const bootProgress = ref(BOOT_PROGRESS.INITIAL)
const bootMessage = ref(locale.value.bootMessages.START)
let bootSlowTimer = null

const hasShownBootLoading = useState('hasShownBootLoading', () => false)

const setBootState = ({ progress, message } = {}) => {
  if (typeof progress === 'number') {
    bootProgress.value = progress
  }

  if (message) {
    bootMessage.value = message
  }
}

const waitForFirstPaint = async () => {
  await nextTick()

  if (typeof window === 'undefined') {
    return
  }

  await new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

const finishBootLoading = async (startedAt) => {
  setBootState({ progress: BOOT_PROGRESS.COMPLETE, message: locale.value.bootMessages.COMPLETE })

  const elapsed = Date.now() - startedAt
  const restTime = Math.max(0, MIN_BOOT_TIME_MS - elapsed)
  await new Promise((resolve) => setTimeout(resolve, restTime + BOOT_EXIT_DELAY_MS))

  showBootLoading.value = false
}

const toggleUserActions = (event) => {
  event.stopPropagation()
  showUserActions.value = !showUserActions.value
  if (showUserActions.value) {
    showLanguageMenu.value = false
    showThemeMenu.value = false
  }
}

const toggleLanguageMenu = (event) => {
  event.stopPropagation()
  showLanguageMenu.value = !showLanguageMenu.value
  if (showLanguageMenu.value) {
    showUserActions.value = false
    showThemeMenu.value = false
  }
}

const selectLocale = (code) => {
  // 手动选择为长期偏好（manual），此后进入网站不再跟随系统语言
  setLocale(code, true)
  showLanguageMenu.value = false
}

const selectFollowSystem = () => {
  // 清除手动偏好，回到跟随系统语言模式
  followSystemLocale()
  showLanguageMenu.value = false
}

// ==================== 主题切换 ====================
const { selectedTheme, themes, setTheme: setThemeFn } = useTheme()
const { theme: themeLocale } = useLocale()

const toggleThemeMenu = (event) => {
  event.stopPropagation()
  showThemeMenu.value = !showThemeMenu.value
  if (showThemeMenu.value) {
    showUserActions.value = false
    showLanguageMenu.value = false
  }
}

const closeThemeMenu = () => {
  showThemeMenu.value = false
}

const selectTheme = (theme) => {
  setThemeFn(theme)
  closeThemeMenu()
}

const getThemeLabel = (theme) => {
  return themeLocale.value[theme]
}

// 监听用户头像变化，重置错误状态
watch(
  () => user.value?.avatar,
  () => {
    avatarError.value = false
  }
)

// 点击外部关闭下拉菜单
const handleClickOutside = (event) => {
  if (showUserActions.value) {
    const dropdown = document.querySelector('.user-actions-dropdown')
    const avatar = document.querySelector('.user-avatar-wrapper')
    if (dropdown && !dropdown.contains(event.target) && !avatar.contains(event.target)) {
      showUserActions.value = false
    }
  }
  if (showLanguageMenu.value) {
    const switcher = document.querySelector('.language-switcher')
    if (switcher && !switcher.contains(event.target)) {
      showLanguageMenu.value = false
    }
  }
  if (showThemeMenu.value) {
    const switcher = document.querySelector('.theme-switcher')
    if (switcher && !switcher.contains(event.target)) {
      showThemeMenu.value = false
    }
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
})

// 标签页状态
const activeTab = ref('schedule') // 默认显示播出排期

const tabOrder = ['schedule', 'songs', 'request', 'notification']
const activeIndex = computed(() => {
  const index = tabOrder.indexOf(activeTab.value)
  return index === -1 ? 0 : index
})

// 通知按钮强制更新相关
const notificationTabRef = ref(null)
const hasInitializedAuthData = ref(isClientAuthenticated.value)

let refreshInterval = null

// 添加通知相关变量
const userNotifications = computed(() => notificationsService?.notifications?.value || [])
const notificationsLoading = computed(() => notificationsService?.loading?.value || false)
const notificationSearchInput = ref('')
let notificationSearchTimer = null

const runNotificationSearch = async () => {
  if (notificationSearchTimer) {
    clearTimeout(notificationSearchTimer)
    notificationSearchTimer = null
  }
  await notificationsService.changeSearch(notificationSearchInput.value)
}

const handleNotificationSearchInput = () => {
  if (notificationSearchTimer) clearTimeout(notificationSearchTimer)
  notificationSearchTimer = setTimeout(() => {
    notificationSearchTimer = null
    notificationsService.changeSearch(notificationSearchInput.value)
  }, 300)
}

const clearNotificationSearch = async () => {
  notificationSearchInput.value = ''
  await runNotificationSearch()
}

onUnmounted(() => {
  if (notificationSearchTimer) clearTimeout(notificationSearchTimer)
})

const hasUnreadNotifications = computed(() => {
  // 确保notificationsService已初始化且有unreadCount
  if (!notificationsService || !notificationsService.unreadCount) {
    return false
  }
  const unreadCount = notificationsService.unreadCount.value
  return unreadCount > 0
})
const showNotificationSettings = ref(false)

const pageSizeOptions = computed(() => [
  { label: locale.value.pageSizeOptions.five, value: 5 },
  { label: locale.value.pageSizeOptions.ten, value: 10 },
  { label: locale.value.pageSizeOptions.twenty, value: 20 },
  { label: locale.value.pageSizeOptions.fifty, value: 50 }
])

const notificationSettings = ref({
  songSelectedNotify: true,
  songPlayedNotify: true,
  songVotedNotify: true,
  songVotedThreshold: 1,
  systemNotify: true,
  refreshInterval: 60
})

// 跳转到通知设置页面
const toggleNotificationSettings = () => {
  navigateTo('/notification-settings')
}

// 获取通知设置
const fetchNotificationSettings = async () => {
  if (notificationsService) {
    await notificationsService.fetchNotificationSettings()
    if (notificationsService.settings.value) {
      notificationSettings.value = {
        songSelectedNotify: notificationsService.settings.value.songSelectedNotify,
        songPlayedNotify: notificationsService.settings.value.songPlayedNotify,
        songVotedNotify: notificationsService.settings.value.songVotedNotify,
        songVotedThreshold: notificationsService.settings.value.songVotedThreshold || 1,
        systemNotify: notificationsService.settings.value.systemNotify,
        refreshInterval: notificationsService.settings.value.refreshInterval || 60
      }
    }
  }
}

// 保存通知设置
const saveNotificationSettings = async () => {
  if (notificationsService) {
    await notificationsService.updateNotificationSettings(notificationSettings.value)

    // 如果在首页，更新刷新间隔
    if (typeof setupRefreshInterval === 'function') {
      setupRefreshInterval()
    }
  }
}

// 加载通知
const loadNotifications = async () => {
  if (isClientAuthenticated.value && notificationsService) {
    try {
      await notificationsService.fetchNotifications()
    } catch (error) {
      console.error('[????] ??????:', error)
    }
  }
}

// 标记通知为已读
const markNotificationAsRead = async (id) => {
  if (notificationsService) {
    await notificationsService.markAsRead(id)
  }
}

// 标记所有通知为已读
const markAllNotificationsAsRead = async () => {
  try {
    if (notificationsService) {
      const result = await notificationsService.markAllAsRead()
      if (result) {
        showToast(locale.value.markAllReadSuccess, 'success')
      }
    }
  } catch (error) {
    console.error('[????] ???????????', error)
  }
}

// 删除通知
const deleteNotification = async (id) => {
  pendingAction.value = 'delete'
  pendingId.value = id
  confirmDialogConfig.value = {
    title: locale.value.confirm.deleteTitle,
    message: locale.value.confirm.deleteMessage,
    type: 'warning',
    confirmText: locale.value.delete,
    cancelText: locale.value.confirm.cancel
  }
  showConfirmDialog.value = true
}

// 清空所有通知
const clearAllNotifications = async () => {
  pendingAction.value = 'clearAll'
  confirmDialogConfig.value = {
    title: locale.value.confirm.clearTitle,
    message: locale.value.confirm.clearMessage,
    type: 'danger',
    confirmText: locale.value.confirm.clearConfirm,
    cancelText: locale.value.confirm.cancel
  }
  showConfirmDialog.value = true
}

// 确认对话框相关状态
const showConfirmDialog = ref(false)
const confirmDialogConfig = ref({
  title: '',
  message: '',
  type: 'warning',
  confirmText: locale.value.confirm.ok,
  cancelText: locale.value.confirm.cancel
})
const pendingAction = ref('')
const pendingId = ref(null)

// 处理确认操作
const handleConfirmAction = async () => {
  if (notificationsService) {
    if (pendingAction.value === 'delete') {
      await notificationsService.deleteNotification(pendingId.value)
      pendingId.value = null
    } else if (pendingAction.value === 'clearAll') {
      const result = await notificationsService.clearAllNotifications()
      if (result) {
        showToast(locale.value.clearAllSuccess, 'success')
      }
    }
  }
  showConfirmDialog.value = false
  pendingAction.value = ''
}

// 处理取消操作
const handleCancelAction = () => {
  showConfirmDialog.value = false
  pendingAction.value = ''
  pendingId.value = null
}

// 分页相关方法
const handlePageSizeChange = async (newSize) => {
  const size = parseInt(newSize)
  if (notificationsService) {
    await notificationsService.changePageSize(size)
  }
}

// 获取可见的页码列表
const getVisiblePages = () => {
  if (!notificationsService) return []

  const currentPage = notificationsService.currentPage.value
  const totalPages = notificationsService.totalPages.value
  const pages = []

  if (totalPages <= 7) {
    // 总页数少于等于7页，显示所有页面
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
  } else {
    // 总页数大于7页，显示省略号
    if (currentPage <= 4) {
      // 当前页在前面
      for (let i = 1; i <= 5; i++) {
        pages.push(i)
      }
      pages.push('...')
      pages.push(totalPages)
    } else if (currentPage >= totalPages - 3) {
      // 当前页在后面
      pages.push(1)
      pages.push('...')
      for (let i = totalPages - 4; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // 当前页在中间
      pages.push(1)
      pages.push('...')
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        pages.push(i)
      }
      pages.push('...')
      pages.push(totalPages)
    }
  }

  return pages
}

const getNotificationTypeLabel = (type) =>
  locale.value?.notificationTypes?.[type] ||
  locale.value?.notificationTypes?.SYSTEM ||
  type

const getNotificationSenderName = (notification) =>
  notification?.sender?.name?.trim() ||
  notification?.sender?.username?.trim() ||
  locale.value.systemSender

// 只有管理员手动发送的通知才允许 Markdown 渲染
const isAdminManualNotification = (notification) => notification?.source === 'ADMIN_MANUAL'

// 预计算已清洗的 Markdown HTML，避免模板内重复解析
const renderedNotificationMessages = computed(() => {
  const rendered = {}
  for (const notification of userNotifications.value) {
    if (isAdminManualNotification(notification)) {
      rendered[notification.id] = renderMarkdown(notification.message)
    }
  }
  return rendered
})

// 格式化通知时间
const formatNotificationTime = (timeString) => {
  const date = new Date(timeString)
  const now = getSyncedDate()
  const diff = now.getTime() - date.getTime()

  // 小于1分钟
  if (diff < 60000) {
    return locale.value?.time?.justNow || '刚刚'
  }

  // 小于1小时
  if (diff < 3600000) {
    return formatLocaleValue(locale.value.time.minutesAgo, Math.floor(diff / 60000))
  }

  // 小于24小时
  if (diff < 86400000) {
    return formatLocaleValue(locale.value.time.hoursAgo, Math.floor(diff / 3600000))
  }

  // 小于30天
  if (diff < 2592000000) {
    return formatLocaleValue(locale.value.time.daysAgo, Math.floor(diff / 86400000))
  }

  // 大于30天，显示具体日期
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}

// 监听标签页切换，如果切换到通知标签页，加载通知
watch(activeTab, (newTab) => {
  if (newTab === 'notification') {
    loadNotifications()
  }
})

watch(
  () => [auth?.isAuthenticated?.value || false, user.value?.id ?? null, user.value?.role || ''],
  async ([newAuthState, newUserId, newRole], [oldAuthState, oldUserId, oldRole] = []) => {
    const identityChanged = newUserId !== oldUserId || newRole !== oldRole

    if (newAuthState && (!oldAuthState || identityChanged)) {
      hasInitializedAuthData.value = true
      songs.clearPrivateSongs()
      songs.clearPublicSongs()
      await Promise.allSettled([
        loadNotifications(),
        fetchNotificationSettings(),
        songs.fetchSongs(),
        songs.fetchPublicSchedules()
      ])
      await updateSongCounts()
      return
    }

    if (!newAuthState && oldAuthState) {
      hasInitializedAuthData.value = false
      songs.clearPrivateSongs()
      songs.clearPublicSongs()
      await Promise.allSettled([songs.fetchSongCount(), songs.fetchPublicSchedules()])
      unreadNotificationCount.value = 0
      await updateSongCounts()
    }
  },
  { flush: 'post' }
)

// 初始化时如果已经在通知标签页，则加载通知
onMounted(() => {
  if (activeTab.value === 'notification') {
    loadNotifications()
  }
})

// 获取当前日期和星期
const getCurrentDate = () => {
  const now = getSyncedDate()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const date = now.getDate()
  const weekDay = (locale.value?.time?.weekdays || ['周日', '周一', '周二', '周三', '周四', '周五', '周六'])[now.getDay()] || '今日'

  return formatLocaleValue(locale.value.time.dateFormat, year, month, date, weekDay)
}

// RequestForm组件引用
const requestFormRef = ref(null)

// 更新歌曲数量统计（优化版本，避免重复请求
const updateSongCounts = async (semester = null) => {
  try {
    // 更新排期歌曲数量
    const schedules = songs?.publicSchedules?.value || []
    scheduleCount.value = schedules.length

    // 更新总歌曲数量
    if (isClientAuthenticated.value && songs?.songs?.value) {
      // 已登录用户：使用完整歌曲列表
      songCount.value = songs.songs.value.length
    } else {
      // 未登录用户：使用缓存的歌曲总数
      songCount.value = songs?.songCount?.value || 0
    }
  } catch (e) {
    console.error('????????', e)
  }
}

// 首页标题：根据加载阶段动态切换
// 配置加载完成前使用环境配置的站点标题兜底，保证 SSR 输出真实站点名（SEO / 链接预览），
// 并与 og:title 保持一致；加载完成后切换为数据库配置的站点标题
const pageTitle = computed(() => {
  if (showBootLoading.value) {
    const bootTitle = isLoaded.value ? siteTitle.value : config.public.siteTitle
    return bootTitle ? `${locale.value.titleLoading} | ${bootTitle}` : locale.value.titleLoading
  }
  return `${locale.value.titleHome} | ${siteTitle.value}`
})
useHead({ title: pageTitle })

const isFirstVisit = !hasShownBootLoading.value

if (import.meta.client) {
  if (!isFirstVisit) {
    showBootLoading.value = false
  }
  hasShownBootLoading.value = true
}

// 在组件挂载后初始化认证和歌曲（只会在客户端执行）
onMounted(async () => {
  const bootStartedAt = Date.now()

  const queryTab = route.query.tab
  const tabFromQuery = Array.isArray(queryTab) ? queryTab[0] : queryTab
  if (tabFromQuery && tabOrder.includes(tabFromQuery)) {
    activeTab.value = tabFromQuery
  }

  try {
    if (isFirstVisit) {
      showBootLoading.value = true
      setBootState({ progress: BOOT_PROGRESS.START })

      bootSlowTimer = setTimeout(() => {
        setBootState({
          progress: Math.max(bootProgress.value, BOOT_PROGRESS.SLOW_NETWORK),
          message: locale.value.bootMessages.SLOW_NETWORK
        })
      }, BOOT_SLOW_THRESHOLD_MS)

      await waitForFirstPaint()
    }

    setBootState({ progress: BOOT_PROGRESS.CONFIG, message: locale.value.bootMessages.CONFIG })
    await initSiteConfig()

    setBootState({ progress: BOOT_PROGRESS.AUTH, message: locale.value.bootMessages.AUTH })
    const currentUser = await auth.initAuth()

    setBootState({ progress: BOOT_PROGRESS.CONTENT, message: locale.value.bootMessages.CONTENT })
    if (isClientAuthenticated.value) {
      hasInitializedAuthData.value = true
      await Promise.allSettled([
        songs.fetchSongs(),
        songs.fetchPublicSchedules(),
        loadNotifications(),
        fetchNotificationSettings()
      ])
      await checkPasswordChangeRequired(currentUser)
    } else {
      hasInitializedAuthData.value = false
      await Promise.allSettled([songs.fetchSongCount(), songs.fetchPublicSchedules()])
    }

    setBootState({ progress: BOOT_PROGRESS.FINALIZING, message: locale.value.bootMessages.FINALIZING })
    await updateSongCounts()

    const setupRefreshInterval = () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }

      const intervalSeconds = notificationSettings.value.refreshInterval || 60
      const intervalMs = intervalSeconds * 1000

      console.log(`设置智能刷新间隔: ${intervalSeconds}秒`)

      refreshInterval = setInterval(async () => {
        try {
          if (isClientAuthenticated.value) {
            await Promise.allSettled([
              songs.fetchSongs(true),
              songs.fetchPublicSchedules(true),
              loadNotifications()
            ])
          } else {
            await Promise.allSettled([songs.fetchPublicSchedules(true), songs.fetchSongCount()])
          }

          await updateSongCounts()
        } catch (error) {
          console.error('??????:', error)
        }
      }, intervalMs)
    }

    setupRefreshInterval()

    if (songs.notification) {
      watch(songs.notification, (newVal) => {
        if (newVal.show) {
          showNotification(newVal.message, newVal.type)
        }
      })
    }
  } catch (error) {
    console.error('???????', error)
    if (isFirstVisit) {
      setBootState({ progress: BOOT_PROGRESS.FALLBACK, message: locale.value.bootMessages.FALLBACK })
    }
    await Promise.allSettled([songs.fetchPublicSchedules(), songs.fetchSongCount()])
    await updateSongCounts()
  } finally {
    if (isFirstVisit) {
      if (bootSlowTimer) {
        clearTimeout(bootSlowTimer)
        bootSlowTimer = null
      }

      await finishBootLoading(bootStartedAt)
    }
  }
})

// 组件卸载时清除定时器
onUnmounted(() => {
  if (bootSlowTimer) {
    clearTimeout(bootSlowTimer)
    bootSlowTimer = null
  }

  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})

// 实时计算歌曲总数
const realSongCount = computed(() => {
  return songs?.visibleSongs?.value?.length || 0
})

// 使用计算属性安全地访问数据
const publicSchedules = computed(() => songs?.publicSchedules?.value || [])
const allSongs = computed(() => songs?.visibleSongs?.value || [])
const filteredSongs = computed(() => {
  // 返回所有歌曲，但将已播放的歌曲排在最前
  if (allSongs.value && allSongs.value.length > 0) {
    const unplayedSongs = allSongs.value.filter((song) => !song.played)
    const playedSongs = allSongs.value.filter((song) => song.played)
    return [...unplayedSongs, ...playedSongs]
  }
  return []
})
const loading = computed(() => songs?.loading?.value || false)
const error = computed(() => songs?.error?.value || '')

// 处理投稿请求
const handleRequest = async (songData) => {
  if (!auth || !isClientAuthenticated.value) {
    if (window.$showNotification) {
      window.$showNotification(getMessage('requestLogin'), 'error')
    }
    showRequestModal.value = false
    return false
  }

  try {
    console.log('处理歌曲请求:', songData.title)
    // 直接传递整个songData对象，确保JSON格式正确
    const result = await songs.requestSong(songData)
    if (result) {
      // 显示投稿成功通知
      if (window.$showNotification) {
        window.$showNotification(getHomeText('messages', 'requestSuccess', songData.title, songData.artist), 'success')
      }

      // 强制刷新歌曲列表
      await refreshSongs()

      // 刷新投稿状态
      if (requestFormRef.value && requestFormRef.value.refreshSubmissionStatus) {
        await requestFormRef.value.refreshSubmissionStatus()
      }

      // 如果当前在歌曲列表页，自动切换到该页面
      if (activeTab.value !== 'songs') {
        setTimeout(() => {
          handleTabClick('songs')
        }, 500)
      }

      return true
    }
    return false
  } catch (err) {
    if (window.$showNotification) {
      window.$showNotification(
        getErrorMessage(err) || getHomeText('messages', 'requestFailed'),
        'error'
      )
    }
    return false
  }
}

// 处理投票
const handleVote = async (song) => {
  if (!isClientAuthenticated.value) {
    showNotification(getMessage('voteLogin'), 'error')
    return
  }

  try {
    if (!songs) return

    // 调用投票API - 通知已在composable中处理
    // 检查是否是取消投票请求
    if (song.unvote) {
      // 传递完整对象以支持撤销投票功能
      await songs.voteSong(song)
    } else {
      // 保持向后兼容，传递ID
      await songs.voteSong(song.id)
    }

    // 静默刷新歌曲列表以获取最新状态，但不影响当前视图
    setTimeout(() => {
      songs.refreshSongsSilent().catch((err) => {
        console.error('????????', err)
      })
    }, 500)
  } catch (err) {
    // 不做任何处理，因为useSongs中已经处理了错误提示
    console.log('API????useSongs???')
  }
}

// 处理撤回重播申请
const handleCancelReplay = async (song) => {
  if (!isClientAuthenticated.value) {
    showNotification(getMessage('cancelReplayLogin'), 'error')
    return
  }

  try {
    if (!songs) return
    await songs.withdrawReplay(song.id)
    updateSongCounts()
  } catch (err) {
    // 不做任何处理，因为useSongs中已经处理了错误提示
  }
}

// 处理撤回投稿
const handleWithdraw = async (song) => {
  if (!isClientAuthenticated.value) {
    showNotification(getMessage('withdrawLogin'), 'error')
    return
  }

  try {
    if (!songs) return

    // 调用撤回API - 通知已在composable中处理
    await songs.withdrawSong(song.id)
    // 更新计数
    updateSongCounts()
  } catch (err) {
    // 不做任何处理，因为useSongs中已经处理了错误提示
    console.log('API????useSongs???')
  }
}

// 刷新歌曲列表（优化版本）
const refreshSongs = async () => {
  try {
    if (isClientAuthenticated.value) {
      await songs.fetchSongs(false, undefined, true) // forceRefresh=true
    } else {
      await songs.fetchPublicSchedules(false, undefined, true) // forceRefresh=true
    }

    updateSongCounts()
  } catch (err) {
    console.error('????????', err)
  }
}

// 处理学期变化（前端过滤版本）
const handleSemesterChange = async (semester) => {
  try {
    // 通过事件总线通知SongList组件进行前端过滤
    // 使用nextTick确保事件在DOM更新后触发
    await nextTick()

    // 触发自定义事件，通知所有监听的组件
    const event = new CustomEvent('semester-filter-change', {
      detail: { semester }
    })
    window.dispatchEvent(event)

    console.log('?????????:', semester)

    // 更新歌曲计数（基于当前已有数据）
    await updateSongCounts(semester)
  } catch (err) {
    console.error('切换学期失败', err)
  }
}

// 更新通知数量 - 可以保留这个函数但不再调用
const updateNotificationCount = async () => {
  // 函数保留但不再使用
}

// 处理登出
const handleLogout = () => {
  if (auth) {
    auth.logout()
  }
}

// 处理进入后台的点击动画
const handleDashboardClick = (event) => {
  const button = event.currentTarget
  button.classList.add('clicking')

  // 添加涟漪效果
  const ripple = document.createElement('span')
  ripple.classList.add('ripple')
  button.appendChild(ripple)

  setTimeout(() => {
    button.classList.remove('clicking')
    ripple.remove()
  }, 300)
}

// 添加查看通知并标记为已读
const viewNotification = async (notification) => {
  if (!notification.read) {
    await notificationsService.markAsRead(notification.id)
  }
}

// 处理联合投稿回复
const handleCollaborationReply = async (notification, accept) => {
  if (notification.processing) return
  notification.processing = true

  try {
    await $fetch('/api/songs/collaborators/reply', {
      method: 'POST',
      body: {
        songId: notification.songId,
        accept
      }
    })

    // 标记为已处理
    notification.handled = true
    notification.status = accept ? 'ACCEPTED' : 'REJECTED'
    notification.repliedAt = new Date()
    // notification.message += accept ? ' (已接受' : ' (已拒绝'

    if (window.$showNotification) {
      window.$showNotification(
        accept ? getMessage('inviteAccepted') : getMessage('inviteRejected'),
        'success'
      )
    }

    // 标记通知为已读
    await markNotificationAsRead(notification.id)

    // 刷新歌曲列表
    refreshSongs()

    // 刷新通知列表
    await loadNotifications()
  } catch (error) {
    console.error('??????????', error)
    if (window.$showNotification) {
      window.$showNotification(
        getErrorMessage(error) || getMessage('operationFailed'),
        'error'
      )
    }
  } finally {
    notification.processing = false
  }
}

// 格式化刷新间隔
const formatRefreshInterval = (seconds) => {
  if (seconds < 60) {
    return formatLocaleValue(locale.value.time.seconds, seconds)
  } else {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0
      ? formatLocaleValue(locale.value.time.minutesSeconds, minutes, remainingSeconds)
      : formatLocaleValue(locale.value.time.minutes, minutes)
  }
}

// 波纹效果指令
const vRipple = {
  mounted(el) {
    el.addEventListener('click', (e) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const ripple = document.createElement('span')
      ripple.className = 'ripple-effect'
      ripple.style.left = `${x}px`
      ripple.style.top = `${y}px`

      el.appendChild(ripple)

      setTimeout(() => {
        ripple.remove()
      }, 600) // 与CSS动画时间一致
    })
  }
}

// 处理标签点击事件，添加动画效果
const handleTabClick = (tab) => {
  activeTab.value = tab
}

// 添加导航到登录页面的方法
const navigateToLogin = () => {
  router.push('/login')
}

// 显示登录提示
const showLoginNotice = () => {
  if (window.$showNotification) {
    window.$showNotification(getMessage('notificationLogin'), 'info')
  }
}

// 检查用户是否需要修改密码
const checkPasswordChangeRequired = async (user = null) => {
  try {
    // 使用传入的用户信息或当前认证状态中的用户信息
    const currentUser = user || auth?.user?.value

    if (currentUser && currentUser.requirePasswordChange) {
      // 延迟1秒显示通知，确保页面加载完成
      setTimeout(() => {
        if (window.$showNotification) {
          window.$showNotification(
            getMessage('changePasswordTip'),
            'info',
            true,
            8000 // 显示8秒
          )
        }
      }, 1000)
    }
  } catch (error) {
    console.error('??????????', error)
  }
}

// 添加未读通知计数
// 之前已声明了unreadNotificationCount，这里对其进行递增操作
if (
  notificationsService &&
  notificationsService.unreadCount &&
  notificationsService.unreadCount.value
) {
  const count = notificationsService.unreadCount.value
  unreadNotificationCount.value = count
}
</script>

<style scoped>
.home-boot-loader-leave-active {
  transition:
    opacity 420ms ease,
    filter 420ms ease;
}

.home-boot-loader-leave-to {
  opacity: 0;
  filter: blur(12px);
}

.home {
  width: 100%;
  flex: 1;
  background-color: var(--panel-bg-darker);
  padding: 1.5rem;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  min-height: 100vh; /* 确保至少占满视口 */
}

.main-content {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%; /* 改为占满父容器高度而不是视口高度*/
}

/* 添加顶部Ellipse 1效果 */
.ellipse-effect {
  position: absolute;
  top: -165px;
  left: 50%;
  transform: translateX(-50%) perspective(500px) rotateX(10deg);
  width: 1110px;
  height: 309px;
  background: radial-gradient(
    ellipse at center,
    var(--color-accent-alpha-30) 0%,
    var(--color-accent-alpha-15) 30%,
    transparent 70%
  );
  z-index: 0;
  pointer-events: none;
}

/* 顶部区域样式 */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  margin-top: -2rem;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 20px;
  min-height: 160px;
}

.logo-link {
  display: block;
  text-decoration: none;
}

.logo-image {
  width: 150px;
  height: auto;
  object-fit: contain;
}

/* 横线和学校logo容器 */
.logo-divider-container {
  display: flex;
  align-items: center;
  gap: 30px;
}

/* 横线样式 */
.logo-divider {
  width: 2px;
  height: 100px;
  background: linear-gradient(
    to bottom,
    var(--overlay-30),
    var(--overlay-80),
    var(--overlay-30)
  );
  border-radius: 1px;
}

/* 学校logo样式 */
.school-logo {
  max-width: 200px;
  max-height: 80px;
  width: auto;
  height: auto;
  object-fit: contain;
}

.user-section {
  position: relative;
  z-index: 100;
}

.user-actions-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.login-options {
  display: flex;
  align-items: center;
  gap: 10px;
}

.language-switcher {
  position: relative;
  display: inline-flex;
}

.language-switcher-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--overlay-10);
  border-radius: 50%;
  background: var(--overlay-4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--overlay-70);
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}

.language-switcher-trigger:hover,
.language-switcher-trigger:focus-visible,
.language-switcher-trigger.is-open {
  color: var(--text-primary);
  border-color: var(--overlay-25);
  background: var(--overlay-8);
  outline: none;
}

.language-dropdown {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  background: var(--panel-bg);
  border: 1px solid var(--overlay-10);
  border-radius: 12px;
  padding: 8px;
  min-width: 160px;
  box-shadow: 0 10px 30px var(--mask-50);
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 200;
}

.language-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--overlay-70);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  text-align: left;
}

.language-option:hover,
.language-option:focus-visible {
  background: var(--overlay-5);
  color: var(--text-primary);
  outline: none;
}

.language-option.is-active {
  color: var(--text-primary);
}

.language-option.is-active .language-option-label {
  font-weight: 600;
}

/* ==================== 主题切换 ==================== */
.theme-switcher {
  position: relative;
  display: inline-flex;
}

.theme-switcher-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--overlay-10);
  border-radius: 50%;
  background: var(--overlay-4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--overlay-70);
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}

.theme-switcher-trigger:hover,
.theme-switcher-trigger:focus-visible,
.theme-switcher-trigger.is-open {
  color: var(--text-primary);
  border-color: var(--overlay-25);
  background: var(--overlay-8);
  outline: none;
}

.theme-dropdown {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  background: var(--panel-bg);
  border: 1px solid var(--overlay-10);
  border-radius: 12px;
  padding: 8px;
  min-width: 160px;
  box-shadow: 0 10px 30px var(--mask-50);
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 200;
}

.theme-option {
  display: block;
  padding: 10px 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--overlay-70);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  text-align: left;
}

.theme-option:hover,
.theme-option:focus-visible {
  background: var(--overlay-5);
  color: var(--text-primary);
  outline: none;
}

.theme-option.is-active {
  color: var(--text-primary);
}

.user-details-desktop {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--overlay-90);
}

.user-badge {
  font-size: 10px;
  padding: 1px 6px;
  background: var(--overlay-10);
  color: var(--overlay-50);
  border-radius: 4px;
  margin-top: 2px;
}

.user-badge.admin {
  background: var(--primary-20);
  color: var(--color-accent-light);
}

.user-avatar-wrapper {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--panel-border);
  border: 1px solid var(--overlay-10);
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar-placeholder {
  font-size: 16px;
  font-weight: 700;
  color: var(--primary);
}

.user-actions-dropdown {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  background: var(--panel-bg);
  border: 1px solid var(--overlay-10);
  border-radius: 12px;
  padding: 8px;
  min-width: 160px;
  box-shadow: 0 10px 30px var(--mask-50);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--overlay-70);
  font-size: 14px;
  transition: all 0.2s;
  text-decoration: none;
  width: 100%;
  text-align: left;
}

.action-item:hover {
  background: var(--overlay-5);
  color: var(--text-primary);
}

.action-item.logout:hover {
  background: var(--error-10);
  color: var(--color-error);
}

.notification-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background-color: var(--color-error);
  color: white;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

/* 登录按钮 - 桌面端*/
.login-options .login-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 24px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 600;
  background: var(--overlay-4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--text-primary);
  border: 1px solid var(--overlay-10);
  box-shadow: 0 4px 15px var(--mask-10);
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  text-decoration: none;
  position: relative;
  overflow: hidden;
}

.login-options .login-btn:hover {
  background: var(--overlay-8);
  border-color: var(--primary-50);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px var(--primary-20);
  color: white;
}

.login-options .login-btn :deep(.icon),
.login-options .login-btn i {
  color: var(--color-accent-light);
  transition: all 0.3s ease;
}

.login-options .login-btn:hover :deep(.icon),
.login-options .login-btn:hover i {
  transform: scale(1.1);
  filter: drop-shadow(0 0 5px var(--primary-50));
}

.login-options .login-btn:active {
  transform: translateY(0) scale(0.96);
  transition: all 0.1s;
}

/* 站点标题 */
.site-title {
  text-align: center;
  margin: 3rem 0;
  padding: 0 1rem;
}

.title-container {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.main-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 800;
  font-size: 42px;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--overlay-70) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 10px 30px var(--mask-30);
  margin: 0;
  line-height: 1.2;
}

.title-divider {
  width: 40px;
  height: 4px;
  background: var(--title-divider-bg);
  border-radius: 2px;
  box-shadow: 0 0 15px var(--color-accent-alpha-60);
}

.sub-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  font-size: 14px;
  color: var(--overlay-40);
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

/* 内容区域结构 */
.content-area {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1; /* 占据剩余空间 */
  min-height: 0; /* 允许 flex 子元素收缩*/
  width: 100%; /* 确保宽度占满 */
}

/* 选项卡片样式- 桌面端*/
.tabs-row {
  display: flex;
  gap: 5px;
  margin-bottom: 0;
  overflow-x: auto;
  white-space: nowrap;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: 2px;
}

.tabs-row::-webkit-scrollbar {
  display: none;
}

.section-tab {
  background: var(--section-tab-bg);
  border-radius: 15px 15px 0 0;
  padding: 15px 24px;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: var(--text-secondary);
  border: 2px solid var(--section-tab-border);
  border-bottom: none;
  cursor: pointer;
  flex: 0 0 auto;
}

.section-tab.active {
  background: var(--panel-bg);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

@keyframes tab-pane-enter {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 通知列表过渡动画 */
.notification-list-fade-enter-active,
.notification-list-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.notification-list-fade-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.95);
}

.notification-list-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(1.02);
}

/* 通知项交错进入动画*/
.notification-card {
  animation: notification-item-enter 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  animation-delay: var(--animation-delay, 0s);
  opacity: 0;
  transform: translateY(20px);
  will-change: transform, opacity;
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.2s ease;
}

.notification-card:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 8px 25px var(--mask-15);
}

@keyframes notification-item-enter {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 选项卡切换动画*/
.section-tab {
  position: relative;
  transition: all 0.3s ease;
  overflow: hidden;
  padding: 0.75rem 1.5rem;
  z-index: 10; /* 确保在内容之上*/
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.section-tab .tab-icon {
  display: none; /* PC端默认隐藏图标*/
}

.section-tab .icon-wrapper {
  display: none; /* PC端默认隐藏图标容器，避免间距问题 */
}

.section-tab .tab-text {
  display: inline;
  position: relative;
}

/* PC端通知小圆点*/
.notification-badge-desktop {
  position: absolute;
  top: -2px;
  right: -8px;
  width: 6px;
  height: 6px;
  background: var(--color-accent);
  border-radius: 50%;
  box-shadow: 0 0 5px var(--color-accent-alpha-50);
}

.section-tab::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 2px;
  background: var(--color-accent);
  transition: all 0.3s ease;
  transform: translateX(-50%);
}

.section-tab:hover::after {
  width: 50%;
}

.section-tab.active::after {
  width: 100%;
}

/* 移除上浮效果 */
.section-tab:hover {
  transform: none; /* 移除上浮效果 */
  background-color: transparent; /* 移除背背景*/
  box-shadow: none; /* 移除内阴影*/
  color: var(--text-primary);
}

.section-tab.active:hover {
  background-color: transparent;
  box-shadow: none;
  color: var(--text-primary);
}

/* 内容容器 */
.tab-content-container {
  background: var(--panel-bg-overlay);
  border: 2px solid var(--panel-bg-raised);
  border-radius: 0 15px 15px 15px;
  padding: 1.5rem;
  margin-top: -2px; /* 使内容容器与标签连接 */
  box-sizing: border-box;
  width: 100%;
  display: flex;
  flex-direction: column;
  flex: 1; /* 占据剩余空间 */
  min-height: 0; /* 允许 flex 子元素收缩*/
  overflow: hidden; /* 防止内容溢出 */
}

@media (max-width: 768px) {
  .tab-content-container {
    padding: 1rem;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }
}

.tab-pane {
  width: 100%;
  box-sizing: border-box;
  animation: tab-pane-enter 0.45s ease;
}

/* 针对排期标签页的特殊样式 */
.schedule-tab-pane {
  width: 100%;
  box-sizing: border-box;
  padding: 0;
  display: flex;
  flex-direction: column;
  flex: 1; /* 占满父容器高度*/
  min-height: 0; /* 允许 flex 子元素收缩*/
  overflow: hidden; /* 防止内容溢出 */
}

.schedule-tab-pane .full-width {
  flex: 1; /* 占据剩余空间 */
  display: flex;
  flex-direction: column;
  min-height: 0; /* 允许 flex 子元素收缩*/
  overflow: hidden; /* 防止内容溢出 */
}

@media (max-width: 768px) {
  .tab-pane {
    padding: 0.5rem;
  }

  .schedule-tab-pane {
    padding: 0;
  }

  /* 移动端分页控件样式*/
  .pagination-controls {
    flex-direction: column;
    gap: 10px;
  }

  .page-size-selector {
    justify-content: center;
  }

  .page-navigation {
    justify-content: center;
    flex-wrap: wrap;
  }

  .page-numbers {
    flex-wrap: wrap;
    justify-content: center;
  }
}

.song-list-container {
  width: 100%;
  padding: 1rem 0;
}

.date-info p {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 16px;
  letter-spacing: 4%;
}

/* 歌曲时段 */
.time-label {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 16px;
  letter-spacing: 4%;
  color: var(--overlay-60);
  margin: 1.5rem 0 1rem;
}

.song-cards {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 请求表单布局 */
.request-pane {
  display: flex;
  gap: 2rem;
}

/* 空状态*/
.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--overlay-60);
}

/* 下拉菜单动画 */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

/* 通知面板 */
.notification-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.notification-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
}

/* 通知头部 */
.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 0;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--overlay-8);
}

.notification-header-main {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.notification-filter {
  display: inline-flex;
  flex-shrink: 0;
  border: 1px solid var(--overlay-10);
  border-radius: 8px;
  background: var(--chip-bg);
  padding: 3px;
}

.notification-filter button {
  min-height: 28px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  padding: 0.3rem 0.65rem;
  color: var(--overlay-55);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.notification-filter button:hover:not(.active) {
  color: var(--overlay-85);
}

.notification-filter button.active {
  background: var(--color-accent);
  color: #ffffff;
}

.notification-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.notification-header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-left: auto;
  flex-shrink: 0;
}

.mark-all-read-header {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 1px solid var(--color-accent-alpha-22);
  border-radius: 10px;
  background: var(--color-accent-alpha-10);
  padding: 0.45rem 0.75rem;
  color: var(--color-accent-light);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mark-all-read-header:hover:not(.disabled) {
  border-color: var(--color-accent-alpha-40);
  background: var(--color-accent-alpha-18);
  color: var(--color-accent-lighter);
}

.mark-all-read-header.disabled {
  border-color: var(--overlay-8);
  background: var(--overlay-3);
  color: var(--overlay-30);
  cursor: not-allowed;
}

.notification-search {
  display: flex;
  width: 260px;
  min-width: 180px;
  min-height: 36px;
  flex: 0 1 260px;
  align-items: center;
  gap: 0.6rem;
  border: 1px solid var(--overlay-10);
  border-radius: 8px;
  background: var(--chip-bg);
  padding: 0 0.75rem;
  color: var(--overlay-40);
  transition: border-color 0.2s ease, background 0.2s ease;
}

.notification-search:focus-within {
  border-color: var(--color-accent-alpha-65);
  background: var(--overlay-6);
  color: var(--color-accent-light);
}

.notification-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.85rem;
}

.notification-search input::placeholder {
  color: var(--overlay-35);
}

.notification-search input::-webkit-search-cancel-button {
  display: none;
}

.notification-search button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--overlay-45);
  cursor: pointer;
}

.notification-search button:hover {
  background: var(--overlay-8);
  color: var(--text-primary);
}

.notification-unread-summary {
  display: flex;
  width: 100%;
  min-height: 72px;
  align-items: center;
  gap: 0.85rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--color-warning-alpha-24);
  border-radius: 8px;
  background: var(--overlay-4);
  padding: 0.8rem 1rem;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.notification-unread-summary:hover:not(:disabled) {
  border-color: var(--color-warning-alpha-48);
  background: var(--overlay-7);
}

.notification-unread-summary:focus-visible {
  outline: 2px solid var(--color-accent-light);
  outline-offset: 2px;
}

.notification-unread-summary.empty {
  border-color: var(--overlay-9);
  color: var(--overlay-58);
  cursor: default;
}

.notification-unread-summary-icon {
  display: inline-flex;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--color-warning-alpha-14);
  color: var(--color-warning-light);
}

.notification-unread-summary.empty .notification-unread-summary-icon {
  background: var(--overlay-6);
  color: var(--overlay-40);
}

.notification-unread-summary-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
}

.notification-unread-summary-copy > span {
  color: var(--overlay-50);
  font-size: 0.72rem;
  font-weight: 600;
}

.settings-icon:hover {
  background-color: var(--overlay-10);
  color: var(--text-primary);
  transform: rotate(30deg);
}

/* 通知列表 */
.notification-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 0.5rem;
  margin-bottom: 1.5rem;
  min-height: 400px;
}

.loading-indicator,
.empty-notification {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 0;
  color: var(--overlay-40);
  gap: 1.25rem;
}

.empty-icon {
  width: 80px;
  height: 80px;
  background: var(--overlay-3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.notification-items {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.notification-card {
  background: var(--overlay-3);
  backdrop-filter: blur(20px);
  border: 1px solid var(--overlay-6);
  border-radius: 20px;
  padding: 1.25rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  cursor: pointer;
}

.notification-card:hover {
  background: var(--overlay-6);
  border-color: var(--overlay-12);
  transform: translateY(-2px);
}

.notification-card.unread {
  background: var(--primary-5);
  border-color: var(--primary-20);
}

.notification-card-header {
  display: flex;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.notification-icon-type {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--primary-10);
  color: var(--color-accent-light);
  border-radius: 12px;
  margin-right: 1rem;
  flex-shrink: 0;
  font-size: 1.25rem;
}

.notification-title-row {
  flex: 1;
  min-width: 0;
}

.notification-heading-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.notification-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 0;
  overflow-wrap: anywhere;
}

.notification-read-status {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 0.2rem 0.45rem;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
}

.notification-read-status.is-read {
  border-color: var(--success-20);
  background: var(--success-10);
  color: var(--color-success-light);
}

.notification-read-status.is-unread {
  border-color: var(--warning-20);
  background: var(--warning-10);
  color: var(--color-warning-light);
}

.notification-time {
  margin-top: 0.4rem;
  font-size: 0.75rem;
  color: var(--overlay-40);
}

.notification-sender {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.35rem;
  font-size: 0.72rem;
  color: var(--overlay-40);
}

.notification-card-body {
  padding: 0 0 0 3.5rem;
}

.notification-text {
  color: var(--overlay-70);
  font-size: 0.875rem;
  line-height: 1.6;
  min-width: 0;
  overflow-wrap: anywhere;
}

.notification-text.markdown-body > :first-child {
  margin-top: 0;
}

.notification-text.markdown-body > :last-child {
  margin-bottom: 0;
}

.notification-card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
  padding-left: 3.5rem;
}

.action-button.delete {
  background: var(--error-5);
  color: var(--color-error);
  border: 1px solid var(--error-10);
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.2s;
}

.action-button.delete:hover {
  background: var(--error-10);
  border-color: var(--error-20);
}

.notification-actions-bar {
  display: flex;
  gap: 1rem;
  padding: 1rem 0;
  border-top: 1px solid var(--overlay-8);
}

.action-button-large {
  flex: 1;
  background: var(--overlay-5);
  border: 1px solid var(--overlay-10);
  color: var(--text-primary);
  padding: 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.action-button-large:hover:not(.disabled) {
  background: var(--overlay-10);
}

.action-button-large.danger {
  color: var(--color-error);
}

.action-button-large.danger:hover {
  background: var(--error-10);
}

.action-button-large.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 分页控件样式 */
.notification-pagination {
  padding: 15px 0;
  border-top: 1px solid var(--overlay-10);
  border-bottom: 1px solid var(--overlay-10);
}

.pagination-info {
  text-align: center;
  margin-bottom: 15px;
}

.pagination-text {
  color: var(--overlay-70);
  font-size: 0.85rem;
}

.pagination-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
}

.page-size-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-size-selector label {
  color: var(--overlay-70);
  font-size: 0.85rem;
  white-space: nowrap;
}

.page-size-custom-select {
  width: 90px;
}

.page-navigation {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-nav-button {
  background-color: var(--overlay-10);
  border: 1px solid var(--overlay-20);
  color: var(--light);
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, background-color;
}

.page-nav-button:hover:not(:disabled) {
  background-color: var(--overlay-20);
  border-color: var(--overlay-30);
  transform: translateY(-1px);
}

.page-nav-button:active:not(:disabled) {
  transform: translateY(0) scale(0.95);
  transition: all 0.1s ease;
}

.page-nav-button:disabled {
  background-color: var(--overlay-5);
  border-color: var(--overlay-10);
  color: var(--overlay-30);
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-number-button {
  background-color: var(--overlay-10);
  border: 1px solid var(--overlay-20);
  color: var(--light);
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, background-color;
  position: relative;
  overflow: hidden;
}

.page-number-button:hover:not(:disabled) {
  background-color: var(--overlay-20);
  border-color: var(--overlay-30);
  transform: translateY(-1px);
}

.page-number-button:active:not(:disabled) {
  transform: translateY(0) scale(0.95);
  transition: all 0.1s ease;
}

.page-number-button.active {
  background-color: var(--primary);
  border-color: var(--primary);
  color: white;
}

.page-number-button.active:hover {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
}

.page-number-button:disabled {
  background-color: var(--overlay-5);
  border-color: var(--overlay-10);
  color: var(--overlay-30);
  cursor: not-allowed;
}

.page-ellipsis {
  color: var(--overlay-50);
  padding: 0 4px;
  font-size: 0.85rem;
}

/* 分页加载状态*/
.pagination-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 0;
  color: var(--overlay-70);
  font-size: 0.85rem;
  animation: fade-in 0.3s ease;
}

@keyframes fade-in {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 底部操作区*/
.notification-actions-bar {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 15px 0;
  border-top: 1px solid var(--overlay-10);
}

.action-button-large {
  background-color: var(--overlay-10);
  border: none;
  color: var(--light);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.action-button-large:hover {
  background-color: var(--overlay-20);
}

.action-button-large.danger {
  color: var(--color-error);
}

.action-button-large.danger:hover {
  background-color: var(--error-20);
}

.action-button-large.disabled {
  background-color: var(--overlay-5);
  color: var(--overlay-30);
  cursor: not-allowed;
  opacity: 0.5;
}

.action-button-large.disabled:hover {
  background-color: var(--overlay-5);
}

/* ==================== 移动端设置==================== */

/* 基础移动端适配 */
@media (max-width: 768px) {
  .home {
    padding: 0;
    background-color: var(--panel-bg-darkest);
  }

  .main-content {
    padding: 0;
  }

  /* 隐藏原有的ellipse效果，使用更微妙的背景*/
  .ellipse-effect {
    display: none;
  }

  /* 顶部区域 */
  .top-bar {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    margin: 0;
    background: linear-gradient(180deg, var(--color-accent-alpha-10) 0%, transparent 100%);
    border-bottom: 1px solid var(--overlay-5);
  }

  .logo-section {
    min-height: auto;
    gap: 8px;
  }

  .logo-image {
    width: 76px;
    height: auto;
  }

  .logo-divider-container {
    gap: 8px;
  }

  .logo-divider {
    height: 28px;
    width: 1px;
    background: var(--overlay-15);
  }

  /* 移动端的主页面里不需要写学校名，保持简约*/
  .site-title {
    display: none;
  }

  .school-logo {
    max-width: 120px;
    max-height: 36px;
  }

  /* 用户区域简约*/
  .user-section {
    width: auto;
  }

  .user-actions-row {
    gap: 8px;
  }

  .user-details-desktop {
    display: none; /* 移动端仅显示头像 */
  }

  .user-avatar-wrapper {
    width: 32px;
    height: 32px;
    background: var(--overlay-5);
    border-color: var(--overlay-10);
  }

  .user-avatar-placeholder {
    font-size: 14px;
  }

  .user-actions-dropdown {
    top: calc(100% + 10px);
    min-width: 140px;
    padding: 6px;
  }

  .language-switcher-trigger {
    width: 32px;
    height: 32px;
  }

  .theme-switcher-trigger {
    width: 32px;
    height: 32px;
  }

  .language-dropdown {
    top: calc(100% + 10px);
    min-width: 140px;
    padding: 6px;
  }

  .language-option {
    padding: 8px 10px;
    font-size: 13px;
  }

  .action-item {
    padding: 8px 10px;
    font-size: 13px;
  }

  /* 登录按钮 */
  .login-options .login-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    background: var(--overlay-8);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: white;
    border: 1px solid var(--overlay-10);
    box-shadow: 0 4px 12px var(--mask-10);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0; /* 防止空间不足时按钮被压缩导致文字换行 */
    white-space: nowrap;
  }

  .login-options .login-btn :deep(.icon) {
    color: var(--color-accent-light);
  }

  .login-options .login-btn:active {
    transform: scale(0.95);
    background: var(--overlay-15);
    border-color: var(--primary-40);
  }

  /* Footer 间距优化 */
  :deep(.site-footer) {
    padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
  }

  /* 内容区域 - 全宽无边框*/
  .content-area {
    min-height: auto;
    overflow-x: hidden; /* 防止横向溢出 */
    max-width: 100vw; /* 确保不超过视口宽度*/
    box-sizing: border-box; /* 确保padding计入总宽度*/
  }

  .tabs-row {
    position: fixed;
    bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
    left: 1rem;
    right: 1rem;
    margin: 0 auto;
    max-width: 500px;
    display: flex;
    justify-content: space-around;
    align-items: stretch; /* 修改为stretch 以配合子元素 height: 100% */
    gap: 0;
    padding: 0 0.5rem;
    height: 64px;
    background: var(--index-footer-bg);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--overlay-10);
    border-radius: 9999px;
    z-index: 1000;
    box-shadow: 0 12px 40px var(--mask-60);
  }

  .section-tab {
    flex: 1;
    height: 100%; /* 确保填满容器高度 */
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0; /* 移除固定内边距，改用 flex 居中 */
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted); /* text-text-tertiary */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center; /* 垂直居中内容 */
    gap: 4px;
    position: relative;
    transition: all 0.2s ease;
  }

  .section-tab .tab-icon {
    display: block;
    margin-bottom: 2px;
    transition: all 0.2s ease;
    color: currentColor;
  }

  .section-tab .tab-text {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.02em;
    transition: all 0.2s ease;
  }

  .section-tab.active {
    color: var(--color-accent-light) !important; /* text-primary - Force blue */
    background: transparent !important;
    transform: none !important;
    text-shadow: 0 0 12px var(--primary-60); /* Text Glow */
  }

  /* Prevent hover from turning it white on mobile */
  .section-tab.active:hover {
    color: var(--color-accent-light) !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  .section-tab.active .tab-icon {
    opacity: 1;
    color: currentColor;
    transform: none;
    filter: drop-shadow(0 0 8px var(--primary-50)); /* Icon Glow */
  }

  .section-tab.active .tab-text {
    font-weight: 700;
  }

  /* 移除原有的伪元素图标 */
  .section-tab::before {
    display: none;
  }

  /* 移除底部指示器（横条 彻底隐藏 */
  .section-tab::after {
    display: none !important;
  }

  @keyframes dot-pop-in {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .icon-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    margin: 0 auto;
  }

  .section-tab .icon-wrapper {
    display: flex; /* 移动端显示图标容器*/
  }

  /* 通知徽章 - 回归蓝色风格 */
  .notification-badge-tab {
    position: absolute;
    top: 0;
    right: 0;
    width: 8px;
    height: 8px;
    background: var(--color-accent);
    border-radius: 50%;
    border: 1.5px solid var(--panel-bg-darkest);
    box-shadow: 0 0 5px var(--color-accent-alpha-40);
    z-index: 2;
  }

  .notification-badge-desktop {
    display: none; /* 移动端隐藏桌面版徽章 */
  }

  @keyframes badge-pulse {
    /* 移除导致位移的动画*/
  }

  .section-tab.disabled {
    opacity: 0.3;
    filter: grayscale(1);
  }

  /* 内容容器 */
  .tab-content-container {
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0 6px calc(80px + env(safe-area-inset-bottom, 0px));
    margin: 0;
    min-height: calc(100vh - 120px);
  }

  .tab-pane {
    padding: 0;
    overflow-x: hidden; /* 防止横向溢出 */
    max-width: 100%; /* 确保不超过视口宽度*/
  }

  /* 通知标签页移动端留出左右边距，避免内容贴满屏幕 */
  .notification-pane {
    padding: 0 0.75rem;
    box-sizing: border-box;
  }

  /* 排期标签页优化*/
  .schedule-tab-pane {
    padding: 0;
    min-height: auto;
  }

  /* 请求表单区域 */
  .request-pane {
    flex-direction: column;
    gap: 16px;
    overflow-x: hidden; /* 防止横向溢出 */
    max-width: 100%; /* 确保不超过视口宽度*/
    padding: 0 0.5rem; /* 添加左右内边距，防止内容贴边 */
    box-sizing: border-box; /* 确保padding计入总宽度*/
  }

  /* 登录选项 */
  .login-options {
    display: flex;
    align-items: center;
  }

  .login-options .btn-outline {
    padding: 6px 14px;
    font-size: 12px;
    border-radius: 6px;
    background: var(--color-accent-alpha-15);
    border: 1px solid var(--color-accent-alpha-30);
  }
}

/* 小屏幕设备额外优化*/
@media (max-width: 480px) {
  .top-bar {
    padding: 8px 10px;
  }

  .logo-image {
    width: 90px;
  }

  .school-logo {
    max-width: 100px;
    max-height: 32px;
  }

  .action-button {
    padding: 5px 8px;
    font-size: 10px;
  }

  .site-title {
    margin: 6px 0 10px;
    padding: 0 12px;
  }

  .site-title h2 {
    font-size: 16px;
  }

  .tab-content-container {
    padding: 0 4px calc(80px + env(safe-area-inset-bottom, 0px));
  }

  .notification-header {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr);
    align-items: center;
    gap: 0.65rem 0.35rem;
  }

  .notification-title {
    grid-column: 1;
    grid-row: 1;
    max-width: 90px;
    font-size: 1.05rem;
    line-height: 1.15;
  }

  .notification-header-main {
    display: contents;
  }

  .notification-filter {
    grid-column: 2;
    grid-row: 1;
  }

  .notification-filter button {
    min-height: 26px;
    padding: 0.25rem 0.5rem;
    font-size: 0.7rem;
  }

  .notification-header-actions {
    grid-column: 3;
    grid-row: 1;
    width: auto;
    gap: 0.35rem;
    margin-left: auto;
  }

  .notification-search {
    grid-column: 1 / -1;
    grid-row: 2;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin: 0;
    box-sizing: border-box;
    border-radius: 8px;
  }

  .mark-all-read-header {
    gap: 0.25rem;
    padding: 0.4rem 0.5rem;
    font-size: 0.7rem;
  }

  .mark-all-read-header span {
    white-space: normal;
    line-height: 1.15;
    text-align: center;
  }

  .notification-unread-summary {
    min-height: 66px;
    padding: 0.7rem 0.75rem;
  }

  .notification-unread-summary-action {
    font-size: 0.7rem;
  }

  /* 窄屏压缩登录按钮，保证“登录”文字横向排布 */
  .login-options .login-btn {
    padding: 8px 14px;
    font-size: 13px;
    gap: 6px;
  }
}

/* 超小屏幕设备 */
@media (max-width: 360px) {
  .logo-image {
    width: 60px;
  }

  .school-logo {
    max-width: 80px;
    max-height: 28px;
  }

  .action-button {
    padding: 4px 6px;
    font-size: 9px;
  }

  .section-tab {
    font-size: 9px;
  }

  .login-options .login-btn {
    padding: 8px 10px;
    font-size: 12px;
    gap: 4px;
  }
}

/* 弹窗遮罩层*/
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--mask-60);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: overlay-fade-in 0.4s ease-out;
}

@keyframes overlay-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 弹窗内容 */
.modal-content {
  background: linear-gradient(135deg, var(--panel-bg-overlay) 0%, var(--panel-bg-darker) 100%);
  border-radius: 20px;
  border: 1px solid var(--overlay-10);
  box-shadow: 0 25px 50px -12px var(--mask-50);
  max-width: 420px;
  width: 90%;
  overflow: hidden;
  animation: modal-slide-up 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modal-slide-up {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 弹窗头部 */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 28px 16px;
  border-bottom: 1px solid var(--overlay-8);
}

.modal-header h2 {
  font-family:
    'MiSans',
    system-ui,
    -apple-system,
    sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: 0.02em;
}

/* 关闭按钮 */
.close-button {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--overlay-8);
  border: none;
  color: var(--overlay-60);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background: var(--overlay-15);
  color: var(--text-primary);
  transform: rotate(90deg);
}

/* 弹窗主体 */
.modal-body {
  padding: 24px 28px 28px;
}

.rules-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.rules-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.rules-subtitle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.rules-icon {
  color: var(--color-accent-light);
}

.rules-text {
  font-size: 14px;
  color: var(--overlay-60);
  line-height: 1.6;
  margin: 0;
}

.guidelines-content {
  font-size: 14px;
  color: var(--overlay-60);
  line-height: 1.6;
}

.default-rules {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rule-item {
  display: flex;
  font-size: 14px;
  color: var(--overlay-60);
  line-height: 1.5;
}

.rule-item span {
  margin-right: 0.5rem;
  color: var(--overlay-30);
  font-weight: 600;
}

/* 年度报告弹窗 */
.year-review-overlay {
  backdrop-filter: blur(8px);
  background: var(--mask-40);
}

.year-review-card {
  position: relative;
  width: 90%;
  max-width: 400px;
  background: var(--panel-bg-darker);
  border-radius: 32px;
  overflow: hidden;
  border: 1px solid var(--overlay-10);
  box-shadow: 0 25px 50px -12px var(--mask-50);
  animation: card-appear 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.card-glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, var(--index-card-glow) 0%, transparent 70%);
  pointer-events: none;
}

.card-pattern {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(var(--overlay-5) 1px, transparent 1px);
  background-size: 20px 20px;
  opacity: 0.5;
}

.card-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--overlay-5);
  border: 1px solid var(--overlay-10);
  color: var(--overlay-40);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
}

.card-close:hover {
  background: var(--overlay-10);
  color: var(--text-primary);
  transform: translateY(2px);
}

.card-content {
  position: relative;
  padding: 40px 32px;
  text-align: center;
  z-index: 5;
}

.brand-badge {
  display: inline-block;
  padding: 4px 12px;
  background: var(--index-brand-badge-bg);
  border: 1px solid var(--index-brand-badge-border);
  border-radius: 99px;
  color: var(--color-collab-light);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  margin-bottom: 32px;
}

.visual-container {
  position: relative;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.main-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--color-collab) 0%, var(--color-collab-hover) 100%);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  box-shadow: 0 10px 25px -5px var(--index-main-icon-shadow);
  z-index: 2;
  transform: rotate(-5deg);
}

.music-bars {
  position: absolute;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 40px;
  opacity: 0.3;
}

.bar {
  width: 4px;
  background: var(--color-collab);
  border-radius: 2px;
  animation: bar-dance 1.2s ease-in-out infinite;
}

.bar:nth-child(1) {
  height: 20px;
  animation-delay: 0.1s;
}
.bar:nth-child(2) {
  height: 35px;
  animation-delay: 0.3s;
}
.bar:nth-child(3) {
  height: 25px;
  animation-delay: 0.2s;
}
.bar:nth-child(4) {
  height: 40px;
  animation-delay: 0.4s;
}
.bar:nth-child(5) {
  height: 30px;
  animation-delay: 0.2s;
}

@keyframes bar-dance {
  0%,
  100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(0.6);
  }
}

.card-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 12px;
  letter-spacing: -0.01em;
}

.card-description {
  font-size: 15px;
  color: var(--overlay-50);
  line-height: 1.6;
  margin-bottom: 32px;
}

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn-primary {
  width: 100%;
  padding: 16px;
  background: var(--text-primary);
  border: none;
  border-radius: 16px;
  color: var(--bg-primary);
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px var(--overlay-10);
  background: var(--panel-bg-deep);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-secondary {
  width: 100%;
  padding: 14px;
  background: transparent;
  border: 1px solid var(--overlay-10);
  border-radius: 16px;
  color: var(--overlay-60);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: var(--overlay-5);
  color: var(--text-primary);
  border-color: var(--overlay-20);
}

@keyframes card-appear {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 覆盖旧动画*/
.modal-animation-enter-active,
.modal-animation-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-animation-enter-from,
.modal-animation-leave-to {
  opacity: 0;
  backdrop-filter: blur(0);
}

.modal-animation-enter-from .year-review-card,
.modal-animation-leave-to .year-review-card {
  transform: translateY(40px) scale(0.9);
}

/* 波纹效果 */
.section-tab {
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
}

.ripple-effect {
  position: absolute;
  border-radius: 50%;
  background-color: var(--overlay-30);
  transform: scale(0);
  animation: ripple 0.6s linear;
  pointer-events: none;
  width: 100px;
  height: 100px;
  margin-left: -50px; /* 居中定位 */
  margin-top: -50px; /* 居中定位 */
}

@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

/* 确保全宽显示 */
.full-width,
.full-width > div {
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
  padding: 0 !important;
  margin: 0 !important;
  display: block !important;
}

/* 通知标签上的未读徽章 */
.notification-badge-tab {
  position: absolute; /* 修改为绝对定位，防止挤压图标 */
  top: 0;
  right: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-accent);
  display: inline-block;
  z-index: 2;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 var(--index-pulsing-ring-shadow);
  }
  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 5px transparent;
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 transparent;
  }
}

/* 禁用的标签页样式 */
.section-tab.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 未登录提示样式*/
.login-required-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 0;
}

.login-required-content {
  text-align: center;
  max-width: 400px;
  padding: 30px;
  background-color: var(--index-visualizer-bg);
  border-radius: 12px;
  border: 1px solid var(--overlay-10);
  box-shadow: 0 5px 20px var(--mask-20);
}

.login-icon {
  font-size: 3rem;
  margin-bottom: 15px;
}

.login-required-content h3 {
  font-size: 1.5rem;
  margin-bottom: 10px;
  color: var(--light);
}

.login-required-content p {
  margin-bottom: 20px;
  color: var(--overlay-70);
}

.login-button {
  background: linear-gradient(180deg, var(--color-accent) 0%, var(--color-accent) 100%);
  border: none;
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.login-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px var(--primary-30);
}
</style>
