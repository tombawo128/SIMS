const apiUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
if (!apiUrl || !anonKey) throw new Error("API_URL and ANON_KEY must be set by supabase status -o env");

const users = [
  { email: "student1@baystate.edu", password: "Password123!" },
  { email: "student2@baystate.edu", password: "Password123!" },
];

async function request(path, options = {}) {
  const response = await fetch(new URL(path, apiUrl), options);
  const body = await response.text();
  return { response, body };
}

async function signIn(user) {
  const { response, body } = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify(user),
  });
  if (!response.ok) throw new Error(`Auth sign-in failed (${response.status}): ${body}`);
  return JSON.parse(body);
}

const owner = await signIn(users[0]);
const other = await signIn(users[1]);
const objectPath = `${owner.user.id}/ci-storage-smoke-${process.env.GITHUB_RUN_ID ?? "local"}.txt`;
const objectUrl = `/storage/v1/object/post-images/${objectPath}`;
const headers = (token, extra = {}) => ({
  apikey: anonKey,
  authorization: `Bearer ${token}`,
  ...extra,
});

let uploaded = false;
try {
  const upload = await request(objectUrl, {
    method: "POST",
    headers: headers(owner.access_token, {
      "content-type": "text/plain",
      "x-upsert": "false",
    }),
    body: "SIMS isolated Storage API smoke test",
  });
  if (!upload.response.ok) {
    throw new Error(`Owner upload failed (${upload.response.status}): ${upload.body}`);
  }
  uploaded = true;
  console.log("PASS: authenticated owner can upload to their own folder");

  const deniedDelete = await request("/storage/v1/object", {
    method: "DELETE",
    headers: headers(other.access_token, { "content-type": "application/json" }),
    body: JSON.stringify({ prefixes: [objectPath] }),
  });
  if (deniedDelete.response.ok) {
    throw new Error("Cross-user delete unexpectedly succeeded");
  }
  console.log("PASS: another authenticated user cannot delete the owner's file");

  const download = await request(`/storage/v1/object/authenticated/post-images/${objectPath}`, {
    headers: headers(owner.access_token),
  });
  if (!download.response.ok || download.body !== "SIMS isolated Storage API smoke test") {
    throw new Error(`Owner download failed or content mismatched (${download.response.status}): ${download.body}`);
  }
  console.log("PASS: owner can download the uploaded object");

  const deletion = await request("/storage/v1/object", {
    method: "DELETE",
    headers: headers(owner.access_token, { "content-type": "application/json" }),
    body: JSON.stringify({ prefixes: [objectPath] }),
  });
  if (!deletion.response.ok) {
    throw new Error(`Owner delete failed (${deletion.response.status}): ${deletion.body}`);
  }
  uploaded = false;
  console.log("PASS: owner can delete the uploaded object");
} finally {
  if (uploaded) {
    const cleanup = await request("/storage/v1/object", {
      method: "DELETE",
      headers: headers(owner.access_token, { "content-type": "application/json" }),
      body: JSON.stringify({ prefixes: [objectPath] }),
    });
    if (!cleanup.response.ok) {
      console.error(`WARNING: cleanup failed (${cleanup.response.status}): ${cleanup.body}`);
    }
  }
}
