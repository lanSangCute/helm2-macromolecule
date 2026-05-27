<template>
  <div class="helm-editor">
    <!-- 顶部工具栏 -->
    <el-toolbar class="toolbar">
      <el-space wrap>
        <el-button @click="newMoleculeFull" :icon="Plus">新建</el-button>
        <el-button @click="openFile" :icon="FolderOpened">打开</el-button>
        <el-button @click="saveHELM" :icon="Download">保存</el-button>
        
        <el-button @click="exportFormat('SMILES')" :icon="Document">SMILES</el-button>
        <el-button @click="exportFormat('Molfile')" :icon="Document">Molfile</el-button>
        <el-button @click="exportFormat('HELM')" :icon="Document">HELM</el-button>
        
        <el-button @click="undoFull" :icon="RefreshLeft">撤销</el-button>
        <el-button @click="redoFull" :icon="RefreshRight">重做</el-button>
        
        <el-button @click="deleteSelected" :icon="Delete" type="danger" :disabled="selectedIndices.size === 0">
          删除选中 ({{ selectedIndices.size }})
        </el-button>
        <el-button @click="clearCanvas" :icon="Delete" type="warning">清空画布</el-button>
        
        <el-button @click="setCanvasModeFull('manual')" :type="canvasMode === 'manual' ? 'primary' : ''">
          Manual
        </el-button>
        <el-button
          @click="setCanvasModeFull('select')"
          :type="canvasMode === 'select' ? 'primary' : ''"
          :icon="Pointer"
        >
          Select
        </el-button>
        <el-button
          @click="setCanvasModeFull('drag')"
          :type="canvasMode === 'drag' ? 'primary' : ''"
          :icon="Pointer"
        >
          Drag
        </el-button>
        <el-button @click="serializeStrandsFull" :icon="Rank">
          序列化
        </el-button>
        <el-button
          @click="toggleConnectionModeFull"
          :type="connectionMode ? 'success' : ''"
          :icon="Connection"
        >
          连接线 {{ connectionMode ? '开' : '关' }}
        </el-button>
      </el-space>
    </el-toolbar>
    
    <!-- 主编辑区 -->
    <div class="editor-container">
      <!-- 左侧单体库 -->
      <div class="monomer-library">
        <div class="monomer-section">
          <div class="monomer-section-header">氨基酸</div>
          <div class="monomer-grid">
            <el-button
              v-for="aa in aminoAcids"
              :key="aa.code"
              @click="addMonomerFull(aa)"
              @dragstart="handleMonomerDragStart($event, aa)"
              draggable="true"
              size="small"
            >
              {{ aa.code }}
            </el-button>
          </div>
        </div>
        
        <div class="monomer-section">
          <div class="monomer-section-header">核苷酸</div>
          <div class="monomer-grid">
            <el-button
              v-for="nt in nucleotides"
              :key="nt.code"
              @click="addMonomerFull(nt)"
              @dragstart="handleMonomerDragStart($event, nt)"
              draggable="true"
              size="small"
              type="success"
            >
              {{ nt.code }}
            </el-button>
          </div>
        </div>
      </div>
      
      <!-- 中间画布区 -->
      <div class="canvas-area">
        <!-- 结构式 Canvas -->
        <el-card shadow="never" class="structure-view">
          <template #header>
            <div class="structure-header">
              <span>结构式</span>
              <el-button size="small" @click="showSVG = !showSVG">
                {{ showSVG ? '隐藏' : '查看' }} SVG
              </el-button>
            </div>
          </template>
          <StructureCanvas
            v-if="!showSVG"
            ref="structureCanvasRef"
            :sequence="currentSequence"
            :polymer-type="polymerType"
            :connections="connections"
            :canvas-mode="canvasMode"
            :monomer-positions="monomerPositions"
            :connection-mode="connectionMode"
            :connection-start-index="connectionStartIndex"
            @monomer-select="handleCanvasMonomerSelect"
            @monomer-select-region="handleCanvasRegionSelect"
            @update:selected-indices="handleCanvasDeleteRequest"
            @monomer-paste="handleCanvasPaste"
            @monomer-move="handleMonomerMove"
            @update:monomer-positions="handleMonomerPositionsUpdate"
            @connection-click="handleConnectionClick"
          />
          <StructureSVG
            v-if="showSVG"
            :sequence="currentSequence"
            :polymer-type="polymerType"
            :connections="connections"
            :monomer-positions="monomerPositions"
            :selected-index="selectedIndex"
            :selected-indices="selectedIndices"
            :width="768"
            :height="300"
            @monomer-click="handleSVGMonomerClick"
          />
        </el-card>
        
        <!-- 序列视图 -->
        <el-card shadow="never" class="sequence-view">
          <template #header>序列视图</template>
          <div 
            ref="sequenceDisplayRef"
            class="sequence-display"
            :class="{ 
              'sequence-display--marquee': isMarqueeMode,
              'sequence-display--connection': connectionMode 
            }"
            @dragover="handleSequenceDragOver"
            @drop="handleSequenceDropFull"
            @pointerdown="handleMarqueePointerDown"
          >
            <!-- Canvas 层用于绘制连接线 -->
            <canvas
              ref="connectionCanvasRef"
              class="connection-canvas"
              :style="canvasStyle"
            />
            
            <span
              v-for="(monomer, index) in currentSequence"
              :key="index"
              class="monomer-item"
              :data-monomer-index="index"
              :class="[
                getMonomerClass(monomer.type),
                { selected: selectedIndex === index },
                { 'multi-selected': selectedIndices.has(index) },
                { 'drag-over': dragOverIndex === index },
                { 'connection-source': connectionStartIndex === index },
                { 'connection-hover': connectionHoverIndex === index && connectionMode }
              ]"
              :draggable="!isMarqueeMode && !connectionMode"
              @click="handleMonomerClick(index, $event)"
              @dragstart="handleDragStartFull($event, index)"
              @dragend="handleDragEnd($event)"
              @dragover="handleDragOver($event, index)"
              @dragleave="handleDragLeave($event)"
              @drop="handleDropFull($event, index)"
              @mouseenter="handleMonomerMouseEnter(index)"
              @mouseleave="onMonomerMouseLeave(index)"
            >
              <span class="monomer-drag-handle">☰</span>
              {{ monomer.code }}
              <el-icon class="remove-btn" @click.stop="removeMonomerFull(index)">
                <Close />
              </el-icon>
            </span>
            <span v-if="currentSequence.length === 0" class="empty-hint">
              点击左侧单体添加，或粘贴 HELM/序列
            </span>
            <div
              v-show="isMarqueeMode && marqueeDragging"
              class="marquee-box"
              :style="marqueeBoxStyle"
            />
          </div>
        </el-card>
        
        <el-card shadow="never" class="input-area">
          <el-input
            v-model="helmInput"
            type="textarea"
            :rows="3"
            placeholder="粘贴 HELM 字符串或序列..."
            @change="parseInputFull"
          />
        </el-card>
      </div>
      
      <!-- 右侧信息面板 -->
      <el-card shadow="never" class="info-panel">
        <template #header>分子信息</template>
        <el-descriptions :column="1" size="small">
          <el-descriptions-item label="类型">{{ polymerType }}</el-descriptions-item>
          <el-descriptions-item label="长度">{{ currentSequence.length }}</el-descriptions-item>
          <el-descriptions-item label="分子量">{{ calculatedMass }} Da</el-descriptions-item>
          <el-descriptions-item label="HELM">{{ helmOutput }}</el-descriptions-item>
        </el-descriptions>
      </el-card>
    </div>
    <input
      ref="fileInputRef"
      type="file"
      style="display: none"
      accept=".helm,.txt,.smi,.smiles,.mol,.molfile"
      @change="loadHELM"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { 
  Plus, FolderOpened, Download, Document, 
  RefreshLeft, RefreshRight, Close, Delete, Pointer, Connection, Rank
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import helmParser, {
  getHelmLetter,
  calculateMass
} from '../utils/helmParser'
import StructureCanvas from './StructureCanvas.vue'
import StructureSVG from './StructureSVG.vue'

// ===== Composables =====
import { useSequence } from '../composables/use-sequence'
import { useSelection } from '../composables/use-selection'
import { useConnections } from '../composables/use-connections'
import { useCanvasMode } from '../composables/use-canvas-mode'
import { useDragDrop } from '../composables/use-drag-drop'
import { useHELMIO } from '../composables/use-helm-io'
import { useMarquee } from '../composables/use-marquee'
import { useStrandLayout } from '../composables/use-strand-layout'

// --- Sequence Management / 序列管理 ---
const {
  currentSequence,
  polymerType,
  history,
  historyIndex,
  saveToHistory,
  addMonomer,
  removeMonomer,
  newMolecule,
  undo,
  redo
} = useSequence()

// --- Selection Management / 选中管理 ---
const {
  selectedIndex,
  selectedIndices,
  isMultiSelectMode,
  isMarqueeMode,
  selectMonomer,
  toggleMultiSelect,
  clearSelection
} = useSelection()

// --- Connection Management / 连接线管理 ---
const {
  connections,
  connectionMode,
  connectionStartIndex,
  connectionHoverIndex,
  toggleConnectionMode,
  handleConnectionClick,
  handleMonomerMouseEnter,
  handleMonomerMouseLeave
} = useConnections()

// --- Canvas Mode Management / 画布模式管理 ---
const {
  canvasMode,
  setCanvasMode
} = useCanvasMode()

// --- Drag & Drop Management / 拖拽管理 ---
const {
  dragOverIndex,
  isDragging,
  draggedMonomer,
  handleMonomerDragStart,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleSequenceDragOver,
  handleSequenceDrop
} = useDragDrop({ currentSequence, polymerType, selectedIndices, saveToHistory })

// --- HELM I/O Management / HELM 输入输出管理 ---
const {
  helmInput,
  helmOutput,
  saveHELM,
  exportFormat,
  parseInput,
  updateHELMOutput,
  loadHELM,
  applyParsedSequence,
  downloadTextFile
} = useHELMIO({ currentSequence, polymerType, connections, saveToHistory })

// --- Marquee Management / 框选管理 ---
const {
  marqueeDragging,
  marqueeStart,
  marqueeEnd,
  handleMarqueePointerDown,
  cleanup: marqueeCleanup
} = useMarquee({ isMarqueeMode, selectedIndex, selectedIndices })

// --- Strand Layout Management / 链布局管理 ---
const monomerPositions = ref<Record<number, { x: number; y: number }>>({})
const structureCanvasRef = ref<InstanceType<typeof StructureCanvas> | null>(null)

const { serializeStrands } = useStrandLayout({
  currentSequence,
  connections,
  monomerPositions,
  structureCanvasRef
})

// --- Component-specific refs / 组件特有引用 ---
const sequenceDisplayRef = ref<HTMLDivElement | null>(null)
const connectionCanvasRef = ref<HTMLCanvasElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const canvasSize = ref({ width: 0, height: 0 })
const showSVG = ref(false)

// --- Monomer Library / 单体库 ---
const aminoAcids = Object.values(helmParser.AMINO_ACIDS).map(aa => ({
  ...aa,
  type: 'PEPTIDE'
}))

const nucleotides = Object.values(helmParser.NUCLEOTIDES).map(nt => ({
  ...nt,
  type: nt.type
}))

// --- Computed Properties / 计算属性 ---
const calculatedMass = computed(() => calculateMass(currentSequence.value).toFixed(2))

const marqueeBoxStyle = computed(() => {
  const x1 = marqueeStart.value.x, x2 = marqueeEnd.value.x
  const y1 = marqueeStart.value.y, y2 = marqueeEnd.value.y
  const left = Math.min(x1, x2)
  const top = Math.min(y1, y2)
  const width = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)
  return { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }
})

