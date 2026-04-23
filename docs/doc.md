# DarkSword-RCE 项目分析报告

## 项目概述

DarkSword-RCE 是一个针对 iOS 系统的远程代码执行（RCE）漏洞利用链项目。该项目展示了如何通过 Safari WebKit 浏览器漏洞链，从沙箱环境逐步提升到系统级权限的完整攻击流程。

### 基本信息
- **项目名称**: DarkSword-RCE
- **攻击目标**: iOS 18.4 和 18.6 版本
- **攻击向量**: Safari WebKit 浏览器
- **参考来源**: https://cloud.google.com/blog/topics/threat-intelligence/darksword-ios-exploit-chain
- **作者声明**: 对 RU/UA 政治不感兴趣，只是因为技术粗糙导致漏洞被发现

## 文件结构分析

### 1. 入口文件

#### index.html
- **作用**: 主入口页面
- **功能**: 创建隐藏的 iframe 并加载 frame.html
- **特点**: 使用随机参数防止缓存
```html
const frame = document.createElement('iframe');
frame.src = 'frame.html?' + Math.random();
frame.style.width = '1px';
frame.style.opacity = '0.01'
```

#### frame.html
- **作用**: 加载漏洞利用加载器
- **功能**: 动态加载 rce_loader.js
- **特点**: 使用 defer 属性和随机参数

### 2. 核心加载器

#### rce_loader.js
- **作用**: 主要的漏洞利用加载器和协调器
- **关键功能**:
  - iOS 版本检测
  - 动态加载对应版本的漏洞利用模块
  - 创建 Web Worker 环境
  - 协调主线程和 Worker 之间的通信
  - 管理日志记录和错误处理

**版本检测逻辑**:
```javascript
const ios_version = (function() {
    let version = /iPhone OS ([0-9_]+)/g.exec(navigator.userAgent)?.[1];
    if (version) {
        return version.split('_').map(part => parseInt(part));
    }
})();
```

**动态加载策略**:
- iOS 18.6/18.6.1/18.6.2: 使用 rce_worker_18.6.js 和 rce_module_18.6.js
- 其他版本: 使用 rce_worker.js 和 rce_module.js

### 3. 漏洞利用模块

#### rce_module.js / rce_module_18.6.js
- **作用**: 包含漏洞利用的核心代码和偏移量数据
- **内容**:
  - 设备特定的偏移量表（支持多种 iPhone 型号）
  - JavaScriptCore 基础设施
  - 内存操作原语
  - 系统函数解析

**支持的设备型号**:
- iPhone11,2 (iPhone XS)
- iPhone11,8 (iPhone XR)
- iPhone12,1 (iPhone 11)
- iPhone12,3 (iPhone 11 Pro)
- iPhone12,8 (iPhone SE 2)
- iPhone13,1 (iPhone 12 mini)
- iPhone13,2 (iPhone 12)

**偏移量数据结构**:
```javascript
rce_offsets = {
   "iPhone11,2_4_6_22F76": {
      JavaScriptCore__jitAllowList: 0x1edb3e4a0n,
      WebCore__DedicatedWorkerGlobalScope_vtable: 0x1f137cf70n,
      // ... 更多偏移量
   }
}
```

#### rce_worker.js / rce_worker_18.6.js
- **作用**: 在 Web Worker 中执行的漏洞利用代码
- **关键功能**:
  - 实现任意读写原语
  - 绕过 PAC（Pointer Authentication Code）保护
  - 动态加载系统库（dlopen/dlsym）
  - 构建和执行 ROP/JOP 链
  - 实现跨进程通信

**内存操作原语**:
```javascript
p.addrof = function addrof(o) {
    boxed_arr[0] = o;
    return BigInt.fromDouble(unboxed_arr[0]);
}

p.write64 = function (addr, value) {
    // 实现任意地址写入
}

p.read64 = function (addr) {
    // 实现任意地址读取
}
```

### 4. 特权提升模块

#### pe_main.js
- **作用**: 特权提升（Privilege Escalation）主代码
- **功能**:
  - 在 GPU 进程中执行代码
  - 绕过沙箱限制
  - 获取系统级权限
  - 执行任意系统调用

**关键特性**:
- 使用 Mach IPC 进行进程间通信
- 利用 GPU 进程的权限漏洞
- 实现完整的系统调用接口
- 支持文件操作、网络操作等

### 5. 沙箱逃逸模块

#### sbx0_main_18.4.js
- **作用**: 沙箱逃逸第一阶段
- **功能**:
  - 建立与 GPU 进程的连接
  - 利用 GPU 进程的漏洞
  - 实现跨进程读写

**关键偏移量**:
```javascript
sbx0_offsets = {
   "iPhone11,2_4_6_22E240": {
      GPUConnectionToWebProcess_CreateGraphicsContextGL: 0x29,
      RemoteGraphicsContextGL_BindBuffer: 0x411,
      // ... GPU 相关偏移量
   }
}
```

#### sbx1_main.js
- **作用**: 沙箱逃逸第二阶段
- **功能**:
  - 在 GPU 进程中建立完整的执行环境
  - 实现系统级别的功能调用
  - 最终实现特权提升

## 攻击流程分析

