/**
 * 画布模式管理 Hook
 * Canvas Mode Management Hook
 * 
 * 负责画布模式切换（手动/选择/拖拽）
 * Handles canvas mode switching (manual/select/drag)
 */
import { ref, type Ref } from 'vue'

/** 画布模式类型 / Canvas mode type */
export type CanvasMode = 'manual' | 'select' | 'drag'

/**
 * 画布模式管理 Hook
 * Canvas mode management composable
 */
export function useCanvasMode() {
  // 当前画布模式 / Current canvas mode
  const canvasMode: Ref<CanvasMode> = ref('manual')

  /**
   * 设置画布模式
   * Set canvas mode
   * 
   * @param mode - 模式名称 / mode name
   * @param onModeChange - 模式变更回调 / mode change callback
   */
  function setCanvasMode(mode: CanvasMode, onModeChange?: (mode: CanvasMode) => void) {
    canvasMode.value = mode
    if (onModeChange) onModeChange(mode)
  }

  return {
    canvasMode,
    setCanvasMode
  }
}