const canvasStyle = computed(() => ({
  width: `${canvasSize.value.width}px`,
  height: `${canvasSize.value.height}px`
}))

// ===== Component Methods / 组件方法 =====

function openFile() {
  fileInputRef.value?.click()
}

function newMoleculeFull() {
  newMolecule()
  connections.value = []
  helmInput.value = ''
  helmOutput.value = ''
  selectedIndex.value = -1
  connectionStartIndex.value = -1
  structureCanvasRef.value?.clearSelection()
  drawConnections()
}

function undoFull() {
  undo((state) => {
    connections.value = [] // connections not tracked in history yet
    updateHELMOutput()
    drawConnections()
  })
}

function redoFull() {
  redo((state) => {
    connections.value = []
    updateHELMOutput()
    drawConnections()
  })
}

function addMonomerFull(monomer: any) {
  addMonomer(monomer)
  updateHELMOutput()
}

function removeMonomerFull(index: number) {
  removeMonomer(index)
  updateHELMOutput()
}

function setCanvasModeFull(mode: 'manual' | 'select' | 'drag') {
  setCanvasMode(mode, () => {
    selectedIndices.value.clear()
    selectedIndex.value = -1
    structureCanvasRef.value?.clearSelection()
    const modeNames = { manual: '手动', select: '选择', drag: '拖拽' }
    ElMessage.success(`已切换到${modeNames[mode]}模式`)
  })
}

