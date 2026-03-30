/**
 * HELM (Hierarchical Editing Language for Macromolecules) 解析器
 * 
 * HELM 是一种用于表示生物大分子的线性符号系统
 * 支持：蛋白质、核酸、化学修饰、复合物等
 * 
 * 参考：https://github.com/PistoiaHELM/HELM1
 */

// HELM 单体缩写映射
const AMINO_ACIDS = {
  'A': { name: 'Alanine', code: 'ALA', formula: 'C3H7NO2', mass: 89.09 },
  'R': { name: 'Arginine', code: 'ARG', formula: 'C6H14N4O2', mass: 174.20 },
  'N': { name: 'Asparagine', code: 'ASN', formula: 'C4H8N2O3', mass: 132.12 },
  'D': { name: 'Aspartic Acid', code: 'ASP', formula: 'C4H7NO4', mass: 133.10 },
  'C': { name: 'Cysteine', code: 'CYS', formula: 'C3H7NO2S', mass: 121.16 },
  'E': { name: 'Glutamic Acid', code: 'GLU', formula: 'C5H9NO4', mass: 147.13 },
  'Q': { name: 'Glutamine', code: 'GLN', formula: 'C5H10N2O3', mass: 146.15 },
  'G': { name: 'Glycine', code: 'GLY', formula: 'C2H5NO2', mass: 75.07 },
  'H': { name: 'Histidine', code: 'HIS', formula: 'C6H9N3O2', mass: 155.16 },
  'I': { name: 'Isoleucine', code: 'ILE', formula: 'C6H13NO2', mass: 131.17 },
  'L': { name: 'Leucine', code: 'LEU', formula: 'C6H13NO2', mass: 131.17 },
  'K': { name: 'Lysine', code: 'LYS', formula: 'C6H14N2O2', mass: 146.19 },
  'M': { name: 'Methionine', code: 'MET', formula: 'C5H11NO2S', mass: 149.21 },
  'F': { name: 'Phenylalanine', code: 'PHE', formula: 'C9H11NO2', mass: 165.19 },
  'P': { name: 'Proline', code: 'PRO', formula: 'C5H9NO2', mass: 115.13 },
  'S': { name: 'Serine', code: 'SER', formula: 'C3H7NO3', mass: 105.09 },
  'T': { name: 'Threonine', code: 'THR', formula: 'C4H9NO3', mass: 119.12 },
  'W': { name: 'Tryptophan', code: 'TRP', formula: 'C11H12N2O2', mass: 204.23 },
  'Y': { name: 'Tyrosine', code: 'TYR', formula: 'C9H11NO3', mass: 181.19 },
  'V': { name: 'Valine', code: 'VAL', formula: 'C5H11NO2', mass: 117.15 }
}

const NUCLEOTIDES = {
  'A': { name: 'Adenine', code: 'A', type: 'RNA' },
  'U': { name: 'Uracil', code: 'U', type: 'RNA' },
  'G': { name: 'Guanine', code: 'G', type: 'RNA' },
  'C': { name: 'Cytosine', code: 'C', type: 'RNA' },
  'T': { name: 'Thymine', code: 'T', type: 'DNA' }
}

/** 三字母 -> 单字母（HELM 聚合物花括号内应为单字母序列） */
const THREE_LETTER_TO_ONE_LETTER = Object.fromEntries(
  Object.entries(AMINO_ACIDS).map(([letter, data]) => [data.code, letter])
)

/**
 * 用于 HELM 字符串、SMILES 映射的单体符号：肽为单字母，核酸为 A/C/G/T/U
 */
export function getHelmLetter(monomer, polymerType) {
  if (!monomer) return ''
  if (polymerType === 'RNA' || polymerType === 'DNA') {
    const c = String(monomer.code ?? '').toUpperCase()
    return c.charAt(0) || ''
  }
  if (polymerType === 'PEPTIDE') {
    if (monomer.letter && String(monomer.letter).length === 1) {
      return String(monomer.letter).toUpperCase()
    }
    const code = String(monomer.code ?? '').toUpperCase()
    if (code.length === 1 && AMINO_ACIDS[code]) return code
    return THREE_LETTER_TO_ONE_LETTER[code] || (code ? code.charAt(0) : '')
  }
  return String(monomer.code ?? '')
}

