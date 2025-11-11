# اختبار الإشعارات - Test Notifications

## طريقة الاختبار المباشر

### 1. الحصول على Token

أولاً، قم بتسجيل الدخول للحصول على token:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}'
```

سيعيد الرد:
```json
{
  "id": 1,
  "email": "admin@gmail.com",
  "name": "Admin",
  "companyId": 1,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. إرسال رسالة مع منشن

استخدم الـ token الذي حصلت عليه:

```bash
TOKEN="YOUR_TOKEN_HERE"
COMPANY_ID=1
CHANNEL_ID=4
MENTIONED_USER_ID=2

curl -X POST http://localhost:5000/api/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-company-id: $COMPANY_ID" \
  -d '{
    "channelId": '$CHANNEL_ID',
    "content": "Test mention notification",
    "mentionedUserIds": ['$MENTIONED_USER_ID']
  }'
```

### 3. استخدام السكريبت

يمكنك استخدام السكريبت المباشر:

```bash
# قم بتحديث القيم في السكريبت أولاً
export TOKEN="your_token_here"
export COMPANY_ID=1
export CHANNEL_ID=4
export MENTIONED_USER_ID=2

./test-notification-direct.sh
```

## التحقق من النتائج

### 1. فحص سجلات الخادم

راقب سجلات الخادم للبحث عن:
- `[POST /api/messages]` - بداية الطلب
- `[POST /api/messages] ===== MENTIONS FOUND` - تم العثور على منشن
- `[Storage] ===== NOTIFICATION INSERTED` - تم إدراج الإشعار
- `[Storage] ===== NOTIFICATION VERIFIED` - تم التحقق من الإشعار

### 2. فحص قاعدة البيانات

```sql
-- فحص الإشعارات
SELECT * FROM notifications 
WHERE type = 'mention' 
ORDER BY created_at DESC 
LIMIT 5;

-- فحص المنشنات في الرسائل
SELECT * FROM message_mentions 
ORDER BY created_at DESC 
LIMIT 5;
```

### 3. فحص API

```bash
curl -X GET http://localhost:5000/api/notifications \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-company-id: $COMPANY_ID"
```

## استكشاف الأخطاء

إذا لم يتم إنشاء الإشعار:

1. **تحقق من السجلات**: ابحث عن أخطاء في سجلات الخادم
2. **تحقق من البيانات**: تأكد من أن `mentionedUserIds` موجود في الطلب
3. **تحقق من قاعدة البيانات**: تأكد من أن الجداول موجودة والـ foreign keys صحيحة
4. **تحقق من الـ authentication**: تأكد من أن الـ token صحيح والـ companyId موجود

## ملاحظات

- تأكد من أن المستخدم المذكور موجود في نفس الشركة
- تأكد من أن القناة موجودة والمستخدم عضو فيها
- تأكد من أن المستخدم المرسل ليس هو نفسه المستخدم المذكور