function toggleConnectionModeFull() {
  toggleConnectionMode((mode) => {
    if (mode) {
      isMarqueeMode.value = false
      ElMessage.success('连接线模式：点击两个单体创建化学键（如二硫键）')
      setTimeout(updateCanvasSize, 0)
    } else {
      ElMessage.info('已关闭连接线模式')
    }
  })
}

function handleMonomerClick(index: number, event: MouseEvent) {
  if (connectionMode.value) {
    event.stopPropagation()
    handleConnectionClick(index, (status, from?, to?) => {
      if (status === 'start') {
        ElMessage.info(`已选择起点：${currentSequence.value[index]?.code}，请选择终点`)
      } else if (status === 'cancel') {
        ElMessage.info('已取消')
      } else if (status === 'created') {
        ElMessage.success(`已创建连接：${currentSequence.value[from!]?.code} ↔ ${currentSequence.value[to!]?.code}`)
        drawConnections()
      } else if (status === 'exists') {
        ElMessage.warning('该连接已存在')
      }
    })
    return
  }
  selectMonomer(index, event)
}

function handleMonomerMove(_data: { index: number; x: number; y: number }) {
  // 单体移动处理 / Monomer move handler
}

function handleMonomerPositionsUpdate(positions: Record<number, { x: number; y: number }>) {
  monomerPositions.value = positions
}

