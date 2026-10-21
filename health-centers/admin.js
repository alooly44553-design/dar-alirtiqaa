import { createAuthClient } from 'https://esm.sh/@neondatabase/auth@0.6.0-beta?bundle';

const AUTH_BASE_URL = 'https://ep-dark-frost-b3sqm6rz.neonauth.c-4.aws.neon.tech/neondb/auth';
const auth = createAuthClient(AUTH_BASE_URL);

const form = document.querySelector('#admin-login-form');
const loginButton = document.querySelector('#admin-login-button');
const message = document.querySelector('#admin-message');
const accountPanel = document.querySelector('#admin-account');
const signoutButton = document.querySelector('#admin-signout-button');

const roleLabels = {
  owner: 'مالك المنظومة',
  admin: 'مسؤول المنظومة',
  auditor: 'مراجع تدقيق',
  manager: 'مدير مركز',
  staff: 'موظف مركز',
  viewer: 'مشاهد بصلاحية محدودة'
};

function showMessage(text, kind = 'info') {
  message.textContent = text;
  message.dataset.kind = kind;
  message.hidden = false;
}

function setBusy(busy) {
  loginButton.disabled = busy;
  loginButton.textContent = busy ? 'جارٍ التحقق…' : 'تسجيل الدخول والتحقق من الصلاحية';
}

function renderAccount(account) {
  document.querySelector('#admin-display-name').textContent = account.displayName || '—';
  document.querySelector('#admin-role').textContent = roleLabels[account.role] || account.role || '—';
  document.querySelector('#admin-scope').textContent = account.type === 'platform_admin'
    ? 'إدارة المنظومة'
    : (account.centerName || 'المركز المعيّن');
  document.querySelector('#admin-permissions').textContent = Array.isArray(account.permissions) && account.permissions.length
    ? account.permissions.join('، ')
    : 'لا توجد صلاحيات مفعّلة';
  accountPanel.hidden = false;
  form.hidden = true;
  showMessage('تم التحقق من الحساب والصلاحيات بنجاح.', 'success');
}

async function getAccessToken() {
  const result = await auth.token();
  if (result?.error || !result?.data?.token) throw new Error('تعذر الحصول على رمز جلسة موثوق.');
  return result.data.token;
}

async function checkAuthorization() {
  const token = await getAccessToken();
  const response = await fetch('./api/health/admin/me', {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    cache: 'no-store',
    credentials: 'omit'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || !data.account) {
    if (response.status === 403) {
      await auth.signOut().catch(() => {});
      throw new Error('تم تسجيل الدخول، لكن هذا الحساب غير معتمد لإدارة المراكز. لم تُمنح أي صلاحيات.');
    }
    if (response.status === 401) {
      throw new Error('تعذر التحقق من الجلسة. تحقق من البريد وكلمة المرور ثم أعد المحاولة.');
    }
    throw new Error(data.message || 'خدمة التحقق غير متاحة حاليًا.');
  }
  return data.account;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.querySelector('#admin-email').value.trim().toLowerCase();
  const password = document.querySelector('#admin-password').value;
  if (!email || !password) {
    showMessage('أدخل البريد الإلكتروني وكلمة المرور.', 'error');
    return;
  }
  setBusy(true);
  accountPanel.hidden = true;
  showMessage('جارٍ التحقق من بيانات الدخول والصلاحيات…');
  try {
    const result = await auth.signIn.email({ email, password });
    if (result?.error) {
      showMessage('تعذر تسجيل الدخول. تحقق من البيانات وحالة الحساب ثم أعد المحاولة.', 'error');
      return;
    }
    const account = await checkAuthorization();
    renderAccount(account);
    document.querySelector('#admin-password').value = '';
  } catch (_) {
    showMessage('تعذر إكمال الدخول أو التحقق من الصلاحيات. إذا كان الحساب غير معتمد، تواصل مع المسؤول الرسمي.', 'error');
  } finally {
    setBusy(false);
  }
});

signoutButton.addEventListener('click', async () => {
  signoutButton.disabled = true;
  try { await auth.signOut(); } catch (_) {}
  form.hidden = false;
  accountPanel.hidden = true;
  document.querySelector('#admin-password').value = '';
  showMessage('تم إنهاء جلسة الدخول على هذا المتصفح.');
  signoutButton.disabled = false;
});

if (!window.isSecureContext) {
  showMessage('يجب فتح بوابة الإدارة عبر اتصال HTTPS آمن.', 'error');
}
