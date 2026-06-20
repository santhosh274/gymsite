import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";
import { createClient } from "@supabase/supabase-js";

type Role = "admin" | "member" | "trainer";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  // 1) Create admin auth user and admin role (single admin id)
  const adminId = "ADMIN001";
  const adminPassword = "admin123";

  // We need an email for admin auth. If your Excel includes it, we’ll use it.
  // Otherwise, create a placeholder admin email from the adminId.
  const adminRow = rows.find((r) => cleanCell(r[COL_IDNO]) === adminId);
  const adminEmail = cleanCell(adminRow?.[COL_EMAIL]) || `admin001@${adminId.toLowerCase()}.local`;
  const adminFullName = cleanCell(adminRow?.[COL_FULLNAME]) || "SRGYM Admin";

  const adminUser = await ensureAuthUser({
    email: adminEmail,
    password: adminPassword,
    full_name: adminFullName,
  });

  await upsertRole(adminUser.id, "admin");

  // Also upsert into profiles if that table expects id matching auth user id.
  // In this app, profiles.id is used as user id everywhere.
  // So we insert profile rows with id = auth user id.
  const { error: profErrAdmin } = await SUPABASE.from("profiles").upsert(
    {
      id: adminUser.id,
      email: adminEmail,
      full_name: adminFullName,
      phone: "",
      address: "",
      emergency_contact: "",
      joined_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      date_of_birth: null,
      photo_url: null,
      // Note: if your profiles schema has extra NOT NULL fields, add them here.
    },
    { onConflict: "id" }
  );
  if (profErrAdmin) throw profErrAdmin;

  // 2) Create member auth users + member role + profiles.
  for (const r of rows) {
    const idNoRaw = cleanCell(r[COL_IDNO]);
    if (!idNoRaw) continue;

    const memberId = normalizeIdNo(idNoRaw);
    if (memberId === adminId) continue; // already created

    // Auth email required.
    const email = cleanCell(r[COL_EMAIL]);
    const full_name = cleanCell(r[COL_FULLNAME]);

    if (!email) {
      console.warn(`Skipping member ${memberId}: missing ${COL_EMAIL} in Excel.`);
      continue;
    }

    const password = inferMemberPassword(memberId);

    const memberUser = await ensureAuthUser({
      email,
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
        email,
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

    // If you have a dedicated member_id field separate from auth user id, add it here.
    // Your request says “member id should be exact as idno like SR1”,
    // but the current codebase uses profiles.id as the user id.
    // So we are ensuring the auth user is created per Excel row.
  }

  console.log("Seeding complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