function handleSVGMonomerClick(index: number) {
  selectedIndex.value = index
  selectedIndices.value.clear()
  selectedIndices.value.add(index)
}

function onMonomerMouseLeave(_index: number) {
  handleMonomerMouseLeave()
}

function updateCanvasSize() {
  const container = sequenceDisplayRef.value
  if (!container) return
  canvasSize.value = { width: container.offsetWidth, height: container.offsetHeight }
  setTimeout(drawConnections, 0)
}

function drawConnections() {
  const canvas = connectionCanvasRef.value
  const container = sequenceDisplayRef.value
  if (!canvas || !container) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const rect = container.getBoundingClientRect()

  canvas.width = canvasSize.value.width
  canvas.height = canvasSize.value.height
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  connections.value.forEach(conn => {
    const fromEl = container.querySelector(`[data-monomer-index="${conn.from}"]`) as HTMLElement | null
    const toEl = container.querySelector(`[data-monomer-index="${conn.to}"]`) as HTMLElement | null
    if (!fromEl || !toEl) return

    const fromRect = fromEl.getBoundingClientRect()
    const toRect = toEl.getBoundingClientRect()
    const fromX = fromRect.left - rect.left + fromRect.width / 2
    const fromY = fromRect.top - rect.top + fromRect.height / 2
    const toX = toRect.left - rect.left + toRect.width / 2
    const toY = toRect.top - rect.top + toRect.height / 2

    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    const midX = (fromX + toX) / 2
    const midY = (fromY + toY) / 2
    const offset = -50
    ctx.quadraticCurveTo(midX, midY + offset, toX, toY)
    ctx.strokeStyle = '#67c23a'
    ctx.lineWidth = 2
    ctx.stroke()

    const angle = Math.atan2(toY - (midY + offset), toX - midX)
    const arrowLength = 10
    ctx.beginPath()
    ctx.moveTo(toX, toY)
    ctx.lineTo(toX - arrowLength * Math.cos(angle - Math.PI / 6), toY - arrowLength * Math.sin(angle - Math.PI / 6))
    ctx.lineTo(toX - arrowLength * Math.cos(angle + Math.PI / 6), toY - arrowLength * Math.sin(angle + Math.PI / 6))
    ctx.closePath()
    ctx.fillStyle = '#67c23a'
    ctx.fill()
  })

  if (connectionStartIndex.value !== -1 && connectionHoverIndex.value !== -1) {
    const fromEl = container.querySelector(`[data-monomer-index="${connectionStartIndex.value}"]`) as HTMLElement | null
    const toEl = container.querySelector(`[data-monomer-index="${connectionHoverIndex.value}"]`) as HTMLElement | null
    if (fromEl && toEl) {
      const fromRect = fromEl.getBoundingClientRect()
      const toRect = toEl.getBoundingClientRect()
      const fromX = fromRect.left - rect.left + fromRect.width / 2
      const fromY = fromRect.top - rect.top + fromRect.height / 2
      const toX = toRect.left - rect.left + toRect.width / 2
      const toY = toRect.top - rect.top + toRect.height / 2
      ctx.beginPath()
      ctx.moveTo(fromX, fromY)
      ctx.lineTo(toX, toY)
      ctx.strokeStyle = '#909399'
      ctx.lineWidth = 1
      ctx.setLineDash([5, 5])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
}

function onGlobalKeydown(event: KeyboardEvent) {
  if (canvasMode.value === 'select') return
  if (event.key !== 'Delete' && event.key !== 'Backspace') return
  const t = event.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if (selectedIndices.value.size === 0) return
  event.preventDefault()
  deleteSelected()
}

function deleteSelected() {
  if (selectedIndices.value.size === 0) {
    ElMessage.warning('没有选中的单体')
    return
  }
  saveToHistory()
  const indices = Array.from(selectedIndices.value).sort((a, b) => b - a)
  const indicesSet = new Set(indices)

  indices.forEach(index => {
    currentSequence.value.splice(index, 1)
    connections.value = connections.value.filter(c => c.from !== index && c.to !== index)
    connections.value.forEach(c => {
      if (c.from > index) c.from--
      if (c.to > index) c.to--
    })
  })

  indices.forEach(index => { delete monomerPositions.value[index] })
  currentSequence.value.forEach((m, i) => { m.position = i + 1 })
  selectedIndices.value.clear()
  selectedIndex.value = -1
  updateHELMOutput()
  drawConnections()
  ElMessage.success(`已删除 ${indices.length} 个单体`)
}

function clearCanvas() {
  if (currentSequence.value.length === 0 && connections.value.length === 0) return
  saveToHistory()
  currentSequence.value = []
  connections.value = []
  helmInput.value = ''
  helmOutput.value = ''
  selectedIndex.value = -1
  selectedIndices.value.clear()
  connectionStartIndex.value = -1
  structureCanvasRef.value?.clearSelection()
  drawConnections()
  ElMessage.success('画布已清空')
}

function handleDragStartFull(event: DragEvent, index: number) {
  handleDragStart(event, index, isMarqueeMode.value)
}

function handleDropFull(event: DragEvent, dropIndex: number) {
  handleDrop(event, dropIndex, (type, ...args) => {
    if (type === 'library') {
      const monomer = args[0]
      updateHELMOutput()
      ElMessage.success(`添加了 ${monomer.code}`)
    } else if (type === 'single') {
      selectedIndex.value = args[1] as number
      updateHELMOutput()
    } else if (type === 'multi') {
      selectedIndices.value.clear()
      updateHELMOutput()
    }
  })
}

function handleSequenceDropFull(event: DragEvent) {
  handleSequenceDrop(event, (type, ...args) => {
    if (type === 'library') {
      const monomer = args[0]
      updateHELMOutput()
      ElMessage.success(`添加了 ${monomer.code}`)
    }
  })
}

function parseInputFull() {
  parseInput((result) => {
    if (result.success) {
      ElMessage.success(result.message)
    } else {
      ElMessage.warning(result.message)
    }
  })
}

function getMonomerClass(type: string) {
  return {
    'monomer-peptide': type === 'PEPTIDE',
    'monomer-rna': type === 'RNA',
    'monomer-dna': type === 'DNA'
  }
}

function handleCanvasMonomerSelect(index: number) {
  selectedIndex.value = index
  selectedIndices.value.clear()
  selectedIndices.value.add(index)
}

function handleCanvasRegionSelect(indices: number[]) {
  selectedIndices.value = new Set(indices)
  selectedIndex.value = indices.length > 0 ? indices[indices.length - 1] : -1
}

function handleCanvasDeleteRequest(indices: number[]) {
  if (indices.length === 0) return
  saveToHistory()
  const indicesSet = new Set(indices)
  const sortedIndices = [...indices].sort((a, b) => b - a)
  sortedIndices.forEach(index => { currentSequence.value.splice(index, 1) })

  const newConnections: typeof connections.value = []
  connections.value.forEach(conn => {
    if (indicesSet.has(conn.from) || indicesSet.has(conn.to)) return
    const fromShift = indices.filter(i => i < conn.from).length
    const toShift = indices.filter(i => i < conn.to).length
    newConnections.push({ from: conn.from - fromShift, to: conn.to - toShift, type: conn.type })
  })
  connections.value = newConnections

  indices.forEach(index => { delete monomerPositions.value[index] })
  currentSequence.value.forEach((m, i) => { m.position = i + 1 })
  selectedIndices.value.clear()
  selectedIndex.value = -1
  updateHELMOutput()
  drawConnections()
  ElMessage.success(`已删除 ${indices.length} 个单体`)
}

function handleCanvasPaste(monomers: any[]) {
  saveToHistory()
  const pt = polymerType.value
  monomers.forEach((m, i) => {
    const monomer = {
      ...m,
      letter: m.letter || getHelmLetter(m, pt),
      position: currentSequence.value.length + i + 1
    }
    currentSequence.value.push(monomer)
  })
  updateHELMOutput()
  ElMessage.success(`已粘贴 ${monomers.length} 个单体`)
}

function serializeStrandsFull() {
  serializeStrands((result) => {
    if (result.success) {
      ElMessage.success(result.message)
    } else {
      ElMessage.warning(result.message)
    }
  })
}

// ===== Watchers / 监听器 =====
watch([selectedIndex, currentSequence, polymerType, connections], () => {
  if (structureCanvasRef.value) {
    structureCanvasRef.value.render()
  }
}, { deep: true })

// ===== Lifecycle / 生命周期 =====
onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
  setTimeout(updateCanvasSize, 100)
  window.addEventListener('resize', updateCanvasSize)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('resize', updateCanvasSize)
  marqueeCleanup()
})

