<template>
  <div 
    ref="canvasContainerRef"
    class="structure-canvas-container"
    :class="[`canvas-mode-${canvasMode}`]"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
    @wheel="handleWheel"
  >
    <canvas
      ref="canvasRef"
      class="structure-canvas"
    />
    
    <!-- Tooltip SVG -->
    <div
      v-if="showTooltip && tooltipMonomerIndex >= 0"
      class="monomer-tooltip"
      :style="{ left: tooltipPos.x + 'px', top: tooltipPos.y + 'px' }"
    >
      <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <circle
          cx="60"
          cy="60"
          :r="getTooltipRadius()"
          :fill="getTooltipBgColor()"
          :stroke="getTooltipColor()"
          stroke-width="2"
        />
        <text
          x="60"
          y="60"
          :fill="getTooltipColor()"
          font-size="24"
          font-weight="bold"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          {{ getTooltipText() }}
        </text>
      </svg>
      <div class="tooltip-info">
        <strong>{{ getTooltipMonomerName() }}</strong>
        <span>位置：{{ tooltipMonomerIndex + 1 }}</span>
      </div>
    </div>
    
    <div class="canvas-hint">
      <span v-if="canvasMode === 'manual'">🖱️ 拖拽分子 | 👆 点击选中</span>
      <span v-else-if="canvasMode === 'select'">🔲 拖拽选择</span>
      <span v-else>🖱️ 拖拽平移画布</span>
      <span>🔍 滚轮缩放</span>
      <span v-if="canvasMode === 'select'">⌨️ Del/Ctrl+C/V</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'

// 节流函数 - 优化拖动性能
function throttle(fn, delay) {
  let lastCall = 0
  return function(...args) {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      fn.apply(this, args)
    }
  }
}

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
  },
  isSelectMode: {
    type: Boolean,
    default: false
  },
  // 画布模式：'manual' | 'select' | 'drag'
  canvasMode: {
    type: String,
    default: 'manual',
    validator: (v) => ['manual', 'select', 'drag'].includes(v)
  },
  // 单体的位置信息（用于独立移动）
  monomerPositions: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits([
  'monomer-select',
  'monomer-select-region',
  'update:selectedIndices',
  'monomer-move',
  'monomer-paste',
  'update:monomerPositions'
])

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

// 矩形选择状态
const isSelecting = ref(false)
const selectStart = ref({ x: 0, y: 0 })
const selectEnd = ref({ x: 0, y: 0 })
const selectedIndices = ref(new Set())

// 剪贴板
const clipboard = ref([])

// 单个分子拖拽状态（manual 模式）
const isDraggingMonomer = ref(false)
const draggingMonomerIndex = ref(-1)
const dragStartMousePos = ref({ x: 0, y: 0 }) // 拖拽开始时鼠标在 canvas 中的位置
const dragStartMonomerPos = ref({ x: 0, y: 0 }) // 拖拽开始时分子的位置

// 整体拖动状态（select 模式下拖动选中的多个分子）
const isDraggingSelected = ref(false)
const selectedDragStartMousePos = ref({ x: 0, y: 0 }) // 拖拽开始时鼠标在 canvas 中的位置
const selectedDragInitialPositions = ref({}) // 拖拽开始时所有选中分子的位置

// 内部位置存储（绝对坐标，相对于 canvas 左上角）
const internalPositions = ref({})

// Tooltip 状态
const showTooltip = ref(false)
const tooltipPos = ref({ x: 0, y: 0 })
const tooltipMonomerIndex = ref(-1)

// 渲染优化 - 使用 requestAnimationFrame 避免频繁重绘
let renderPending = false
function requestRender() {
  if (renderPending) return
  renderPending = true
  requestAnimationFrame(() => {
    renderPending = false
    render()
  })
}

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
    // 优先使用内部位置（实时更新），其次是 props 传入的位置
    const storedPos = internalPositions.value[index] || props.monomerPositions[index]
    let x, y

    if (storedPos) {
      // 存储的位置是绝对坐标，直接使用
      x = storedPos.x
      y = storedPos.y
    } else {
      // 默认水平排列（相对于 viewport）
      x = viewport.value.offsetX + index * spacing * viewport.value.scale
      y = viewport.value.offsetY
    }

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
  const isSelected = index === selectedMonomerIndex.value || selectedIndices.value.has(index)
  
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



