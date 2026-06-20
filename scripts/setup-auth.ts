import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function main() {
  // Step 1: Apply migration via direct pg connection
  console.log("Step 1: Applying auth table migration...");
  const pool = new Pool({
    host: "127.0.0.1",
    port: 54322,
    user: "postgres",
    password: "postgres",
    database: "postgres",
    connectionTimeoutMillis: 5000,
  });

  try {
    const migrationSql = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/migrations/20260620000000_create_auth_table.sql"),
      "utf8"
    );
    const statements = migrationSql.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
    for (const stmt of statements) {
      try {
        await pool.query(stmt + ";");
      } catch (e: any) {
        // Ignore "already exists" errors
        if (e.code !== "42P07") throw e;
      }
    }
    console.log("  Migration applied successfully");
  } catch (e: any) {
    console.error("  Failed to apply migration:", e.message);
    console.error("  Make sure local Supabase is running (supabase start)");
    process.exit(1);
  }

  // Step 2: Reload PostgREST schema cache
  console.log("Step 2: Reloading PostgREST schema cache...");
  await pool.query("NOTIFY pgrst, 'reload schema'");
  console.log("  Schema cache reloaded");

  await pool.end();

  // Step 3: Run the seed script
  console.log("Step 3: Running seed script...");
  // The seed script is already imported inline below

  const SUPABASE = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  type Role = "admin" | "member" | "trainer";

  async function upsertRole(userId: string, role: Role) {
    await SUPABASE.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    const { error } = await SUPABASE.from("user_roles").insert({ user_id: userId, role });
    if (error) throw error;
  }

  // Helper to insert into auth table
  async function upsertAuth(userId: string, password: string, role: Role, email: string) {
    await SUPABASE.from("auth").delete().eq("user_id", userId);
    const { error } = await SUPABASE.from("auth").insert({ user_id: userId, password, role, email });
    if (error) throw error;
    console.log(`  Auth: ${userId} / ${password} => ${email} (${role})`);
  }

  // Helper: find existing auth user by email or create one
  async function ensureAuthUser(params: {
    email: string;
    password: string;
    full_name?: string;
  }) {
    const { email, password, full_name } = params;

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

  // Create admin test user (admin123)
  console.log("  Creating admin123@...");
  const testAdminUser = await ensureAuthUser({
    email: "admin123@srgym.local",
    password: "admintest",
    full_name: "Admin Test",
  });
  await upsertRole(testAdminUser.id, "admin");
  await upsertAuth("admin123", "admintest", "admin", "admin123@srgym.local");

  // Create member test user (member123)
  console.log("  Creating member123@...");
  const testMemberUser = await ensureAuthUser({
    email: "member123@srgym.local",
    password: "membertest",
    full_name: "Member Test",
  });
  await upsertRole(testMemberUser.id, "member");
  await upsertAuth("member123", "membertest", "member", "member123@srgym.local");

  console.log("\nSetup complete! You can now log in with:");
  console.log("  Admin:  admin123 / admintest");
  console.log("  Member: member123 / membertest");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
