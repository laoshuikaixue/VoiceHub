<template>
  <div class="site-config-manager">
    <div class="header">
      <h3>站点配置</h3>
      <p class="description">管理站点标题、Logo、描述等基本信息</p>
    </div>

    <div v-if="!loading" class="config-form">
      <div class="form-group">
        <label for="siteTitle">站点标题</label>
        <input
            id="siteTitle"
            v-model="formData.siteTitle"
            maxlength="100"
            placeholder="请输入站点标题"
            type="text"
        />
        <small class="help-text">显示在浏览器标题栏和页面顶部</small>
      </div>

      <div class="form-group">
        <label for="siteLogoUrl">站点Logo URL</label>
        <input
            id="siteLogoUrl"
            v-model="formData.siteLogoUrl"
            placeholder="请输入Logo图片URL"
            type="url"
        />
        <small class="help-text">支持相对路径（如 /logo.png）或完整URL</small>
      </div>


      <div class="form-group">
        <label for="schoolLogoHomeUrl">首页学校Logo URL（可选）</label>
        <input
            id="schoolLogoHomeUrl"
            v-model="formData.schoolLogoHomeUrl"
            placeholder="请输入首页用的学校Logo图片URL"
            type="url"
        />
        <small class="help-text">设置后将在首页VoiceHub Logo旁边显示学校Logo（大尺寸）</small>
      </div>

      <div class="form-group">
        <label for="schoolLogoPrintUrl">打印页学校Logo URL（可选）</label>
        <input
            id="schoolLogoPrintUrl"
            v-model="formData.schoolLogoPrintUrl"
            placeholder="请输入打印页用的学校Logo图片URL"
            type="url"
        />
        <small class="help-text">设置后将在排期打印页面显示学校Logo（小尺寸）</small>
      </div>

      <div class="form-group">
        <label for="siteDescription">站点描述</label>
        <textarea
            id="siteDescription"
            v-model="formData.siteDescription"
            maxlength="200"
            placeholder="请输入站点描述"
            rows="3"
        ></textarea>
        <small class="help-text">用于SEO和页面介绍，建议控制在200字以内</small>
      </div>

      <div class="form-group">
        <label for="submissionGuidelines">投稿须知</label>
        <textarea
            id="submissionGuidelines"
            v-model="formData.submissionGuidelines"
            maxlength="1000"
            placeholder="请输入投稿须知内容"
            rows="5"
        ></textarea>
        <small class="help-text">向用户说明投稿规则和注意事项</small>
      </div>

      <div class="form-group">
        <label for="icpNumber">备案号（可选）</label>
        <input
            id="icpNumber"
            v-model="formData.icpNumber"
            maxlength="50"
            placeholder="请输入ICP备案号"
            type="text"
        />
        <small class="help-text">如有备案号，将显示在页面底部</small>
      </div>

      <!-- 黑名单设置 -->
      <div class="form-section">
        <h4 class="section-title">黑名单设置</h4>

        <div class="form-group">
          <label class="checkbox-label">
            <input
                v-model="formData.enableBlacklist"
                type="checkbox"
            />
            <span class="checkbox-text">启用黑名单功能</span>
          </label>
          <small class="help-text">开启后，系统将检查投稿内容是否包含黑名单关键词</small>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
                v-model="formData.showBlacklistKeywords"
                type="checkbox"
            />
            <span class="checkbox-text">显示具体黑名单关键词</span>
          </label>
          <small class="help-text">开启后，在投稿时会显示"包含关键词：XXX"；关闭时只显示"包含关键词"</small>
        </div>
      </div>

      <!-- 隐私设置 -->
      <div class="form-section">
        <h4 class="section-title">隐私设置</h4>

        <div class="form-group">
          <label class="checkbox-label">
            <input
                v-model="formData.hideStudentInfo"
                type="checkbox"
            />
            <span class="checkbox-text">隐藏学生信息</span>
          </label>
          <small class="help-text">开启后，未登录用户将无法查看完整的学生姓名</small>
        </div>
      </div>

      <div class="form-actions">
        <button
            :disabled="saving"
            class="btn btn-primary"
            @click="saveConfig"
        >
          <span v-if="saving">保存中...</span>
          <span v-else>保存配置</span>
        </button>

        <button
            :disabled="saving"
            class="btn btn-secondary"
            @click="resetForm"
        >
          重置
        </button>
      </div>
    </div>

    <div v-else class="loading">
      <div class="loading-spinner"></div>
      <p>加载配置中...</p>
    </div>


  </div>
</template>

<script setup>
import {computed, onMounted, ref} from 'vue'
import {useAuth} from '~/composables/useAuth'

const {getAuthConfig} = useAuth()

const loading = ref(true)
const saving = ref(false)

const defaultSubmissionGuidelines = `1. 投稿时无需加入书名号
2. 除DJ外，其他类型歌曲均接收（包括小语种）
3. 禁止投递含有违规内容的歌曲
4. 点播的歌曲将由管理员进行审核
5. 审核通过后将安排在播放时段播出
6. 提交即表明我已阅读投稿须知并已知该歌曲有概率无法播出
7. 本系统仅提供音乐搜索和播放管理功能，不存储任何音乐文件。所有音乐内容均来自第三方音乐平台，版权归原平台及版权方所有。用户点歌时请确保遵守相关音乐平台的服务条款，尊重音乐作品版权。我们鼓励用户支持正版音乐，在官方平台购买和收听喜爱的音乐作品。
8. 最终解释权归广播站所有`

