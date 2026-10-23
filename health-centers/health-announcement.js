(function () {
  "use strict";
  if (document.getElementById("irtiqaa-health-promo-root")) return;
  var style = document.createElement("style");
  style.textContent = [
    "#irtiqaa-health-promo-root{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(14px,env(safe-area-inset-bottom));z-index:2147483000;direction:rtl;font-family:'Noto Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif;color:#18323a}",
    "#irtiqaa-health-promo-root *{box-sizing:border-box}",
    "#irtiqaa-health-promo-root .ih-promo-tab{display:flex;align-items:center;gap:9px;border:1px solid #d7bd79;border-radius:999px;padding:11px 15px;background:linear-gradient(135deg,#0b3b46,#0a6570);color:#fff;box-shadow:0 12px 35px rgba(10,69,80,.25);font:inherit;font-weight:900;cursor:pointer;min-height:46px}",
    "#irtiqaa-health-promo-root .ih-promo-mark{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#f0cf82;color:#123744;font-size:19px;line-height:1}",
    "#irtiqaa-health-promo-root .ih-promo-panel{position:absolute;right:0;bottom:calc(100% + 10px);width:min(390px,calc(100vw - 24px));max-height:min(78vh,650px);overflow:auto;background:#fff;border:1px solid #dce8e8;border-radius:20px;box-shadow:0 24px 70px rgba(10,69,80,.24);padding:0 18px 18px}",
    "#irtiqaa-health-promo-root .ih-promo-panel[hidden]{display:none!important}",
    "#irtiqaa-health-promo-root .ih-promo-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:17px 0 12px;border-bottom:1px solid #e4ebeb}",
    "#irtiqaa-health-promo-root .ih-promo-kicker{display:inline-block;background:#fff5d9;color:#765a13;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:900}",
    "#irtiqaa-health-promo-root .ih-promo-title{font-size:19px;line-height:1.5;color:#123744;margin:8px 0 0;font-weight:900}",
    "#irtiqaa-health-promo-root .ih-promo-close{border:0;background:#edf4f4;color:#21464e;border-radius:10px;width:34px;height:34px;font-size:21px;cursor:pointer;flex:0 0 auto}",
    "#irtiqaa-health-promo-root .ih-promo-copy{font-size:13px;color:#526970;line-height:1.85;margin:12px 0}",
    "#irtiqaa-health-promo-root .ih-promo-tags{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}",
    "#irtiqaa-health-promo-root .ih-promo-tags span{display:block;background:#edf6f5;border:1px solid #dce8e8;border-radius:10px;padding:8px 9px;font-size:12px;font-weight:800;color:#21464e}",
    "#irtiqaa-health-promo-root .ih-promo-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}",
    "#irtiqaa-health-promo-root .ih-promo-link{display:flex;align-items:center;justify-content:center;text-align:center;text-decoration:none;border-radius:11px;padding:10px 9px;font-size:12px;font-weight:900;line-height:1.5;background:#0a4550;color:#fff}",
    "#irtiqaa-health-promo-root .ih-promo-link.gold{background:#f0cf82;color:#123744}",
    "#irtiqaa-health-promo-root .ih-promo-phone-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}",
    "#irtiqaa-health-promo-root .ih-promo-phone{direction:ltr;flex:1;min-width:130px;text-align:center;border:1px solid #dce8e8;border-radius:10px;padding:9px 8px;text-decoration:none;color:#123744;font-size:14px;font-weight:900}",
    "#irtiqaa-health-promo-root .ih-promo-note{font-size:11px;color:#647a7d;line-height:1.7;margin:12px 0 0}",
    "@media(max-width:480px){#irtiqaa-health-promo-root{right:10px;bottom:max(10px,env(safe-area-inset-bottom))}#irtiqaa-health-promo-root .ih-promo-tab{padding:9px 12px;font-size:12px;min-height:42px}#irtiqaa-health-promo-root .ih-promo-panel{width:calc(100vw - 20px);padding:0 14px 14px}#irtiqaa-health-promo-root .ih-promo-title{font-size:17px}}",
    "@media(prefers-reduced-motion:reduce){#irtiqaa-health-promo-root *{scroll-behavior:auto!important;transition:none!important}}"
  ].join("");
  document.head.appendChild(style);
  var root = document.createElement("div");
  root.id = "irtiqaa-health-promo-root";
  root.innerHTML = [
    '<button class="ih-promo-tab" type="button" aria-expanded="false" aria-controls="irtiqaa-health-promo-panel">',
    '<span class="ih-promo-mark" aria-hidden="true">✚</span><span>الإعلان الصحي</span></button>',
    '<aside class="ih-promo-panel" id="irtiqaa-health-promo-panel" hidden role="region" aria-label="الإعلان التعريفي للمراكز الصحية">',
    '<div class="ih-promo-head"><div><span class="ih-promo-kicker">إعلان تعريفي ثابت • للقراءة فقط</span>',
    '<h2 class="ih-promo-title">مراكز الإرتقاء الفكري الصحية</h2></div>',
    '<button class="ih-promo-close" type="button" aria-label="طي الإعلان">×</button></div>',
    '<p class="ih-promo-copy">صحتك تستحق الاهتمام. تعرّف على دليل التخصصات ومسارات التوعية والرعاية وتنظيم الطواقم والجلسات والتجهيزات. تُعرض المجالات الموسعة للتخطيط ولا تعني توفر عيادة أو مختبر أو مقدم خدمة بالفعل؛ تحقق من المختص المرخّص قبل أي موعد أو دفع.</p>',
    '<div class="ih-promo-tags"><span>🩺 دليل التخصصات</span><span>💚 صحة الأسرة</span><span>🧠 الوعي النفسي</span><span>🌿 الوقاية والتثقيف</span><span>♙ تخطيط الطواقم</span><span>◉ جلسات قيد التجهيز</span></div>',
    '<div class="ih-promo-actions"><a class="ih-promo-link gold" href="./health-announcement.html">قراءة الإعلان كاملًا</a>',
    '<a class="ih-promo-link" href="https://al-irtiqaa-health-smart-global.vercel.app/?utm_source=chatgpt.com#home">فتح تطبيق المركز</a></div>',
    '<div class="ih-promo-phone-row"><a class="ih-promo-phone" href="tel:+966538216050">☎ 0538216050</a><a class="ih-promo-phone" href="tel:+966538838891">☎ 0538838891</a></div>',
    '<p class="ih-promo-note">تنويه: الواجهة تنظيمية وسجلاتها محلية فقط ولا تستقبل الطلبات مركزيًا. الأدوار الافتراضية ليست أطباء فعليين، والجلسات لا تنشأ تلقائيًا. تحقّق من توفر الخدمة والسعر والترخيص مباشرةً، ولا ترسل معلومات صحية حساسة عبر الإعلان.</p>',
    '</aside>'
  ].join("");
  document.body.appendChild(root);
  var tab = root.querySelector(".ih-promo-tab");
  var panel = root.querySelector(".ih-promo-panel");
  var close = root.querySelector(".ih-promo-close");
  function setOpen(open) {
    panel.hidden = !open;
    tab.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) close.focus({ preventScroll: true });
    else tab.focus({ preventScroll: true });
  }
  tab.addEventListener("click", function () { setOpen(panel.hidden); });
  close.addEventListener("click", function () { setOpen(false); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) setOpen(false);
  });
})();