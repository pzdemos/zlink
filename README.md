# zlink Manager - Mac 别名管理工具 🚀

一个简单易用的命令行工具,用于管理 Mac 上的 zsh shell 别名。

## ✨ 功能特点

- 📋 **查看别名**: 列出所有已配置的别名
- ➕ **添加别名**: 快速添加新的别名
- ✏️ **编辑别名**: 修改现有别名的名称或命令
- 🗑️ **删除别名**: 批量删除不需要的别名
- 🔍 **搜索别名**: 根据关键词快速查找别名
- 🔄 **自动生效**: 每次修改后自动 source ~/.zshrc
- 🔧 **独立管理**: 不影响其他手动配置的别名

## 📦 安装

### 方式一: 全局安装 (推荐)

```bash
npm install -g zlink
```

安装后可以在任何地方使用 `zlink` 命令。

### 方式二: 本地开发

```bash
# 克隆项目
git clone <https://github.com/pzdemos/zlink>
cd zlink

# 链接到全局
npm link

# 运行
zlink
```

## 🎯 使用方法

### 启动工具

```bash
zlink
```

### 主菜单

```
╔════════════════════════════════════╗
║     Mac 别名管理工具 v1.0.0       ║
╚════════════════════════════════════╝

请选择操作:
  1. 📋 查看所有别名
  2. ➕ 添加新别名
  3. ✏️  编辑别名
  4. 🗑️  删除别名
  5. 🔍 搜索别名
  0. 👋 退出
```

## 📝 使用示例

### 添加 SSH 别名

```
请选择操作: 2
请输入别名名称: bt
请输入命令内容: ssh root@192.168.1.100

✅ 已添加别名: bt = 'ssh root@192.168.1.100'
✅ 已重新加载 ~/.zshrc
```

现在你可以直接使用 `bt` 命令快速 SSH 登录!

### 添加常用命令别名

```bash
# Git 相关
gs -> git status
gp -> git push
gc -> git commit -m

# 目录跳转
www -> cd /var/www
proj -> cd ~/Projects

# 系统命令
ll -> ls -lah
update -> brew update && brew upgrade
```

### 编辑现有别名

```
请选择操作: 3

📝 可编辑的别名:
[1] bt = 'ssh root@192.168.1.100'
[2] gs = 'git status'

请选择要编辑的别名序号: 1
当前别名: bt = 'ssh root@192.168.1.100'
新的别名名称 (留空保持 'bt'): 
新的命令内容 (留空保持当前命令): ssh root@192.168.1.200

✅ 已更新别名: bt = 'ssh root@192.168.1.200'
```

### 删除别名

```
请选择操作: 4

🗑️  可删除的别名:
[1] test1 = 'echo test1'
[2] test2 = 'echo test2'
[3] test3 = 'echo test3'

请选择要删除的别名序号 (多个用逗号分隔): 1,3

将删除以下别名:
  - test1
  - test3

确认删除? (y/n): y

✅ 删除成功
```

### 搜索别名

```
请选择操作: 5
🔍 请输入搜索关键词: git

🔍 搜索结果 (共 3 条):
🔧 [1] gs = 'git status'
🔧 [2] gp = 'git push'
🔧 [3] gc = 'git commit -m'
```

## 🔒 安全特性

- ✅ 别名集中管理在标记区域内,不会影响其他配置
- ✅ 删除操作需要二次确认
- ✅ 覆盖已存在别名时会提示确认
- ✅ 自动备份机制(通过标记管理)

## 📂 文件结构

```
alias-manager/
├── index.js          # 主程序
├── package.json      # 包配置
└── README.md         # 说明文档
```

## 🔧 配置文件位置

工具会在 `~/.zshrc` 文件中创建一个管理区域:

```bash
# === Managed Aliases Start ===
alias bt='ssh root@xx.168.1.100'
alias gs='git status'
# === Managed Aliases End ===
```

这个区域由工具自动管理,建议不要手动编辑。

## 🎨 图标说明

- 🔧 = 本工具管理的别名
- 📌 = 其他方式配置的别名(只读)

## ⚙️ 系统要求

- macOS (支持 zsh)
- Node.js >= 14.0.0
- 已安装并配置 zsh 作为默认 shell

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📄 许可证

MIT License

## 💡 常见问题

### Q: 工具会影响我手动配置的别名吗?
A: 不会。工具只管理标记区域内的别名,不会影响其他配置。

### Q: 如何卸载?
A: 运行 `npm uninstall -g zlink`,然后手动从 ~/.zshrc 中删除管理区域。

### Q: 支持 bash 吗?
A: 当前版本仅支持 zsh,后续版本会考虑支持 bash。

### Q: 如何备份我的别名?
A: 别名存储在 ~/.zshrc 中,建议定期备份该文件。

---

Made with zhaojiu for Mac developers