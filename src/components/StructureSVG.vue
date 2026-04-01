<template>
  <div class="structure-svg">
    <svg
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- 绘制单体 -->
      <g v-for="pos in positions" :key="pos.index">
        <!-- 单体形状 -->
        <circle
          v-if="getShape(pos.monomer.type) === 'circle'"
          :cx="pos.x"
          :cy="pos.y"
          :r="getRadius(pos.monomer.type)"
          :fill="getBgColor(pos.monomer.type, pos.index)"
          :stroke="getColor(pos.monomer.type, pos.index)"
          :stroke-width="isSelected(pos.index) ? 3 : 2"
          @click="handleMonomerClick(pos.index, $event)"
          @mouseenter="handleMonomerHover(pos.index)"
          @mouseleave="handleMonomerLeave"
          style="cursor: pointer"
        />
        <rect
          v-else
          :x="pos.x - getSize(pos.monomer.type) / 2"
          :y="pos.y - getSize(pos.monomer.type) / 2"
          :width="getSize(pos.monomer.type)"
          :height="getSize(pos.monomer.type)"
          :fill="getBgColor(pos.monomer.type, pos.index)"
          :stroke="getColor(pos.monomer.type, pos.index)"
          :stroke-width="isSelected(pos.index) ? 3 : 2"
          @click="handleMonomerClick(pos.index, $event)"
          @mouseenter="handleMonomerHover(pos.index)"
          @mouseleave="handleMonomerLeave"
          style="cursor: pointer"
        />
        
        <!-- 单体文字 -->
        <text
          :x="pos.x"
          :y="pos.y"
          :fill="getColor(pos.monomer.type)"
          :font-size="getFontSize(pos.monomer.type)"
          font-weight="bold"
          text-anchor="middle"
          dominant-baseline="middle"
          style="pointer-events: none"
        >
          {{ getText(pos.monomer) }}
        </text>
      </g>
      
      <!-- 连接线 -->
      <g v-if="connections && connections.length > 0">
        <path
          v-for="(conn, i) in connections"
          :key="i"
          :d="getConnectionPath(conn)"
          fill="none"
          stroke="#67c23a"
          stroke-width="2"
          stroke-linecap="round"
        />
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'

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
  monomerPositions: {
    type: Object,
    default: () => ({})
  },
  selectedIndex: {
    type: Number,
    default: -1
  },
  selectedIndices: {
    type: Set,
    default: () => new Set()
  },
  width: {
    type: Number,
    default: 400
  },
  height: {
    type: Number,
    default: 300
  }
})

const emit = defineEmits(['monomer-click'])

// 单体配置
const CONFIG = {
  PEPTIDE: {
    shape: 'circle',
    radius: 25,
    fontSize: 14,
    color: '#409eff',
    bgColor: '#ecf5ff',
    selectedColor: '#67c23a',
    selectedBgColor: '#f0f9eb'
  },
  RNA: {
    shape: 'square',
    size: 40,
    fontSize: 16,
    color: '#00bcd4',
    bgColor: '#f0f9ff',
    selectedColor: '#67c23a',
    selectedBgColor: '#f0f9eb'
  },
  DNA: {
    shape: 'square',
    size: 40,
    fontSize: 16,
    color: '#4caf50',
    bgColor: '#f0f9ff',
    selectedColor: '#67c23a',
    selectedBgColor: '#f0f9eb'
  }
}

// 计算单体位置
const positions = computed(() => {
  const spacing = 70
  return props.sequence.map((monomer, index) => {
    const storedPos = props.monomerPositions[index]
    let x, y
    
    if (storedPos) {
      x = storedPos.x
      y = storedPos.y
    } else {
      x = 60 + index * spacing
      y = props.height / 2
    }
    
    return {
      index,
      x,
      y,
      monomer
    }
  })
})

function getShape(type) {
  return CONFIG[type]?.shape || 'circle'
}

function getRadius(type) {
  return CONFIG[type]?.radius || 25
}

function getSize(type) {
  return CONFIG[type]?.size || 40
}

function getFontSize(type) {
  return CONFIG[type]?.fontSize || 14
}

function getColor(type, index) {
  const config = CONFIG[type] || CONFIG.PEPTIDE
  return isSelected(index) ? config.selectedColor : config.color
}

function getBgColor(type, index) {
  const config = CONFIG[type] || CONFIG.PEPTIDE
  return isSelected(index) ? config.selectedBgColor : config.bgColor
}

function isSelected(index) {
  return index === props.selectedIndex || props.selectedIndices.has(index)
}

function getText(monomer) {
  return props.polymerType === 'PEPTIDE' ? monomer.code : monomer.code.charAt(0)
}

function getConnectionPath(conn) {
  const fromPos = positions.value.find(p => p.index === conn.from)
  const toPos = positions.value.find(p => p.index === conn.to)
  
  if (!fromPos || !toPos) return ''
  
  const midX = (fromPos.x + toPos.x) / 2
  const midY = (fromPos.y + toPos.y) / 2
  const offset = -50
  
  return `M ${fromPos.x} ${fromPos.y} Q ${midX} ${midY + offset} ${toPos.x} ${toPos.y}`
}

function handleMonomerClick(index, event) {
  emit('monomer-click', index, event)
}

function handleMonomerHover(index) {
  // 可以添加悬停效果
}

function handleMonomerLeave() {
  // 清除悬停效果
}
</script>

<style scoped>
.structure-svg {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: hidden;
}

.structure-svg svg {
  display: block;
}

.structure-svg circle,
.structure-svg rect {
  transition: all 0.2s;
}

.structure-svg circle:hover,
.structure-svg rect:hover {
  filter: brightness(0.95);
}
</style>
