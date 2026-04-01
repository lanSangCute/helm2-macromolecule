<template>
  <div class="helm-editor">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-group">
        <el-button @click="newMolecule" :icon="Plus">新建</el-button>
        <el-button @click="openFile" :icon="FolderOpened">打开</el-button>
        <el-button @click="saveHELM" :icon="Download">保存</el-button>
      </div>
      
      <div class="toolbar-group">
        <el-button @click="exportFormat('SMILES')" :icon="Document">SMILES</el-button>
        <el-button @click="exportFormat('Molfile')" :icon="Document">Molfile</el-button>
        <el-button @click="exportFormat('HELM')" :icon="Document">HELM</el-button>
      </div>
      
      <div class="toolbar-group">
        <el-button @click="undo" :icon="RefreshLeft">撤销</el-button>
        <el-button @click="redo" :icon="RefreshRight">重做</el-button>
      </div>
      
      <div class="toolbar-group">
        <el-button @click="deleteSelected" :icon="Delete" type="danger" :disabled="selectedIndices.size === 0">
          删除选中 ({{ selectedIndices.size }})
        </el-button>
        <el-button @click="clearCanvas" :icon="Delete" type="warning">清空画布</el-button>
      </div>
      
      <div class="toolbar-group">
        <el-button @click="toggleMultiSelect"  :type="isMultiSelectMode ? 'primary' : ''">
          多选模式：{{ isMultiSelectMode ? '开' : '关' }}
        </el-button>
        <el-button
          @click="toggleMarqueeMode"
          :type="isMarqueeMode ? 'primary' : ''"
          :icon="Pointer"
        >
          Select
        </el-button>
        <el-button
          @click="toggleConnectionMode"
          :type="connectionMode ? 'success' : ''"
          :icon="Connection"
        >
          连接线 {{ connectionMode ? '开' : '关' }}
        </el-button>
      </div>
    </div>
    
    <!-- 主编辑区 -->
    <div class="editor-container">
      <!-- 左侧单体库 -->
      <div class="monomer-library">
        <h3>氨基酸</h3>
        <div class="monomer-grid">
          <el-button
            v-for="aa in aminoAcids"
            :key="aa.code"
            @click="addMonomer(aa)"
            @dragstart="handleMonomerDragStart($event, aa)"
            draggable="true"
            size="small"
          >
            {{ aa.code }}
          </el-button>
        </div>
        
        <h3>核苷酸</h3>
        <div class="monomer-grid">
          <el-button
            v-for="nt in nucleotides"
            :key="nt.code"
            @click="addMonomer(nt)"
            @dragstart="handleMonomerDragStart($event, nt)"
            draggable="true"
            size="small"
            type="success"
          >
            {{ nt.code }}
          </el-button>
        </div>
      </div>
      
      <!-- 中间画布区 -->
      <div class="canvas-area">
        <!-- 结构式 Canvas -->
        <div class="structure-view">
          <h3>结构式</h3>
          <StructureCanvas
            ref="structureCanvasRef"
            :sequence="currentSequence"
            :polymer-type="polymerType"
            :connections="connections"
            @monomer-select="handleCanvasMonomerSelect"
          />
        </div>
        
        <div class="sequence-view">
          <h3>序列视图</h3>
          <div 
            ref="sequenceDisplayRef"
            class="sequence-display"
            :class="{ 
              'sequence-display--marquee': isMarqueeMode,
              'sequence-display--connection': connectionMode 
            }"
            @dragover="handleSequenceDragOver"
            @drop="handleSequenceDrop"
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
              @dragstart="handleDragStart($event, index)"
              @dragend="handleDragEnd($event)"
              @dragover="handleDragOver($event, index)"
              @dragleave="handleDragLeave($event)"
              @drop="handleDrop($event, index)"
              @mouseenter="handleMonomerMouseEnter(index)"
              @mouseleave="handleMonomerMouseLeave(index)"
            >
              <span class="monomer-drag-handle">☰</span>
              {{ monomer.code }}
              <el-icon class="remove-btn" @click.stop="removeMonomer(index)">
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
        </div>
        
        <div class="input-area">
          <el-input
            v-model="helmInput"
            type="textarea"
            :rows="3"
            placeholder="粘贴 HELM 字符串或序列..."
            @change="parseInput"
          />
        </div>
      </div>
      
      <!-- 右侧信息面板 -->
      <div class="info-panel">
        <h3>分子信息</h3>
        <el-descriptions :column="1" size="small">
          <el-descriptions-item label="类型">{{ polymerType }}</el-descriptions-item>
          <el-descriptions-item label="长度">{{ currentSequence.length }}</el-descriptions-item>
          <el-descriptions-item label="分子量">{{ calculatedMass }} Da</el-descriptions-item>
          <el-descriptions-item label="HELM">{{ helmOutput }}</el-descriptions-item>
        </el-descriptions>
      </div>
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

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { 
  Plus, FolderOpened, Download, Document, 
  RefreshLeft, RefreshRight, Close, Delete, Pointer, Connection
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import helmParser, {
  parseHELM,
  toHELM,
  getHelmLetter,
  toSMILES,
  parseSMILES,
  toMolfile,
  parseMolfile,
  calculateMass
} from '../utils/helmParser'
import StructureCanvas from './StructureCanvas.vue'

// 状态
const currentSequence = ref([])
const selectedIndex = ref(-1)
const selectedIndices = ref(new Set())
const isMultiSelectMode = ref(false)
const isMarqueeMode = ref(false)
const sequenceDisplayRef = ref(null)
const connectionCanvasRef = ref(null)
const structureCanvasRef = ref(null)
const marqueeDragging = ref(false)
const marqueeStart = ref({ x: 0, y: 0 })
const marqueeEnd = ref({ x: 0, y: 0 })
const dragOverIndex = ref(-1)
const isDragging = ref(false)
const draggedMonomer = ref(null)
const helmInput = ref('')
const helmOutput = ref('')
const polymerType = ref('PEPTIDE')
const history = ref([])
const historyIndex = ref(-1)
const fileInputRef = ref(null)
// 连接线相关
const connections = ref([]) // { from: number, to: number, type: string }
const connectionMode = ref(false)
const connectionStartIndex = ref(-1)
const connectionHoverIndex = ref(-1)
const canvasSize = ref({ width: 0, height: 0 })

// 单体库
const aminoAcids = Object.values(helmParser.AMINO_ACIDS).map(aa => ({
  ...aa,
  type: 'PEPTIDE'
}))

const nucleotides = Object.values(helmParser.NUCLEOTIDES).map(nt => ({
  ...nt,
  type: nt.type
}))

// 计算属性
const calculatedMass = computed(() => {
  return calculateMass(currentSequence.value).toFixed(2)
})

const marqueeBoxStyle = computed(() => {
  const x1 = marqueeStart.value.x
  const x2 = marqueeEnd.value.x
  const y1 = marqueeStart.value.y
  const y2 = marqueeEnd.value.y
  const left = Math.min(x1, x2)
  const top = Math.min(y1, y2)
  const width = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`
  }
})

const canvasStyle = computed(() => {
  return {
    width: `${canvasSize.value.width}px`,
    height: `${canvasSize.value.height}px`
  }
})

// 方法
function newMolecule() {
  saveToHistory()
  currentSequence.value = []
  connections.value = []
  helmInput.value = ''
  helmOutput.value = ''
  selectedIndex.value = -1
  connectionStartIndex.value = -1
  drawConnections()
}

function openFile() {
  fileInputRef.value?.click()
}

function applyParsedSequence(type, sequence) {
  if (!sequence) {
    ElMessage.warning('未识别到可用序列')
    return
  }

  let monomers = []
  if (type === 'PEPTIDE') {
    monomers = sequence.split('').map((char, index) => {
      const aa = helmParser.AMINO_ACIDS[char.toUpperCase()]
      return aa
        ? { ...aa, type: 'PEPTIDE', letter: char.toUpperCase(), position: index + 1 }
        : null
    }).filter(Boolean)
  } else if (type === 'RNA' || type === 'DNA') {
    monomers = sequence.split('').map((char, index) => {
      const nt = helmParser.NUCLEOTIDES[char.toUpperCase()]
      return nt ? { ...nt, type, letter: char.toUpperCase(), position: index + 1 } : null
    }).filter(Boolean)
  }

  if (monomers.length === 0) {
    ElMessage.warning('文件内容无法转换为当前支持的单体序列')
    return
  }

  saveToHistory()
  polymerType.value = type
  currentSequence.value = monomers
  updateHELMOutput()
  // 与右侧 HELM、保存文件一致：输入框同步为当前 HELM 字符串
  helmInput.value = helmOutput.value
}

async function loadHELM(event) {
  const file = event?.target?.files?.[0]
  if (!file) return

  try {
    const content = await file.text()
    const fileName = file.name.toLowerCase()
    const text = content.trim()
    let parsed = null

    if (fileName.endsWith('.helm') || text.includes('{')) {
      const parsedHELM = parseHELM(text)
      if (parsedHELM.polymers.length > 0) {
        const polymer = parsedHELM.polymers[0]
        const helmSeq = polymer.sequence
          .map((m) => getHelmLetter(m, polymer.type))
          .join('')
        applyParsedSequence(polymer.type, helmSeq)
        ElMessage.success('HELM 文件加载成功')
      } else {
        ElMessage.warning('HELM 文件解析失败')
      }
    } else if (fileName.endsWith('.mol') || fileName.endsWith('.molfile') || text.includes('V2000')) {
      parsed = parseMolfile(text)
      if (parsed) {
        applyParsedSequence(parsed.type, parsed.sequence)
        ElMessage.success('Molfile 文件加载成功')
      } else {
        ElMessage.warning('Molfile 解析失败')
      }
    } else if (fileName.endsWith('.smi') || fileName.endsWith('.smiles')) {
      parsed = parseSMILES(text)
      if (parsed) {
        applyParsedSequence(parsed.type, parsed.sequence)
        ElMessage.success('SMILES 文件加载成功')
      } else {
        ElMessage.warning('SMILES 解析失败')
      }
    } else {
      // 兜底自动识别：HELM > Molfile > SMILES
      const parsedHELM = parseHELM(text)
      if (parsedHELM.polymers.length > 0) {
        const polymer = parsedHELM.polymers[0]
        const helmSeq = polymer.sequence
          .map((m) => getHelmLetter(m, polymer.type))
          .join('')
        applyParsedSequence(polymer.type, helmSeq)
        ElMessage.success('文件已按 HELM 格式加载')
      } else {
        parsed = parseMolfile(text) || parseSMILES(text)
        if (parsed) {
          applyParsedSequence(parsed.type, parsed.sequence)
          ElMessage.success('文件格式自动识别并加载成功')
        } else {
          ElMessage.warning('无法识别文件格式，请使用 HELM/SMILES/Molfile')
        }
      }
    }
  } catch (error) {
    ElMessage.error(`文件读取失败：${error.message || '未知错误'}`)
  } finally {
    // 重置 input，允许重复选择同一文件
    if (event?.target) {
      event.target.value = ''
    }
  }
}

function saveHELM() {
  const helm = toHELM({
    polymers: [{
      type: polymerType.value,
      index: 1,
      monomers: currentSequence.value
    }]
  })
  
  // 创建下载
  const blob = new Blob([helm], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'molecule.helm'
  a.click()
  URL.revokeObjectURL(url)
  
  ElMessage.success('HELM 文件已保存')
}

function exportFormat(format) {
  if (currentSequence.value.length === 0) {
    ElMessage.warning('当前没有可导出的分子')
    return
  }

  const type = polymerType.value
  const baseName = 'molecule'

  if (format === 'HELM') {
    saveHELM()
    return
  }

  if (format === 'SMILES') {
    const smiles = toSMILES(currentSequence.value, type)
    const sequence = currentSequence.value.map((m) => getHelmLetter(m, type)).join('')
    const smilesContent = [
      `# HELM_TYPE: ${type}`,
      `# HELM_SEQUENCE: ${sequence}`,
      smiles
    ].join('\n')
    downloadTextFile(`${baseName}.smi`, smilesContent, 'text/plain')
    ElMessage.success('SMILES 导出成功')
    return
  }

  if (format === 'Molfile') {
    const molfile = toMolfile(currentSequence.value, type)
    downloadTextFile(`${baseName}.mol`, molfile, 'chemical/x-mdl-molfile')
    ElMessage.success('Molfile 导出成功')
    return
  }

  ElMessage.warning(`暂不支持导出格式：${format}`)
}

