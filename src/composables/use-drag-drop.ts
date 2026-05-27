/**
 * 拖拽管理 Hook
 * Drag and Drop Management Hook
 * 
 * 负责单体拖拽、排序、从库中添加
 * Handles monomer dragging, reordering, adding from library
 */
import { ref, type Ref } from 'vue'
import { getHelmLetter } from '../utils/helmParser'
import type { Monomer } from './use-sequence'

/** 拖拽单体数据 / Dragged monomer data */
interface DraggedMonomerData {
  isFromLibrary?: boolean
  isMultiDrag?: boolean
  index?: number
  indices?: number[]
  monomer?: Monomer
  monomers?: Monomer[]
  [key: string]: any
}

/**
 * 拖拽管理 Hook 参数 / Drag and drop hook parameters
 */
interface UseDragDropOptions {
  currentSequence: Ref<Monomer[]>
  polymerType: Ref<string>
  selectedIndices: Ref<Set<number>>
  saveToHistory: () => void
}

/**
 * 拖拽管理 Hook
 * Drag and drop management composable
 */
export function useDragDrop(options: UseDragDropOptions) {
  const { currentSequence, polymerType, selectedIndices, saveToHistory } = options

  // 拖拽悬停索引 / Drag over index
  const dragOverIndex: Ref<number> = ref(-1)
  // 是否正在拖拽 / Whether currently dragging
  const isDragging: Ref<boolean> = ref(false)
  // 被拖拽的单体数据 / Dragged monomer data
  const draggedMonomer: Ref<DraggedMonomerData | null> = ref(null)

  /**
   * 从库中拖拽单体开始
   * Start dragging monomer from library
   * 
   * @param event - 拖拽事件 / drag event
   * @param monomer - 单体对象 / monomer object
   */
  function handleMonomerDragStart(event: DragEvent, monomer: Monomer) {
    draggedMonomer.value = { ...monomer, isFromLibrary: true }
    event.dataTransfer!.effectAllowed = 'copy'
    event.dataTransfer!.setData('application/json', JSON.stringify({
      type: 'monomer',
      data: monomer
    }))
  }

  /**
   * 序列中拖拽开始
   * Start dragging from sequence
   * 
   * @param event - 拖拽事件 / drag event
   * @param index - 单体索引 / monomer index
   * @param isMarqueeMode - 是否框选模式 / whether in marquee mode
   */
  function handleDragStart(event: DragEvent, index: number, isMarqueeMode: boolean) {
    if (isMarqueeMode) {
      event.preventDefault()
      return
    }
    if (selectedIndices.value.has(index)) {
      draggedMonomer.value = {
        isFromLibrary: false,
        isMultiDrag: true,
        indices: Array.from(selectedIndices.value),
        monomers: Array.from(selectedIndices.value).map(i => currentSequence.value[i])
      }
    } else {
      draggedMonomer.value = {
        isFromLibrary: false,
        index,
        monomer: currentSequence.value[index]
      }
    }
    isDragging.value = true
    event.dataTransfer!.effectAllowed = 'move'
    event.dataTransfer!.setData('application/json', JSON.stringify({
      type: 'sequence',
      index
    }))
  }

  /**
   * 拖拽结束
   * Drag end
   */
  function handleDragEnd() {
    isDragging.value = false
    dragOverIndex.value = -1
    draggedMonomer.value = null
  }

  /**
   * 拖拽悬停
   * Drag over
   * 
   * @param event - 拖拽事件 / drag event
   * @param index - 目标索引 / target index
   */
  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault()
    if (!isDragging.value) return
    event.dataTransfer!.dropEffect = 'move'
    dragOverIndex.value = index
  }

  /**
   * 拖拽离开
   * Drag leave
   */
  function handleDragLeave() {
    dragOverIndex.value = -1
  }

  /**
   * 放置处理
   * Drop handler
   * 
   * @param event - 拖拽事件 / drag event
   * @param dropIndex - 放置索引 / drop index
   * @param onDropResult - 放置结果回调 / drop result callback
   */
  function handleDrop(
    event: DragEvent,
    dropIndex: number,
    onDropResult?: (type: string, ...args: any[]) => void
  ) {
    event.preventDefault()
    dragOverIndex.value = -1

    if (!draggedMonomer.value) return

    if (draggedMonomer.value.isFromLibrary) {
      saveToHistory()
      const src = draggedMonomer.value
      const pt = src.type || polymerType.value
      const monomer: Monomer = {
        ...src,
        letter: src.letter || getHelmLetter(src, pt),
        position: dropIndex + 1
      }
      currentSequence.value.splice(dropIndex, 0, monomer)
      currentSequence.value.forEach((m, i) => { m.position = i + 1 })
      if (onDropResult) onDropResult('library', monomer)
    } else if (draggedMonomer.value.isMultiDrag) {
      saveToHistory()
      const monomersToMove = draggedMonomer.value.indices!.map(i => currentSequence.value[i])
      const indices = [...draggedMonomer.value.indices!].sort((a, b) => b - a)
      indices.forEach(idx => {
        currentSequence.value.splice(idx, 1)
      })
      let insertIndex = dropIndex
      indices.forEach(idx => {
        if (idx < dropIndex) insertIndex--
      })
      monomersToMove.forEach(m => {
        currentSequence.value.splice(insertIndex, 0, m)
        insertIndex++
      })
      currentSequence.value.forEach((m, i) => { m.position = i + 1 })
      if (onDropResult) onDropResult('multi')
    } else {
      const dragIndex = draggedMonomer.value.index!
      if (dragIndex === dropIndex) return

      saveToHistory()
      const [moved] = currentSequence.value.splice(dragIndex, 1)
      let newIndex = dropIndex
      if (dragIndex < dropIndex) newIndex--
      currentSequence.value.splice(newIndex, 0, moved)
      currentSequence.value.forEach((m, i) => { m.position = i + 1 })
      if (onDropResult) onDropResult('single', newIndex)
    }
  }

  /**
   * 序列区域拖拽悬停
   * Sequence area drag over
   * 
   * @param event - 拖拽事件 / drag event
   */
  function handleSequenceDragOver(event: DragEvent) {
    event.preventDefault()
    if (!isDragging.value) {
      event.dataTransfer!.dropEffect = 'copy'
    }
  }

  /**
   * 序列区域放置
   * Sequence area drop
   * 
   * @param event - 拖拽事件 / drag event
   * @param onDropResult - 放置结果回调 / drop result callback
   */
  function handleSequenceDrop(
    event: DragEvent,
    onDropResult?: (type: string, ...args: any[]) => void
  ) {
    event.preventDefault()
    if (!draggedMonomer.value || !draggedMonomer.value.isFromLibrary) return

    saveToHistory()
    const src = draggedMonomer.value
    const pt = src.type || polymerType.value
    const monomer: Monomer = {
      ...src,
      letter: src.letter || getHelmLetter(src, pt),
      position: currentSequence.value.length + 1
    }
    currentSequence.value.push(monomer)
    if (onDropResult) onDropResult('library', monomer)
  }

  return {
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
  }
}
