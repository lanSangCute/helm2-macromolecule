/**
 * 序列管理 Hook
 * Sequence Management Hook
 * 
 * 负责单体序列的增删改查、历史记录、撤销重做
 * Handles monomer sequence CRUD, history management, undo/redo
 */
import { ref, type Ref } from 'vue'
import { getHelmLetter } from '../utils/helmParser'

/** 单体对象类型 / Monomer object type */
export interface Monomer {
  code: string
  letter?: string
  type: string
  position?: number
  [key: string]: any
}

/** 历史状态 / History state */
interface HistoryState {
  sequence: Monomer[]
  polymerType: string
}

/**
 * 序列管理 Hook
 * Sequence management composable
 */
export function useSequence() {
  // 当前序列 / Current sequence
  const currentSequence: Ref<Monomer[]> = ref([])
  // 聚合物类型 / Polymer type
  const polymerType: Ref<string> = ref('PEPTIDE')
  // 历史记录 / History records
  const history: Ref<HistoryState[]> = ref([])
  // 当前历史索引 / Current history index
  const historyIndex: Ref<number> = ref(-1)

  /**
   * 保存当前状态到历史
   * Save current state to history
   */
  function saveToHistory() {
    history.value = history.value.slice(0, historyIndex.value + 1)
    history.value.push({
      sequence: [...currentSequence.value],
      polymerType: polymerType.value
    })
    historyIndex.value = history.value.length - 1
  }

  /**
   * 添加单体到序列末尾
   * Add a monomer to the end of the sequence
   * 
   * @param monomer - 单体对象 / monomer object
   */
  function addMonomer(monomer: Monomer) {
    saveToHistory()
    const pt = monomer.type || polymerType.value
    currentSequence.value.push({
      ...monomer,
      letter: monomer.letter || getHelmLetter(monomer, pt),
      position: currentSequence.value.length + 1
    })
  }

  /**
   * 从序列中移除指定索引的单体
   * Remove monomer at given index from sequence
   * 
   * @param index - 要移除的索引 / index to remove
   */
  function removeMonomer(index: number) {
    saveToHistory()
    currentSequence.value.splice(index, 1)
    currentSequence.value.forEach((m, i) => { m.position = i + 1 })
  }

  /**
   * 新建分子（清空序列）
   * Create new molecule (clear sequence)
   */
  function newMolecule() {
    saveToHistory()
    currentSequence.value = []
    polymerType.value = 'PEPTIDE'
  }

  /**
   * 撤销
   * Undo
   * 
   * @param onRestore - 恢复后的回调 / callback after restore
   */
  function undo(onRestore?: (state: HistoryState) => void) {
    if (historyIndex.value > 0) {
      historyIndex.value--
      const state = history.value[historyIndex.value]
      currentSequence.value = [...state.sequence]
      polymerType.value = state.polymerType || 'PEPTIDE'
      if (onRestore) onRestore(state)
    }
  }

  /**
   * 重做
   * Redo
   * 
   * @param onRestore - 恢复后的回调 / callback after restore
   */
  function redo(onRestore?: (state: HistoryState) => void) {
    if (historyIndex.value < history.value.length - 1) {
      historyIndex.value++
      const state = history.value[historyIndex.value]
      currentSequence.value = [...state.sequence]
      polymerType.value = state.polymerType || 'PEPTIDE'
      if (onRestore) onRestore(state)
    }
  }

  return {
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
  }
}
