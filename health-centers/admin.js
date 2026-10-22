import { createAuthClient } from 'https://esm.sh/@neondatabase/auth@0.6.0-beta?bundle';

const AUTH_BASE_URL = 'https://ep-dark-frost-b3sqm6rz.neonauth.c-4.ap-southeast-1.aws.neon.tech/neondb/auth';
const auth = createAuthClient(AUTH_BASE_URL);

const form = document.querySelector('#admin-login-form');
const loginButton = document.querySelector('#admin-login-button');
const message = document.querySelector('#admin-message');
const accountPanel = document.querySelector('#admin-account');
const signoutButton = document.querySelector('#admin-signout-button');
const forgotButton = document.querySelector('#admin-forgot-button');
const registerButton = document.querySelector('#admin-register-button');
const authOptions = document.querySelector('#admin-auth-options');
const otpPanel = document.querySelector('#admin-email-verification');
const sendOtpButton = document.querySelector('#admin-send-otp-button');
const verifyOtpButton = document.querySelector('#admin-verify-otp-button');
const cancelOtpButton = document.querySelector('#admin-cancel-otp-button');
const otpInput = document.querySelector('#admin-email-otp');
let otpEmail = '';

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
  forgotButton.disabled = busy;
  registerButton.disabled = busy;
  if (sendOtpButton) sendOtpButton.disabled = busy;
  if (verifyOtpButton) verifyOtpButton.disabled = busy;
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
  authOptions.hidden = true;
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
      throw new Error('تم تسجيل الدخول، لكن هذا الحساب غير معتمد لإدارة المراكز. يمكنك توثيق البريد أدناه؛ التوثيق وحده لا يمنح صلاحيات الإدارة.');
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
  } catch (error) {
    const safeMessage = typeof error?.message === 'string' && error.message.length <= 220
      ? error.message
      : 'تعذر إكمال الدخول أو التحقق من الصلاحيات. إذا كان الحساب غير معتمد، تواصل مع المسؤول الرسمي.';
    showMessage(safeMessage, 'error');
  } finally {
    setBusy(false);
  }
});

signoutButton.addEventListener('click', async () => {
  signoutButton.disabled = true;
  try { await auth.signOut(); } catch (_) {}
  form.hidden = false;
  authOptions.hidden = false;
  accountPanel.hidden = true;
  document.querySelector('#admin-password').value = '';
  showMessage('تم إنهاء جلسة الدخول على هذا المتصفح.');
  signoutButton.disabled = false;
});

if (!window.isSecureContext) {
  showMessage('يجب فتح بوابة الإدارة عبر اتصال HTTPS آمن.', 'error');
}


forgotButton.addEventListener('click', async () => {
  const email = document.querySelector('#admin-email').value.trim().toLowerCase();
  if (!email) {
    showMessage('أدخل بريدك الإلكتروني أولًا، ثم اضغط «نسيت كلمة المرور؟».', 'error');
    document.querySelector('#admin-email').focus();
    return;
  }
  setBusy(true);
  showMessage('جارٍ طلب رسالة استعادة كلمة المرور…');
  try {
    const result = await auth.requestPasswordReset({
      email,
      redirectTo: window.location.origin + '/reset-password.html'
    });
    if (result?.error) throw new Error('Password reset request failed');
    showMessage('إذا كان البريد مسجلًا وكانت خدمة البريد مهيأة، فستصلك تعليمات إعادة تعيين كلمة المرور. تحقق من صندوق الوارد والرسائل غير المرغوب فيها.', 'success');
  } catch (_) {
    showMessage('تعذر إكمال طلب الاستعادة حاليًا. تحقق من إعدادات خدمة البريد في مزود المصادقة أو حاول لاحقًا.', 'error');
  } finally {
    setBusy(false);
  }
});

