/**
 * HELM 输入输出管理 Hook
 * HELM I/O Management Hook
 * 
 * 负责 HELM 解析、文件加载、保存、导出
 * Handles HELM parsing, file loading, saving, exporting
 */
import { ref, type Ref } from 'vue'
import helmParser, {
  parseHELM,
  toHELM,
  getHelmLetter,
  toSMILES,
  parseSMILES,
  toMolfile,
  parseMolfile
} from '../utils/helmParser'
import type { Monomer } from './use-sequence'

/** 解析结果 / Parse result */
interface ParseResult {
  success: boolean
  message?: string
}

/**
 * HELM I/O Hook 参数 / HELM I/O hook parameters
 */
interface UseHELMIOOptions {
  currentSequence: Ref<Monomer[]>
  polymerType: Ref<string>
  connections: Ref<any[]>
  saveToHistory: () => void
}

/**
 * HELM 输入输出管理 Hook
 * HELM I/O management composable
 */
export function useHELMIO(options: UseHELMIOOptions) {
  const { currentSequence, polymerType, connections, saveToHistory } = options

  // HELM 输入框内容 / HELM input content
  const helmInput: Ref<string> = ref('')
  // HELM 输出内容 / HELM output content
  const helmOutput: Ref<string> = ref('')

  /**
   * 应用解析后的序列
   * Apply parsed sequence
   * 
   * @param type - 聚合物类型 / polymer type
   * @param sequence - 序列字符串 / sequence string
   */
  function applyParsedSequence(type: string, sequence: string): ParseResult {
    if (!sequence) {
      return { success: false, message: '未识别到可用序列' }
    }

    let monomers: Monomer[] = []
    if (type === 'PEPTIDE') {
      monomers = sequence.split('').map((char, index) => {
        const aa = helmParser.AMINO_ACIDS[char.toUpperCase()]
        return aa
          ? { ...aa, type: 'PEPTIDE', letter: char.toUpperCase(), position: index + 1 }
          : null
      }).filter(Boolean) as Monomer[]
    } else if (type === 'RNA' || type === 'DNA') {
      monomers = sequence.split('').map((char, index) => {
        const nt = helmParser.NUCLEOTIDES[char.toUpperCase()]
        return nt ? { ...nt, type, letter: char.toUpperCase(), position: index + 1 } : null
      }).filter(Boolean) as Monomer[]
    }

    if (monomers.length === 0) {
      return { success: false, message: '文件内容无法转换为当前支持的单体序列' }
    }

    saveToHistory()
    polymerType.value = type
    currentSequence.value = monomers
    updateHELMOutput()
    helmInput.value = helmOutput.value
    return { success: true }
  }

  /**
   * 加载 HELM 文件
   * Load HELM file
   * 
   * @param event - 文件输入事件 / file input event
   */
  async function loadHELM(event: Event): Promise<ParseResult> {
    const target = event?.target as HTMLInputElement | null
    const file = target?.files?.[0]
    if (!file) return { success: false }

    try {
      const content = await file.text()
      const fileName = file.name.toLowerCase()
      const text = content.trim()
      let parsed: { type: string; sequence: string } | null = null

      if (fileName.endsWith('.helm') || text.includes('{')) {
        const parsedHELM = parseHELM(text)
        if (parsedHELM.polymers.length > 0) {
          const polymer = parsedHELM.polymers[0]
          const helmSeq = polymer.sequence
            .map((m: any) => getHelmLetter(m, polymer.type))
            .join('')
          const result = applyParsedSequence(polymer.type, helmSeq)
          if (result.success) return { success: true, message: 'HELM 文件加载成功' }
          return { success: false, message: 'HELM 文件解析失败' }
        }
        return { success: false, message: 'HELM 文件解析失败' }
      } else if (fileName.endsWith('.mol') || fileName.endsWith('.molfile') || text.includes('V2000')) {
        parsed = parseMolfile(text)
        if (parsed) {
          const result = applyParsedSequence(parsed.type, parsed.sequence)
          if (result.success) return { success: true, message: 'Molfile 文件加载成功' }
          return { success: false, message: 'Molfile 解析失败' }
        }
        return { success: false, message: 'Molfile 解析失败' }
      } else if (fileName.endsWith('.smi') || fileName.endsWith('.smiles')) {
        parsed = parseSMILES(text)
        if (parsed) {
          const result = applyParsedSequence(parsed.type, parsed.sequence)
          if (result.success) return { success: true, message: 'SMILES 文件加载成功' }
          return { success: false, message: 'SMILES 解析失败' }
        }
        return { success: false, message: 'SMILES 解析失败' }
      } else {
        const parsedHELM = parseHELM(text)
        if (parsedHELM.polymers.length > 0) {
          const polymer = parsedHELM.polymers[0]
          const helmSeq = polymer.sequence
            .map((m: any) => getHelmLetter(m, polymer.type))
            .join('')
          const result = applyParsedSequence(polymer.type, helmSeq)
          if (result.success) return { success: true, message: '文件已按 HELM 格式加载' }
        }
        parsed = parseMolfile(text) || parseSMILES(text)
        if (parsed) {
          const result = applyParsedSequence(parsed.type, parsed.sequence)
          if (result.success) return { success: true, message: '文件格式自动识别并加载成功' }
        }
        return { success: false, message: '无法识别文件格式，请使用 HELM/SMILES/Molfile' }
      }
    } catch (error: any) {
      return { success: false, message: `文件读取失败：${error.message || '未知错误'}` }
    } finally {
      if (target) {
        target.value = ''
      }
    }
  }

  /**
   * 保存 HELM 文件
   * Save HELM file
   */
  function saveHELM(): ParseResult {
    const helm = toHELM({
      polymers: [{
        type: polymerType.value,
        index: 1,
        monomers: currentSequence.value
      }]
    })
    downloadTextFile('molecule.helm', helm, 'text/plain')
    return { success: true, message: 'HELM 文件已保存' }
  }

  /**
   * 导出指定格式
   * Export in specified format
   * 
   * @param format - 导出格式 / export format
   */
  function exportFormat(format: string): ParseResult {
    if (currentSequence.value.length === 0) {
      return { success: false, message: '当前没有可导出的分子' }
    }

    const type = polymerType.value
    const baseName = 'molecule'

    if (format === 'HELM') return saveHELM()

    if (format === 'SMILES') {
      const smiles = toSMILES(currentSequence.value, type)
      const sequence = currentSequence.value.map((m) => getHelmLetter(m, type)).join('')
      const smilesContent = [
        `# HELM_TYPE: ${type}`,
        `# HELM_SEQUENCE: ${sequence}`,
        smiles
      ].join('\n')
      downloadTextFile(`${baseName}.smi`, smilesContent, 'text/plain')
      return { success: true, message: 'SMILES 导出成功' }
    }

    if (format === 'Molfile') {
      const molfile = toMolfile(currentSequence.value, type)
      downloadTextFile(`${baseName}.mol`, molfile, 'chemical/x-mdl-molfile')
      return { success: true, message: 'Molfile 导出成功' }
    }

    return { success: false, message: `暂不支持导出格式：${format}` }
  }

  /**
   * 下载文本文件
   * Download text file
   * 
   * @param filename - 文件名 / filename
   * @param content - 文件内容 / file content
   * @param mimeType - MIME 类型 / MIME type
   */
  function downloadTextFile(filename: string, content: string, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * 解析输入
   * Parse input
   * 
   * @param onResult - 解析结果回调 / parse result callback
   */
  function parseInput(onResult?: (result: ParseResult) => void) {
    const input = helmInput.value.trim()
    if (!input) return

    if (input.includes('{') && input.includes('}')) {
      const parsed = parseHELM(input)
      if (parsed.polymers.length > 0) {
        saveToHistory()
        currentSequence.value = parsed.polymers[0].sequence || []
        polymerType.value = parsed.polymers[0].type
        updateHELMOutput()
        if (onResult) onResult({ success: true, message: 'HELM 解析成功' })
        return
      }
    }

    if (/^[ACDEFGHIKLMNPQRSTVWY]+$/i.test(input)) {
      saveToHistory()
      polymerType.value = 'PEPTIDE'
      currentSequence.value = input.split('').map((char, index) => {
        const aa = helmParser.AMINO_ACIDS[char.toUpperCase()]
        return aa
          ? { ...aa, type: 'PEPTIDE', letter: char.toUpperCase(), position: index + 1 }
          : null
      }).filter(Boolean) as Monomer[]
      updateHELMOutput()
      if (onResult) onResult({ success: true, message: '蛋白质序列解析成功' })
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
      }).filter(Boolean) as Monomer[]
      updateHELMOutput()
      if (onResult) onResult({ success: true, message: '核酸序列解析成功' })
      return
    }

    if (onResult) onResult({ success: false, message: '无法识别的格式' })
  }

  /**
   * 更新 HELM 输出
   * Update HELM output
   */
  function updateHELMOutput() {
    helmOutput.value = toHELM({
      polymers: [{
        type: polymerType.value,
        index: 1,
        monomers: currentSequence.value
      }],
      connections: connections.value.map(c => ({
        source: `PEPTIDE1`,
        sourceBond: c.from + 1,
        target: `PEPTIDE1`,
        targetBond: c.to + 1
      }))
    })
  }

  return {
    helmInput,
    helmOutput,
    saveHELM,
    exportFormat,
    parseInput,
    updateHELMOutput,
    loadHELM,
    applyParsedSequence,
    downloadTextFile
  }
}