// 轻量级映射：用于编辑器中的 SMILES/Molfile 占位导出与回读
const AMINO_SMILES = {
  A: 'N[C@@H](C)C(=O)O',
  R: 'N[C@@H](CCCNC(N)=N)C(=O)O',
  N: 'N[C@@H](CC(=O)N)C(=O)O',
  D: 'N[C@@H](CC(=O)O)C(=O)O',
  C: 'N[C@@H](CS)C(=O)O',
  E: 'N[C@@H](CCC(=O)O)C(=O)O',
  Q: 'N[C@@H](CCC(=O)N)C(=O)O',
  G: 'NCC(=O)O',
  H: 'N[C@@H](Cc1cnc[nH]1)C(=O)O',
  I: 'N[C@@H](C(C)CC)C(=O)O',
  L: 'N[C@@H](CC(C)C)C(=O)O',
  K: 'N[C@@H](CCCCN)C(=O)O',
  M: 'N[C@@H](CCSC)C(=O)O',
  F: 'N[C@@H](Cc1ccccc1)C(=O)O',
  P: 'O=C(O)[C@@H]1CCCN1',
  S: 'N[C@@H](CO)C(=O)O',
  T: 'N[C@@H](C(O)C)C(=O)O',
  W: 'N[C@@H](Cc1c[nH]c2ccccc12)C(=O)O',
  Y: 'N[C@@H](Cc1ccc(O)cc1)C(=O)O',
  V: 'N[C@@H](C(C)C)C(=O)O'
}

const NUCLEOTIDE_SMILES = {
  A: 'Nc1ncnc2n(cnc12)[C@H]1O[C@@H](CO)[C@H](O)[C@@H]1O',
  U: 'O=c1[nH]cc(=O)[nH]1[C@H]1O[C@@H](CO)[C@H](O)[C@@H]1O',
  G: 'Nc1nc2[nH]cnc2c(=O)[nH]1[C@H]1O[C@@H](CO)[C@H](O)[C@@H]1O',
  C: 'Nc1ncc(=O)[nH]c1[C@H]1O[C@@H](CO)[C@H](O)[C@@H]1O',
  T: 'CC1=CN([C@H]2O[C@@H](CO)[C@H](O)[C@@H]2O)C(=O)NC1=O'
}

const REVERSE_AMINO_SMILES = Object.fromEntries(
  Object.entries(AMINO_SMILES).map(([code, smiles]) => [smiles, code])
)

const REVERSE_NUCLEOTIDE_SMILES = Object.fromEntries(
  Object.entries(NUCLEOTIDE_SMILES).map(([code, smiles]) => [smiles, code])
)

/**
 * 解析 HELM 字符串
 * @param {string} helmString - HELM 格式字符串
 * @returns {Object} 解析后的结构
 */
export function parseHELM(helmString) {
  const result = {
    polymers: [],
    chemicals: [],
    connections: [],
    metadata: {}
  }

  // 移除空白
  const cleaned = helmString.trim()
  
  // 分割不同的 HELM 段
  const segments = cleaned.split('$')
  
  for (const segment of segments) {
    if (!segment.trim()) continue
    
    // 解析聚合物链 (PEPTIDE1, RNA1, DNA1 等)
    const polymerMatch = segment.match(/^(PEPTIDE|RNA|DNA|CHEM)(\d+)\{([^}]*)\}/)
    if (polymerMatch) {
      const [, type, index, sequence] = polymerMatch
      const polymer = {
        type,
        index: parseInt(index),
        name: `${type}${index}`,
        sequence: parseSequence(sequence, type),
        modifications: []
      }
      result.polymers.push(polymer)
    }
    
    // 解析连接
    const connMatch = segment.match(/(\w+\d+):(\d+)-(\d+):(\w+\d+):(\d+)-(\d+)/)
    if (connMatch) {
      result.connections.push({
        source: `${connMatch[1]}:${connMatch[2]}`,
        sourceBond: connMatch[3],
        target: `${connMatch[4]}:${connMatch[5]}`,
        targetBond: connMatch[6]
      })
    }
  }
  
  return result
}

