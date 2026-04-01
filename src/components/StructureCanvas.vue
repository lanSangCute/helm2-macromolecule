<template>
  <div 
    ref="canvasContainerRef"
    class="structure-canvas-container"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
    @wheel="handleWheel"
  >
    <canvas
      ref="canvasRef"
      class="structure-canvas"
    />
    <div class="canvas-hint">
      <span>🖱️ 拖拽平移</span>
      <span>🔍 滚轮缩放</span>
      <span>👆 点击选中</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'

const props = defineProps({
  sequence: {
    type: Array,
    default: () => []
  },
  polymerType: {
    type: String,
    default: 'PEPTIDE'
  },
  connections: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['monomer-select'])

const canvasRef = ref(null)
const canvasContainerRef = ref(null)

// 画布状态
const ctx = ref(null)
const canvasSize = ref({ width: 800, height: 400 })
const viewport = ref({
  offsetX: 50,
  offsetY: 200,
  scale: 1
})

// 交互状态
const isDragging = ref(false)
const lastMousePos = ref({ x: 0, y: 0 })
const selectedMonomerIndex = ref(-1)

// 单体配置
const MONOMER_CONFIG = {
  PEPTIDE: {
    shape: 'circle',
    radius: 25,
    fontSize: 10,
    color: '#409eff',
    bgColor: '#ecf5ff',
    selectedColor: '#67c23a',
    selectedBgColor: '#f0f9eb'
  },
  RNA: {
    shape: 'square',
    size: 40,
    fontSize: 14,
    color: '#00bcd4',
    bgColor: '#f0f9ff',
    selectedColor: '#67c23a',
    selectedBgColor: '#f0f9eb'
  },
  DNA: {
    shape: 'square',
    size: 40,
    fontSize: 14,
    color: '#4caf50',
    bgColor: '#f0f9ff',
    selectedColor: '#67c23a',
    selectedBgColor: '#f0f9eb'
  }
}

// 计算单体位置
function getMonomerPositions() {
  const positions = []
  const spacing = 70 // 单体间距
  
  props.sequence.forEach((monomer, index) => {
    const x = viewport.value.offsetX + index * spacing * viewport.value.scale
    const y = viewport.value.offsetY
    
    positions.push({
      index,
      x,
      y,
      monomer,
      ...getMonomerBounds(index, x, y)
    })
  })
  
  return positions
}

// 获取单体边界
function getMonomerBounds(index, x, y) {
  const config = MONOMER_CONFIG[props.polymerType] || MONOMER_CONFIG.PEPTIDE
  
  if (config.shape === 'circle') {
    const radius = config.radius * viewport.value.scale
    return {
      left: x - radius,
      right: x + radius,
      top: y - radius,
      bottom: y + radius,
      radius
    }
  } else {
    const size = config.size * viewport.value.scale
    const halfSize = size / 2
    return {
      left: x - halfSize,
      right: x + halfSize,
      top: y - halfSize,
      bottom: y + halfSize,
      size
    }
  }
}

// 绘制单体
function drawMonomer(position) {
  const { x, y, monomer, index } = position
  const config = MONOMER_CONFIG[props.polymerType] || MONOMER_CONFIG.PEPTIDE
  const isSelected = index === selectedMonomerIndex.value
  
  ctx.value.save()
  
  // 绘制形状
  ctx.value.beginPath()
  
  if (config.shape === 'circle') {
    const radius = config.radius * viewport.value.scale
    ctx.value.arc(x, y, radius, 0, Math.PI * 2)
  } else {
    const size = config.size * viewport.value.scale
    const halfSize = size / 2
    ctx.value.rect(x - halfSize, y - halfSize, size, size)
  }
  
  // 填充颜色
  ctx.value.fillStyle = isSelected ? config.selectedBgColor : config.bgColor
  ctx.value.fill()
  
  // 描边
  ctx.value.strokeStyle = isSelected ? config.selectedColor : config.color
  ctx.value.lineWidth = isSelected ? 3 : 2
  ctx.value.stroke()
  
  // 绘制文字
  ctx.value.fillStyle = config.color
  ctx.value.font = `bold ${config.fontSize * viewport.value.scale}px Arial`
  ctx.value.textAlign = 'center'
  ctx.value.textBaseline = 'middle'
  
  const text = props.polymerType === 'PEPTIDE' ? monomer.code : monomer.code.charAt(0)
  ctx.value.fillText(text, x, y)
  
  ctx.value.restore()
}

// 绘制连接线
function drawConnections(positions) {
  if (!props.connections || props.connections.length === 0) return
  
  ctx.value.save()
  ctx.value.strokeStyle = '#67c23a'
  ctx.value.lineWidth = 2 * viewport.value.scale
  ctx.value.lineCap = 'round'
  
  props.connections.forEach(conn => {
    const fromPos = positions.find(p => p.index === conn.from)
    const toPos = positions.find(p => p.index === conn.to)
    
    if (!fromPos || !toPos) return
    
    // 绘制曲线
    ctx.value.beginPath()
    ctx.value.moveTo(fromPos.x, fromPos.y)
    
    // 计算控制点，使曲线向上拱起
    const midX = (fromPos.x + toPos.x) / 2
    const midY = (fromPos.y + toPos.y) / 2
    const offset = -50 * viewport.value.scale
    
    ctx.value.quadraticCurveTo(midX, midY + offset, toPos.x, toPos.y)
    ctx.value.stroke()
    
    // 绘制箭头
    const angle = Math.atan2(toPos.y - (midY + offset), toPos.x - midX)
    const arrowLength = 10 * viewport.value.scale
    
    ctx.value.beginPath()
    ctx.value.moveTo(toPos.x, toPos.y)
    ctx.value.lineTo(
      toPos.x - arrowLength * Math.cos(angle - Math.PI / 6),
      toPos.y - arrowLength * Math.sin(angle - Math.PI / 6)
    )
    ctx.value.lineTo(
      toPos.x - arrowLength * Math.cos(angle + Math.PI / 6),
      toPos.y - arrowLength * Math.sin(angle + Math.PI / 6)
    )
    ctx.value.closePath()
    ctx.value.fillStyle = '#67c23a'
    ctx.value.fill()
  })
  
  ctx.value.restore()
}

// 绘制主链连接线（肽键/磷酸二酯键）
function drawBackbone(positions) {
  if (positions.length < 2) return
  
  ctx.value.save()
  ctx.value.strokeStyle = '#909399'
  ctx.value.lineWidth = 1.5 * viewport.value.scale
  ctx.value.setLineDash([5, 5])
  
  for (let i = 0; i < positions.length - 1; i++) {
    const from = positions[i]
    const to = positions[i + 1]
    
    ctx.value.beginPath()
    ctx.value.moveTo(from.x, from.y)
    ctx.value.lineTo(to.x, to.y)
    ctx.value.stroke()
  }
  
  ctx.value.setLineDash([])
  ctx.value.restore()
}

// 渲染场景
function render() {
  if (!ctx.value || !canvasRef.value) return
  
  // 清空画布
  ctx.value.clearRect(0, 0, canvasSize.value.width, canvasSize.value.height)
  
  // 绘制白色背景
  ctx.value.fillStyle = '#ffffff'
  ctx.value.fillRect(0, 0, canvasSize.value.width, canvasSize.value.height)
  
  const positions = getMonomerPositions()
  
  // 绘制顺序：主链 -> 连接线 -> 单体
  drawBackbone(positions)
  drawConnections(positions)
  
  // 绘制所有单体
  positions.forEach(pos => drawMonomer(pos))
}

// 鼠标事件处理
function handleMouseDown(event) {
  if (event.button !== 0) return // 只响应左键
  
  isDragging.value = true
  lastMousePos.value = { x: event.clientX, y: event.clientY }
  
  // 检查是否点击了单体
  const positions = getMonomerPositions()
  const rect = canvasRef.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const clickY = event.clientY - rect.top
  
  for (const pos of positions) {
    if (isPointInMonomer(clickX, clickY, pos)) {
      selectedMonomerIndex.value = pos.index
      emit('monomer-select', pos.index)
      render()
      return
    }
  }
  
  // 没有点击到单体，开始拖拽画布
  canvasRef.value.style.cursor = 'grabbing'
}

function handleMouseMove(event) {
  if (!isDragging.value) return
  
  const dx = event.clientX - lastMousePos.value.x
  const dy = event.clientY - lastMousePos.value.y
  
  viewport.value.offsetX += dx
  viewport.value.offsetY += dy
  lastMousePos.value = { x: event.clientX, y: event.clientY }
  
  render()
}

function handleMouseUp(event) {
  if (!isDragging.value) return
  
  isDragging.value = false
  if (canvasRef.value) {
    canvasRef.value.style.cursor = 'grab'
  }
  
  // 检查是否是点击（没有移动）
  if (event && lastMousePos.value) {
    const dx = event.clientX - lastMousePos.value.x
    const dy = event.clientY - lastMousePos.value.y
    const dist = Math.hypot(dx, dy)
    
    if (dist < 3) {
      // 视为点击，已经处理过选中逻辑
    }
  }
}

function handleWheel(event) {
  event.preventDefault()
  
  const delta = event.deltaY > 0 ? -0.1 : 0.1
  const newScale = Math.max(0.5, Math.min(3, viewport.value.scale + delta))
  
  // 以鼠标位置为中心缩放
  const rect = canvasRef.value.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  
  const scaleRatio = newScale / viewport.value.scale
  viewport.value.offsetX = mouseX - (mouseX - viewport.value.offsetX) * scaleRatio
  viewport.value.offsetY = mouseY - (mouseY - viewport.value.offsetY) * scaleRatio
  viewport.value.scale = newScale
  
  render()
}

// 检查点是否在单体内
function isPointInMonomer(x, y, position) {
  const config = MONOMER_CONFIG[props.polymerType] || MONOMER_CONFIG.PEPTIDE
  
  if (config.shape === 'circle') {
    const dx = x - position.x
    const dy = y - position.y
    return Math.hypot(dx, dy) <= position.radius
  } else {
    return (
      x >= position.left &&
      x <= position.right &&
      y >= position.top &&
      y <= position.bottom
    )
  }
}

// 更新画布尺寸
function updateCanvasSize() {
  if (!canvasContainerRef.value || !canvasRef.value) return
  
  const container = canvasContainerRef.value
  canvasSize.value = {
    width: container.offsetWidth,
    height: container.offsetHeight
  }
  
  // 设置 canvas 实际尺寸（考虑 DPI）
  const dpr = window.devicePixelRatio || 1
  canvasRef.value.width = canvasSize.value.width * dpr
  canvasRef.value.height = canvasSize.value.height * dpr
  canvasRef.value.style.width = `${canvasSize.value.width}px`
  canvasRef.value.style.height = `${canvasSize.value.height}px`
  
  // 缩放 ctx
  ctx.value.scale(dpr, dpr)
  
  render()
}

// 重置视图
function resetView() {
  viewport.value = {
    offsetX: 50,
    offsetY: 200,
    scale: 1
  }
  render()
}

// 监听序列变化
watch(
  () => [props.sequence, props.polymerType, props.connections],
  () => {
    render()
  },
  { deep: true }
)

onMounted(() => {
  ctx.value = canvasRef.value?.getContext('2d')
  updateCanvasSize()
  
  window.addEventListener('resize', updateCanvasSize)
  
  // 暴露方法给父组件
  if (canvasContainerRef.value) {
    canvasContainerRef.value.resetView = resetView
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateCanvasSize)
})

// 暴露方法
defineExpose({
  resetView,
  render
})
</script>

<style scoped>
.structure-canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 300px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: hidden;
}

.structure-canvas {
  display: block;
  cursor: grab;
}

.structure-canvas:active {
  cursor: grabbing;
}

.canvas-hint {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  gap: 12px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  font-size: 12px;
  color: #909399;
  pointer-events: none;
  user-select: none;
}

.canvas-hint span {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
