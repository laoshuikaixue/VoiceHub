<template>
  <div class="smtp-manager">
    <div class="section-header">
      <h2>SMTP邮件服务配置</h2>
      <p>配置邮件服务器以发送邮件通知</p>
    </div>

    <div class="config-section">
      <div class="form-row">
        <label class="switch-label">
          <input
              v-model="config.smtpEnabled"
              class="switch-input"
              type="checkbox"
          >
          <span class="switch-slider"></span>
          启用SMTP邮件服务
        </label>
      </div>

      <div v-if="config.smtpEnabled" class="smtp-config">
        <div class="form-group">
          <label>SMTP服务器地址</label>
          <input
              v-model="config.smtpHost"
              class="form-input"
              placeholder="例如: smtp.gmail.com"
              type="text"
          >
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>端口</label>
            <input
                v-model.number="config.smtpPort"
                class="form-input"
                placeholder="587"
                type="number"
            >
          </div>
          <div class="form-group">
            <label>SSL/TLS设置</label>
            <div class="ssl-button-group">
              <button
                  :class="['ssl-button', { 'active': config.smtpSecure }]"
                  type="button"
                  @click="config.smtpSecure = true"
              >
                启用SSL/TLS
              </button>
              <button
                  :class="['ssl-button', { 'active': !config.smtpSecure }]"
                  type="button"
                  @click="config.smtpSecure = false"
              >
                禁用SSL/TLS
              </button>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>用户名</label>
            <input
                v-model="config.smtpUsername"
                class="form-input"
                placeholder="邮箱地址或用户名"
                type="text"
            >
          </div>
          <div class="form-group">
            <label>密码</label>
            <input
                v-model="config.smtpPassword"
                class="form-input"
                placeholder="密码或应用专用密码"
                type="password"
            >
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>发件人邮箱</label>
            <input
                v-model="config.smtpFromEmail"
                class="form-input"
                placeholder="发件人邮箱地址"
                type="email"
            >
          </div>
          <div class="form-group">
            <label>发件人姓名</label>
            <input
                v-model="config.smtpFromName"
                class="form-input"
                placeholder="校园广播站"
                type="text"
            >
          </div>
        </div>

        <div class="test-section">
          <h3>测试SMTP连接</h3>
          <div class="test-form">
            <div class="form-group">
              <label>测试邮箱</label>
              <input
                  v-model="testEmail"
                  class="form-input"
                  placeholder="输入测试邮箱地址"
                  type="email"
              >
            </div>
            <div class="test-buttons">
              <button
                  :disabled="testing || !config.smtpEnabled"
                  class="btn btn-secondary"
                  @click="testConnection"
              >
                {{ testing ? '测试中...' : '测试连接' }}
              </button>
              <button
                  :disabled="testing || !testEmail || !config.smtpEnabled"
                  class="btn btn-secondary"
                  @click="sendTestEmail"
              >
                {{ testing ? '发送中...' : '发送测试邮件' }}
              </button>
            </div>
          </div>

          <div v-if="testResult" :class="['test-result', testResult.success ? 'success' : 'error']">
            <Icon :name="testResult.success ? 'check-circle' : 'x-circle'"/>
            {{ testResult.message }}
          </div>
        </div>
      </div>

      <div class="action-buttons">
        <button
            :disabled="saving"
            class="btn btn-primary"
            @click="saveConfig"
        >
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
        <button
            class="btn btn-secondary"
            @click="resetConfig"
        >
          重置
        </button>
      </div>
    </div>

    <!-- 使用说明 -->
    <div class="help-section">
      <h3>配置说明</h3>
      <div class="help-content">
        <h4>常用邮件服务提供商配置：</h4>
        <div class="provider-configs">
          <div class="provider-item">
            <strong>Gmail</strong>
            <p>服务器: smtp.gmail.com, 端口: 587, 使用SSL/TLS</p>
            <p>需要使用应用专用密码，不能使用普通密码</p>
          </div>
          <div class="provider-item">
            <strong>QQ邮箱</strong>
            <p>服务器: smtp.qq.com, 端口: 587, 使用SSL/TLS</p>
            <p>需要在QQ邮箱设置中开启SMTP服务并获取授权码</p>
          </div>
          <div class="provider-item">
            <strong>163邮箱</strong>
            <p>服务器: smtp.163.com, 端口: 994, 使用SSL/TLS</p>
            <p>需要在邮箱设置中开启SMTP服务并设置授权密码</p>
          </div>
        </div>

        <h4>安全提示：</h4>
        <ul>
          <li>建议使用专门的邮箱账号用于系统通知</li>
          <li>使用应用专用密码而不是账号密码</li>
          <li>定期更换密码以确保安全</li>
          <li>测试成功后再启用服务</li>
        </ul>
      </div>
    </div>

    <!-- 模板管理 -->
    <div class="templates-section" style="margin-top: 24px;">
      <h3 style="color:#fff; font-size:18px; margin:0 0 12px;">邮件模板</h3>
      <EmailTemplateManager/>
    </div>
  </div>