function downloadTextFile(filename, content, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function undo() {
  if (historyIndex.value > 0) {
    historyIndex.value--
    const state = history.value[historyIndex.value]
    currentSequence.value = [...state.sequence]
    connections.value = [...state.connections]
    updateHELMOutput()
    drawConnections()
  }
}

function redo() {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    const state = history.value[historyIndex.value]
    currentSequence.value = [...state.sequence]
    connections.value = [...state.connections]
    updateHELMOutput()
    drawConnections()
  }
}

function saveToHistory() {
  // 移除当前索引之后的历史
  history.value = history.value.slice(0, historyIndex.value + 1)
  history.value.push({
    sequence: [...currentSequence.value],
    connections: [...connections.value]
  })
  historyIndex.value = history.value.length - 1
}

function addMonomer(monomer) {
  saveToHistory()
  const pt = monomer.type || polymerType.value
  currentSequence.value.push({
    ...monomer,
    letter: monomer.letter || getHelmLetter(monomer, pt),
    position: currentSequence.value.length + 1
  })
  updateHELMOutput()
}

function removeMonomer(index) {
  saveToHistory()
  currentSequence.value.splice(index, 1)
  // 更新位置
  currentSequence.value.forEach((m, i) => m.position = i + 1)
  updateHELMOutput()
}

