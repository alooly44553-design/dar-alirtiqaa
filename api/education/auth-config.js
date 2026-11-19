import { getEducationSupabaseConfig } from "../../lib/education-portal-auth.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const { base, key } = getEducationSupabaseConfig();
    return res.status(200).json({
      supabaseUrl: base,
      publishableKey: key
    });
  } catch {
    return res.status(503).json({ error: "EDUCATION_AUTH_NOT_CONFIGURED" });
  }
}
