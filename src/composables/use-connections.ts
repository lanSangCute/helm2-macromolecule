/**
 * 连接线管理 Hook
 * Connection Management Hook
 * 
 * 负责连接线模式、连接创建、连接悬停状态
 * Handles connection mode, connection creation, connection hover state
 */
import { ref, type Ref } from 'vue'

/** 连接对象类型 / Connection object type */
export interface Connection {
  from: number
  to: number
  type: string
}

/**
 * 连接线管理 Hook
 * Connection management composable
 */
export function useConnections() {
  // 连接列表 / Connection list
  const connections: Ref<Connection[]> = ref([])
  // 是否连接线模式 / Whether in connection mode
  const connectionMode: Ref<boolean> = ref(false)
  // 连接线起点索引 / Connection start index
  const connectionStartIndex: Ref<number> = ref(-1)
  // 连接线悬停索引 / Connection hover index
  const connectionHoverIndex: Ref<number> = ref(-1)

  /**
   * 切换连接线模式
   * Toggle connection mode
   * 
   * @param onToggle - 切换后的回调 / callback after toggle
   */
  function toggleConnectionMode(onToggle?: (mode: boolean) => void) {
    connectionMode.value = !connectionMode.value
    connectionStartIndex.value = -1
    connectionHoverIndex.value = -1
    if (onToggle) onToggle(connectionMode.value)
  }

  /**
   * 处理连接线点击
   * Handle connection click
   * 
   * @param index - 点击的单体索引 / clicked monomer index
   * @param onResult - 结果回调 / result callback
   */
  function handleConnectionClick(
    index: number,
    onResult?: (status: 'start' | 'cancel' | 'created' | 'exists', from?: number, to?: number) => void
  ) {
    if (connectionStartIndex.value === -1) {
      connectionStartIndex.value = index
      if (onResult) onResult('start', index)
    } else if (connectionStartIndex.value === index) {
      connectionStartIndex.value = -1
      if (onResult) onResult('cancel')
    } else {
      const from = connectionStartIndex.value
      const to = index
      const exists = connections.value.some(
        c => (c.from === from && c.to === to) || (c.from === to && c.to === from)
      )
      if (exists) {
        if (onResult) onResult('exists')
      } else {
        connections.value.push({ from, to, type: 'covalent' })
        if (onResult) onResult('created', from, to)
      }
      connectionStartIndex.value = -1
    }
  }

  /**
   * 处理单体鼠标进入
   * Handle monomer mouse enter
   * 
   * @param index - 单体索引 / monomer index
   */
  function handleMonomerMouseEnter(index: number) {
    if (connectionMode.value && connectionStartIndex.value !== -1) {
      connectionHoverIndex.value = index
    }
  }

  /**
   * 处理单体鼠标离开
   * Handle monomer mouse leave
   */
  function handleMonomerMouseLeave() {
    connectionHoverIndex.value = -1
  }

  return {
    connections,
    connectionMode,
    connectionStartIndex,
    connectionHoverIndex,
    toggleConnectionMode,
    handleConnectionClick,
    handleMonomerMouseEnter,
    handleMonomerMouseLeave
  }
}