const formData = ref({
  siteTitle: '',
  siteLogoUrl: '',
  schoolLogoHomeUrl: '',
  schoolLogoPrintUrl: '',
  siteDescription: '',
  submissionGuidelines: '',
  icpNumber: '',
  showBlacklistKeywords: false,
  hideStudentInfo: true
})

const originalData = ref({})

// 加载配置
const loadConfig = async () => {
  try {
    loading.value = true
    const response = await fetch('/api/admin/system-settings', {
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error('获取配置失败')
    }

    const data = await response.json()

    formData.value = {
      siteTitle: data.siteTitle || '',
      siteLogoUrl: data.siteLogoUrl || '',
      schoolLogoHomeUrl: data.schoolLogoHomeUrl || '',
      schoolLogoPrintUrl: data.schoolLogoPrintUrl || '',
      siteDescription: data.siteDescription || '',
      submissionGuidelines: data.submissionGuidelines || defaultSubmissionGuidelines,
      icpNumber: data.icpNumber || '',
      showBlacklistKeywords: data.showBlacklistKeywords || false,
      hideStudentInfo: data.hideStudentInfo ?? true
    }

    // 保存原始数据用于重置
    originalData.value = {...formData.value}

  } catch (error) {
    console.error('加载配置失败:', error)
    // 使用默认值
    formData.value = {
      siteTitle: 'VoiceHub',
      siteLogoUrl: '/favicon.ico',
      schoolLogoHomeUrl: '',
      schoolLogoPrintUrl: '',
      siteDescription: '校园广播站点歌系统 - 让你的声音被听见',
      submissionGuidelines: defaultSubmissionGuidelines,
      icpNumber: '',
      showBlacklistKeywords: false
    }
    originalData.value = {...formData.value}
  } finally {
    loading.value = false
  }
}

// 保存配置
const saveConfig = async () => {
  try {
    saving.value = true
    // 处理空值，使用默认值，确保二选一逻辑
    const configToSave = {
      siteTitle: formData.value.siteTitle.trim() || '校园广播站点歌系统',
      siteLogoUrl: formData.value.siteLogoUrl.trim() || '/favicon.ico',
      schoolLogoHomeUrl: formData.value.schoolLogoHomeUrl.trim(),
      schoolLogoPrintUrl: formData.value.schoolLogoPrintUrl.trim(),
      siteDescription: formData.value.siteDescription.trim() || '校园广播站点歌系统 - 让你的声音被听见',
      submissionGuidelines: formData.value.submissionGuidelines.trim() || defaultSubmissionGuidelines,
      icpNumber: formData.value.icpNumber.trim(),
      showBlacklistKeywords: formData.value.showBlacklistKeywords
    }

    const response = await fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        ...configToSave,
        hideStudentInfo: formData.value.hideStudentInfo
      })
    })

    if (!response.ok) {
      throw new Error('保存配置失败')
    }

    // 更新表单数据和原始数据
    formData.value = {...configToSave}
    originalData.value = {...configToSave}

    // 显示成功通知
    window.$showNotification('配置保存成功！', 'success')

  } catch (error) {
    console.error('保存配置失败:', error)
    window.$showNotification('保存配置失败，请重试', 'error')
  } finally {
    saving.value = false
  }
}

// 重置表单
const resetForm = () => {
  formData.value = {...originalData.value}
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.site-config-manager {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 20px;
  box-sizing: border-box;
}

.header {
  margin-bottom: 30px;
}

.header h3 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.config-form {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 30px;
}

.form-group {
  margin-bottom: 24px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border-secondary);
}

.section-title {
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-weight: 500;
  color: var(--text-primary);
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin-right: 8px;
  cursor: pointer;
}

.checkbox-text {
  font-size: 14px;
}

.submission-limits {
  margin-top: 16px;
  padding: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-secondary);
  border-radius: 8px;
}

.limit-type-selection {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.radio-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-weight: 500;
  color: var(--text-primary);
}

.radio-label input[type="radio"] {
  width: auto;
  margin-right: 8px;
  cursor: pointer;
}

.radio-text {
  font-size: 14px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
  font-size: 14px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border-secondary);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.help-text {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid var(--border-secondary);
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%);
  transform: translateY(-1px);
  box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4);
}

.btn-secondary {
  background: linear-gradient(135deg, #64748b 0%, #475569 100%);
  color: white;
  border: 1px solid rgba(71, 85, 105, 0.3);
  box-shadow: 0 4px 12px rgba(100, 116, 139, 0.3);
}

.btn-secondary:hover:not(:disabled) {
  background: linear-gradient(135deg, #475569 0%, #334155 100%);
  transform: translateY(-1px);
  box-shadow: 0 8px 25px rgba(100, 116, 139, 0.4);
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-secondary);
  border-top: 3px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .site-config-manager {
    padding: 16px;
  }

  .config-form,
  .preview-section {
    padding: 16px;
  }

  .form-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>