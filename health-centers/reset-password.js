import { createAuthClient } from 'https://esm.sh/@neondatabase/auth@0.6.0-beta?bundle';

const AUTH_BASE_URL = 'https://ep-dark-frost-b3sqm6rz.neonauth.c-4.ap-southeast-1.aws.neon.tech/neondb/auth';
const auth = createAuthClient(AUTH_BASE_URL);
const form = document.querySelector('#reset-form');
const password = document.querySelector('#reset-password');
const confirmPassword = document.querySelector('#reset-password-confirm');
const submit = document.querySelector('#reset-submit');
const message = document.querySelector('#reset-message');

function showMessage(text, kind = 'info') {
  message.textContent = text;
  message.dataset.kind = kind;
  message.hidden = false;
}

function getResetToken() {
  const url = new URL(window.location.href);
  const queryToken = url.searchParams.get('token');
  if (queryToken) return queryToken;
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);
  const hashToken = hashParams.get('token');
  if (hashToken) return hashToken;
  const segments = url.pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (last && last !== 'reset-password.html' && /^[A-Za-z0-9_-]{20,}$/.test(last)) return last;
  return '';
}

const token = getResetToken();
if (!window.isSecureContext) {
  showMessage('افتح صفحة الاستعادة عبر اتصال HTTPS آمن.', 'error');
} else if (!token) {
  showMessage('رابط الاستعادة غير مكتمل أو انتهت صلاحيته. ارجع إلى صفحة الدخول واطلب رسالة جديدة.', 'error');
} else {
  form.hidden = false;
  showMessage('الرابط موجود. أدخل كلمة مرور جديدة لإكمال الاستعادة.');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!token) {
    showMessage('رابط الاستعادة غير صالح. اطلب رسالة استعادة جديدة.', 'error');
    return;
  }
  if (password.value.length < 8) {
    showMessage('يجب ألا تقل كلمة المرور عن 8 أحرف.', 'error');
    return;
  }
  if (password.value !== confirmPassword.value) {
    showMessage('كلمتا المرور غير متطابقتين. أعد كتابتهما.', 'error');
    confirmPassword.focus();
    return;
  }
  submit.disabled = true;
  submit.textContent = 'جارٍ حفظ كلمة المرور…';
  try {
    const result = await auth.resetPassword({ newPassword: password.value, token });
    if (result?.error) throw new Error('reset failed');
    password.value = '';
    confirmPassword.value = '';
    form.hidden = true;
    showMessage('تم إرسال طلب تحديث كلمة المرور بنجاح. يمكنك العودة إلى صفحة الدخول وتجربة كلمة المرور الجديدة. تذكّر أن تغيير كلمة المرور لا يمنح صلاحيات الإدارة.', 'success');
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('token');
    cleanUrl.hash = '';
    window.history.replaceState({}, document.title, cleanUrl.pathname);
  } catch (_) {
    showMessage('تعذر تحديث كلمة المرور. قد يكون الرابط منتهي الصلاحية أو غير صالح. ارجع إلى صفحة الدخول واطلب رسالة استعادة جديدة.', 'error');
  } finally {
    submit.disabled = false;
    submit.textContent = 'حفظ كلمة المرور الجديدة';
  }
});
