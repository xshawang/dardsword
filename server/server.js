const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const app = express();
const PORT = 8088;
const fs = require('fs');

// 跨域配置
app.use(cors());

// 解析JSON请求体
app.use(express.json({ limit: '100mb' }));
// 解析表单格式请求体（兼容更多客户端）
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const KEY = Buffer.from('aes_key_16bytes_01', 'utf8');
const fileChunks = new Map(); // 存储分片数据

app.post('/api/upload', (req, res) => {
    try {
        const { path, chunk, offset, total } = req.body;
        
        // 1. 解码文件名
        const filePath = decodeURIComponent(escape(atob(path)));
        
        // 2. 存储分片
        if (!fileChunks.has(filePath)) {
            fileChunks.set(filePath, { chunks: [], total });
        }
        
        const fileData = fileChunks.get(filePath);
        fileData.chunks.push({ offset, chunk });
        
        // 3. 检查是否接收完成
        const receivedSize = fileData.chunks.reduce((sum, c) => sum + c.chunk.length, 0);
        
        if (receivedSize >= total) {
            // 4. 合并所有分片
            fileData.chunks.sort((a, b) => a.offset - b.offset);
            const encryptedData = fileData.chunks.map(c => c.chunk).join('');
            
            // 5. 解密
            const decrypted = aesDecrypt(encryptedData);
            
            console.log(`文件 ${filePath} 解密成功，内容:`, decrypted);
            
            // 6. 清理
           // fileChunks.delete(filePath);
           // 写入文件
           writeTXT(filePath, decrypted);
            res.json({ success: true});
        } else {
            res.json({ success: true, received: receivedSize, total });
        }
    } catch (error) {
        console.error('处理失败:', error);
        res.status(500).json({ error: '处理失败' });
    }
});
function writeTXT(filePath, content) {
    fs.writeFileSync(filePath, content);
}
function aesDecrypt(encryptedBase64) {
    const encrypted = Buffer.from(encryptedBase64, 'base64');
    const iv = encrypted.slice(0, 16);
    const ciphertext = encrypted.slice(16);
    
    const decipher = crypto.createDecipheriv('aes-128-cbc', KEY, iv);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
}
 // 使用示例
// const encryptedData = 'IV_BASE64_HERE...'; // 客户端上传的数据
// const decrypted = aesDecrypt(encryptedData);
// console.log('解密结果:', decrypted);
// 统一上传接口：支持 GET + POST
app.all('/api/first', (req, res) => {
    try {
        console.log('===== 收到客户端上传请求 =====');
        console.log('请求时间:', new Date().toLocaleString());
        console.log('请求方法:', req.method);
        console.log('客户端IP:', req.ip);
        console.log('请求头:', req.headers);
        
        // 关键：GET 打印 query，POST 打印 body
        if (req.method === 'GET') {
            console.log('URL 参数(query):', req.query);
        } else {
            console.log('请求体数据(body):', req.body);
        }

        console.log('============================\n');

        // 返回统一成功响应
        res.json({
            code: 200,
            msg: '数据接收成功，已打印到控制台'
        });

    } catch (error) {
        console.error('处理请求异常:', error);
        res.status(500).json({ code: 500, msg: '服务器处理失败' });
    }
});

// 启动服务（绑定 0.0.0.0 允许局域网/公网访问）
app.listen(PORT, '0.0.0.0', () => {
    console.log(`服务器已启动：http://0.0.0.0:${PORT}`);
    console.log(`本机访问：http://127.0.0.1:${PORT}`);
});