function selectMonomer(index, event) {
  if (isMarqueeMode.value) return
  if (isMultiSelectMode.value) {
    // 多选模式
    if (event.shiftKey) {
      // Shift+ 点击：范围选择
      const start = selectedIndex.value >= 0 ? selectedIndex.value : index
      const end = index
      const min = Math.min(start, end)
      const max = Math.max(start, end)
      for (let i = min; i <= max; i++) {
        selectedIndices.value.add(i)
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd+ 点击：切换选择
      if (selectedIndices.value.has(index)) {
        selectedIndices.value.delete(index)
      } else {
        selectedIndices.value.add(index)
      }
    } else {
      // 普通点击：清空其他选择
      selectedIndices.value.clear()
      selectedIndices.value.add(index)
    }
    selectedIndex.value = index
  } else {
    // 单选模式
    selectedIndex.value = index
    selectedIndices.value.clear()
  }
}

function toggleMultiSelect() {
  isMultiSelectMode.value = !isMultiSelectMode.value
  if (!isMultiSelectMode.value) {
    selectedIndices.value.clear()
  }
  ElMessage.success(isMultiSelectMode.value ? '已开启多选模式' : '已关闭多选模式')
}

function toggleMarqueeMode() {
  isMarqueeMode.value = !isMarqueeMode.value
  marqueeDragging.value = false
  if (isMarqueeMode.value) {
    ElMessage.success('框选：在序列区域拖拽划定范围；Delete 删除选中')
  } else {
    ElMessage.info('已关闭框选')
  }
}

function toggleConnectionMode() {
  connectionMode.value = !connectionMode.value
  connectionStartIndex.value = -1
  connectionHoverIndex.value = -1
  if (connectionMode.value) {
    isMarqueeMode.value = false
    ElMessage.success('连接线模式：点击两个单体创建化学键（如二硫键）')
    setTimeout(updateCanvasSize, 0)
  } else {
    ElMessage.info('已关闭连接线模式')
  }
}

function handleMonomerClick(index, event) {
  if (connectionMode.value) {
    event.stopPropagation()
    handleConnectionClick(index)
    return
  }
  selectMonomer(index, event)
}

function handleConnectionClick(index) {
  if (connectionStartIndex.value === -1) {
    // 第一个点击：选择起点
    connectionStartIndex.value = index
    ElMessage.info(`已选择起点：${currentSequence.value[index]?.code}，请选择终点`)
  } else if (connectionStartIndex.value === index) {
    // 点击同一个：取消
    connectionStartIndex.value = -1
    ElMessage.info('已取消')
  } else {
    // 第二个点击：创建连接
    const from = connectionStartIndex.value
    const to = index
    // 检查是否已存在
    const exists = connections.value.some(
      c => (c.from === from && c.to === to) || (c.from === to && c.to === from)
    )
    if (exists) {
      ElMessage.warning('该连接已存在')
    } else {
      connections.value.push({ from, to, type: 'covalent' })
      ElMessage.success(`已创建连接：${currentSequence.value[from]?.code} ↔ ${currentSequence.value[to]?.code}`)
      drawConnections()
    }
    connectionStartIndex.value = -1
  }
}

function handleMonomerMouseEnter(index) {
  if (connectionMode.value && connectionStartIndex.value !== -1) {
    connectionHoverIndex.value = index
  }
}

function handleMonomerMouseLeave(index) {
  connectionHoverIndex.value = -1
}

function updateCanvasSize() {
  const container = sequenceDisplayRef.value
  if (!container) return
  canvasSize.value = {
    width: container.offsetWidth,
    height: container.offsetHeight
  }
  setTimeout(drawConnections, 0)
}

function drawConnections() {
  const canvas = connectionCanvasRef.value
  const container = sequenceDisplayRef.value
  if (!canvas || !container) return
  
  const ctx = canvas.getContext('2d')
  const rect = container.getBoundingClientRect()
  
  // 设置 canvas 尺寸
  canvas.width = canvasSize.value.width
  canvas.height = canvasSize.value.height
  
  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // 绘制所有连接线
  connections.value.forEach(conn => {
    const fromEl = container.querySelector(`[data-monomer-index="${conn.from}"]`)
    const toEl = container.querySelector(`[data-monomer-index="${conn.to}"]`)
    
    if (!fromEl || !toEl) return
    
    const fromRect = fromEl.getBoundingClientRect()
    const toRect = toEl.getBoundingClientRect()
    
    const fromX = fromRect.left - rect.left + fromRect.width / 2
    const fromY = fromRect.top - rect.top + fromRect.height / 2
    const toX = toRect.left - rect.left + toRect.width / 2
    const toY = toRect.top - rect.top + toRect.height / 2
    
    // 绘制曲线
    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    
    // 计算控制点，使曲线向上拱起
    const midX = (fromX + toX) / 2
    const midY = (fromY + toY) / 2
    const offset = -50 // 向上偏移
    
    ctx.quadraticCurveTo(midX, midY + offset, toX, toY)
    
    ctx.strokeStyle = '#67c23a'
    ctx.lineWidth = 2
    ctx.stroke()
    
    // 绘制箭头
    const angle = Math.atan2(toY - (midY + offset), toX - midX)
    const arrowLength = 10
    ctx.beginPath()
    ctx.moveTo(toX, toY)
    ctx.lineTo(
      toX - arrowLength * Math.cos(angle - Math.PI / 6),
      toY - arrowLength * Math.sin(angle - Math.PI / 6)
    )
    ctx.lineTo(
      toX - arrowLength * Math.cos(angle + Math.PI / 6),
      toY - arrowLength * Math.sin(angle + Math.PI / 6)
    )
    ctx.closePath()
    ctx.fillStyle = '#67c23a'
    ctx.fill()
  })
  
  // 绘制临时连接线（起点到悬停位置）
  if (connectionStartIndex.value !== -1 && connectionHoverIndex.value !== -1) {
    const fromEl = container.querySelector(`[data-monomer-index="${connectionStartIndex.value}"]`)
    const toEl = container.querySelector(`[data-monomer-index="${connectionHoverIndex.value}"]`)
    
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

function getRelativePointInContainer(event, container) {
  const r = container.getBoundingClientRect()
  return { x: event.clientX - r.left, y: event.clientY - r.top }
}

function rectIntersects(a, b) {
  return !(
    a.left + a.width < b.left ||
    b.left + b.width < a.left ||
    a.top + a.height < b.top ||
    b.top + b.height < a.top
  )
}

let marqueeMoveHandler = null

function handleMarqueePointerDown(event) {
  if (!isMarqueeMode.value) return
  if (event.button !== 0) return
  const container = sequenceDisplayRef.value
  if (!container) return
  event.preventDefault()
  const p = getRelativePointInContainer(event, container)
  marqueeStart.value = { ...p }
  marqueeEnd.value = { ...p }
  marqueeDragging.value = true

  marqueeMoveHandler = (ev) => {
    if (!marqueeDragging.value) return
    marqueeEnd.value = getRelativePointInContainer(ev, container)
  }
  window.addEventListener('pointermove', marqueeMoveHandler)

  const onUp = (ev) => {
    window.removeEventListener('pointermove', marqueeMoveHandler)
    marqueeMoveHandler = null
    marqueeDragging.value = false

    const dx = marqueeEnd.value.x - marqueeStart.value.x
    const dy = marqueeEnd.value.y - marqueeStart.value.y
    const dist = Math.hypot(dx, dy)

    if (dist < 5) {
      const el = ev.target?.closest?.('[data-monomer-index]')
      if (el) {
        const idx = parseInt(el.getAttribute('data-monomer-index'), 10)
        if (!Number.isNaN(idx)) {
          selectedIndex.value = idx
          selectedIndices.value.clear()
          selectedIndices.value.add(idx)
        }
      }
      window.removeEventListener('pointerup', onUp)
      return
    }

    const selLeft = Math.min(marqueeStart.value.x, marqueeEnd.value.x)
    const selTop = Math.min(marqueeStart.value.y, marqueeEnd.value.y)
    const selW = Math.abs(marqueeEnd.value.x - marqueeStart.value.x)
    const selH = Math.abs(marqueeEnd.value.y - marqueeStart.value.y)
    const sel = { left: selLeft, top: selTop, width: selW, height: selH }
    const cr = container.getBoundingClientRect()
    const hits = []
    container.querySelectorAll('[data-monomer-index]').forEach((el) => {
      const mr = el.getBoundingClientRect()
      const rel = {
        left: mr.left - cr.left,
        top: mr.top - cr.top,
        width: mr.width,
        height: mr.height
      }
      if (rectIntersects(sel, rel)) {
        hits.push(parseInt(el.getAttribute('data-monomer-index'), 10))
      }
    })
    hits.sort((a, b) => a - b)
    selectedIndices.value = new Set(hits)
    selectedIndex.value = hits.length ? hits[hits.length - 1] : -1
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointerup', onUp)
}

function onGlobalKeydown(event) {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return
  const t = event.target
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
  // 从后往前删除，避免索引偏移
  const indices = Array.from(selectedIndices.value).sort((a, b) => b - a)
  indices.forEach(index => {
    currentSequence.value.splice(index, 1)
    // 删除相关连接
    connections.value = connections.value.filter(
      c => c.from !== index && c.to !== index
    )
    // 更新连接索引
    connections.value.forEach(c => {
      if (c.from > index) c.from--
      if (c.to > index) c.to--
    })
  })
  // 更新位置
  currentSequence.value.forEach((m, i) => m.position = i + 1)
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
  drawConnections()
  ElMessage.success('画布已清空')
}

// 拖拽相关方法
function handleMonomerDragStart(event, monomer) {
  draggedMonomer.value = { ...monomer, isFromLibrary: true }
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'monomer',
    data: monomer
  }))
}

function handleDragStart(event, index) {
  if (isMarqueeMode.value) {
    event.preventDefault()
    return
  }
  if (selectedIndices.value.has(index)) {
    // 拖拽选中的多个单体
    draggedMonomer.value = {
      isFromLibrary: false,
      isMultiDrag: true,
      indices: Array.from(selectedIndices.value),
      monomers: Array.from(selectedIndices.value).map(i => currentSequence.value[i])
    }
  } else {
    draggedMonomer.value = {
      isFromLibrary: false,
      index: index,
      monomer: currentSequence.value[index]
    }
  }
  isDragging.value = true
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'sequence',
    index: index
  }))
}

