const TOKEN = ENV_BOT_TOKEN; // 从环境变量中获取 Telegram 机器人 token
const WEBHOOK = '/endpoint'; // 设置 webhook 的端点
const SECRET = ENV_BOT_SECRET; // 用于验证请求的 secret token
const ADMIN_UID = ENV_ADMIN_UID; // 管理员的用户 ID，用于控制特殊功能
const NOTIFY_INTERVAL = 12 * 3600 * 1000; // 设置通知间隔（12 小时）
const notificationUrl = 'https://raw.githubusercontent.com/QDwbd/sBot/main/data/notification.txt'; // 通知内容的 URL
const startMsgUrl = 'https://raw.githubusercontent.com/QDwbd/sBot/main/data/startMessage.md'; // 启动消息内容的 URL
const enable_notification = true; // 是否启用通知的标志
function apiUrl(methodName, params = null) {
  let query = ''; // 初始化查询字符串
  if (params) { // 如果有参数
    query = '?' + new URLSearchParams(params).toString(); // 构建查询字符串
  }
  return `https://api.telegram.org/bot${TOKEN}/${methodName}${query}`; // 返回 Telegram API 的 URL
}
function requestTelegram(methodName, body, params = null) {
  return fetch(apiUrl(methodName, params), body).then(r => r.json()); // 发送请求并返回 JSON 响应
}
function makeReqBody(body) {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }; // 构建请求体
}
function sendMessage(msg = {}) {
  return requestTelegram('sendMessage', makeReqBody(msg)); // 发送消息
}
function copyMessage(msg = {}) {
  return requestTelegram('copyMessage', makeReqBody(msg)); // 复制消息
}
function forwardMessage(msg) {
  return requestTelegram('forwardMessage', makeReqBody(msg)); // 转发消息
}
function deleteMessage(msg = {}) {
  return requestTelegram('deleteMessage', makeReqBody(msg)); // 删除消息
}
addEventListener('fetch', event => { // 监听 fetch 事件
  const url = new URL(event.request.url); // 获取请求的 URL
  if (url.pathname === WEBHOOK) { // 如果请求路径是 webhook
    event.respondWith(handleWebhook(event)); // 处理 webhook 请求
  } else if (url.pathname === '/registerWebhook') { // 如果请求路径是 /registerWebhook
    event.respondWith(registerWebhook(event, url, WEBHOOK, SECRET)); // 注册 webhook
  } else if (url.pathname === '/unRegisterWebhook') { // 如果请求路径是 /unRegisterWebhook
    event.respondWith(unRegisterWebhook(event)); // 注销 webhook
  } else {
    event.respondWith(new Response('No handler for this request')); // 其他请求返回无处理消息
  }
});
async function handleWebhook(event) {
  if (event.request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== SECRET) { // 如果 secret token 不匹配
    return new Response('Unauthorized', { status: 403 }); // 返回 403 Unauthorized
  }
  const update = await event.request.json(); // 解析请求的 JSON 数据
  event.waitUntil(onUpdate(update)); // 处理更新
  return new Response('Ok'); // 返回 OK 响应
}
async function onUpdate(update) {
  if ('message' in update) { // 如果更新中有消息
    await onMessage(update.message); // 处理消息
  }
}
async function onMessage(message) {
  if (message.text === '/start') { // 如果消息文本是 /start
    const userId = message.from.id; // 获取用户 ID
    let username = message.from.first_name && message.from.last_name
      ? message.from.first_name + " " + message.from.last_name // 用户名由名字和姓氏组成
      : message.from.first_name || "未知"; // 如果没有姓氏，只用名字，如果没有名字，则为“未知”
    let user = message.from.username; // 获取用户名
    let startMsg;
    try {
      const response = await fetch(startMsgUrl); // 获取启动消息内容
      if (!response.ok) throw new Error('Failed to fetch start message'); // 如果获取失败，则抛出错误
      startMsg = await response.text(); // 获取文本内容
    } catch (error) {
      console.error('Error fetching start message:', error); // 捕获错误
      startMsg = 'An error occurred while fetching the start message.'; // 设置错误消息
    }
    startMsg = startMsg.replace(/{{username}}/g, username).replace(/{{user_id}}/g, userId).replace(/{{user}}/g, user); // 替换占位符
    let keyboard = {
      inline_keyboard: [
        [
          { text: 'AiMi的github', url: 'https://github.com/QDwbd' } // 设置 GitHub 链接的按钮
        ]
      ]
    };
    return sendMessage({
      chat_id: message.chat.id, // 发送到该聊天
      text: startMsg, // 消息内容
      parse_mode: 'Markdown', // 设置消息格式为 Markdown
      reply_markup: keyboard, // 设置键盘按钮
    });
  }
  if (message.text && /配置文件|配置/i.test(message.text)) { // 如果消息包含“配置文件”或“配置”
    const linkText = `[AiMi配置](https://raw.githubusercontent.com/QDwbd/srule/refs/heads/main/s.conf)`; // 设置配置文件链接
    return sendMessage({
      chat_id: message.chat.id, // 发送到该聊天
      text: linkText, // 消息内容
      parse_mode: 'Markdown', // 设置消息格式为 Markdown
    });
  }
  if (message.chat.id.toString() === ADMIN_UID) { // 如果消息来自管理员
    if (!message?.reply_to_message?.chat) { // 如果没有回复的消息
      return sendMessage({
        chat_id: ADMIN_UID, // 发送给管理员
        text: '拉黑 不拉黑 检测拉黑没有`/block`、`/unblock`、`/checkblock`' // 提示管理员使用命令
      });
    }
    if (/^\/block$/.exec(message.text)) { // 如果消息是 /block
      return handleBlock(message); // 处理拉黑
    }
    if (/^\/unblock$/.exec(message.text)) { // 如果消息是 /unblock
      return handleUnBlock(message); // 处理解除拉黑
    }
    if (/^\/checkblock$/.exec(message.text)) { // 如果消息是 /checkblock
      return checkBlock(message); // 检查拉黑状态
    }
    let guestChantId = await getGuestChatId(message); // 获取来访者聊天 ID
    return copyMessage({
      chat_id: guestChantId, // 复制消息到来访者聊天
      from_chat_id: message.chat.id, // 来自管理员的聊天 ID
      message_id: message.message_id, // 消息 ID
    });
  }
  return handleGuestMessage(message); // 处理来访者消息
}
async function getGuestChatId(message) {
  return await sBot.get('msg-map-' + message?.reply_to_message.message_id, { type: "json" }); // 获取来访者聊天 ID
}
async function handleGuestMessage(message) {
  let chatId = message.chat.id; // 获取消息的聊天 ID
  let isBlocked = await sBot.get('isblocked-' + chatId, { type: "json" }); // 检查是否被拉黑
  if (isBlocked) { // 如果被拉黑
    return sendMessage({
      chat_id: chatId, // 发送消息到来访者聊天
      text: 'You are blocked', // 消息内容
    });
  }
  const sentMessage = await sendMessage({
    chat_id: chatId, // 发送消息到来访者聊天
    text: '稍等一下-主人看到会回复你', // 提示等待消息
  });
  setTimeout(async () => {
    await deleteMessage({
      chat_id: chatId, // 删除等待消息
      message_id: sentMessage.result.message_id, // 消息 ID
    });
  }, 360);
  let forwardReq = await forwardMessage({
    chat_id: ADMIN_UID, // 转发消息给管理员
    from_chat_id: message.chat.id, // 来自来访者的聊天 ID
    message_id: message.message_id, // 消息 ID
  });
  if (forwardReq.ok) {
    await sBot.put('msg-map-' + forwardReq.result.message_id, chatId); // 保存转发消息 ID 和来访者聊天 ID
  }
  return handleNotify(message); // 处理通知
}
async function handleNotify(message) {
  if (enable_notification) { // 如果启用通知
    let lastMsgTime = await sBot.get('lastmsg-' + message.chat.id, { type: "json" }); // 获取最后一条消息时间
    if (!lastMsgTime || Date.now() - lastMsgTime > NOTIFY_INTERVAL) { // 如果超出通知间隔
      await sBot.put('lastmsg-' + message.chat.id, Date.now()); // 更新最后一条消息时间
      return sendMessage({
        chat_id: ADMIN_UID, // 发送通知给管理员
        text: await fetch(notificationUrl).then(r => r.text()) // 获取并发送通知内容
      });
    }
  }
}
async function handleBlock(message) {
  let guestChantId = await getGuestChatId(message); // 获取来访者聊天 ID
  if (guestChantId === ADMIN_UID) { // 如果是管理员
    return sendMessage({
      chat_id: ADMIN_UID, // 发送消息给管理员
      text: '不能屏蔽自己' // 提示不能屏蔽自己
    });
  }
  await sBot.put('isblocked-' + guestChantId, true); // 标记该用户为被拉黑
  return sendMessage({
    chat_id: ADMIN_UID, // 发送消息给管理员
    text: `UID:${guestChantId}屏蔽成功`, // 显示屏蔽成功的消息
  });
}
async function handleUnBlock(message) {
  let guestChantId = await getGuestChatId(message); // 获取来访者聊天 ID
  await sBot.put('isblocked-' + guestChantId, false); // 解除拉黑标记
  return sendMessage({
    chat_id: ADMIN_UID, // 发送消息给管理员
    text: `UID:${guestChantId}解除屏蔽成功`, // 显示解除屏蔽成功的消息
  });
}
async function checkBlock(message) {
  let guestChantId = await getGuestChatId(message); // 获取来访者聊天 ID
  let blocked = await sBot.get('isblocked-' + guestChantId, { type: "json" }); // 检查是否被拉黑
  return sendMessage({
    chat_id: ADMIN_UID, // 发送消息给管理员
    text: `UID:${guestChantId}` + (blocked ? '被屏蔽' : '没有被屏蔽') // 显示拉黑状态
  });
}
async function registerWebhook(event, requestUrl, suffix, secret) {
  const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`; // 构建 webhook URL
  const r = await (await fetch(apiUrl('setWebhook', { url: webhookUrl, secret_token: secret }))).json(); // 注册 webhook
  return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2)); // 返回注册结果
}
async function unRegisterWebhook(event) {
  const r = await (await fetch(apiUrl('setWebhook', { url: '' }))).json(); // 注销 webhook
  return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2)); // 返回注销结果
}
