#!/usr/bin/env tsx
import { config } from 'dotenv';
import { randomUUID } from 'crypto';
import axios from 'axios';

config();

const API_BASE_URL = 'http://localhost:5000/api';
const CHANNEL_ID = 'bf640c9c-b1ca-11f0-b929-6814011177f5';
const USER_ID = 'dev-user-123';

interface TestResult {
  action: string;
  status: 'success' | 'error';
  message: string;
}

const results: TestResult[] = [];

function logResult(action: string, status: 'success' | 'error', message: string) {
  results.push({ action, status, message });
  const icon = status === 'success' ? '✅' : '❌';
  console.log(`${icon} ${action}: ${message}`);
}

async function testReactions() {
  console.log('\n🧪 اختبار التفاعلات (Reactions)...');
  
  try {
    // إنشاء رسالة جديدة
    const messageId = randomUUID();
    const createMessageRes = await axios.post(`${API_BASE_URL}/messages`, {
      id: messageId,
      channelId: CHANNEL_ID,
      content: 'Test message for reactions',
      userId: USER_ID,
    });
    logResult('Create test message', 'success', 'Message created');

    // إضافة تفاعل
    const addReactionRes = await axios.post(`${API_BASE_URL}/reactions`, {
      messageId: messageId,
      icon: 'thumbs-up',
    });
    logResult('Add reaction', 'success', `Reaction added: ${addReactionRes.data.icon}`);

    // التحقق من التفاعلات
    const getReactionsRes = await axios.get(`${API_BASE_URL}/messages/${messageId}/reactions`);
    const reactions = getReactionsRes.data;
    if (reactions.length > 0 && reactions[0].icon === 'thumbs-up') {
      logResult('Get reactions', 'success', `Found ${reactions.length} reaction(s)`);
    } else {
      logResult('Get reactions', 'error', 'Reactions not found after adding');
    }

    // إزالة التفاعل
    await axios.delete(`${API_BASE_URL}/reactions/${messageId}/thumbs-up`);
    const reactionsAfterRemove = await axios.get(`${API_BASE_URL}/messages/${messageId}/reactions`);
    if (reactionsAfterRemove.data.length === 0) {
      logResult('Remove reaction', 'success', 'Reaction removed successfully');
    } else {
      logResult('Remove reaction', 'error', 'Reaction still exists after removal');
    }

    // تنظيف: حذف الرسالة
    await axios.delete(`${API_BASE_URL}/messages/${messageId}`);
  } catch (error: any) {
    logResult('Reactions test', 'error', error.response?.data?.message || error.message);
  }
}

async function testStarring() {
  console.log('\n⭐ اختبار وضع النجمة (Starring)...');
  
  try {
    // إنشاء رسالة جديدة
    const messageId = randomUUID();
    await axios.post(`${API_BASE_URL}/messages`, {
      id: messageId,
      channelId: CHANNEL_ID,
      content: 'Test message for starring',
      userId: USER_ID,
    });

    // وضع نجمة
    await axios.post(`${API_BASE_URL}/messages/${messageId}/star`);
    logResult('Star message', 'success', 'Message starred');

    // التحقق من حالة النجمة
    const starStatusRes = await axios.get(`${API_BASE_URL}/messages/${messageId}/starred`);
    if (starStatusRes.data.isStarred) {
      logResult('Check star status', 'success', 'Message is starred');
    } else {
      logResult('Check star status', 'error', 'Message should be starred but is not');
    }

    // إزالة النجمة
    await axios.delete(`${API_BASE_URL}/messages/${messageId}/star`);
    const starStatusAfterRemove = await axios.get(`${API_BASE_URL}/messages/${messageId}/starred`);
    if (!starStatusAfterRemove.data.isStarred) {
      logResult('Unstar message', 'success', 'Message unstarred successfully');
    } else {
      logResult('Unstar message', 'error', 'Message should not be starred but is');
    }

    // تنظيف: حذف الرسالة
    await axios.delete(`${API_BASE_URL}/messages/${messageId}`);
  } catch (error: any) {
    logResult('Starring test', 'error', error.response?.data?.message || error.message);
  }
}

async function testEditDelete() {
  console.log('\n✏️ اختبار التعديل والحذف...');
  
  try {
    // إنشاء رسالة جديدة
    const messageId = randomUUID();
    await axios.post(`${API_BASE_URL}/messages`, {
      id: messageId,
      channelId: CHANNEL_ID,
      content: 'Original message content',
      userId: USER_ID,
    });
    logResult('Create message for edit', 'success', 'Message created');

    // تعديل الرسالة
    const updatedContent = 'Updated message content';
    const updateRes = await axios.patch(`${API_BASE_URL}/messages/${messageId}`, {
      content: updatedContent,
    });
    if (updateRes.data.content === updatedContent && updateRes.data.editedAt) {
      logResult('Edit message', 'success', 'Message edited successfully');
    } else {
      logResult('Edit message', 'error', 'Message not edited correctly');
    }

    // الحصول على الرسالة المحدثة
    const messagesRes = await axios.get(`${API_BASE_URL}/channels/${CHANNEL_ID}/messages`);
    const message = messagesRes.data.find((m: any) => m.id === messageId);
    if (message && message.content === updatedContent && message.editedAt) {
      logResult('Verify edited message', 'success', 'Edited message found in database');
    } else {
      logResult('Verify edited message', 'error', 'Edited message not found or incorrect');
    }

    // حذف الرسالة
    await axios.delete(`${API_BASE_URL}/messages/${messageId}`);
    const messagesAfterDelete = await axios.get(`${API_BASE_URL}/channels/${CHANNEL_ID}/messages`);
    const deletedMessage = messagesAfterDelete.data.find((m: any) => m.id === messageId);
    if (!deletedMessage) {
      logResult('Delete message', 'success', 'Message deleted successfully');
    } else {
      logResult('Delete message', 'error', 'Message still exists after deletion');
    }
  } catch (error: any) {
    logResult('Edit/Delete test', 'error', error.response?.data?.message || error.message);
  }
}

