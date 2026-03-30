# HELM2 Macromolecule Editor

🧬 基于 Vue3 的生物大分子编辑工具

## 功能特性

- ✅ **HELM 格式支持** - 解析和生成 HELM (Hierarchical Editing Language for Macromolecules) 格式
- ✅ **氨基酸编辑** - 20 种标准氨基酸快速添加
- ✅ **核苷酸编辑** - 支持 RNA/DNA 核苷酸
- ✅ **序列视图** - 可视化序列编辑和选择
- ✅ **分子量计算** - 自动计算总分子量
- ✅ **撤销/重做** - 完整的操作历史
- ✅ **多格式导出** - 支持 HELM、SMILES、Molfile 导出

## 技术栈

- **框架**: Vue 3 + Vite
- **UI 库**: Element Plus
- **格式**: HELM1 规范

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

开发服务器运行在：http://localhost:3025/

## HELM 格式示例

### 蛋白质
```
PEPTIDE1{ACDEFGHIKLMNPQRSTVWY}
```

### RNA
```
RNA1{AUCG}
```

### DNA
```
DNA1{ATCG}
```

## 项目结构

```
helm2-macromolecule/
├── src/
│   ├── components/
│   │   └── HELMEditor.vue    # 主编辑器组件
│   ├── utils/
│   │   └── helmParser.js     # HELM 解析器
│   ├── App.vue               # 应用入口
│   └── main.js               # 应用入口
├── index.html
├── package.json
└── vite.config.js
```

## 开发计划

- [ ] 化学修饰支持
- [ ] 二硫键连接
- [ ] 3D 结构可视化
- [ ] PDB 文件导入/导出
- [ ] 序列比对
- [ ] 批量操作

## 参考

- [HELM 规范](https://github.com/PistoiaHELM/HELM1)
- [Vue 3 文档](https://vuejs.org/)
- [Element Plus](https://element-plus.org/)

## License

MIT