</template>

<script setup>
import {onMounted, ref} from 'vue'
import {useToast} from '~/composables/useToast'
import EmailTemplateManager from '~/components/Admin/EmailTemplateManager.vue'

const {showNotification} = useToast()

// 响应式数据
const config = ref({
  smtpEnabled: false,
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUsername: '',
  smtpPassword: '',
  smtpFromEmail: '',
  smtpFromName: '校园广播站'
})

const testEmail = ref('')
const testing = ref(false)
const saving = ref(false)
const testResult = ref(null)
const originalConfig = ref({})

// 加载配置
const loadConfig = async () => {
  try {
    const response = await $fetch('/api/admin/system-settings')

    config.value = {
      smtpEnabled: response.smtpEnabled || false,
      smtpHost: response.smtpHost || '',
      smtpPort: response.smtpPort || 587,
      smtpSecure: response.smtpSecure || false,
      smtpUsername: response.smtpUsername || '',
      smtpPassword: response.smtpPassword || '',
      smtpFromEmail: response.smtpFromEmail || '',
      smtpFromName: response.smtpFromName || '校园广播站'
    }

    // 保存原始配置用于重置
    originalConfig.value = {...config.value}
  } catch (error) {
    console.error('加载SMTP配置失败:', error)
    showNotification('加载配置失败', 'error')
  }
}

// 保存配置
const saveConfig = async () => {
  if (config.value.smtpEnabled) {
    // 验证必填字段
    if (!config.value.smtpHost || !config.value.smtpUsername || !config.value.smtpPassword) {
      showNotification('请填写完整的SMTP配置信息', 'error')
      return
    }
  }

  saving.value = true
  try {
    await $fetch('/api/admin/system-settings', {
      method: 'POST',
      body: config.value
    })

    originalConfig.value = {...config.value}
    showNotification('SMTP配置保存成功', 'success')
  } catch (error) {
    console.error('保存SMTP配置失败:', error)
    showNotification(error.data?.message || '保存配置失败', 'error')
  } finally {
    saving.value = false
  }
}

// 重置配置
const resetConfig = () => {
  config.value = {...originalConfig.value}
  testResult.value = null
  showNotification('配置已重置', 'info')
}

// 测试连接
const testConnection = async () => {
  if (!config.value.smtpEnabled || !config.value.smtpHost) {
    showNotification('请先配置SMTP服务器信息', 'error')
    return
  }

  testing.value = true
  testResult.value = null

  try {
    const response = await $fetch('/api/admin/smtp/test-connection', {
      method: 'POST',
      body: config.value
    })

    testResult.value = response
  } catch (error) {
    console.error('测试连接失败:', error)
    testResult.value = {
      success: false,
      message: error.data?.message || '测试连接失败'
    }
  } finally {
    testing.value = false
  }
}

