<template>
  <div class="notification-test">
    <div class="test-container">
      <h1>通知系统测试</h1>
      <p>测试新的多通知系统功能，包括显示时长和流畅动画</p>
      
      <div class="test-buttons">
        <button @click="showSuccessNotification" class="btn success">
          显示成功通知
        </button>
        
        <button @click="showErrorNotification" class="btn error">
          显示错误通知
        </button>
        
        <button @click="showInfoNotification" class="btn info">
          显示信息通知
        </button>
        
        <button @click="showLongNotification" class="btn long">
          显示长时间通知 (10秒)
        </button>
        
        <button @click="showPersistentNotification" class="btn persistent">
          显示持久通知 (不自动关闭)
        </button>
        
        <button @click="showMultipleNotifications" class="btn multiple">
          显示多个通知
        </button>
        
        <button @click="clearAllNotifications" class="btn clear">
          清除所有通知
        </button>
      </div>
      
      <div class="description">
        <h3>功能特点：</h3>
        <ul>
          <li>支持多个通知同时显示</li>
          <li>新通知从右侧滑入，往下展开</li>
          <li>移除通知时其他通知向上移动，动画流畅</li>
          <li>支持自定义显示时长</li>
          <li>支持持久通知（不自动关闭）</li>
          <li>进度条显示剩余时间</li>
          <li>悬停效果和响应式设计</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'

// 显示成功通知
const showSuccessNotification = () => {
  if (window.$showNotification) {
    window.$showNotification('操作成功完成！', 'success', true, 3000)
  }
}

// 显示错误通知
const showErrorNotification = () => {
  if (window.$showNotification) {
    window.$showNotification('发生了一个错误，请重试。', 'error', true, 4000)
  }
}

// 显示信息通知
const showInfoNotification = () => {
  if (window.$showNotification) {
    window.$showNotification('这是一条信息提示。', 'info', true, 3000)
  }
}

// 显示长时间通知
const showLongNotification = () => {
  if (window.$showNotification) {
    window.$showNotification('这是一个长时间显示的通知，将显示10秒钟。', 'info', true, 10000)
  }
}

// 显示持久通知
const showPersistentNotification = () => {
  if (window.$showNotification) {
    window.$showNotification('这是一个持久通知，不会自动关闭，需要手动点击关闭按钮。', 'info', false)
  }
}

// 显示多个通知
const showMultipleNotifications = () => {
  if (window.$showNotification) {
    window.$showNotification('第一个通知', 'success', true, 5000)
    
    setTimeout(() => {
      window.$showNotification('第二个通知', 'info', true, 4000)
    }, 500)
    
    setTimeout(() => {
      window.$showNotification('第三个通知', 'error', true, 6000)
    }, 1000)
    
    setTimeout(() => {
      window.$showNotification('第四个通知', 'success', true, 3000)
    }, 1500)
  }
}

// 清除所有通知
const clearAllNotifications = () => {
  if (window.$clearNotifications) {
    window.$clearNotifications()
  }
}

// 页面标题
useHead({
  title: '通知系统测试 - VoiceHub'
})
</script>

<style scoped>
.notification-test {
  min-height: 100vh;
  background-color: #121318;
  color: #FFFFFF;
  padding: 2rem;
  font-family: 'MiSans', sans-serif;
}

.test-container {
  max-width: 800px;
  margin: 0 auto;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  text-align: center;
  background: linear-gradient(135deg, #0B5AFE, #10b981);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

p {
  text-align: center;
  margin-bottom: 3rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.1rem;
}

.test-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 3rem;
}

.btn {
  padding: 1rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: white;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.btn.success {
  background: linear-gradient(135deg, #10b981, #059669);
}

.btn.error {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.btn.info {
  background: linear-gradient(135deg, #0B5AFE, #0043F8);
}

.btn.long {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
}

.btn.persistent {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.btn.multiple {
  background: linear-gradient(135deg, #06b6d4, #0891b2);
}

.btn.clear {
  background: linear-gradient(135deg, #6b7280, #4b5563);
}

.description {
  background: rgba(255, 255, 255, 0.05);
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.description h3 {
  margin-bottom: 1rem;
  color: #0B5AFE;
}

.description ul {
  list-style: none;
  padding: 0;
}

.description li {
  padding: 0.5rem 0;
  position: relative;
  padding-left: 1.5rem;
}

.description li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #10b981;
  font-weight: bold;
}

@media (max-width: 768px) {
  .test-buttons {
    grid-template-columns: 1fr;
  }
  
  h1 {
    font-size: 2rem;
  }
}
</style>