### 阶段 1: 初始代码执行
1. 用户访问恶意网站
2. index.html 加载并创建隐藏 iframe
3. frame.html 加载 rce_loader.js
4. rce_loader.js 检测 iOS 版本和设备型号
5. 加载对应的漏洞利用模块到 Web Worker

### 阶段 2: WebKit 漏洞利用
1. 在 Worker 中触发 JavaScriptCore 漏洞
2. 实现任意读写原语（addrof, fakeobj, read64, write64）
3. 绕过 JIT 保护机制
4. 修改 JavaScriptCore 内部数据结构

### 阶段 3: 动态库加载
1. 利用 ImageIO 漏洞绕过沙箱限制
2. 通过 dlopen 加载系统库
3. 使用 dlsym 解析系统函数地址
4. 绕过 PAC 签名验证

### 阶段 4: 沙箱逃逸
1. 利用 GPU 进程漏洞
2. 建立与 GPU 进程的通信通道
3. 在 GPU 进程中执行代码
4. 获取更高级别的权限

### 阶段 5: 特权提升
1. 利用内核漏洞或权限提升漏洞
2. 获取 root 权限
3. 执行任意系统操作
4. 建立持久化后门

## 技术特点

### 1. 多版本支持
- 针对不同的 iOS 版本（18.4, 18.6）使用不同的漏洞利用代码
- 支持多种 iPhone 设备型号
- 动态检测和适配

### 2. 高级漏洞利用技术
- **ROP/JOP 链**: 使用面向返回编程和面向跳转编程
- **PAC 绕过**: 绕过指针认证代码保护
- **类型混淆**: 利用 JavaScript 类型系统漏洞
- **堆喷射**: 精确控制内存布局

### 3. 跨进程攻击
- 利用 Web Worker 隔离环境
- 通过 GPU 进程进行权限提升
- 使用 Mach IPC 进行进程间通信

### 4. 反检测和隐蔽性
- 使用隐藏的 iframe
- 随机化 URL 参数防止缓存
- 最小化可见性
- 错误处理和重试机制

## 安全影响

### 受影响的系统
- iOS 18.4.x
- iOS 18.6.x
- Safari 浏览器（基于 WebKit）

### 攻击能力
- 远程代码执行（RCE）
- 沙箱逃逸
- 特权提升
- 系统级访问
- 数据窃取
- 持久化后门

### 防御建议

### 用户层面
1. **及时更新系统**: 安装 Apple 发布的安全补丁
2. **谨慎访问未知网站**: 避免点击可疑链接
3. **使用 Safari 的安全功能**: 启用 JavaScript 限制（如果可能）

### 开发者层面
1. **输入验证**: 严格验证所有用户输入
2. **最小权限原则**: 限制应用程序权限
3. **安全编码**: 遵循安全编码最佳实践
4. **定期安全审计**: 进行代码审查和渗透测试

### 系统层面
1. **加强沙箱**: 改进沙箱隔离机制
2. **增强 PAC**: 改进指针认证机制
3. **漏洞赏金**: 鼓励负责任的漏洞披露
4. **监控和检测**: 实施异常行为检测

## 学习价值

### 正面学习价值
1. **漏洞研究**: 理解现代操作系统的漏洞类型
2. **防御改进**: 帮助改进安全防护措施
3. **安全意识**: 提高对网络威胁的认识
4. **技术深度**: 展示了高级漏洞利用技术

### 道德考量
- 本项目仅供学习和研究使用
- 不应用于非法目的
- 应遵循负责任的漏洞披露原则
- 尊重用户隐私和系统安全

## 技术细节

### JavaScriptCore 漏洞利用
项目利用了 JavaScriptCore 引擎中的类型混淆漏洞，通过精心构造的 JavaScript 对象来实现内存读写原语。

### PAC 绕过技术
Pointer Authentication Code (PAC) 是 ARM64 架构中的安全特性，项目通过以下方式绕过：
1. 泄露 PAC 签名密钥
2. 使用已签名的指针
3. 构造有效的 PAC 签名

### GPU 进程利用
iOS 使用 GPU 进程来隔离图形操作，项目利用了 GPU 进程中的漏洞来实现权限提升。

## 总结

DarkSword-RCE 项目是一个高度复杂的 iOS 漏洞利用链，展示了从 Web 浏览器到系统级权限的完整攻击路径。该项目对于安全研究人员具有重要的学习价值，可以帮助理解：

1. 现代移动操作系统的安全机制
2. 高级漏洞利用技术
3. 跨层攻击的复杂性
4. 防御措施的重要性

通过研究此类项目，安全研究人员可以更好地理解攻击者的技术手段，从而开发更有效的防御策略。同时，这也提醒我们需要持续关注和改进移动设备的安全性。

## 参考资料
- Google Cloud Threat Intelligence: https://cloud.google.com/blog/topics/threat-intelligence/darksword-ios-exploit-chain
- Apple Security Updates: https://support.apple.com/en-us/HT201222
- WebKit Security: https://webkit.org/security/
- ARM Pointer Authentication: https://developer.arm.com/documentation/ddi0601/latest/AArch64-Registers-PAC-Keys

---

**免责声明**: 本分析报告仅用于教育和研究目的。读者应遵守当地法律法规，不得将此信息用于任何非法活动。