async function testThreads() {
  console.log('\n🧵 اختبار Threads...');
  
  try {
    // إنشاء رسالة رئيسية
    const parentMessageId = randomUUID();
    await axios.post(`${API_BASE_URL}/messages`, {
      id: parentMessageId,
      channelId: CHANNEL_ID,
      content: 'Parent message for thread',
      userId: USER_ID,
    });
    logResult('Create parent message', 'success', 'Parent message created');

    // إنشاء رد في Thread
    const replyMessageId = randomUUID();
    await axios.post(`${API_BASE_URL}/messages`, {
      id: replyMessageId,
      channelId: CHANNEL_ID,
      content: 'Reply in thread',
      userId: USER_ID,
      threadParentId: parentMessageId,
    });
    logResult('Create thread reply', 'success', 'Thread reply created');

    // التحقق من الرد
    const messagesRes = await axios.get(`${API_BASE_URL}/channels/${CHANNEL_ID}/messages`);
    const reply = messagesRes.data.find((m: any) => m.id === replyMessageId);
    if (reply && reply.threadParentId === parentMessageId) {
      logResult('Verify thread reply', 'success', 'Thread reply found with correct parent');
    } else {
      logResult('Verify thread reply', 'error', 'Thread reply not found or incorrect parent');
    }

    // إنشاء رد ثاني
    const reply2Id = randomUUID();
    await axios.post(`${API_BASE_URL}/messages`, {
      id: reply2Id,
      channelId: CHANNEL_ID,
      content: 'Second reply in thread',
      userId: USER_ID,
      threadParentId: parentMessageId,
    });

    // التحقق من عدد الردود
    const allMessages = await axios.get(`${API_BASE_URL}/channels/${CHANNEL_ID}/messages`);
    const threadReplies = allMessages.data.filter((m: any) => m.threadParentId === parentMessageId);
    if (threadReplies.length === 2) {
      logResult('Count thread replies', 'success', `Found ${threadReplies.length} replies in thread`);
    } else {
      logResult('Count thread replies', 'error', `Expected 2 replies, found ${threadReplies.length}`);
    }

    // تنظيف
    await axios.delete(`${API_BASE_URL}/messages/${replyMessageId}`);
    await axios.delete(`${API_BASE_URL}/messages/${reply2Id}`);
    await axios.delete(`${API_BASE_URL}/messages/${parentMessageId}`);
  } catch (error: any) {
    logResult('Threads test', 'error', error.response?.data?.message || error.message);
  }
}

async function testStarredPage() {
  console.log('\n⭐ اختبار صفحة الرسائل المميزة...');
  
  try {
    // إنشاء رسالة ووضع نجمة عليها
    const messageId = randomUUID();
    await axios.post(`${API_BASE_URL}/messages`, {
      id: messageId,
      channelId: CHANNEL_ID,
      content: 'Message to star',
      userId: USER_ID,
    });
    await axios.post(`${API_BASE_URL}/messages/${messageId}/star`);

    // الحصول على الرسائل المميزة
    const starredRes = await axios.get(`${API_BASE_URL}/starred`);
    const starredMessages = starredRes.data;
    const found = starredMessages.find((m: any) => m.id === messageId);
    
    if (found) {
      logResult('Get starred messages', 'success', `Found starred message in list`);
    } else {
      logResult('Get starred messages', 'error', 'Starred message not found in list');
    }

    // تنظيف
    await axios.delete(`${API_BASE_URL}/messages/${messageId}/star`);
    await axios.delete(`${API_BASE_URL}/messages/${messageId}`);
  } catch (error: any) {
    logResult('Starred page test', 'error', error.response?.data?.message || error.message);
  }
}

async function runAllTests() {
  console.log('🚀 بدء اختبار جميع إجراءات صفحة القناة...\n');
  console.log(`📡 API Base URL: ${API_BASE_URL}`);
  console.log(`📨 Channel ID: ${CHANNEL_ID}`);
  console.log(`👤 User ID: ${USER_ID}\n`);

  // التحقق من أن السيرفر يعمل
  try {
    await axios.get(`${API_BASE_URL}/auth/user`);
    logResult('Server connection', 'success', 'Server is running');
  } catch (error: any) {
    logResult('Server connection', 'error', 'Server is not responding');
    console.error('\n❌ السيرفر لا يعمل. يرجى تشغيل: pnpm dev');
    process.exit(1);
  }

  await testReactions();
  await testStarring();
  await testEditDelete();
  await testThreads();
  await testStarredPage();

  // تقرير نهائي
  console.log('\n' + '='.repeat(60));
  console.log('📊 تقرير الاختبارات');
  console.log('='.repeat(60));
  
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const totalCount = results.length;

  console.log(`\n✅ نجح: ${successCount}`);
  console.log(`❌ فشل: ${errorCount}`);
  console.log(`📊 الإجمالي: ${totalCount}`);
  console.log(`📈 النجاح: ${((successCount / totalCount) * 100).toFixed(1)}%\n`);

  if (errorCount > 0) {
    console.log('❌ الاختبارات التي فشلت:');
    results.filter(r => r.status === 'error').forEach(r => {
      console.log(`   - ${r.action}: ${r.message}`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

runAllTests().catch(console.error);

