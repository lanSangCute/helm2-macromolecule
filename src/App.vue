<template>
  <div id="app">
    <el-container class="main-container">
      <el-header class="app-header">
        <h1>🧬 HELM2 大分子编辑器</h1>
        <p class="subtitle">基于 Vue3 的生物大分子编辑工具</p>
      </el-header>
      
      <el-main class="app-main">
        <HELMEditor />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import HELMEditor from './components/HELMEditor.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.main-container {
  height: 100%;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.app-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.subtitle {
  font-size: 12px;
  opacity: 0.9;
  margin: 4px 0 0 0;
}

.app-main {
  padding: 0;
  overflow: hidden;
}
</style>
