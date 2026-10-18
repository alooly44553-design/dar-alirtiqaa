# تقرير جاهزية ربط قنوات دار الإرتقاء الفكري

تاريخ المراجعة: 18 أكتوبر 2026  
الموقع: https://alirtiqaa-educational-platform.vercel.app/

## النتيجة

لا يوجد رابط واحد رسمي يمنح ChatGPT تلقائيًا جميع صلاحيات النشر واستقبال الرسائل والرد على WhatsApp وTelegram وفيسبوك وبقية القنوات. يجب تفويض كل حساب وفق الواجهة الرسمية، وإعداد webhook/permissions، ثم اختبار الرسائل والنشر فعليًا.

## حالة المشروع وقت التدقيق

- متغيرات Vercel التي تمت مراجعتها لا تتضمن متغيرات مخصصة لWhatsApp Business أو Telegram Bot أو OpenAI API.
- ملفات API التي تمت مراجعتها تخص خدمات التعليم والتسجيل؛ لم يظهر مسار webhook قائم لواتساب أو تليجرام.
- Metricool متصل بعلامة «مدارس دار الإرتقاء الفكري». عينة المنشورات المجدولة تستهدف Facebook وLinkedIn.
- راجعت 47 عنصرًا في جدول Metricool للفترة 18 أكتوبر–16 ديسمبر 2026: 20 مسودة، و27 عنصرًا مجدولًا مع النشر التلقائي، و46 عنصرًا بلا وسائط مرفقة، مع 20 مجموعة من النصوص المتكررة مرتين.
- لم أعدّل الجدول ولم أحذف أي منشورات خلال التدقيق.

## الروابط الرسمية للبدء

- WhatsApp Business Platform: https://business.whatsapp.com/developers/developer-hub/
- Meta for Developers: https://developers.facebook.com/
- Telegram BotFather: https://t.me/BotFather
- Telegram Bot API: https://core.telegram.org/bots/api
- Telegram Webhooks: https://core.telegram.org/bots/webhooks
- تقويم Metricool: https://app.metricool.com/planner/calendar?blogId=7335637
- تصميم Canva الحالي: https://www.canva.com/d/pwHB5yc5EL14j6w
- دليل OpenAI لربط MCP مخصص: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt

## واتساب: القناة ليست صندوق الرسائل

قنوات WhatsApp Channel هي مساحة تحديثات أحادية الاتجاه؛ لا يستطيع المتابعون الرد مباشرة على تحديثات القناة. وثائق WhatsApp Business Platform تتناول محادثات العملاء عبر Cloud API، ولا تقدم مسارًا رسميًا منشورًا لإدارة منشورات قناة واتساب العامة. لذلك تُنشر تحديثات القناة من تطبيق واتساب أو بواسطة مشرف مفوّض، أما الردود الآلية فتحتاج مسارًا مستقلًا لمحادثات WhatsApp Business.

مراجع:
- https://faq.whatsapp.com/809740894165112
- https://faq.whatsapp.com/360977646301595
- https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api

## متطلبات WhatsApp Business

1. حساب Meta Business وWhatsApp Business Account ورقم عمل مؤهل.
2. Meta App وصلاحيات ومعرّفات الحساب والرقم.
3. رمز وصول محفوظ كمتغير سري في Vercel، لا في GitHub أو HTML أو المحادثات.
4. endpoint webhook للتحقق من الرسائل واستقبالها، ثم إرسال رد عبر Cloud API.
5. سياسات واضحة لقوالب الرسائل ونافذة خدمة العملاء والتصعيد لموظف.

## متطلبات Telegram

1. إنشاء بوت من https://t.me/BotFather.
2. حفظ bot token في متغير سري بVercel وعدم مشاركته.
3. إضافته إلى القناة مديرًا بصلاحية النشر، إذا كان المطلوب نشر تحديثات.
4. إضافته إلى المجموعات وضبط الخصوصية والصلاحيات حتى يستقبل نوع الرسائل المرغوب.
5. إعداد webhook على HTTPS والتحقق من secret token واختبار الاستقبال والرد.

المراجع:
- https://core.telegram.org/bots
- https://core.telegram.org/bots/api
- https://core.telegram.org/bots/webhooks

مسار webhook المقترح بعد تنفيذ الكود والتكوين (غير موجود/غير مفعّل حاليًا):
https://alirtiqaa-educational-platform.vercel.app/api/connectors/telegram/webhook

## ChatGPT والردود الآلية

توضح وثائق OpenAI أن التطبيقات المخصصة ذات إجراءات الكتابة تحتاج خادم MCP موثقًا وصلاحيات متوافقة مع خطة ChatGPT ومساحة العمل. الربط لا يتم بمجرد فتح رابط القناة. يمكن كذلك تشغيل أتمتة مستقلة على الخادم تستخدم OpenAI API، وهذا يحتاج مفتاح API وفوترة منفصلة، إضافة إلى إعداد مفاتيح القنوات.

مرجع:
https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt

## ضوابط الرد الآلي والنشر

- الرد على الأسئلة المتكررة من معلومات اعتمدتها الإدارة فقط.
- عدم اختراع رسوم أو مواعيد أو مقاعد أو شهادات أو ضمان قبول.
- منع تكرار الردود والرسائل الحلقية وتسجيل حالات الفشل.
- إحالة الشكاوى، والمدفوعات، والنزاعات، وشؤون الأطفال، والبيانات الحساسة، والأسئلة غير المؤكدة إلى موظف.
- إرفاق التصاميم والوسائط ومراجعة المحتوى المكرر قبل النشر، وعدم اعتبار التصميم في Canva دليلًا على إرفاقه في Metricool.
- لا تُعتبر أي قناة متصلة إلا بعد اختبار موثق ناجح.

## ترتيب المجالات المعتمد

الطفولة والتأسيس؛ التعليم الأساسي والعام؛ التعليم الجامعي والعالي؛ التدريب المهني والتقني؛ القرآن والإسلامية؛ التقوية والعربية والتأهيل؛ الإرشاد الأكاديمي؛ ثم بقية المجالات التعليمية والتربوية والترفيهية.

**الحالة:** هذا الملف نقطة بدء واحدة وروابط رسمية، وليس اتصالًا مفعلًا. لا توجد بيانات دخول أو مفاتيح سرية داخل الملف، ولم يُنشر محتوى أو يتغير جدول Metricool أثناء المراجعة.
