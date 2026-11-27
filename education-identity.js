/* إزالة لوحة الهوية الكبيرة من صفحات المحتوى، مع توحيد روابط العودة إلى الصفحة الرئيسية. */
(()=>{
  document.querySelectorAll('[data-education-identity]').forEach(el=>el.remove());
  const official='https://alirtiqaa-educational-platform.vercel.app/';
  document.querySelectorAll('a[href]').forEach(a=>{
    try{
      const u=new URL(a.href,location.href);
      if(u.origin==='https://alirtiqaa-educational-platform.vercel.app' && u.pathname==='/' && !u.search && !u.hash){
        a.href=official+'?utm_source=chatgpt.com#leadership';
      }
    }catch(_){}
  });
})();
