import { getDatabase, sendJson, methodNotAllowed, cleanText } from "../../lib/neon-db.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value, max = 500) => cleanText(typeof value === "string" ? value : "", max);
const uuidOrNull = value => typeof value === "string" && UUID.test(value) ? value : null;
const dateTimeOrNull = value => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

async function adminUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return null;
  const headers = {
    apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: "Bearer " + token,
    "Content-Type": "application/json"
  };
  try {
    const [userRes, roleRes] = await Promise.all([
      fetch(process.env.SUPABASE_URL + "/auth/v1/user", { headers }),
      fetch(process.env.SUPABASE_URL + "/rest/v1/rpc/is_center_management_admin", {
        method: "POST", headers, body: "{}"
      })
    ]);
    if (!userRes.ok || !roleRes.ok) return null;
    const [user, isAdmin] = await Promise.all([userRes.json(), roleRes.json()]);
    return isAdmin === true ? user : null;
  } catch (error) {
    console.error("EDUCATION_MARKETING_AUTH_FAILED", error?.name || "unknown");
    return null;
  }
}

async function recordAudit(sql, actorId, action, entityType, entityId, details = {}) {
  await sql`
    INSERT INTO education_marketing.audit_log (actor_id, action, entity_type, entity_id, details)
    VALUES (${actorId}::uuid, ${action}, ${entityType}, ${entityId}, ${JSON.stringify(details)}::jsonb)
  `;
}