/**
 * 解析序列
 * @param {string} sequence - 原始序列字符串
 * @param {string} type - 聚合物类型
 * @returns {Array} 解析后的单体数组
 */
function parseSequence(sequence, type) {
  const monomers = []
  let i = 0
  
  while (i < sequence.length) {
    const char = sequence[i]
    
    // 跳过特殊字符
    if (char === '(' || char === ')' || char === '[' || char === ']') {
      i++
      continue
    }
    
    // 解析单体
    if (type === 'PEPTIDE') {
      const aminoAcid = AMINO_ACIDS[char.toUpperCase()]
      if (aminoAcid) {
        monomers.push({
          position: monomers.length + 1,
          letter: char.toUpperCase(),
          ...aminoAcid,
          modified: false
        })
      }
    } else if (type === 'RNA' || type === 'DNA') {
      const nucleotide = NUCLEOTIDES[char.toUpperCase()]
      if (nucleotide) {
        monomers.push({
          position: monomers.length + 1,
          letter: char.toUpperCase(),
          ...nucleotide,
          modified: false
        })
      }
    }
    
    i++
  }
  
  return monomers
}

/**
 * 将结构转换为 HELM 字符串
 * @param {Object} structure - 结构对象
 * @returns {string} HELM 格式字符串
 */
export function toHELM(structure) {
  const segments = []
  
  // 生成聚合物段
  if (structure.polymers) {
    for (const polymer of structure.polymers) {
      const sequence = polymer.monomers
        .map((m) => getHelmLetter(m, polymer.type))
        .join('')
      segments.push(`${polymer.type}${polymer.index}{${sequence}}`)
    }
  }
  
  // 生成连接段
  if (structure.connections) {
    for (const conn of structure.connections) {
      segments.push(`${conn.source}:${conn.sourceBond}-${conn.sourceBond}:${conn.target}:${conn.targetBond}-${conn.targetBond}`)
    }
  }
  
  return segments.join('$')
}

/**
 * 计算分子量
 * @param {Array} monomers - 单体数组
 * @returns {number} 总分子量
 */
export function calculateMass(monomers) {
  return monomers.reduce((sum, m) => sum + (m.mass || 0), 0)
}

export function toSMILES(monomers, type = 'PEPTIDE') {
  const mapping = type === 'PEPTIDE' ? AMINO_SMILES : NUCLEOTIDE_SMILES
  return monomers
    .map((m) => {
      const sym = getHelmLetter(m, type)
      return mapping[sym] || m.code
    })
    .join('.')
}

