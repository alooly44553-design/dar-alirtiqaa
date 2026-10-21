(function () {
  "use strict";
  if (document.getElementById("dar-education-promo-root")) return;
  var style = document.createElement("style");
  style.textContent = [
    "#dar-education-promo-root{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(14px,env(safe-area-inset-bottom));z-index:2147483000;direction:rtl;font-family:'Noto Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif;color:#142337}",
    "#dar-education-promo-root *{box-sizing:border-box}",
    "#dar-education-promo-root .dar-promo-tab{display:flex;align-items:center;gap:9px;border:1px solid #d8bc70;border-radius:999px;padding:11px 15px;background:linear-gradient(135deg,#082f57,#0f667e);color:#fff;box-shadow:0 12px 35px rgba(8,47,87,.25);font:inherit;font-weight:900;cursor:pointer;min-height:46px}",
    "#dar-education-promo-root .dar-promo-tab .dar-promo-pin{display:inline-grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#c89b2c;color:#082f57;font-size:16px}",
    "#dar-education-promo-root .dar-promo-panel{position:absolute;right:0;bottom:calc(100% + 10px);width:min(390px,calc(100vw - 24px));max-height:min(78vh,650px);overflow:auto;background:#fff;border:1px solid #d8e2ed;border-radius:20px;box-shadow:0 24px 70px rgba(8,47,87,.24);padding:0 18px 18px}",
    "#dar-education-promo-root .dar-promo-panel[hidden]{display:none!important}",
    "#dar-education-promo-root .dar-promo-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:17px 0 12px;border-bottom:1px solid #e4ebf2}",
    "#dar-education-promo-root .dar-promo-kicker{display:inline-block;background:#fff5d6;color:#70551a;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:900}",
    "#dar-education-promo-root .dar-promo-title{font-size:19px;line-height:1.5;color:#082f57;margin:8px 0 0;font-weight:900}",
    "#dar-education-promo-root .dar-promo-close{border:0;background:#eef3f8;color:#173b5c;border-radius:10px;width:34px;height:34px;font-size:21px;cursor:pointer;flex:0 0 auto}",
    "#dar-education-promo-root .dar-promo-copy{font-size:13px;color:#52647a;line-height:1.85;margin:12px 0}",
    "#dar-education-promo-root .dar-promo-list{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}",
    "#dar-education-promo-root .dar-promo-list span{display:block;background:#f3f7fb;border:1px solid #e0e8f0;border-radius:10px;padding:8px 9px;font-size:12px;font-weight:800;color:#173b5c}",
    "#dar-education-promo-root .dar-promo-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}",
    "#dar-education-promo-root .dar-promo-link{display:flex;align-items:center;justify-content:center;text-align:center;text-decoration:none;border-radius:11px;padding:10px 9px;font-size:12px;font-weight:900;line-height:1.5;background:#082f57;color:#fff}",
    "#dar-education-promo-root .dar-promo-link.gold{background:#c89b2c;color:#082f57}",
    "#dar-education-promo-root .dar-promo-phone-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}",
    "#dar-education-promo-root .dar-promo-phone{direction:ltr;flex:1;min-width:130px;text-align:center;border:1px solid #dce5ee;border-radius:10px;padding:9px 8px;text-decoration:none;color:#082f57;font-size:14px;font-weight:900}",
    "#dar-education-promo-root .dar-promo-note{font-size:11px;color:#64748b;line-height:1.7;margin:12px 0 0}",
    "@media(max-width:480px){#dar-education-promo-root{right:10px;bottom:max(10px,env(safe-area-inset-bottom))}#dar-education-promo-root .dar-promo-tab{padding:9px 12px;font-size:12px;min-height:42px}#dar-education-promo-root .dar-promo-panel{width:calc(100vw - 20px);padding:0 14px 14px}#dar-education-promo-root .dar-promo-title{font-size:17px}}",
    "@media(prefers-reduced-motion:reduce){#dar-education-promo-root *{scroll-behavior:auto!important;transition:none!important}}"
  ].join("");
  document.head.appendChild(style);
  var root = document.createElement("div");
  root.id = "dar-education-promo-root";
  root.innerHTML = [
    '<button class="dar-promo-tab" type="button" aria-expanded="false" aria-controls="dar-education-promo-panel">',
    '<span class="dar-promo-pin" aria-hidden="true">📌</span><span>الإعلان التعليمي</span></button>',
    '<aside class="dar-promo-panel" id="dar-education-promo-panel" hidden role="region" aria-label="الإعلان التعريفي المثبت">',
    '<div class="dar-promo-panel-head"><div><span class="dar-promo-kicker">منشور تعريفي ثابت • للقراءة فقط</span>',
    '<h2 class="dar-promo-title">منظومة مدارس ومراكز دار الإرتقاء الفكري التعليمية</h2></div>',
    '<button class="dar-promo-close" type="button" aria-label="طي الإعلان">×</button></div>',
    '<p class="dar-promo-copy">تعليم شامل ومسارات متعددة من الطفولة والتأسيس إلى التعليم الأساسي والعام، والتعليم الجامعي والعالي، والتدريب المهني والتقني، والقرآن والدراسات الإسلامية، والتقوية واللغة العربية والتأهيل، والإرشاد الأكاديمي.</p>',
    '<div class="dar-promo-list"><span>👶 الطفولة والتأسيس</span><span>📚 التعليم العام</span><span>🎓 التعليم العالي</span><span>🛠️ التدريب المهني</span><span>📖 القرآن والإسلامية</span><span>✍️ التقوية واللغات</span><span>🧭 الإرشاد الأكاديمي</span><span>💻 المهارات الرقمية</span></div>',
    '<p class="dar-promo-copy">استكشف المسارات، وتعرّف على متطلبات كل برنامج، وتحقق من توفره وشروطه قبل تقديم الطلب.</p>',
    '<div class="dar-promo-actions"><a class="dar-promo-link gold" href="/education-announcement.html">قراءة الإعلان كاملًا</a>',
    '<a class="dar-promo-link" href="https://alirtiqaa-educational-platform.vercel.app/">استكشف المنصة</a></div>',
    '<div class="dar-promo-phone-row"><a class="dar-promo-phone" href="tel:+966538216050">☎ 0538216050</a><a class="dar-promo-phone" href="tel:+966538838891">☎ 0538838891</a></div>',
    '<p class="dar-promo-note">استقبال الطلبات عبر النماذج المنشورة فوري، لكن فتح كل برنامج ومجموعته يتم تدريجيًا بحسب الإقبال والطاقم المؤهل والطاقة الاستيعابية وبعد اعتماد الخطة والرسوم. إرسال الطلب لا يضمن القبول أو توفر مقعد.</p>',
    '</aside>'
  ].join("");
  document.body.appendChild(root);
  var tab = root.querySelector(".dar-promo-tab");
  var panel = root.querySelector(".dar-promo-panel");
  var close = root.querySelector(".dar-promo-close");
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