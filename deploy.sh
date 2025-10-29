#!/bin/bash

# سكريبت تحديث المشروع بعد git pull
# استخدام: ssh root@72.61.96.90 'bash -s' < deploy.sh

set -e  # إيقاف التنفيذ عند وجود خطأ

cd /www/wwwroot/ChatSphere

echo "=== تحديث المشروع من Git ==="
git stash
git pull origin main --rebase

echo "=== تثبيت/تحديث الحزم ==="
pnpm install

echo "=== بناء المشروع ==="
npm run build

echo "=== إعادة تشغيل التطبيق ==="
pm2 restart chat

echo "=== التحقق من الحالة ==="
pm2 status chat
sleep 3

echo "=== اختبار التطبيق ==="
curl -I http://localhost:5000 | head -5

echo "=== ✅ تم التحديث بنجاح ==="