export function parseSMILES(smiles) {
  const raw = (smiles || '').trim()
  if (!raw) return null

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  let metaType = ''
  let metaSequence = ''
  const smilesLines = []

  for (const line of lines) {
    if (line.startsWith('#')) {
      const typeMatch = line.match(/^#\s*HELM_TYPE\s*:\s*(\w+)/i)
      if (typeMatch) {
        metaType = typeMatch[1].toUpperCase()
      }
      const seqMatch = line.match(/^#\s*HELM_SEQUENCE\s*:\s*([A-Za-z]+)/i)
      if (seqMatch) {
        metaSequence = seqMatch[1].toUpperCase()
      }
      continue
    }
    smilesLines.push(line)
  }

  if (metaType && metaSequence) {
    return { type: metaType, sequence: metaSequence }
  }

  const cleaned = smilesLines.join('').trim()
  if (!cleaned) return null

  // 支持点分单体 SMILES
  const parts = cleaned.split('.').map((p) => p.trim()).filter(Boolean)
  if (parts.length > 1) {
    const peptideCodes = []
    const nucCodes = []

    for (const part of parts) {
      if (REVERSE_AMINO_SMILES[part]) {
        peptideCodes.push(REVERSE_AMINO_SMILES[part])
        continue
      }
      if (REVERSE_NUCLEOTIDE_SMILES[part]) {
        nucCodes.push(REVERSE_NUCLEOTIDE_SMILES[part])
        continue
      }
      return null
    }

    // 全部被双重识别（如 A/C/G/T）：默认按核酸，减少核酸 round-trip 偏差
    const allDual = parts.every(
      (part) => REVERSE_AMINO_SMILES[part] && REVERSE_NUCLEOTIDE_SMILES[part]
    )
    if (allDual && nucCodes.length === parts.length) {
      const type = nucCodes.includes('U') ? 'RNA' : 'DNA'
      return { type, sequence: nucCodes.join('') }
    }

    if (peptideCodes.length === parts.length) {
      return { type: 'PEPTIDE', sequence: peptideCodes.join('') }
    }
    if (nucCodes.length === parts.length) {
      const type = nucCodes.includes('U') ? 'RNA' : 'DNA'
      return { type, sequence: nucCodes.join('') }
    }
    return null
  }

  // 支持简化的一字母序列输入
  if (/^[ACDEFGHIKLMNPQRSTVWY]+$/i.test(cleaned)) {
    return { type: 'PEPTIDE', sequence: cleaned.toUpperCase() }
  }
  if (/^[ACGTU]+$/i.test(cleaned)) {
    return { type: cleaned.toUpperCase().includes('U') ? 'RNA' : 'DNA', sequence: cleaned.toUpperCase() }
  }

  return null
}

export function toMolfile(monomers, type = 'PEPTIDE') {
  const sequence = monomers.map((m) => getHelmLetter(m, type)).join('')
  const smiles = toSMILES(monomers, type)
  return [
    'HELM2-MACROMOLECULE',
    '  CursorHELMEditor',
    '',
    '  0  0  0  0  0  0            999 V2000',
    `>  <HELM_TYPE>`,
    type,
    '',
    `>  <HELM_SEQUENCE>`,
    sequence,
    '',
    `>  <HELM_SMILES>`,
    smiles,
    '',
    'M  END'
  ].join('\n')
}

export function parseMolfile(molfileText) {
  const text = (molfileText || '').trim()
  if (!text) return null

  const sequenceMatch = text.match(/>\s*<HELM_SEQUENCE>\s*[\r\n]+([A-Za-z]+)/)
  const typeMatch = text.match(/>\s*<HELM_TYPE>\s*[\r\n]+([A-Za-z]+)/)
  const smilesMatch = text.match(/>\s*<HELM_SMILES>\s*[\r\n]+([^\r\n]+)/)

  if (sequenceMatch) {
    const sequence = sequenceMatch[1].trim().toUpperCase()
    let type = (typeMatch?.[1] || '').trim().toUpperCase()
    if (!type || !['PEPTIDE', 'RNA', 'DNA'].includes(type)) {
      if (/^[ACGT]+$/i.test(sequence) && !/U/i.test(sequence)) type = 'DNA'
      else if (/^[ACGU]+$/i.test(sequence) && /U/i.test(sequence)) type = 'RNA'
      else if (/^[ACGTU]+$/i.test(sequence)) type = sequence.includes('U') ? 'RNA' : 'DNA'
      else type = 'PEPTIDE'
    }
    return { type, sequence }
  }

  if (smilesMatch) {
    return parseSMILES(smilesMatch[1].trim())
  }

  return null
}

/**
 * 验证 HELM 字符串
 * @param {string} helmString - HELM 格式字符串
 * @returns {Object} { valid: boolean, errors: Array }
 */
export function validateHELM(helmString) {
  const errors = []
  
  if (!helmString || typeof helmString !== 'string') {
    errors.push('HELM 字符串不能为空')
    return { valid: false, errors }
  }
  
  // 基本格式检查
  if (!helmString.includes('{') || !helmString.includes('}')) {
    errors.push('缺少聚合物定义花括号')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

export default {
  parseHELM,
  toHELM,
  getHelmLetter,
  toSMILES,
  parseSMILES,
  toMolfile,
  parseMolfile,
  calculateMass,
  validateHELM,
  AMINO_ACIDS,
  NUCLEOTIDES
}
