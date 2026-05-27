/**
 * 框选管理 Hook
 * Marquee Selection Management Hook
 * 
 * 负责框选拖拽、矩形区域选择单体
 * Handles marquee dragging, rectangular area monomer selection
 */
import { ref, type Ref } from 'vue'

/** 框选坐标 / Marquee coordinates */
interface MarqueePoint {
  x: number
  y: number
}

/**
 * 框选 Hook 参数 / Marquee hook parameters
 */
interface UseMarqueeOptions {
  isMarqueeMode: Ref<boolean>
  selectedIndex: Ref<number>
  selectedIndices: Ref<Set<number>>
}

/**
 * 框选管理 Hook
 * Marquee selection management composable
 */
export function useMarquee(options: UseMarqueeOptions) {
  const { isMarqueeMode, selectedIndex, selectedIndices } = options

  // 是否框选拖拽中 / Whether marquee dragging
  const marqueeDragging: Ref<boolean> = ref(false)
  // 框选起点 / Marquee start point
  const marqueeStart: Ref<MarqueePoint> = ref({ x: 0, y: 0 })
  // 框选终点 / Marquee end point
  const marqueeEnd: Ref<MarqueePoint> = ref({ x: 0, y: 0 })

  let marqueeMoveHandler: ((ev: PointerEvent) => void) | null = null

  /**
   * 获取容器内相对坐标
   * Get relative point in container
   * 
   * @param event - 指针事件 / pointer event
   * @param container - 容器元素 / container element
   */
  function getRelativePointInContainer(event: PointerEvent, container: HTMLElement): MarqueePoint {
    const r = container.getBoundingClientRect()
    return { x: event.clientX - r.left, y: event.clientY - r.top }
  }

  /**
   * 判断两个矩形是否相交
   * Check if two rectangles intersect
   * 
   * @param a - 矩形 A / rectangle A
   * @param b - 矩形 B / rectangle B
   */
  function rectIntersects(
    a: { left: number; top: number; width: number; height: number },
    b: { left: number; top: number; width: number; height: number }
  ): boolean {
    return !(
      a.left + a.width < b.left ||
      b.left + b.width < a.left ||
      a.top + a.height < b.top ||
      b.top + b.height < a.top
    )
  }

  /**
   * 处理框选指针按下
   * Handle marquee pointer down
   * 
   * @param event - 指针事件 / pointer event
   * @param sequenceDisplayRef - 序列显示容器引用 / sequence display container ref
   */
  function handleMarqueePointerDown(
    event: PointerEvent,
    sequenceDisplayRef: Ref<HTMLElement | null>
  ) {
    if (!isMarqueeMode.value) return
    if (event.button !== 0) return
    const container = sequenceDisplayRef.value
    if (!container) return
    event.preventDefault()
    const p = getRelativePointInContainer(event, container)
    marqueeStart.value = { ...p }
    marqueeEnd.value = { ...p }
    marqueeDragging.value = true

    marqueeMoveHandler = (ev: PointerEvent) => {
      if (!marqueeDragging.value) return
      marqueeEnd.value = getRelativePointInContainer(ev, container)
    }
    window.addEventListener('pointermove', marqueeMoveHandler)

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', marqueeMoveHandler)
      marqueeMoveHandler = null
      marqueeDragging.value = false

      const dx = marqueeEnd.value.x - marqueeStart.value.x
      const dy = marqueeEnd.value.y - marqueeStart.value.y
      const dist = Math.hypot(dx, dy)

      // 点击而非拖拽 / Click instead of drag
      if (dist < 5) {
        const el = (ev.target as HTMLElement)?.closest?.('[data-monomer-index]')
        if (el) {
          const idx = parseInt(el.getAttribute('data-monomer-index')!, 10)
          if (!Number.isNaN(idx)) {
            selectedIndex.value = idx
            selectedIndices.value.clear()
            selectedIndices.value.add(idx)
          }
        }
        window.removeEventListener('pointerup', onUp)
        return
      }

      // 框选区域 / Marquee area
      const selLeft = Math.min(marqueeStart.value.x, marqueeEnd.value.x)
      const selTop = Math.min(marqueeStart.value.y, marqueeEnd.value.y)
      const selW = Math.abs(marqueeEnd.value.x - marqueeStart.value.x)
      const selH = Math.abs(marqueeEnd.value.y - marqueeStart.value.y)
      const sel = { left: selLeft, top: selTop, width: selW, height: selH }
      const cr = container.getBoundingClientRect()
      const hits: number[] = []
      container.querySelectorAll('[data-monomer-index]').forEach((el) => {
        const htmlEl = el as HTMLElement
        const mr = htmlEl.getBoundingClientRect()
        const rel = {
          left: mr.left - cr.left,
          top: mr.top - cr.top,
          width: mr.width,
          height: mr.height
        }
        if (rectIntersects(sel, rel)) {
          hits.push(parseInt(htmlEl.getAttribute('data-monomer-index')!, 10))
        }
      })
      hits.sort((a, b) => a - b)
      selectedIndices.value = new Set(hits)
      selectedIndex.value = hits.length ? hits[hits.length - 1] : -1
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointerup', onUp)
  }

  /**
   * 清理资源
   * Cleanup resources
   */
  function cleanup() {
    if (marqueeMoveHandler) {
      window.removeEventListener('pointermove', marqueeMoveHandler)
      marqueeMoveHandler = null
    }
  }

  return {
    marqueeDragging,
    marqueeStart,
    marqueeEnd,
    handleMarqueePointerDown,
    cleanup
  }
}