// 绘制矩形选择框
function drawSelectionBox() {
  if (!isSelecting.value || props.canvasMode !== 'select') return
  
  const x1 = selectStart.value.x
  const y1 = selectStart.value.y
  const x2 = selectEnd.value.x
  const y2 = selectEnd.value.y
  
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const width = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)
  
  if (width < 2 || height < 2) return
  
  ctx.value.save()
  ctx.value.strokeStyle = '#f56c6c'
  ctx.value.lineWidth = 2
  ctx.value.setLineDash([5, 5])
  ctx.value.fillStyle = 'rgba(245, 108, 108, 0.12)'
  
  ctx.value.strokeRect(x, y, width, height)
  ctx.value.fillRect(x, y, width, height)
  
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
  
  // 绘制顺序：连接线 -> 单体 -> 选择框
  drawConnections(positions)
  
  // 绘制所有单体
  positions.forEach(pos => drawMonomer(pos))
  
  // 绘制选择框（最上层）
  drawSelectionBox()
}

// 鼠标事件处理
function handleMouseDown(event) {
  if (event.button !== 0) return // 只响应左键
  
  const rect = canvasRef.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const clickY = event.clientY - rect.top
  
  const positions = getMonomerPositions()
  const clickedMonomer = positions.find(pos => isPointInMonomer(clickX, clickY, pos))
  
  // Select 模式 - 矩形选择或拖动选中分子
  if (props.canvasMode === 'select') {
    // 检查是否点击在选中的分子上
    if (clickedMonomer && selectedIndices.value.has(clickedMonomer.index)) {
      // 开始拖动选中的分子整体
      isDraggingSelected.value = true
      
      // 记录鼠标起始位置（canvas 坐标）
      selectedDragStartMousePos.value = { x: clickX, y: clickY }
      
      // 记录所有选中分子的起始位置
      selectedIndices.value.forEach(idx => {
        // 优先使用内部位置（实时更新的），其次使用 props 传入的位置
        const storedPos = internalPositions.value[idx] || props.monomerPositions[idx]
        if (storedPos) {
          selectedDragInitialPositions.value[idx] = { ...storedPos }
        } else {
          // 默认位置
          selectedDragInitialPositions.value[idx] = {
            x: viewport.value.offsetX + idx * 70 * viewport.value.scale,
            y: viewport.value.offsetY
          }
        }
      })
      
      canvasRef.value.style.cursor = 'grabbing'
      event.preventDefault()
      event.stopPropagation()
      return
    }
    
    // 否则开始矩形选择
    isSelecting.value = true
    selectStart.value = { x: clickX, y: clickY }
    selectEnd.value = { x: clickX, y: clickY }
    canvasRef.value.style.cursor = 'crosshair'
    return
  }
  
  // Manual 模式 - 可点击选中或拖拽单个分子
  if (props.canvasMode === 'manual') {
    // 隐藏 tooltip
    showTooltip.value = false
    
    if (clickedMonomer) {
      // 点击到单体 - 选中并开始拖拽
      selectedMonomerIndex.value = clickedMonomer.index
      selectedIndices.value.clear()
      selectedIndices.value.add(clickedMonomer.index)
      emit('monomer-select', clickedMonomer.index)
      
      isDraggingMonomer.value = true
      draggingMonomerIndex.value = clickedMonomer.index
      
      // 记录拖拽开始时的鼠标位置（canvas 坐标）和分子位置
      dragStartMousePos.value = { x: clickX, y: clickY }
      dragStartMonomerPos.value = { x: clickedMonomer.x, y: clickedMonomer.y }
      
      canvasRef.value.style.cursor = 'grabbing'
      event.preventDefault()
      event.stopPropagation()
      return
    }
    // 没点到单体，清除选中状态
    clearSelection()
    isDragging.value = true
    lastMousePos.value = { x: event.clientX, y: event.clientY }
    canvasRef.value.style.cursor = 'grabbing'
    return
  }
  
  // Drag 模式 - 拖拽画布平移
  if (props.canvasMode === 'drag') {
    isDragging.value = true
    lastMousePos.value = { x: event.clientX, y: event.clientY }
    canvasRef.value.style.cursor = 'grabbing'
    return
  }
}

