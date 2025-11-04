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
const ALIAS_DESC_PREFIX = '# DESC:';

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // 前景色
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // 背景色
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

// 颜色辅助函数
const color = {
  name: (text) => `${colors.cyan}${colors.bright}${text}${colors.reset}`,
  command: (text) => `${colors.yellow}${text}${colors.reset}`,
  desc: (text) => `${colors.gray}${text}${colors.reset}`,
  success: (text) => `${colors.green}${text}${colors.reset}`,
  error: (text) => `${colors.red}${text}${colors.reset}`,
  warning: (text) => `${colors.yellow}${text}${colors.reset}`,
  info: (text) => `${colors.blue}${text}${colors.reset}`,
  label: (text) => `${colors.magenta}${text}${colors.reset}`,
};

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

  // 创建单选框选择器
  async selectOption(title, options, defaultIndex = 0) {
    return new Promise((resolve) => {
      let selectedIndex = defaultIndex;
      const stdin = process.stdin;
      let lineCount = 0;
      
      // 设置原始模式以捕获单个按键
      if (stdin.isTTY) {
        stdin.setRawMode(true);
      }
      stdin.resume();
      stdin.setEncoding('utf8');
      
      // 移动光标到指定行
      const moveCursor = (lines) => {
        if (lines > 0) {
          process.stdout.write(`\x1b[${lines}A`); // 向上移动
        } else if (lines < 0) {
          process.stdout.write(`\x1b[${-lines}B`); // 向下移动
        }
      };
      
      // 清除从当前位置开始的多行
      const clearLines = (count) => {
        for (let i = 0; i < count; i++) {
          process.stdout.write('\x1b[2K'); // 清除当前行
          if (i < count - 1) {
            process.stdout.write('\x1b[1B'); // 移动到下一行
          }
        }
        // 移回起始位置
        if (count > 1) {
          process.stdout.write(`\x1b[${count - 1}A`);
        }
        process.stdout.write('\r'); // 移动到行首
      };
      
      // 渲染选项
      const render = (clear = false) => {
        if (clear && lineCount > 0) {
          // 移动到渲染起始位置并清除
          moveCursor(lineCount);
          clearLines(lineCount);
        }
        
        // 计算新的行数
        lineCount = 0;
        
        if (!clear) {
          console.log(title);
          console.log();
          lineCount += 2;
        }
        
        options.forEach((option, index) => {
          if (index === selectedIndex) {
            console.log(`  ${color.success('▶')} ${option.label}`);
          } else {
            console.log(`    ${option.label}`);
          }
          lineCount++;
        });
        
        console.log();
        console.log(color.desc('使用 ↑↓ 方向键选择，Enter 确认，ESC/Ctrl+C 取消'));
        lineCount += 2;
      };
      
      // 初始渲染
      render();
      
      // 监听按键
      const onKeyPress = (key) => {
        if (key === '\u001B\u005B\u0041') { // 上箭头
          selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : options.length - 1;
          render(true);
        } else if (key === '\u001B\u005B\u0042') { // 下箭头
          selectedIndex = selectedIndex < options.length - 1 ? selectedIndex + 1 : 0;
          render(true);
        } else if (key === '\r' || key === '\n') { // 回车
          if (stdin.isTTY) {
            stdin.setRawMode(false);
          }
          stdin.pause();
          stdin.removeListener('data', onKeyPress);
          // 清除选择界面
          moveCursor(lineCount);
          clearLines(lineCount);
          resolve(options[selectedIndex].value);
        } else if (key === '\u001b' || key === '\u0003') { // ESC 或 Ctrl+C
          if (stdin.isTTY) {
            stdin.setRawMode(false);
          }
          stdin.pause();
          stdin.removeListener('data', onKeyPress);
          // 清除选择界面
          moveCursor(lineCount);
          clearLines(lineCount);
          resolve(null);
        }
      };
      
      stdin.on('data', onKeyPress);
    });
  }

  // 读取所有别名
  async readAliases() {
    try {
      const content = fs.readFileSync(SHELL_RC, 'utf8');
      const lines = content.split('\n');
      const aliases = [];

      let inManagedSection = false;
      let nextDescription = null;
      
      for (const line of lines) {
        if (line.includes(ALIAS_MARKER_START)) {
          inManagedSection = true;
          continue;
        }
        if (line.includes(ALIAS_MARKER_END)) {
          inManagedSection = false;
          continue;
        }

        // 检查是否是描述行
        if (inManagedSection && line.startsWith(ALIAS_DESC_PREFIX)) {
          nextDescription = line.substring(ALIAS_DESC_PREFIX.length).trim();
          continue;
        }

        // 匹配 alias 格式
        const match = line.match(/^\s*alias\s+([^=]+)=(['"]?)(.+)\2\s*$/);
        if (match) {
          aliases.push({
            name: match[1].trim(),
            command: match[3],
            description: inManagedSection ? nextDescription : null,
            managed: inManagedSection,
            raw: line
          });
          nextDescription = null; // 重置描述
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
        // 如果有描述，先添加描述注释
        if (alias.description) {
          newLines.push(`${ALIAS_DESC_PREFIX} ${alias.description}`);
        }
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
      console.log(color.success('✅ 已重新加载 ~/.zshrc'));
    } catch (error) {
      console.log(color.warning('⚠️  配置已保存,请手动执行: source ~/.zshrc'));
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
      const indexStr = `[${index + 1}]`;
      console.log(`${status} ${color.info(indexStr)} ${color.name(alias.name)} = ${color.command(alias.command)}`);
      if (alias.description) {
        console.log(`     ${color.desc('└─ ' + alias.description)}`);
      }
    });
    console.log(`\n${color.label('🔧 = 本工具管理')}  ${color.label('📌 = 其他配置')}\n`);
  }

  // 添加别名
  async addAlias() {
    const name = await this.question('\n请输入别名名称: ');
    if (!name) {
      console.log(color.error('❌ 别名名称不能为空'));
      return;
    }

    const command = await this.question('请输入命令内容: ');
    if (!command) {
      console.log(color.error('❌ 命令内容不能为空'));
      return;
    }

    const description = await this.question('请输入命令说明 (可选): ');

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

    managedAliases.push({ 
      name, 
      command, 
      description: description || null,
      managed: true 
    });
    await this.saveAliases(managedAliases);
    console.log(color.success(`\n✅ 已添加别名: `) + color.name(name) + ' = ' + color.command(`'${command}'`));
    if (description) {
      console.log(`   ${color.desc('说明: ' + description)}`);
    }
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
      const indexStr = `[${index + 1}]`;
      console.log(`${status} ${color.info(indexStr)} ${color.name(alias.name)} = ${color.command(alias.command)}`);
      if (alias.description) {
        console.log(`     ${color.desc('└─ ' + alias.description)}`);
      }
    });
    console.log(`\n${color.label('🔧 = 本工具管理')}  ${color.label('📌 = 其他配置 (编辑后将移至工具管理)')}\n`);

    const choice = await this.question('请选择要编辑的别名序号: ');
    const index = parseInt(choice) - 1;

    if (isNaN(index) || index < 0 || index >= aliases.length) {
      console.log('❌ 无效的选择');
      return;
    }

    const alias = aliases[index];
    const wasManaged = alias.managed;
    
    console.log(`\n当前别名: ${color.name(alias.name)} = ${color.command(`'${alias.command}'`)}`);
    if (alias.description) {
      console.log(`当前说明: ${color.desc(alias.description)}`);
    }
    
    const newName = await this.question(`新的别名名称 (留空保持 '${alias.name}'): `);
    const newCommand = await this.question(`新的命令内容 (留空保持当前命令): `);
    const newDescription = await this.question(`新的命令说明 (留空保持当前说明): `);

    const finalName = newName || alias.name;
    const finalCommand = newCommand || alias.command;
    const finalDescription = newDescription || alias.description || null;

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
      description: finalDescription,
      managed: true 
    });

    await this.saveAliases(managedAliases);
    console.log(color.success(`\n✅ 已更新别名: `) + color.name(finalName) + ' = ' + color.command(`'${finalCommand}'`));
    if (finalDescription) {
      console.log(`   ${color.desc('说明: ' + finalDescription)}`);
    }
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
      const indexStr = `[${index + 1}]`;
      console.log(`${status} ${color.info(indexStr)} ${color.name(alias.name)} = ${color.command(alias.command)}`);
      if (alias.description) {
        console.log(`     ${color.desc('└─ ' + alias.description)}`);
      }
    });
    console.log(`\n${color.label('🔧 = 本工具管理')}  ${color.label('📌 = 其他配置')}\n`);

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
      console.log(`  ${status} ${color.name(alias.name)}`);
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
      a.name.includes(keyword) || a.command.includes(keyword) || 
      (a.description && a.description.includes(keyword))
    );

    if (results.length === 0) {
      console.log(`\n❌ 未找到包含 '${keyword}' 的别名`);
      return;
    }

    console.log(color.info(`\n🔍 搜索结果 (共 ${results.length} 条):\n`));
    results.forEach((alias, index) => {
      const status = alias.managed ? '🔧' : '📌';
      const indexStr = `[${index + 1}]`;
      console.log(`${status} ${color.info(indexStr)} ${color.name(alias.name)} = ${color.command(alias.command)}`);
      if (alias.description) {
        console.log(`     ${color.desc('└─ ' + alias.description)}`);
      }
    });
    console.log();
  }

  // 执行别名命令
  async executeAlias() {
    const aliases = await this.readAliases();
    
    if (aliases.length === 0) {
      console.log('\n📭 暂无可执行的别名\n');
      return;
    }

    // 准备选项列表
    const aliasOptions = aliases.map((alias, index) => {
      const status = alias.managed ? '🔧' : '📌';
      let label = `${status} ${color.name(alias.name)}`;
      if (alias.description) {
        label += ` - ${color.desc(alias.description)}`;
      } else {
        // 如果没有描述，显示命令的简短版本
        const shortCmd = alias.command.length > 40 
          ? alias.command.substring(0, 37) + '...' 
          : alias.command;
        label += ` - ${color.command(shortCmd)}`;
      }
      return {
        label: label,
        value: alias
      };
    });

    // 添加取消选项
    aliasOptions.push({
      label: '❌ 取消',
      value: null
    });

    // 使用单选框选择别名
    const title = color.info('🚀 选择要执行的命令:');
    const alias = await this.selectOption(title, aliasOptions, 0);
    
    if (!alias) {
      console.log('❌ 已取消');
      return;
    }
    
    // 显示命令信息
    console.log(`\n${color.label('准备执行:')} ${color.name(alias.name)}`);
    console.log(`${color.label('命令内容:')} ${color.command(alias.command)}`);
    if (alias.description) {
      console.log(`${color.label('命令说明:')} ${color.desc(alias.description)}`);
    }
    
    // 选择执行方式
    const execOptions = [
      { label: '🆕 在新终端窗口中执行', value: 'new' },
      { label: '📋 复制命令到剪贴板', value: 'copy' },
      { label: '❌ 取消', value: null }
    ];
    
    const execTitle = '\n请选择执行方式:';
    const execMode = await this.selectOption(execTitle, execOptions, 0); // 默认选中第一个（新终端）
    
    switch (execMode) {
      case 'new':
        await this.executeInNewTerminal(alias);
        break;
      case 'copy':
        await this.copyToClipboard(alias.command);
        break;
      case null:
        console.log('❌ 已取消');
        break;
    }
  }

  // 在新终端窗口中执行命令
  async executeInNewTerminal(alias) {
    const { exec } = require('child_process');
    
    try {
      // macOS 使用 Terminal.app 或 iTerm2
      const command = alias.command;
      
      // 检测是否安装了 iTerm2
      const checkITerm = 'osascript -e \'tell application "System Events" to get name of every application process\' | grep -q "iTerm"';
      
      exec(checkITerm, (error) => {
        let script;
        if (!error) {
          // 使用 iTerm2
          script = `osascript -e '
            tell application "iTerm"
              activate
              tell current window
                create tab with default profile
                tell current session
                  write text "${command.replace(/'/g, "\\'")}"
                end tell
              end tell
            end tell'`;
        } else {
          // 使用默认 Terminal.app
          script = `osascript -e '
            tell application "Terminal"
              activate
              do script "${command.replace(/'/g, "\\'")}"
            end tell'`;
        }
        
        exec(script, (error, stdout, stderr) => {
          if (error) {
            console.error('❌ 无法打开新终端窗口:', error.message);
            console.log('\n💡 提示: 你可以手动复制以下命令到终端执行:');
            console.log(`\n${command}\n`);
          } else {
            console.log('✅ 已在新终端窗口中执行命令');
          }
        });
      });
      
    } catch (error) {
      console.error('❌ 执行失败:', error.message);
    }
  }

  // 复制命令到剪贴板
  async copyToClipboard(command) {
    const { exec } = require('child_process');
    
    // macOS 使用 pbcopy
    exec(`echo '${command.replace(/'/g, "'\\''")}' | pbcopy`, (error) => {
      if (error) {
        console.error('❌ 复制失败:', error.message);
        console.log('\n请手动复制以下命令:');
        console.log(`\n${command}\n`);
      } else {
        console.log('✅ 命令已复制到剪贴板');
        console.log('\n💡 提示: 你可以在终端中使用 Cmd+V 粘贴执行');
      }
    });
  }

  // 主菜单
  async showMenu() {
    console.log(`${colors.cyan}\n╔════════════════════════════════════╗`);
    console.log(`║     zlink别名管理工具 v1.1.1       ║`);
    console.log(`╚════════════════════════════════════╝${colors.reset}`);
    console.log('\n请选择操作:');
    console.log(`  ${color.info('1.')} 📋 查看所有别名`);
    console.log(`  ${color.info('2.')} ➕ 添加新别名`);
    console.log(`  ${color.info('3.')} ✏️  编辑别名`);
    console.log(`  ${color.info('4.')} 🗑️  删除别名`);
    console.log(`  ${color.info('5.')} 🔍 搜索别名`);
    console.log(`  ${color.info('6.')} 🚀 执行别名命令`);
    console.log(`  ${color.info('0.')} 👋 退出\n`);

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
      case '6':
        await this.executeAlias();
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