// 发送测试邮件
const sendTestEmail = async () => {
  if (!testEmail.value) {
    showNotification('请输入测试邮箱地址', 'error')
    return
  }

  testing.value = true
  testResult.value = null

  try {
    const response = await $fetch('/api/admin/smtp/test-email', {
      method: 'POST',
      body: {
        ...config.value,
        testEmail: testEmail.value
      }
    })

    testResult.value = response
  } catch (error) {
    console.error('发送测试邮件失败:', error)
    testResult.value = {
      success: false,
      message: error.data?.message || '发送测试邮件失败'
    }
  } finally {
    testing.value = false
  }
}

// 生命周期
onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.smtp-manager {
  background: #111111;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #1f1f1f;
}

.section-header {
  margin-bottom: 32px;
}

.section-header h2 {
  color: #ffffff;
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.section-header p {
  color: #888888;
  margin: 0;
}

.config-section {
  margin-bottom: 32px;
}

.form-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.form-group {
  flex: 1;
}

.form-group-switch {
  display: flex;
  flex-direction: column;
}

.switch-wrapper {
  margin-top: 8px;
}

.form-group label {
  display: block;
  color: #cccccc;
  font-weight: 500;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 12px;
  background: #1a1a1a;
  border: 1px solid #333333;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  transition: all 0.2s ease;
}

.form-input:focus {
  border-color: #007bff;
  outline: none;
  background: #222222;
}

.form-input::placeholder {
  color: #666666;
}

.switch-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  color: #cccccc;
  font-weight: 500;
}

.switch-input {
  display: none;
}

.switch-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background: #333333;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.switch-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #ffffff;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.switch-input:checked + .switch-slider {
  background: #007bff;
}

.switch-input:checked + .switch-slider::before {
  transform: translateX(20px);
}

/* SSL按钮组样式 */
.ssl-button-group {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.ssl-button {
  padding: 10px 16px;
  border: 2px solid #4a5568;
  border-radius: 8px;
  background: #2d3748;
  color: #9ca3af;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.ssl-button:hover {
  border-color: #6b7280;
  background: #374151;
  color: #ffffff;
}

.ssl-button.active {
  border-color: #22c55e;
  background: #22c55e;
  color: #ffffff;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
}

.ssl-button.active:hover {
  background: #16a34a;
  border-color: #16a34a;
}

.smtp-config {
  background: #0f0f0f;
  border-radius: 8px;
  padding: 24px;
  border: 1px solid #1f1f1f;
  margin-top: 20px;
}

.test-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #1f1f1f;
}

.test-section h3 {
  color: #ffffff;
  font-size: 18px;
  margin: 0 0 16px 0;
}

.test-form {
  display: flex;
  gap: 16px;
  align-items: end;
  margin-bottom: 16px;
}

.test-buttons {
  display: flex;
  gap: 12px;
}

.test-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
}

.test-result.success {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.test-result.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-size: 14px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #333333;
  color: #ffffff;
  border: 1px solid #444444;
}

.btn-secondary:hover:not(:disabled) {
  background: #444444;
}

.help-section {
  background: #0f0f0f;
  border-radius: 8px;
  padding: 24px;
  border: 1px solid #1f1f1f;
}

.help-section h3 {
  color: #ffffff;
  font-size: 18px;
  margin: 0 0 16px 0;
}

.help-section h4 {
  color: #cccccc;
  font-size: 16px;
  margin: 16px 0 12px 0;
}

.help-content {
  color: #888888;
  line-height: 1.6;
}

.provider-configs {
  display: grid;
  gap: 16px;
  margin: 16px 0;
}

.provider-item {
  background: #1a1a1a;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #2a2a2a;
}

.provider-item strong {
  color: #ffffff;
  display: block;
  margin-bottom: 8px;
}

.provider-item p {
  margin: 4px 0;
  font-size: 14px;
}

.help-content ul {
  margin: 12px 0;
  padding-left: 20px;
}

.help-content li {
  margin: 8px 0;
  font-size: 14px;
}

@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    gap: 12px;
  }

  .test-form {
    flex-direction: column;
    align-items: stretch;
  }

  .test-buttons {
    flex-direction: column;
  }

  .action-buttons {
    flex-direction: column;
  }

  .provider-configs {
    grid-template-columns: 1fr;
  }
}
</style>