function handleMouseMove(event) {
  const rect = canvasRef.value.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  
  // Select 模式 - 拖动选中的分子整体
  if (props.canvasMode === 'select' && isDraggingSelected.value) {
    // 计算鼠标移动距离（canvas 坐标）
    const deltaX = mouseX - selectedDragStartMousePos.value.x
    const deltaY = mouseY - selectedDragStartMousePos.value.y
    
    // 更新所有选中分子的位置
    selectedIndices.value.forEach(idx => {
      const initialPos = selectedDragInitialPositions.value[idx]
      if (initialPos) {
        internalPositions.value[idx] = {
          x: initialPos.x + deltaX,
          y: initialPos.y + deltaY
        }
      }
    })
    
    requestRender()
    return
  }
  
  // Select 模式 - 绘制选择框
  if (props.canvasMode === 'select' && isSelecting.value) {
    selectEnd.value = { x: mouseX, y: mouseY }
    requestRender()
    return
  }
  
  // Manual 模式 - 拖拽单个分子
  if (props.canvasMode === 'manual' && isDraggingMonomer.value) {
    const index = draggingMonomerIndex.value
    
    // 计算鼠标移动距离（canvas 坐标）
    const deltaX = mouseX - dragStartMousePos.value.x
    const deltaY = mouseY - dragStartMousePos.value.y
    
    // 新位置 = 起始位置 + 移动距离
    const newX = dragStartMonomerPos.value.x + deltaX
    const newY = dragStartMonomerPos.value.y + deltaY
    
    // 更新位置（绝对坐标）
    internalPositions.value[index] = { x: newX, y: newY }
    requestRender()
    return
  }
  
  // Manual 模式下，非拖拽状态时显示 tooltip
  if (props.canvasMode === 'manual' && !isDraggingMonomer.value && !isDragging.value) {
    const positions = getMonomerPositions()
    const hoveredMonomer = positions.find(pos => isPointInMonomer(mouseX, mouseY, pos))
    
    if (hoveredMonomer) {
      showMonomerTooltip(hoveredMonomer.index, mouseX, mouseY)
      canvasRef.value.style.cursor = 'pointer'
    } else {
      hideMonomerTooltip()
      canvasRef.value.style.cursor = 'grab'
    }
  }
  
  // Select 模式下，非拖动状态时根据是否悬停在分子上改变光标
  if (props.canvasMode === 'select' && !isDraggingSelected.value && !isSelecting.value) {
    const positions = getMonomerPositions()
    const hoveredMonomer = positions.find(pos => isPointInMonomer(mouseX, mouseY, pos))
    
    if (hoveredMonomer && selectedIndices.value.has(hoveredMonomer.index)) {
      canvasRef.value.style.cursor = 'grab'
    } else {
      canvasRef.value.style.cursor = 'crosshair'
    }
  }
  
  // Drag 模式或 Manual 模式下的画布拖拽
  if (!isDragging.value) return
  
  const dx = event.clientX - lastMousePos.value.x
  const dy = event.clientY - lastMousePos.value.y
  
  // Drag 模式：所有元素一起移动（包括已存储位置的分子）
  if (props.canvasMode === 'drag') {
    // 更新 viewport
    viewport.value.offsetX += dx
    viewport.value.offsetY += dy
    
    // 同步更新所有已存储位置的分子
    Object.keys(internalPositions.value).forEach(key => {
      const idx = parseInt(key)
      internalPositions.value[idx] = {
        x: internalPositions.value[idx].x + dx,
        y: internalPositions.value[idx].y + dy
      }
    })
  } else {
    // Manual 模式下的画布拖拽
    viewport.value.offsetX += dx
    viewport.value.offsetY += dy
  }
  
  lastMousePos.value = { x: event.clientX, y: event.clientY }
  
  requestRender()
}

