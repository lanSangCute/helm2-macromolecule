/**
 * 链布局管理 Hook
 * Strand Layout Management Hook
 * 
 * 负责序列化：根据连通分量将单体分行排列
 * Handles serialization: arranges monomers in rows based on connected components
 */
import type { Ref } from 'vue'
import type { Monomer } from './use-sequence'
import type { Connection } from './use-connections'

/** 单体位置 / Monomer position */
interface MonomerPosition {
  x: number
  y: number
}

/**
 * 序列化结果 / Serialization result
 */
interface SerializeResult {
  success: boolean
  message?: string
}

/**
 * 链布局 Hook 参数 / Strand layout hook parameters
 */
interface UseStrandLayoutOptions {
  currentSequence: Ref<Monomer[]>
  connections: Ref<Connection[]>
  monomerPositions: Ref<Record<number, MonomerPosition>>
  structureCanvasRef: Ref<any>
}

/**
 * 链布局管理 Hook
 * Strand layout management composable
 */
export function useStrandLayout(options: UseStrandLayoutOptions) {
  const { currentSequence, connections, monomerPositions, structureCanvasRef } = options

  /**
   * 序列化：将单体按连通分量分行排列
   * Serialize: arrange monomers in rows by connected components
   * 
   * @param onResult - 结果回调 / result callback
   */
  function serializeStrands(onResult?: (result: SerializeResult) => void) {
    if (!currentSequence.value || currentSequence.value.length === 0) {
      if (onResult) onResult({ success: false, message: '画布上没有单体' })
      return
    }

    // Step 1: 构建邻接表 / Build adjacency list
    const adj: Record<number, Set<number>> = {}
    const allIndices = new Set(currentSequence.value.map((_, i) => i))

    connections.value.forEach(conn => {
      if (!adj[conn.from]) adj[conn.from] = new Set()
      if (!adj[conn.to]) adj[conn.to] = new Set()
      adj[conn.from].add(conn.to)
      adj[conn.to].add(conn.from)
    })

    // Step 2: BFS 找连通分量 / Find connected components using BFS
    const visited = new Set<number>()
    const strands: number[][] = []

    for (const idx of allIndices) {
      if (visited.has(idx)) continue

      const strand: number[] = []
      const queue: number[] = [idx]
      visited.add(idx)

      while (queue.length > 0) {
        const current = queue.shift()!
        strand.push(current)

        const neighbors = adj[current]
        if (neighbors) {
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor)
              queue.push(neighbor)
            }
          }
        }
      }

      strand.sort((a, b) => a - b)
      strands.push(strand)
    }

    // Step 3: 计算每个链的位置 / Calculate positions for each strand
    const SPACING = 70   // 单体水平间距 / horizontal spacing between monomers
    const ROW_HEIGHT = 120 // 行高 / vertical spacing between rows
    const START_X = 80
    const START_Y = 100

    const newPositions: Record<number, MonomerPosition> = {}

    strands.forEach((strand, strandIndex) => {
      const y = START_Y + strandIndex * ROW_HEIGHT
      strand.forEach((monomerIndex, posInStrand) => {
        newPositions[monomerIndex] = {
          x: START_X + posInStrand * SPACING,
          y
        }
      })
    })

    // Step 4: 更新位置 / Update positions
    monomerPositions.value = newPositions

    // Step 5: 适配画布 / Fit canvas to content
    if (structureCanvasRef.value?.fitToContent) {
      structureCanvasRef.value.fitToContent()
    }

    if (onResult) onResult({ success: true, message: `已序列化：${strands.length} 条链` })
  }

  return {
    serializeStrands
  }
}