function handleDragEnd(event) {
  isDragging.value = false
  dragOverIndex.value = -1
  draggedMonomer.value = null
}

function handleDragOver(event, index) {
  event.preventDefault()
  if (!isDragging.value) return
  event.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

function handleDragLeave(event) {
  dragOverIndex.value = -1
}

function handleDrop(event, dropIndex) {
  event.preventDefault()
  dragOverIndex.value = -1
  
  if (!draggedMonomer.value) return
  
  if (draggedMonomer.value.isFromLibrary) {
    // 从库中拖拽添加
    saveToHistory()
    const src = draggedMonomer.value
    const pt = src.type || polymerType.value
    const monomer = {
      ...src,
      letter: src.letter || getHelmLetter(src, pt),
      position: dropIndex + 1
    }
    currentSequence.value.splice(dropIndex, 0, monomer)
    // 更新位置
    currentSequence.value.forEach((m, i) => m.position = i + 1)
    updateHELMOutput()
    ElMessage.success(`添加了 ${monomer.code}`)
  } else if (draggedMonomer.value.isMultiDrag) {
    // 拖拽多个选中的单体
    saveToHistory()
    const monomersToMove = draggedMonomer.value.indices.map(i => currentSequence.value[i])
    // 先删除（从后往前）
    const indices = draggedMonomer.value.indices.sort((a, b) => b - a)
    indices.forEach(idx => {
      currentSequence.value.splice(idx, 1)
    })
    // 再插入到新位置
    let insertIndex = dropIndex
    indices.forEach(idx => {
      if (idx < dropIndex) insertIndex--
    })
    monomersToMove.forEach(m => {
      currentSequence.value.splice(insertIndex, 0, m)
      insertIndex++
    })
    // 更新位置
    currentSequence.value.forEach((m, i) => m.position = i + 1)
    selectedIndices.value.clear()
    updateHELMOutput()
  } else {
    // 拖拽单个单体重新排序
    const dragIndex = draggedMonomer.value.index
    if (dragIndex === dropIndex) return
    
    saveToHistory()
    const [moved] = currentSequence.value.splice(dragIndex, 1)
    let newIndex = dropIndex
    if (dragIndex < dropIndex) newIndex--
    currentSequence.value.splice(newIndex, 0, moved)
    // 更新位置
    currentSequence.value.forEach((m, i) => m.position = i + 1)
    selectedIndex.value = newIndex
    updateHELMOutput()
  }
}

function handleSequenceDragOver(event) {
  event.preventDefault()
  if (!isDragging.value) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function handleSequenceDrop(event) {
  event.preventDefault()
  if (!draggedMonomer.value || !draggedMonomer.value.isFromLibrary) return
  
  // 拖拽到空白区域，添加到末尾
  saveToHistory()
  const src = draggedMonomer.value
  const pt = src.type || polymerType.value
  const monomer = {
    ...src,
    letter: src.letter || getHelmLetter(src, pt),
    position: currentSequence.value.length + 1
  }
  currentSequence.value.push(monomer)
  updateHELMOutput()
  ElMessage.success(`添加了 ${monomer.code}`)
}

function parseInput() {
  const input = helmInput.value.trim()
  
  if (!input) return
  
  // 尝试解析为 HELM
  if (input.includes('{') && input.includes('}')) {
    const parsed = parseHELM(input)
    if (parsed.polymers.length > 0) {
      saveToHistory()
      currentSequence.value = parsed.polymers[0].sequence || []
      polymerType.value = parsed.polymers[0].type
      updateHELMOutput()
      ElMessage.success('HELM 解析成功')
      return
    }
  }
  
  // 尝试解析为纯序列
  if (/^[ACDEFGHIKLMNPQRSTVWY]+$/i.test(input)) {
    saveToHistory()
    polymerType.value = 'PEPTIDE'
    currentSequence.value = input.split('').map((char, index) => {
      const aa = helmParser.AMINO_ACIDS[char.toUpperCase()]
      return aa
        ? { ...aa, type: 'PEPTIDE', letter: char.toUpperCase(), position: index + 1 }
        : null
    }).filter(Boolean)
    updateHELMOutput()
    ElMessage.success('蛋白质序列解析成功')
    return
  }
  
  if (/^[ACGTU]+$/i.test(input)) {
    saveToHistory()
    polymerType.value = input.includes('U') ? 'RNA' : 'DNA'
    const pt = polymerType.value
    currentSequence.value = input.split('').map((char, index) => {
      const nt = helmParser.NUCLEOTIDES[char.toUpperCase()]
      return nt
        ? { ...nt, type: pt, letter: char.toUpperCase(), position: index + 1 }
        : null
    }).filter(Boolean)
    updateHELMOutput()
    ElMessage.success('核酸序列解析成功')
    return
  }
  
  ElMessage.warning('无法识别的格式')
}

function updateHELMOutput() {
  helmOutput.value = toHELM({
    polymers: [{
      type: polymerType.value,
      index: 1,
      monomers: currentSequence.value
    }],
    connections: connections.value.map(c => ({
      source: `PEPTIDE1`,
      sourceBond: c.from + 1, // HELM 使用 1-based 索引
      target: `PEPTIDE1`,
      targetBond: c.to + 1
    }))
  })
}

function getMonomerClass(type) {
  return {
    'monomer-peptide': type === 'PEPTIDE',
    'monomer-rna': type === 'RNA',
    'monomer-dna': type === 'DNA'
  }
}

function handleCanvasMonomerSelect(index) {
  // Canvas 点击选中同步到序列视图
  selectedIndex.value = index
  selectedIndices.value.clear()
  selectedIndices.value.add(index)
}

// 同步选中状态到 Canvas
watch([selectedIndex, currentSequence, polymerType, connections], () => {
  if (structureCanvasRef.value) {
    structureCanvasRef.value.render()
  }
}, { deep: true })

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
  // 初始化 canvas 尺寸
  setTimeout(updateCanvasSize, 100)
  // 窗口大小改变时更新
  window.addEventListener('resize', updateCanvasSize)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('resize', updateCanvasSize)
  if (marqueeMoveHandler) {
    window.removeEventListener('pointermove', marqueeMoveHandler)
    marqueeMoveHandler = null
  }
})

// 初始化
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
}

.monomer-library h3 {
  font-size: 14px;
  color: #606266;
  margin: 0 0 12px 0;
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

.structure-view h3 {
  font-size: 14px;
  color: #606266;
  margin: 0 0 12px 0;
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
