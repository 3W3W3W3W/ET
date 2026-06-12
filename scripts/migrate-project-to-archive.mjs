// One-off migration: recreate every `_type == "project"` document as
// `_type == "archive"`, preserving its _id and all field content.
// Sanity won't let you patch `_type`, so we delete + recreate in a single
// transaction (processed in order, so same-id reuse is safe).
import { createClient } from "@sanity/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const env = Object.fromEntries(
  readFileSync(join(process.cwd(), ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const token = env.SANITY_API_TOKEN || process.env.SANITY_API_TOKEN;
if (!token) {
  console.error("Missing SANITY_API_TOKEN in .env.local");
  process.exit(1);
}

const client = createClient({
  projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: "2024-01-01",
  token,
  useCdn: false,
});

const docs = await client.fetch(`*[_type == "project"]`);
console.log(`Found ${docs.length} "project" documents to migrate.`);

if (docs.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

const tx = client.transaction();
for (const doc of docs) {
  const { _rev, _createdAt, _updatedAt, ...rest } = doc;
  tx.delete(doc._id);
  tx.create({ ...rest, _type: "archive" });
  console.log(`  → ${doc._id}  (${doc.title ?? "untitled"})`);
}

const res = await tx.commit();
console.log(`Done. ${res.results.length} mutations committed.`);