registerButton.addEventListener('click', async () => {
  const email = document.querySelector('#admin-email').value.trim().toLowerCase();
  const password = document.querySelector('#admin-password').value;
  if (!email) {
    showMessage('أدخل البريد الإلكتروني الذي تملكه لإنشاء الحساب.', 'error');
    document.querySelector('#admin-email').focus();
    return;
  }
  if (!password || password.length < 8) {
    showMessage('أنشئ كلمة مرور لا تقل عن 8 أحرف، ويفضل أن تجمع بين أحرف كبيرة وصغيرة وأرقام ورموز.', 'error');
    document.querySelector('#admin-password').focus();
    return;
  }
  setBusy(true);
  showMessage('جارٍ إنشاء حساب الدخول…');
  try {
    const result = await auth.signUp.email({
      email,
      password,
      name: email.split('@')[0]
    });
    if (result?.error) throw new Error('Sign up failed');
    showMessage('تم إرسال طلب إنشاء الحساب إذا كانت الخدمة تسمح بذلك. الحساب الجديد لا يحصل على صلاحيات الإدارة تلقائيًا؛ يجب اعتماد الحساب وربطه بدور رسمي.', 'success');
    document.querySelector('#admin-password').value = '';
  } catch (_) {
    showMessage('تعذر إنشاء الحساب. تحقق من البريد وكلمة المرور، ومن أن التسجيل بالبريد مفعّل لدى مزود المصادقة.', 'error');
  } finally {
    setBusy(false);
  }
});


function showOtpPanel(email) {
  otpEmail = email;
  otpPanel.hidden = false;
  form.hidden = true;
  authOptions.hidden = true;
  otpInput.value = '';
  showMessage('يمكنك طلب رمز تحقق لإثبات ملكية البريد. لن تتغير صلاحيات الإدارة بمجرد التحقق.', 'info');
}

sendOtpButton.addEventListener('click', async () => {
  if (!otpEmail) {
    showMessage('أعد إدخال البريد الإلكتروني أولًا.', 'error');
    return;
  }
  setBusy(true);
  try {
    const result = await auth.emailOtp.sendVerificationOtp({
      email: otpEmail,
      type: 'email-verification'
    });
    if (result?.error) throw new Error('تعذر إرسال الرمز. تحقق من إعدادات البريد في خدمة المصادقة ثم أعد المحاولة.');
    showMessage('إذا كان البريد مدعومًا للتحقق، فسيصلك رمز. افحص الوارد والرسائل غير المرغوب فيها.', 'success');
  } catch (_) {
    showMessage('تعذر إرسال رمز التحقق حاليًا. يلزم التأكد من تفعيل التحقق بالبريد ومزوّد الإرسال في Neon Auth.', 'error');
  } finally {
    setBusy(false);
  }
});

verifyOtpButton.addEventListener('click', async () => {
  const otp = otpInput.value.trim();
  if (!otpEmail || !/^[0-9]{6,12}$/.test(otp)) {
    showMessage('أدخل رمز التحقق الرقمي كما وصلك في البريد.', 'error');
    return;
  }
  setBusy(true);
  try {
    const result = await auth.emailOtp.verifyEmail({ email: otpEmail, otp });
    if (result?.error) throw new Error('رمز التحقق غير صحيح أو منتهي الصلاحية. اطلب رمزًا جديدًا.');
    const tokenResult = await auth.token();
    const token = tokenResult?.data?.token;
    if (!token || tokenResult?.error) throw new Error('تم التحقق من الرمز، لكن تعذر تأكيد جلسة الدخول.');
    const response = await fetch('./api/health/admin/link-verified-identity', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ email: otpEmail }),
      cache: 'no-store',
      credentials: 'omit'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.message || 'تعذر ربط الهوية. قد تحتاج خدمة المصادقة إلى إصدار جلسة تتضمن حالة التحقق.');
    }
    otpPanel.hidden = true;
    form.hidden = false;
    authOptions.hidden = false;
    showMessage(data.active
      ? 'تم توثيق البريد وربط الهوية. أعد تسجيل الدخول للتحقق من الصلاحيات.'
      : 'تم توثيق البريد وربط الهوية، لكن الحساب الإداري ما زال بانتظار الاعتماد الرسمي. لم تُمنح أي صلاحيات.', 'success');
  } catch (error) {
    showMessage(error?.message || 'تعذر إكمال التحقق. حاول إرسال رمز جديد.', 'error');
  } finally {
    setBusy(false);
  }
});

cancelOtpButton.addEventListener('click', () => {
  otpPanel.hidden = true;
  form.hidden = false;
  authOptions.hidden = false;
  otpInput.value = '';
  otpEmail = '';
  showMessage('أُغلق نموذج التحقق. يمكنك متابعة تسجيل الدخول.');
});

