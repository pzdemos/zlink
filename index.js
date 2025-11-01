#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

// 配置文件路径
const SHELL_RC = path.join(os.homedir(), '.zshrc');
const ALIAS_MARKER_START = '# === Managed Aliases Start ===';
const ALIAS_MARKER_END = '# === Managed Aliases End ===';

class AliasManager {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  // 提示用户输入
  question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  // 读取所有别名
  async readAliases() {
    try {
      const content = fs.readFileSync(SHELL_RC, 'utf8');
      const lines = content.split('\n');
      const aliases = [];

      let inManagedSection = false;
      for (const line of lines) {
        if (line.includes(ALIAS_MARKER_START)) {
          inManagedSection = true;
          continue;
        }
        if (line.includes(ALIAS_MARKER_END)) {
          inManagedSection = false;
          continue;
        }

        // 匹配 alias 格式
        const match = line.match(/^\s*alias\s+([^=]+)=(['"]?)(.+)\2\s*$/);
        if (match) {
          aliases.push({
            name: match[1].trim(),
            command: match[3],
            managed: inManagedSection,
            raw: line
          });
        }
      }

      return aliases;
    } catch (error) {
      if (error.code === 'ENOENT') {
        fs.writeFileSync(SHELL_RC, '');
        return [];
      }
      throw error;
    }
  }

  // 保存别名到配置文件
  async saveAliases(aliases) {
    const content = fs.readFileSync(SHELL_RC, 'utf8');
    const lines = content.split('\n');
    
    // 移除旧的管理区域
    let newLines = [];
    let skip = false;
    for (const line of lines) {
      if (line.includes(ALIAS_MARKER_START)) {
        skip = true;
        continue;
      }
      if (line.includes(ALIAS_MARKER_END)) {
        skip = false;
        continue;
      }
      if (!skip) {
        newLines.push(line);
      }
    }

    // 移除末尾空行
    while (newLines.length > 0 && newLines[newLines.length - 1] === '') {
      newLines.pop();
    }

    // 添加新的管理区域
    if (aliases.length > 0) {
      newLines.push('');
      newLines.push(ALIAS_MARKER_START);
      aliases.forEach(alias => {
        newLines.push(`alias ${alias.name}='${alias.command}'`);
      });
      newLines.push(ALIAS_MARKER_END);
    }

    fs.writeFileSync(SHELL_RC, newLines.join('\n') + '\n');
    
    // 自动 source
    await this.sourceZshrc();
  }

  // 执行 source ~/.zshrc
  async sourceZshrc() {
    try {
      // 注意:在 Node.js 中 source 需要用 zsh -c 来执行
      await execPromise(`zsh -c "source ${SHELL_RC}"`);
      console.log('✅ 已重新加载 ~/.zshrc');
    } catch (error) {
      console.log('⚠️  配置已保存,请手动执行: source ~/.zshrc');
    }
  }

  // 列出所有别名
  async listAliases() {
    const aliases = await this.readAliases();
    
    if (aliases.length === 0) {
      console.log('\n📭 暂无别名配置\n');
      return;
    }

    console.log('\n📋 当前别名列表:\n');
    aliases.forEach((alias, index) => {
      const status = alias.managed ? '🔧' : '📌';
      console.log(`${status} [${index + 1}] ${alias.name} = '${alias.command}'`);
    });
    console.log('\n🔧 = 本工具管理  📌 = 其他配置\n');
  }

  // 添加别名
  async addAlias() {
    const name = await this.question('\n请输入别名名称: ');
    if (!name) {
      console.log('❌ 别名名称不能为空');
      return;
    }

    const command = await this.question('请输入命令内容: ');
    if (!command) {
      console.log('❌ 命令内容不能为空');
      return;
    }

    const aliases = await this.readAliases();
    const managedAliases = aliases.filter(a => a.managed);
    
    // 检查是否已存在
    const existing = managedAliases.find(a => a.name === name);
    if (existing) {
      console.log(`\n⚠️  别名 '${name}' 已存在: ${existing.command}`);
      const confirm = await this.question('是否覆盖? (y/n): ');
      if (confirm.toLowerCase() !== 'y') {
        console.log('❌ 已取消');
        return;
      }
      // 删除旧的
      const index = managedAliases.findIndex(a => a.name === name);
      managedAliases.splice(index, 1);
    }

    managedAliases.push({ name, command, managed: true });
    await this.saveAliases(managedAliases);
    console.log(`\n✅ 已添加别名: ${name} = '${command}'`);
  }

  // 修改别名
  async editAlias() {
    const aliases = await this.readAliases();

    if (aliases.length === 0) {
      console.log('\n❌ 暂无可编辑的别名');
      return;
    }

    console.log('\n📝 所有别名:\n');
    aliases.forEach((alias, index) => {
      const status = alias.managed ? '🔧' : '📌';
      console.log(`${status} [${index + 1}] ${alias.name} = '${alias.command}'`);
    });
    console.log('\n🔧 = 本工具管理  📌 = 其他配置 (编辑后将移至工具管理)\n');

    const choice = await this.question('请选择要编辑的别名序号: ');
    const index = parseInt(choice) - 1;

    if (isNaN(index) || index < 0 || index >= aliases.length) {
      console.log('❌ 无效的选择');
      return;
    }

    const alias = aliases[index];
    const wasManaged = alias.managed;
    
    console.log(`\n当前别名: ${alias.name} = '${alias.command}'`);
    
    const newName = await this.question(`新的别名名称 (留空保持 '${alias.name}'): `);
    const newCommand = await this.question(`新的命令内容 (留空保持当前命令): `);

    const finalName = newName || alias.name;
    const finalCommand = newCommand || alias.command;

    // 如果是未管理的别名,需要从原文件中删除
    if (!wasManaged) {
      await this.deleteUnmanagedAliases([alias]);
    }

    // 获取当前所有管理的别名
    const currentAliases = await this.readAliases();
    let managedAliases = currentAliases.filter(a => a.managed);
    
    // 如果原来是管理的,移除旧的
    if (wasManaged) {
      managedAliases = managedAliases.filter(a => a.name !== alias.name);
    }
    
    // 添加编辑后的别名
    managedAliases.push({ 
      name: finalName, 
      command: finalCommand, 
      managed: true 
    });

    await this.saveAliases(managedAliases);
    console.log(`\n✅ 已更新别名: ${finalName} = '${finalCommand}'`);
  }

  // 删除别名
  async deleteAlias() {
    const aliases = await this.readAliases();

    if (aliases.length === 0) {
      console.log('\n❌ 暂无可删除的别名');
      return;
    }

    console.log('\n🗑️  所有别名:\n');
    aliases.forEach((alias, index) => {
      const status = alias.managed ? '🔧' : '📌';
      console.log(`${status} [${index + 1}] ${alias.name} = '${alias.command}'`);
    });
    console.log('\n🔧 = 本工具管理  📌 = 其他配置 (删除后将移至工具管理)\n');

    const choice = await this.question('请选择要删除的别名序号 (多个用逗号分隔): ');
    const indices = choice.split(',').map(s => parseInt(s.trim()) - 1);

    const validIndices = indices.filter(i => !isNaN(i) && i >= 0 && i < aliases.length);
    if (validIndices.length === 0) {
      console.log('❌ 无效的选择');
      return;
    }

    // 确认删除
    console.log('\n将删除以下别名:');
    validIndices.forEach(i => {
      const alias = aliases[i];
      const status = alias.managed ? '🔧' : '📌';
      console.log(`  ${status} ${alias.name}`);
    });

    const confirm = await this.question('\n确认删除? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ 已取消');
      return;
    }

    // 处理删除逻辑
    const toDelete = validIndices.map(i => aliases[i]);
    const hasUnmanaged = toDelete.some(a => !a.managed);

    if (hasUnmanaged) {
      // 如果删除的包含非管理的别名,需要特殊处理
      await this.deleteUnmanagedAliases(toDelete);
    } else {
      // 只删除管理的别名
      const managedAliases = aliases.filter(a => a.managed);
      const newAliases = managedAliases.filter(a => !toDelete.includes(a));
      await this.saveAliases(newAliases);
    }
    
    console.log('\n✅ 删除成功');
  }

  // 删除未被管理的别名
  async deleteUnmanagedAliases(toDelete) {
    const content = fs.readFileSync(SHELL_RC, 'utf8');
    const lines = content.split('\n');
    const deleteNames = new Set(toDelete.map(a => a.name));
    
    // 过滤掉要删除的别名行
    const newLines = lines.filter(line => {
      const match = line.match(/^\s*alias\s+([^=]+)=/);
      if (match) {
        const name = match[1].trim();
        return !deleteNames.has(name);
      }
      return true;
    });

    fs.writeFileSync(SHELL_RC, newLines.join('\n'));
    await this.sourceZshrc();
  }

  // 搜索别名
  async searchAlias() {
    const keyword = await this.question('\n🔍 请输入搜索关键词: ');
    if (!keyword) {
      console.log('❌ 关键词不能为空');
      return;
    }

    const aliases = await this.readAliases();
    const results = aliases.filter(a => 
      a.name.includes(keyword) || a.command.includes(keyword)
    );

    if (results.length === 0) {
      console.log(`\n❌ 未找到包含 '${keyword}' 的别名`);
      return;
    }

    console.log(`\n🔍 搜索结果 (共 ${results.length} 条):\n`);
    results.forEach((alias, index) => {
      const status = alias.managed ? '🔧' : '📌';
      console.log(`${status} [${index + 1}] ${alias.name} = '${alias.command}'`);
    });
    console.log();
  }

  // 主菜单
  async showMenu() {
    console.log('\n╔════════════════════════════════════╗');
    console.log('║     zlink别名管理工具 v1.0.0       ║');
    console.log('╚════════════════════════════════════╝');
    console.log('\n请选择操作:');
    console.log('  1. 📋 查看所有别名');
    console.log('  2. ➕ 添加新别名');
    console.log('  3. ✏️  编辑别名');
    console.log('  4. 🗑️  删除别名');
    console.log('  5. 🔍 搜索别名');
    console.log('  0. 👋 退出\n');

    const choice = await this.question('请输入选项: ');

    switch (choice) {
      case '1':
        await this.listAliases();
        break;
      case '2':
        await this.addAlias();
        break;
      case '3':
        await this.editAlias();
        break;
      case '4':
        await this.deleteAlias();
        break;
      case '5':
        await this.searchAlias();
        break;
      case '0':
        console.log('\n👋 再见!\n');
        this.rl.close();
        return false;
      default:
        console.log('\n❌ 无效的选项');
    }

    return true;
  }

  // 启动应用
  async start() {
    let continueRunning = true;
    while (continueRunning) {
      continueRunning = await this.showMenu();
    }
  }
}

// 主程序
async function main() {
  const manager = new AliasManager();
  
  try {
    await manager.start();
  } catch (error) {
    console.error('\n❌ 发生错误:', error.message);
    manager.rl.close();
    process.exit(1);
  }
}

// 运行
if (require.main === module) {
  main();
}

module.exports = AliasManager;