// 初始化 / Initialize
saveToHistory()
</script>

<style scoped>
.helm-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.toolbar {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-wrap: wrap;
}

.toolbar-group {
  display: flex;
  gap: 8px;
}

.editor-container {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.monomer-library {
  width: 200px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.monomer-section-header {
  font-size: 14px;
  font-weight: 600;
  color: #606266;
  margin: 0 0 8px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #ebeef5;
}

.monomer-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-bottom: 20px;
}

.canvas-area {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.structure-view {
  background: #fff;
  border-radius: 4px;
  padding: 16px;
  min-height: 300px;
}

.structure-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.structure-header h3 {
  font-size: 14px;
  color: #606266;
  margin: 0;
}

.sequence-view {
  background: #fff;
  border-radius: 4px;
  padding: 16px;
}

.sequence-view h3 {
  font-size: 14px;
  color: #606266;
  margin: 0 0 12px 0;
}

.sequence-display {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 60px;
}

.connection-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 10;
}

.sequence-display--marquee {
  cursor: crosshair;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.sequence-display--connection {
  cursor: pointer;
}

.connection-source {
  box-shadow: 0 0 0 2px #67c23a !important;
  background: #f0f9eb !important;
}

.connection-hover {
  box-shadow: 0 0 0 2px #909399 !important;
  opacity: 0.8;
}

.marquee-box {
  position: absolute;
  z-index: 20;
  border: 2px dashed #f56c6c;
  background: rgba(245, 108, 108, 0.12);
  pointer-events: none;
  box-sizing: border-box;
  border-radius: 2px;
}

.monomer-item {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.monomer-item:hover {
  transform: scale(1.05);
}

.monomer-item.selected {
  box-shadow: 0 0 0 2px #409eff;
}

.monomer-item.multi-selected {
  box-shadow: 0 0 0 2px #67c23a;
  background: #f0f9eb;
}

.monomer-item.drag-over {
  border-left: 3px solid #409eff;
  transform: translateX(3px);
}

.monomer-peptide {
  background: #ecf5ff;
  color: #409eff;
}

.monomer-rna {
  background: #f0f9ff;
  color: #00bcd4;
}

.monomer-dna {
  background: #f0f9ff;
  color: #4caf50;
}

.remove-btn {
  margin-left: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.monomer-item:hover .remove-btn {
  opacity: 1;
}

.monomer-drag-handle {
  opacity: 0;
  margin-right: 4px;
  font-size: 10px;
  color: #909399;
  cursor: grab;
  transition: opacity 0.2s;
}

.monomer-item:hover .monomer-drag-handle {
  opacity: 1;
}

.monomer-item:active .monomer-drag-handle {
  cursor: grabbing;
}

.empty-hint {
  color: #909399;
  font-style: italic;
  padding: 8px;
}

.input-area {
  background: #fff;
  border-radius: 4px;
  padding: 16px;
}

.info-panel {
  width: 250px;
  background: #fff;
  border-left: 1px solid #e4e7ed;
  padding: 16px;
  overflow-y: auto;
}

.info-panel h3 {
  font-size: 14px;
  color: #606266;
  margin: 0 0 12px 0;
}
</style>