function handleMouseUp(event) {
  // Select 模式 - 结束拖动选中的分子
  if (props.canvasMode === 'select' && isDraggingSelected.value) {
    isDraggingSelected.value = false
    
    // 发送位置更新事件
    const updatedPositions = {}
    selectedIndices.value.forEach(idx => {
      const pos = internalPositions.value[idx]
      if (pos) {
        updatedPositions[idx] = pos
      }
    })
    
    if (Object.keys(updatedPositions).length > 0) {
      emit('update:monomerPositions', { ...props.monomerPositions, ...updatedPositions })
    }
    
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'crosshair'
    }
    event.stopPropagation()
    return
  }
  
  // Manual 模式 - 结束分子拖拽
  if (props.canvasMode === 'manual' && isDraggingMonomer.value) {
    const index = draggingMonomerIndex.value
    isDraggingMonomer.value = false
    draggingMonomerIndex.value = -1
    
    // 发送位置更新事件
    const pos = internalPositions.value[index]
    if (pos) {
      emit('monomer-move', { index, x: pos.x, y: pos.y })
      emit('update:monomerPositions', { ...props.monomerPositions, [index]: pos })
    }
    
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'grab'
    }
    event.stopPropagation()
    return
  }
  
  // Select 模式 - 结束矩形选择
  if (props.canvasMode === 'select' && isSelecting.value) {
    isSelecting.value = false
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'crosshair'
    }
    
    const dx = selectEnd.value.x - selectStart.value.x
    const dy = selectEnd.value.y - selectStart.value.y
    const dist = Math.hypot(dx, dy)
    
    if (dist < 3) {
      // 点击，执行单体选择
      const positions = getMonomerPositions()
      const clickX = selectEnd.value.x
      const clickY = selectEnd.value.y
      
      for (const pos of positions) {
        if (isPointInMonomer(clickX, clickY, pos)) {
          selectedMonomerIndex.value = pos.index
          selectedIndices.value.clear()
          selectedIndices.value.add(pos.index)
          emit('monomer-select', pos.index)
          render()
          return
        }
      }
      // 点击空白区域，清除选中状态
      clearSelection()
    } else {
      // 矩形选择
      selectMonomersInRegion()
    }
    
    render()
    return
  }

  // Drag 模式或 Manual 模式 - 结束画布拖拽
  if (!isDragging.value) return
  
  isDragging.value = false
  if (canvasRef.value) {
    canvasRef.value.style.cursor = 'grab'
  }
}

// 鼠标离开画布
function handleMouseLeave() {
  hideMonomerTooltip()
  isDragging.value = false
  isDraggingMonomer.value = false
  isSelecting.value = false
  isDraggingSelected.value = false
  if (canvasRef.value) {
    canvasRef.value.style.cursor = 'grab'
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
  
  requestRender()
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

// Tooltip 相关函数
function showMonomerTooltip(index, x, y) {
  tooltipMonomerIndex.value = index
  tooltipPos.value = { x: x + 10, y: y - 60 }
  showTooltip.value = true
}

function hideMonomerTooltip() {
  showTooltip.value = false
  tooltipMonomerIndex.value = -1
}

function getTooltipRadius() {
  const config = MONOMER_CONFIG[props.polymerType] || MONOMER_CONFIG.PEPTIDE
  return config.shape === 'circle' ? 40 : 35
}

function getTooltipColor() {
  const config = MONOMER_CONFIG[props.polymerType] || MONOMER_CONFIG.PEPTIDE
  return config.color
}

function getTooltipBgColor() {
  const config = MONOMER_CONFIG[props.polymerType] || MONOMER_CONFIG.PEPTIDE
  return config.bgColor
}

function getTooltipText() {
  if (tooltipMonomerIndex.value < 0 || tooltipMonomerIndex.value >= props.sequence.length) {
    return ''
  }
  const monomer = props.sequence[tooltipMonomerIndex.value]
  return props.polymerType === 'PEPTIDE' ? monomer.code : monomer.code.charAt(0)
}

function getTooltipMonomerName() {
  if (tooltipMonomerIndex.value < 0 || tooltipMonomerIndex.value >= props.sequence.length) {
    return ''
  }
  const monomer = props.sequence[tooltipMonomerIndex.value]
  return `${monomer.code} (${monomer.name || props.polymerType})`
}

// 清除选中状态
function clearSelection() {
  selectedMonomerIndex.value = -1
  selectedIndices.value.clear()
  emit('monomer-select', -1)
  emit('update:selectedIndices', [])
  render()
}

// 选择矩形区域内的单体
function selectMonomersInRegion() {
  const positions = getMonomerPositions()
  const x1 = selectStart.value.x
  const y1 = selectStart.value.y
  const x2 = selectEnd.value.x
  const y2 = selectEnd.value.y
  
  const left = Math.min(x1, x2)
  const right = Math.max(x1, x2)
  const top = Math.min(y1, y2)
  const bottom = Math.max(y1, y2)
  
  const newSelectedIndices = new Set()
  
  positions.forEach(pos => {
    // 检查单体中心是否在选择框内
    if (pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom) {
      newSelectedIndices.add(pos.index)
    }
  })
  
  selectedIndices.value = newSelectedIndices
  if (newSelectedIndices.size > 0) {
    const indicesArray = Array.from(newSelectedIndices).sort((a, b) => a - b)
    selectedMonomerIndex.value = indicesArray[indicesArray.length - 1]
    emit('monomer-select-region', indicesArray)
  }
}

// 删除选中的单体
function deleteSelectedMonomers() {
  if (selectedIndices.value.size === 0) return false
  
  const indices = Array.from(selectedIndices.value).sort((a, b) => b - a)
  emit('update:selectedIndices', indices)
  return true
}

// 复制选中的单体
function copySelectedMonomers() {
  if (selectedIndices.value.size === 0) return false
  
  const indices = Array.from(selectedIndices.value).sort((a, b) => a - b)
  const monomersToCopy = indices.map(i => props.sequence[i])
  clipboard.value = monomersToCopy.filter(Boolean)
  
  return true
}

// 粘贴剪贴板中的单体
function pasteMonomers() {
  if (clipboard.value.length === 0) return false
  
  emit('monomer-paste', [...clipboard.value])
  return true
}

// 全局键盘事件处理
function handleKeydown(event) {
  // 只在 select 模式下处理键盘事件
  if (props.canvasMode !== 'select') return
  
  // 忽略在输入框中的按键
  const target = event.target
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return
  }
  
  // Delete/Backspace - 删除
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (selectedIndices.value.size > 0) {
      event.preventDefault()
      deleteSelectedMonomers()
    }
    return
  }
  
  // Ctrl+C - 复制
  if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
    if (selectedIndices.value.size > 0) {
      event.preventDefault()
      copySelectedMonomers()
    }
    return
  }
  
  // Ctrl+V - 粘贴
  if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
    if (clipboard.value.length > 0) {
      event.preventDefault()
      pasteMonomers()
    }
    return
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
  
  // 重置变换矩阵后再缩放，避免累积
  ctx.value.setTransform(1, 0, 0, 1, 0, 0)
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

