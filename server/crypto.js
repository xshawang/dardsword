const crypto = require('crypto');

const KEY = Buffer.from('aes_key_16bytes_01', 'utf8'); // 16字节密钥

function aesDecrypt(encryptedBase64) {
    try {
        // 1. 解码 Base64
        const encrypted = Buffer.from(encryptedBase64, 'base64');
        
        // 2. 提取 IV（前16字节）和密文
        const iv = encrypted.slice(0, 16);
        const ciphertext = encrypted.slice(16);
        
        // 3. 创建解密器
        const decipher = crypto.createDecipheriv('aes-128-cbc', KEY, iv);
        
        // 4. 解密
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted.toString('utf8');
    } catch (error) {
        console.error('解密失败:', error);
        return null;
    }
}

// 使用示例
// const encryptedData = 'IV_BASE64_HERE...'; // 客户端上传的数据
// const decrypted = aesDecrypt(encryptedData);
// console.log('解密结果:', decrypted);