(() => {
  'use strict';
  const STORAGE_KEY = 'irtiqaa-health-ops-checks-v1';
  const groups = [
    { title: 'الحسابات والصلاحيات', items: [
      'تأكيد هوية مسؤول المنظومة واعتماد بريده رسميًا',
      'اختبار تسجيل الدخول والخروج واستعادة كلمة المرور',
      'اختبار الأدوار ومنع الوصول غير المصرح به'
    ]},
    { title: 'الأمان والخصوصية', items: [
      'مراجعة سياسة الخصوصية والموافقة والاحتفاظ والحذف',
      'اختبار تحديد معدل الطلبات والتحقق من المدخلات',
      'تأكيد عدم حفظ بيانات المرضى في التخزين المحلي'
    ]},
    { title: 'الكوادر والتراخيص', items: [
      'التحقق من هوية ومؤهلات وتراخيص كل مقدم خدمة',
      'اعتماد وصف وظيفي ومسؤوليات ومسار تصعيد لكل دور',
      'تدريب الطاقم على الخصوصية وسلامة المستفيد'
    ]},
    { title: 'المرافق والمعدات', items: [
      'جرد الأصول والمعدات والأثاث المتوفر فعليًا',
      'توثيق الصيانة والمعايرة وسلامة الأجهزة',
      'اعتماد جاهزية المكان والطوارئ ومكافحة العدوى'
    ]},
    { title: 'التكاملات والتشغيل', items: [
      'اختبار إرسال البريد والإشعارات من القنوات الرسمية',
      'اختبار منصة الجلسات عن بُعد والخصوصية والموافقة',
      'اختبار دورة الطلب من الاستلام إلى الإغلاق'
    ]},
    { title: 'الحوكمة والإطلاق', items: [
      'مراجعة المتطلبات النظامية حسب بلد تقديم الخدمة',
      'اختبار النسخ الاحتياطي وسجل التدقيق وخطة الاستعادة',
      'اعتماد خطة إطلاق تدريجي وآلية التقارير اليومية'
    ]}
  ];
  const allTasks = groups.flatMap((g, gi) => g.items.map((text, ti) => ({ id: gi + '-' + ti, text })));
  const root = document.getElementById('checklists');
  const status = document.getElementById('status');
  const safeRead = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (_) { return {}; }
  };
  const save = value => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
    catch (_) { status.textContent = 'تعذر حفظ التأشيرات في هذا المتصفح.'; }
  };
  let checks = safeRead();
  function render() {
    root.replaceChildren();
    groups.forEach((group, gi) => {
      const card = document.createElement('section');
      card.className = 'card';
      const h = document.createElement('h3'); h.textContent = group.title; card.append(h);
      group.items.forEach((task, ti) => {
        const id = gi + '-' + ti;
        const row = document.createElement('div'); row.className = 'task';
        const input = document.createElement('input'); input.type = 'checkbox'; input.id = 'task-' + id; input.checked = checks[id] === true;
        const label = document.createElement('label'); label.htmlFor = input.id; label.textContent = task;
        input.addEventListener('change', () => { checks[id] = input.checked; save(checks); updateProgress(); });
        row.append(input, label); card.append(row);
      });
      root.append(card);
    });
    updateProgress();
  }
  function updateProgress() {
    const done = allTasks.filter(t => checks[t.id] === true).length;
    const pct = Math.round(done / allTasks.length * 100);
    document.getElementById('progress-label').textContent = pct + '%';
    document.getElementById('count-label').textContent = done + ' / ' + allTasks.length;
    document.getElementById('progress-bar').style.width = pct + '%';
  }
  const date = document.getElementById('report-date');
  if (date && !date.value) { const now = new Date(); date.value = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'); }
  document.getElementById('make-report').addEventListener('click', () => {
    const done = allTasks.filter(t => checks[t.id] === true);
    const left = allTasks.filter(t => checks[t.id] !== true);
    const stage = document.getElementById('report-stage').value;
    const report = [
      'مراكز الإرتقاء الفكري الصحية — مسودة تقرير التجهيز',
      'التاريخ: ' + (date.value || 'غير محدد'),
      'مرحلة العمل: ' + stage,
      'مؤشر قائمة التحقق المحلية: ' + done.length + ' من ' + allTasks.length + ' (' + Math.round(done.length / allTasks.length * 100) + '%)',
      '',
      'البنود المؤشر عليها محليًا:',
      ...(done.length ? done.map(t => '• ' + t.text) : ['• لا توجد بنود مؤشر عليها']),
      '',
      'الأعمال المنجزة المضافة يدويًا:',
      document.getElementById('report-done').value.trim() || 'لم تُضف تفاصيل.',
      '',
      'المهام المتبقية المضافة يدويًا:',
      document.getElementById('report-blockers').value.trim() || (left.length ? left.map(t => '• ' + t.text).join('\n') : 'لم تُضف تفاصيل.'),
      '',
      'تنبيه: هذه مسودة محلية وليست تقريرًا مركزيًا معتمدًا، ولا تثبت جاهزية سريرية أو مؤسسية.'
    ].join('\n');
    document.getElementById('report-output').value = report;
    status.textContent = 'تم إنشاء المسودة في هذه الصفحة فقط. راجع محتواها قبل مشاركتها.';
  });
  document.getElementById('copy-report').addEventListener('click', async () => {
    const output = document.getElementById('report-output');
    if (!output.value) { status.textContent = 'أنشئ المسودة أولًا.'; return; }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(output.value);
      else { output.focus(); output.select(); document.execCommand('copy'); }
      status.textContent = 'تم نسخ المسودة إن كان المتصفح يسمح بالنسخ.';
    } catch (_) { output.focus(); output.select(); status.textContent = 'حدد النص وانسخه يدويًا.'; }
  });
  document.getElementById('reset-checks').addEventListener('click', () => {
    checks = {};
    save(checks);
    render();
    status.textContent = 'أُعيد ضبط التأشيرات في هذا المتصفح فقط.';
  });
  render();
})();