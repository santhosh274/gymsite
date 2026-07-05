import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";
import { createClient } from "@supabase/supabase-js";

type Role = "admin" | "member" | "trainer";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Avoid logging secrets
// console.log(process.env.SUPABASE_SERVICE_ROLE_KEY);
// console.log(process.env.SUPABASE_URL);



if (!SUPABASE_URL) {
  console.error("Missing env: SUPABASE_URL");
  process.exit(1);
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const SUPABASE = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

const excelPath = path.resolve(process.cwd(), "src/srgymDB.xlsx");
if (!fs.existsSync(excelPath)) {
  console.error(`Excel file not found: ${excelPath}`);
  process.exit(1);
}

function cleanCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function normalizeIdNo(idNo: string) {
  // Ensure exact like SR1/SR2 as per sheet values.
  return idNo.trim();
}

function inferMemberPassword(memberId: string) {
  // Not provided by user; create deterministic placeholder.
  // If your auth expects a different password, update this function.
  return `member_${memberId}`;
}

async function upsertRole(userId: string, role: Role) {
  // Ensure single role row per user/role if your schema supports it.
  // Using upsert with explicit columns for idempotency.
  const row = {
    user_id: userId,
    role,
  };

  // Some schemas may have a unique constraint; if not, this may insert duplicates.
  // We mitigate by deleting existing matching role rows first.
  const { error: delErr } = await SUPABASE
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", role);

  if (delErr) throw delErr;

  const { error: insErr } = await SUPABASE.from("user_roles").insert(row);
  if (insErr) throw insErr;
}

async function ensureAuthUser(params: {
  email: string;
  password: string;
  full_name?: string;
}) {
  const { email, password, full_name } = params;

  // Try to find existing auth user by email
  // Supabase admin listUsers does not always support `search` depending on SDK types.
  // We'll fetch a small page and match by email.
  const { data: existing, error: listErr } = await SUPABASE.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });

  if (listErr) throw listErr;


  const match = existing.users.find((u) => u.email === email);
  if (match) return match;

  const { data, error: signUpErr } = await SUPABASE.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: full_name ? { full_name } : undefined,
  });

  if (signUpErr) throw signUpErr;
  return data.user;
}

async function main() {
  const workbook = xlsx.readFile(excelPath, { cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    console.error("No sheet found in workbook.");
    process.exit(1);
  }

  // Convert to rows; column headers are taken from the first row.
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (!rows.length) {
    console.error("Excel sheet has no rows.");
    process.exit(1);
  }

  // Column names we expect from user request:
  // - "id no" (member id, exact like SR1)
  // - for auth creation we also need email (and optionally full_name)
  // If your sheet uses different headers, update these keys.
  const COL_IDNO = "id no";
  const COL_EMAIL = "email";
  const COL_FULLNAME = "full name";

  const synthEmail = (id: string) => `${id.toLowerCase()}@srgym.local`;

  // 1) Create admin auth user and admin role (single admin)
const ADMIN_ID = "admin";
const ADMIN_PASSWORD = "admin001"; // change this after seeding for security 
const ADMIN_EMAIL = "admin@srgym.local";

  const adminRow = rows.find((r) => cleanCell(r[COL_IDNO]) === ADMIN_ID);
  const adminFullName = cleanCell(adminRow?.[COL_FULLNAME]) || "SRGYM Admin";

  const adminUser = await ensureAuthUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    full_name: adminFullName,
  });

  await upsertRole(adminUser.id, "admin");

  const { error: profErrAdmin } = await SUPABASE.from("profiles").upsert(
    {
      id: adminUser.id,
      email: ADMIN_EMAIL,
      full_name: adminFullName,
      phone: "",
      address: "",
      emergency_contact: "",
      joined_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      date_of_birth: null,
      photo_url: null,
    },
    { onConflict: "id" }
  );
  if (profErrAdmin) throw profErrAdmin;

  // 2) Create member auth users + member role + profiles.
  for (const r of rows) {
    const idNoRaw = cleanCell(r[COL_IDNO]);
    if (!idNoRaw) continue;

    const memberId = normalizeIdNo(idNoRaw);
    if (memberId === ADMIN_ID) continue;

    const full_name = cleanCell(r[COL_FULLNAME]);
    const password = inferMemberPassword(memberId);

    const memberUser = await ensureAuthUser({
      email: synthEmail(memberId),
      password,
      full_name: full_name || memberId,
    });

    await upsertRole(memberUser.id, "member");

    const phone = cleanCell(r["phone"]);
    const address = cleanCell(r["address"]);
    const emergency_contact = cleanCell(r["emergency contact"]);
    const date_of_birth = cleanCell(r["date of birth"]);

    const { error: profErr } = await SUPABASE.from("profiles").upsert(
      {
        id: memberUser.id,
        email: synthEmail(memberId),
        full_name: full_name || memberId,
        phone: phone || null,
        address: address || "",
        emergency_contact: emergency_contact || null,
        joined_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        date_of_birth: date_of_birth ? date_of_birth : null,
        photo_url: null,
      },
      { onConflict: "id" }
    );

    if (profErr) throw profErr;
  }

  // ========== Auth table seeding ==========
  // Verify the auth table exists before proceeding
  console.log("Checking if auth table exists...");
  const { error: authCheckErr } = await SUPABASE.from("auth").select("id", { count: "exact", head: true }).limit(1);
  if (authCheckErr) {
    console.error("\n✗ The 'auth' table does not exist or is not accessible.");
    console.error("  Please apply the migration first:");
    console.error("  1. Go to https://supabase.com/dashboard/project/lqvdysnkbcereccvbnfk");
    console.error("  2. Open the SQL Editor");
    console.error("  3. Paste and run the contents of: supabase/migrations/20260620000000_create_auth_table.sql");
    console.error("  4. Then re-run this seed script.\n");
    process.exit(1);
  }

  // Populate auth table with all credentials
  console.log("Populating auth table...");

  // Helper to insert into auth table
  async function upsertAuth(userId: string, password: string, role: Role) {
    await SUPABASE.from("auth").delete().eq("user_id", userId);
    const { error } = await SUPABASE.from("auth").insert({
      user_id: userId,
      password,
      role,
    });
    if (error) throw error;
    console.log(`  Auth entry: ${userId} / ${password} (${role})`);
  }

  // Admin entry
  await upsertAuth(ADMIN_ID, ADMIN_PASSWORD, "admin");

  // Member entries
  for (const r of rows) {
    const idNoRaw = cleanCell(r[COL_IDNO]);
    if (!idNoRaw) continue;
    const memberId = normalizeIdNo(idNoRaw);
    if (memberId === ADMIN_ID) continue;
    const password = inferMemberPassword(memberId);
    await upsertAuth(memberId, password, "member");
  }

  console.log("Seeding complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

