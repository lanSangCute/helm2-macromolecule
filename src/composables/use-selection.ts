/**
 * 选中管理 Hook
 * Selection Management Hook
 * 
 * 负责单体的选中状态、多选模式、框选模式
 * Handles monomer selection state, multi-select mode, marquee mode
 */
import { ref, type Ref } from 'vue'

/**
 * 选中管理 Hook
 * Selection management composable
 */
export function useSelection() {
  // 当前选中索引 / Current selected index
  const selectedIndex: Ref<number> = ref(-1)
  // 多选索引集合 / Multi-selected indices set
  const selectedIndices: Ref<Set<number>> = ref(new Set())
  // 是否多选模式 / Whether in multi-select mode
  const isMultiSelectMode: Ref<boolean> = ref(false)
  // 是否框选模式 / Whether in marquee mode
  const isMarqueeMode: Ref<boolean> = ref(false)

  /**
   * 选中单体
   * Select a monomer
   * 
   * @param index - 单体索引 / monomer index
   * @param event - 鼠标事件 / mouse event
   */
  function selectMonomer(index: number, event: MouseEvent) {
    if (isMarqueeMode.value) return
    if (isMultiSelectMode.value) {
      if (event.shiftKey) {
        // Shift+点击：范围选择 / Shift+click: range select
        const start = selectedIndex.value >= 0 ? selectedIndex.value : index
        const end = index
        const min = Math.min(start, end)
        const max = Math.max(start, end)
        for (let i = min; i <= max; i++) {
          selectedIndices.value.add(i)
        }
      } else if (event.ctrlKey || event.metaKey) {
        // Ctrl/Cmd+点击：切换选择 / Ctrl/Cmd+click: toggle select
        if (selectedIndices.value.has(index)) {
          selectedIndices.value.delete(index)
        } else {
          selectedIndices.value.add(index)
        }
      } else {
        // 普通点击：清空其他选择 / Normal click: clear other selections
        selectedIndices.value.clear()
        selectedIndices.value.add(index)
      }
      selectedIndex.value = index
    } else {
      // 单选模式 / Single select mode
      selectedIndex.value = index
      selectedIndices.value.clear()
    }
  }

  /**
   * 切换多选模式
   * Toggle multi-select mode
   */
  function toggleMultiSelect() {
    isMultiSelectMode.value = !isMultiSelectMode.value
    if (!isMultiSelectMode.value) {
      selectedIndices.value.clear()
    }
  }

  /**
   * 清空选中状态
   * Clear selection state
   */
  function clearSelection() {
    selectedIndices.value.clear()
    selectedIndex.value = -1
  }

  return {
    selectedIndex,
    selectedIndices,
    isMultiSelectMode,
    isMarqueeMode,
    selectMonomer,
    toggleMultiSelect,
    clearSelection
  }
}
