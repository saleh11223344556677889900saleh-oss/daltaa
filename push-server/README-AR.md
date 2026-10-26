# خادم إشعارات أكاديمية دلتا أبين الرياضية

هذا خادم مستقل يستخدم Firebase Admin SDK لإرسال إشعارات FCM عند:
- إضافة حدث هدف جديد في `MatchEvents/{matchId}` عندما يكون `type: "goal"`.
- تغير حالة المباراة في `Matches/{matchId}/status` إلى `live` أو `half_time` أو `second_half` أو `finished` أو `ended` أو `completed`.

يقرأ رموز الأجهزة من `publicNotificationSubscriptions/{uid}`. لا يحتوي هذا المشروع على مفتاح خدمة أو بيانات اعتماد سرية.

## قبل النشر

1. افتح Firebase Console للمشروع `dalta-d4f41`.
2. من Project settings > Service accounts أنشئ مفتاحًا خاصًا لحساب خدمة، إذا كان ذلك متاحًا في إعدادات مؤسستك.
3. **لا ترفع ملف المفتاح إلى GitHub ولا ترسله لأي شخص.** انسخ محتواه لاستخدامه كقيمة سرية في إعدادات الخدمة على Render.
4. أنشئ مستودعًا خاصًا في GitHub وارفع ملفات هذه الحزمة إليه، أو ارفعها إلى Render وفق الخيارات المتاحة في حسابك.

## إعداد Render

أنشئ Web Service جديدًا من هذا المشروع:
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`

أضف متغيرات البيئة التالية في Render > Environment:
- `FIREBASE_PROJECT_ID` = `dalta-d4f41`
- `FIREBASE_DATABASE_URL` = `https://dalta-d4f41-default-rtdb.firebaseio.com`
- `FIREBASE_SERVICE_ACCOUNT_JSON` = محتوى JSON كامل لحساب الخدمة، كسطر واحد أو JSON صالح.

لا تضف مفتاح الخدمة إلى `index.html` أو `admin.html` أو `firebase-messaging-sw.js`.

## اختبار أولي

بعد النشر افتح:
- `/health` على رابط خدمة Render. يجب أن يظهر `{"ok":true,"service":"delta-push-server"}`.

ثم جرّب تسجيل هدف جديد على مباراة تجريبية، وتحقق من سجل الخدمة في Render. يجب أن يكون الجهاز قد حفظ رمزًا صالحًا في `publicNotificationSubscriptions`.

## حدود مهمة

- هذا الخادم يرسل فقط إلى الأجهزة المسجلة مسبقًا والتي لم يُعطّل تسجيلها.
- لا يرسل إشعارات للأحداث القديمة عند بدء الخدمة، لكنه يبدأ مراقبة الأحداث الجديدة.
- حالات المباريات المعروفة في هذا الإصدار هي `live`, `half_time`, `second_half`, `finished`, `ended`, `completed`. إذا كانت لوحة الإدارة تحفظ قيمًا مختلفة، يجب تعديل الخريطة في `server.js`.
- خدمة Render المجانية قد تتوقف عند عدم النشاط؛ إذا توقف الخادم فلن تكون مراقبة قاعدة البيانات لحظية أثناء توقفه. للإرسال الموثوق المستمر يلزم استضافة دائمة التشغيل أو مشغّل خادم موثوق آخر.
- لم يتم اختبار الإرسال الفعلي من هذه البيئة؛ يلزم النشر بإعدادات حساب الخدمة ثم الاختبار من جهاز حقيقي.