export default async function handler(req, res) {
  if (!["GET", "POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const user = await adminUser(req);
    if (!user) return sendJson(res, 401, { error: "ADMIN_AUTH_REQUIRED" });
    const sql = getDatabase("education");

    if (req.method === "GET") {
      const [campaigns, tasks, posts, channels, teamRoles, assets, calendarEvents] = await Promise.all([
        sql`SELECT * FROM education_marketing.campaigns ORDER BY created_at DESC LIMIT 100`,
        sql`SELECT t.*, r.role_name AS assigned_role_name FROM education_marketing.tasks t LEFT JOIN education_marketing.team_roles r ON r.id=t.assigned_role_id ORDER BY t.created_at DESC LIMIT 100`,
        sql`SELECT p.*, c.channel_name, g.title AS campaign_title FROM education_marketing.posts p LEFT JOIN education_marketing.channels c ON c.id=p.channel_id LEFT JOIN education_marketing.campaigns g ON g.id=p.campaign_id ORDER BY p.created_at DESC LIMIT 100`,
        sql`SELECT id, platform, channel_name, external_reference, connection_status, publishing_enabled, approval_required, last_verified_at FROM education_marketing.channels ORDER BY created_at DESC LIMIT 100`,
        sql`SELECT id, role_name, department, role_kind, responsibilities, permission_scope, is_active FROM education_marketing.team_roles ORDER BY department, role_name LIMIT 100`,
        sql`SELECT id, campaign_id, asset_type, title, description, text_content, storage_status, created_at FROM education_marketing.assets ORDER BY created_at DESC LIMIT 100`,
        sql`SELECT e.*, c.channel_name, g.title AS campaign_title FROM education_marketing.calendar_events e LEFT JOIN education_marketing.channels c ON c.id=e.channel_id LEFT JOIN education_marketing.campaigns g ON g.id=e.campaign_id ORDER BY e.starts_at ASC LIMIT 100`
      ]);
      return sendJson(res, 200, {
        ok: true,
        workspace: "education_marketing",
        capabilities: {
          persistent_drafts: true,
          external_publishing: false,
          outbound_messaging: false,
          file_uploads: false,
          channel_credentials_stored: false
        },
        campaigns, tasks, posts, channels, team_roles: teamRoles, assets, calendar_events: calendarEvents
      });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const action = text(body.action, 50);

    if (req.method === "POST") {
      let created;
      let entityType = "";
      if (action === "create_campaign") {
        const title = text(body.title, 180);
        if (title.length < 2) return sendJson(res, 400, { error: "INVALID_CAMPAIGN_TITLE" });
        const startsOn = text(body.starts_on, 10) || null;
        const endsOn = text(body.ends_on, 10) || null;
        if ((startsOn && !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) || (endsOn && !/^\d{4}-\d{2}-\d{2}$/.test(endsOn))) {
          return sendJson(res, 400, { error: "INVALID_CAMPAIGN_DATES" });
        }
        const campaignCode = "EDU-MKT-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().slice(0, 6).toUpperCase();
        created = await sql`
          WITH created AS (
            INSERT INTO education_marketing.campaigns
              (campaign_code, title, objective, audience, status, starts_on, ends_on, created_by)
            VALUES
              (${campaignCode}, ${title}, NULLIF(${text(body.objective, 1000)}, ''),
               NULLIF(${text(body.audience, 500)}, ''), 'draft',
               NULLIF(${startsOn}, '')::date, NULLIF(${endsOn}, '')::date, ${user.id}::uuid)
            RETURNING *
          ), logged AS (
            INSERT INTO education_marketing.audit_log (actor_id, action, entity_type, entity_id, details)
            SELECT ${user.id}::uuid, 'create', 'campaign', id::text, '{}'::jsonb FROM created
            RETURNING id
          )
          SELECT * FROM created
        `;
        entityType = "campaign";
      } else if (action === "create_task") {
        const title = text(body.title, 180);
        const dueAt = dateTimeOrNull(body.due_at);
        if (title.length < 2 || dueAt === undefined) return sendJson(res, 400, { error: "INVALID_TASK_FIELDS" });
        const area = text(body.area, 40) || "operations";
        const priority = text(body.priority, 20) || "normal";
        const allowedAreas = ["planning","content","design","video","publishing","community","support","analytics","operations"];
        const allowedPriorities = ["low","normal","high","urgent"];
        if (!allowedAreas.includes(area) || !allowedPriorities.includes(priority)) return sendJson(res, 400, { error: "INVALID_TASK_FIELDS" });
        const roleId = body.assigned_role_id ? uuidOrNull(body.assigned_role_id) : null;
        if (body.assigned_role_id && !roleId) return sendJson(res, 400, { error: "INVALID_ROLE_ID" });
        const campaignId = body.campaign_id ? uuidOrNull(body.campaign_id) : null;
        if (body.campaign_id && !campaignId) return sendJson(res, 400, { error: "INVALID_CAMPAIGN_ID" });
        created = await sql`
          WITH created AS (
            INSERT INTO education_marketing.tasks
              (campaign_id, area, title, description, assigned_role_id, priority, due_at, created_by)
            VALUES
              (${campaignId}::uuid, ${area}, ${title}, NULLIF(${text(body.description, 2000)}, ''),
               ${roleId}::uuid, ${priority}, ${dueAt}::timestamptz, ${user.id}::uuid)
            RETURNING *
          ), logged AS (
            INSERT INTO education_marketing.audit_log (actor_id, action, entity_type, entity_id, details)
            SELECT ${user.id}::uuid, 'create', 'task', id::text, jsonb_build_object('status', status) FROM created
            RETURNING id
          )
          SELECT * FROM created
        `;
        entityType = "task";
      } else if (action === "create_post") {
        const title = text(body.title, 180), content = text(body.body, 12000);
        const contentType = text(body.content_type, 30) || "post";
        const allowedTypes = ["post","story","video","reel","article","brochure","announcement","other"];
        if (title.length < 2 || !content || !allowedTypes.includes(contentType)) return sendJson(res, 400, { error: "INVALID_POST_FIELDS" });
        const channelId = body.channel_id ? uuidOrNull(body.channel_id) : null;
        const campaignId = body.campaign_id ? uuidOrNull(body.campaign_id) : null;
        if ((body.channel_id && !channelId) || (body.campaign_id && !campaignId)) return sendJson(res, 400, { error: "INVALID_POST_LINK" });
        created = await sql`
          WITH created AS (
            INSERT INTO education_marketing.posts
              (campaign_id, channel_id, content_type, title, body, status, approval_required, created_by)
            VALUES
              (${campaignId}::uuid, ${channelId}::uuid, ${contentType}, ${title}, ${content}, 'draft', true, ${user.id}::uuid)
            RETURNING *
          ), logged AS (
            INSERT INTO education_marketing.audit_log (actor_id, action, entity_type, entity_id, details)
            SELECT ${user.id}::uuid, 'create', 'post', id::text, jsonb_build_object('status', status) FROM created
            RETURNING id
          )
          SELECT * FROM created
        `;
        entityType = "post";
      } else if (action === "create_channel") {
        const platform = text(body.platform, 30), channelName = text(body.channel_name, 160);
        const allowedPlatforms = ["website","whatsapp","telegram","instagram","facebook","youtube","tiktok","x","linkedin","other"];
        if (!allowedPlatforms.includes(platform) || channelName.length < 2) return sendJson(res, 400, { error: "INVALID_CHANNEL_FIELDS" });
        created = await sql`
          WITH created AS (
            INSERT INTO education_marketing.channels
              (platform, channel_name, external_reference, connection_status, publishing_enabled, approval_required, created_by)
            VALUES
              (${platform}, ${channelName}, NULLIF(${text(body.external_reference, 300)}, ''),
               'planned', false, true, ${user.id}::uuid)
            RETURNING id, platform, channel_name, external_reference, connection_status, publishing_enabled, approval_required
          ), logged AS (
            INSERT INTO education_marketing.audit_log (actor_id, action, entity_type, entity_id, details)
            SELECT ${user.id}::uuid, 'create', 'channel', id::text, jsonb_build_object('platform', platform) FROM created
            RETURNING id
          )
          SELECT * FROM created
        `;
        entityType = "channel";
      } else if (action === "create_role") {
        const roleName = text(body.role_name, 120), department = text(body.department, 80) || "marketing";
        const roleKind = text(body.role_kind, 20) || "virtual";
        if (roleName.length < 2 || !["virtual","human"].includes(roleKind)) return sendJson(res, 400, { error: "INVALID_ROLE_FIELDS" });
        const responsibilities = text(body.responsibilities, 1500);
        const scope = body.permission_scope && typeof body.permission_scope === "object" && !Array.isArray(body.permission_scope) ? body.permission_scope : {};
        created = await sql`
          WITH created AS (
            INSERT INTO education_marketing.team_roles
              (role_name, department, role_kind, responsibilities, permission_scope, created_by)
            VALUES
              (${roleName}, ${department}, ${roleKind}, NULLIF(${responsibilities}, ''), ${JSON.stringify(scope)}::jsonb, ${user.id}::uuid)
            RETURNING *
          ), logged AS (
            INSERT INTO education_marketing.audit_log (actor_id, action, entity_type, entity_id, details)
            SELECT ${user.id}::uuid, 'create', 'team_role', id::text, jsonb_build_object('role_kind', role_kind) FROM created
            RETURNING id
          )
          SELECT * FROM created
        `;
        entityType = "team_role";
      } else if (action === "create_asset") {
        const title = text(body.title, 180), assetType = text(body.asset_type, 30);
        const allowedTypes = ["copy","image","video","brochure","poster","document","other"];
        if (title.length < 2 || !allowedTypes.includes(assetType)) return sendJson(res, 400, { error: "INVALID_ASSET_FIELDS" });
        created = await sql`
          WITH created AS (
            INSERT INTO education_marketing.assets
              (campaign_id, asset_type, title, description, text_content, storage_status, created_by)
            VALUES
              (${body.campaign_id ? uuidOrNull(body.campaign_id) : null}::uuid, ${assetType}, ${title},
               NULLIF(${text(body.description, 1500)}, ''), NULLIF(${text(body.text_content, 12000)}, ''),
               'not_configured', ${user.id}::uuid)
            RETURNING id, campaign_id, asset_type, title, description, text_content, storage_status, created_at
          ), logged AS (
            INSERT INTO education_marketing.audit_log (actor_id, action, entity_type, entity_id, details)
            SELECT ${user.id}::uuid, 'create', 'asset', id::text, jsonb_build_object('asset_type', asset_type) FROM created
            RETURNING id
          )
          SELECT * FROM created
        `;
        entityType = "asset";
      } else if (action === "create_event") {
        const title = text(body.title, 180), startsAt = dateTimeOrNull(body.starts_at), endsAt = dateTimeOrNull(body.ends_at);
        if (title.length < 2 || !startsAt || startsAt === undefined || endsAt === undefined) return sendJson(res, 400, { error: "INVALID_EVENT_FIELDS" });
        const eventType = text(body.event_type, 30) || "content";
        const allowedTypes = ["content","campaign","meeting","deadline","event","other"];
        if (!allowedTypes.includes(eventType)) return sendJson(res, 400, { error: "INVALID_EVENT_TYPE" });
        const channelId = body.channel_id ? uuidOrNull(body.channel_id) : null;
        const campaignId = body.campaign_id ? uuidOrNull(body.campaign_id) : null;
        if ((body.channel_id && !channelId) || (body.campaign_id && !campaignId)) return sendJson(res, 400, { error: "INVALID_EVENT_LINK" });
        created = await sql`
          WITH created AS (
            INSERT INTO education_marketing.calendar_events
              (campaign_id, channel_id, title, event_type, starts_at, ends_at, status, created_by)
            VALUES
              (${campaignId}::uuid, ${channelId}::uuid, ${title}, ${eventType},
               ${startsAt}::timestamptz, ${endsAt}::timestamptz, 'proposed', ${user.id}::uuid)
            RETURNING *
          ), logged AS (
            INSERT INTO education_marketing.audit_log (actor_id, action, entity_type, entity_id, details)
            SELECT ${user.id}::uuid, 'create', 'calendar_event', id::text, '{}'::jsonb FROM created
            RETURNING id
          )
          SELECT * FROM created
        `;
        entityType = "calendar_event";
      } else {
        return sendJson(res, 400, { error: "UNKNOWN_ACTION" });
      }

      if (!created?.length) return sendJson(res, 500, { error: "MARKETING_CREATE_FAILED" });
      return sendJson(res, 201, { ok: true, entity_type: entityType, item: created[0] });
    }

    const id = uuidOrNull(body.id);
    if (!id) return sendJson(res, 400, { error: "INVALID_ENTITY_ID" });

    if (action === "update_task_status") {
      const status = text(body.status, 30);
      if (!["open","in_progress","review","blocked","completed","cancelled"].includes(status)) return sendJson(res, 400, { error: "INVALID_TASK_STATUS" });
      const changed = await sql`
        WITH changed AS (
          UPDATE education_marketing.tasks
          SET status=${status}, completed_at=CASE WHEN ${status}='completed' THEN now() ELSE NULL END, updated_at=now()
          WHERE id=${id}::uuid RETURNING *
        ), logged AS (
          INSERT INTO education_marketing.audit_log (actor_id, action, entity_type, entity_id, details)
          SELECT ${user.id}::uuid, 'status_update', 'task', id::text, jsonb_build_object('status', status) FROM changed
          RETURNING id
        )
        SELECT * FROM changed
      `;
      if (!changed.length) return sendJson(res, 404, { error: "TASK_NOT_FOUND" });
      return sendJson(res, 200, { ok: true, item: changed[0] });
    }

    if (action === "update_post_status") {
      const status = text(body.status, 30);
      if (!["draft","review","approved","blocked","archived"].includes(status)) {
        return sendJson(res, 400, { error: "INVALID_POST_STATUS", message: "النشر والجدولة الخارجية غير متاحين في هذه المرحلة." });
      }
      const changed = await sql`
        WITH changed AS (
          UPDATE education_marketing.posts
          SET status=${status},
              approved_by=CASE WHEN ${status}='approved' THEN ${user.id}::uuid ELSE NULL END,
              approved_at=CASE WHEN ${status}='approved' THEN now() ELSE NULL END,
              updated_at=now()
          WHERE id=${id}::uuid RETURNING *
        ), logged AS (
          INSERT INTO education_marketing.audit_log (actor_id, action, entity_type, entity_id, details)
          SELECT ${user.id}::uuid, 'status_update', 'post', id::text, jsonb_build_object('status', status) FROM changed
          RETURNING id
        )
        SELECT * FROM changed
      `;
      if (!changed.length) return sendJson(res, 404, { error: "POST_NOT_FOUND" });
      return sendJson(res, 200, { ok: true, item: changed[0], external_publishing: false });
    }

    if (action === "update_campaign_status") {
      const status = text(body.status, 30);
      if (!["draft","review","approved","active","completed","blocked","archived"].includes(status)) return sendJson(res, 400, { error: "INVALID_CAMPAIGN_STATUS" });
      const changed = await sql`
        WITH changed AS (
          UPDATE education_marketing.campaigns
          SET status=${status},
              approved_by=CASE WHEN ${status}='approved' THEN ${user.id}::uuid ELSE approved_by END,
              approved_at=CASE WHEN ${status}='approved' THEN now() ELSE approved_at END,
              updated_at=now()
          WHERE id=${id}::uuid AND (${status}<>'active' OR status='approved')
          RETURNING *
        ), logged AS (
          INSERT INTO education_marketing.audit_log (actor_id, action, entity_type, entity_id, details)
          SELECT ${user.id}::uuid, 'status_update', 'campaign', id::text, jsonb_build_object('status', status) FROM changed
          RETURNING id
        )
        SELECT * FROM changed
      `;
      if (!changed.length) return sendJson(res, 409, { error: "CAMPAIGN_NOT_FOUND_OR_NOT_APPROVED" });
      return sendJson(res, 200, { ok: true, item: changed[0] });
    }

    if (action === "update_event_status") {
      const status = text(body.status, 30);
      if (!["proposed","confirmed","completed","cancelled"].includes(status)) return sendJson(res, 400, { error: "INVALID_EVENT_STATUS" });
      const changed = await sql`
        WITH changed AS (
          UPDATE education_marketing.calendar_events SET status=${status}, updated_at=now()
          WHERE id=${id}::uuid RETURNING *
        ), logged AS (
          INSERT INTO education_marketing.audit_log (actor_id, action, entity_type, entity_id, details)
          SELECT ${user.id}::uuid, 'status_update', 'calendar_event', id::text, jsonb_build_object('status', status) FROM changed
          RETURNING id
        )
        SELECT * FROM changed
      `;
      if (!changed.length) return sendJson(res, 404, { error: "EVENT_NOT_FOUND" });
      return sendJson(res, 200, { ok: true, item: changed[0] });
    }

    return sendJson(res, 400, { error: "UNKNOWN_ACTION" });
  } catch (error) {
    const status = error.statusCode || 500;
    console.error("EDUCATION_MARKETING_WORKSPACE_FAILED", error?.code || error?.name || "unknown");
    return sendJson(res, status, { error: status === 503 ? error.message : "MARKETING_WORKSPACE_FAILED" });
  }
}
