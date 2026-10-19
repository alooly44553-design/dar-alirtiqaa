const BUSINESS_SCOPE_PATTERNS = [
  /أعمال\s+الإرتقاء\s+الفكري|أعمال\s+الارتقاء\s+الفكري|بوابة\s+أعمال\s+الإرتقاء/iu,
  /مراكز?\s+(?:الإرتقاء\s+الفكري\s+)?الصحي(?:ة|ة)?|مركز\s+طبي|مراكز\s+طبية|عياد(?:ة|ات)|سجل\s+المرضى|موعد\s+طبي|مريض|مرضى|تشخيص\s+طبي|وصفة\s+طبية|خدمة\s+صحية|خدمات\s+صحية|healthcare\s+(?:center|appointment|record)|medical\s+(?:clinic|center|appointment)|patient\s+record/iu,
  /خدمات?\s+حكومي(?:ة|ة)|خدمات?\s+عام(?:ة|ة)|معاملة\s+حكومية|الجهات\s+الحكومية|جواز\s+(?:السفر)?|طلب\s+إقامة|تصريح\s+حكومي|المرور|هوية\s+وطنية|government\s+(?:service|transaction)|public\s+service|passport\s+application|residency\s+permit|national\s+id/iu,
  /بطاقات?\s+(?:الإرتقاء|الارتقاء)\s+الفكري(?:ة)?\s+النموذجي(?:ة)?|بطاقة\s+(?:موظف|زائر|متعاقد)|إصدار\s+بطاقة|تجديد\s+بطاقة|سجل\s+البطاقات|card\s+issuance|employee\s+badge|print\s+(?:an?\s+)?id\s+card/iu
];

const EDUCATION_CONTEXT_PATTERN = /المنصة\s+التعليمية|التعليم|تعليمي|مدرس(?:ة|ي)|طلاب?|طالبات|متعلمين?|معلمين?|معلمات|دروس?|حصة|حصص|منهج|واجب|اختبار|تقييم|قبول|تسجيل|رسوم\s+دراسية|ولي\s+أمر|فصل\s+دراسي|مقرر|مادة\s+دراسية|بوابة\s+الطالب|بوابة\s+المعلم|نشاط\s+تعليمي|فعالية\s+تعليمية|school|student|teacher|lesson|classroom|homework|exam|curriculum|enrollment|admission|education(?:al)?\s+platform|school\s+event/iu;

export const EDUCATION_SCOPE_REPLY =
  "هذا البوت مخصص حصريًا لمهام المنصة التعليمية: القبول والتسجيل، الدروس والواجبات، شؤون المتعلمين والمعلمين، والإرشاد والفعاليات التعليمية. لا يعالج هذا البوت الطلب الحالي.";

export function isBusinessOperationsRequest(value) {
  const text = String(value || "").normalize("NFKC").trim();
  return Boolean(text) && BUSINESS_SCOPE_PATTERNS.some(pattern => pattern.test(text));
}

export function hasEducationPlatformContext(value) {
  return EDUCATION_CONTEXT_PATTERN.test(String(value || "").normalize("NFKC"));
}

export function isEducationPlatformRequest(value) {
  return !isBusinessOperationsRequest(value) && hasEducationPlatformContext(value);
}
