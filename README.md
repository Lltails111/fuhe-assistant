这是一个为留学生准备复核材料的平台
有专业匹配选择
以及自述生成
仅供参考
如果你有vpn或者在国外，你可以选择直接访问https://liuzifuhe.vercel.app
如果不行请修改app.js中
async function callDeepSeekAI(prompt) {
    const API_KEY = "YOUR_DEEPSEEK_API_KEY";  // 替换为你的真实 API Key
    
    try {
        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
这一部分
真实 API Key 可以去deepseek官网免费申请

            
