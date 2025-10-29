#!/usr/bin/env tsx

import { randomUUID } from 'crypto';

async function testApiMessage() {
  console.log('🧪 اختبار إرسال رسالة عبر API...');
  
  try {
    const channelId = 'bf640c9c-b1ca-11f0-b929-6814011177f5';
    const messageId = randomUUID();
    const content = `رسالة تجريبية عبر API - ${new Date().toLocaleString('ar-SA')}`;

    // First, get the channel info
    console.log('📡 جلب معلومات القناة...');
    const channelResponse = await fetch(`http://localhost:5000/api/channels/${channelId}`);
    
    if (!channelResponse.ok) {
      throw new Error(`فشل في جلب القناة: ${channelResponse.status}`);
    }
    
    const channel = await channelResponse.json();
    console.log('✅ القناة:', channel.name);

    // Get current messages
    console.log('📡 جلب الرسائل الحالية...');
    const messagesResponse = await fetch(`http://localhost:5000/api/channels/${channelId}/messages`);
    
    if (!messagesResponse.ok) {
      throw new Error(`فشل في جلب الرسائل: ${messagesResponse.status}`);
    }
    
    const messages = await messagesResponse.json();
    console.log(`📨 عدد الرسائل الحالية: ${messages.length}`);

    // Try to send a message (this will fail without authentication, but we can test the endpoint)
    console.log('📡 محاولة إرسال رسالة...');
    const sendResponse = await fetch('http://localhost:5000/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: messageId,
        content: content,
        channelId: channelId,
        userId: 'dev-user-123',
        mentions: []
      })
    });

    if (sendResponse.ok) {
      const newMessage = await sendResponse.json();
      console.log('✅ تم إرسال الرسالة بنجاح:', newMessage.content);
    } else {
      console.log('⚠️  فشل في إرسال الرسالة (متوقع بدون مصادقة):', sendResponse.status);
    }

    // Check messages again
    console.log('📡 جلب الرسائل مرة أخرى...');
    const updatedMessagesResponse = await fetch(`http://localhost:5000/api/channels/${channelId}/messages`);
    const updatedMessages = await updatedMessagesResponse.json();
    console.log(`📨 عدد الرسائل المحدث: ${updatedMessages.length}`);

    if (updatedMessages.length > messages.length) {
      console.log('✅ تم إضافة رسالة جديدة!');
      const latestMessage = updatedMessages[updatedMessages.length - 1];
      console.log(`   - المحتوى: ${latestMessage.content}`);
      console.log(`   - المستخدم: ${latestMessage.user.firstName}`);
    }

  } catch (error) {
    console.error('❌ فشل في اختبار API:', error);
  }
}

// Run the function
if (import.meta.url === `file://${process.argv[1]}`) {
  testApiMessage();
}