// 监听 canvasMode 变化，切换模式时清除选中状态
watch(
  () => props.canvasMode,
  () => {
    clearSelection()
  }
)

// 监听 sequence 变化（新建/清空画布），清除选中状态
watch(
  () => props.sequence,
  (newVal, oldVal) => {
    // 序列长度变化时（新建/清空/加载），清除选中状态
    if (newVal.length === 0 || (oldVal && newVal.length !== oldVal.length)) {
      clearSelection()
    }
  }
)

onMounted(() => {
  ctx.value = canvasRef.value?.getContext('2d')
  updateCanvasSize()
  
  window.addEventListener('resize', updateCanvasSize)
  window.addEventListener('keydown', handleKeydown)
  
  // 暴露方法给父组件
  if (canvasContainerRef.value) {
    canvasContainerRef.value.resetView = resetView
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateCanvasSize)
  window.removeEventListener('keydown', handleKeydown)
  renderPending = false
})

// 暴露方法
defineExpose({
  resetView,
  render,
  deleteSelectedMonomers,
  copySelectedMonomers,
  pasteMonomers,
  getSelectedIndices: () => selectedIndices.value,
  clearSelection
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

/* Manual 模式 */
.canvas-mode-manual .structure-canvas {
  cursor: default;
}
.canvas-mode-manual .structure-canvas:active {
  cursor: grabbing;
}

/* Select 模式 */
.canvas-mode-select .structure-canvas {
  cursor: crosshair;
}

/* Drag 模式 */
.canvas-mode-drag .structure-canvas {
  cursor: grab;
}
.canvas-mode-drag .structure-canvas:active {
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

.monomer-tooltip {
  position: absolute;
  z-index: 100;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 8px;
  pointer-events: none;
  animation: tooltip-fade-in 0.2s ease-out;
}

.monomer-tooltip svg {
  display: block;
}

.tooltip-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #eee;
  font-size: 11px;
  color: #606266;
}

.tooltip-info strong {
  font-size: 12px;
  color: #303133;
}

@keyframes tooltip-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
