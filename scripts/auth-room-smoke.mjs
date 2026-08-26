const endpoint = process.env.BRANICE_ENDPOINT ?? "http://localhost:3000";
const unique = `${Date.now()}${Math.random()}`.replace(/\D/g, "").slice(-14);

async function call(path, input, cookie) {
  const response = await fetch(`${endpoint}/api/trpc/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ json: input }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(`${path} failed: ${JSON.stringify(payload.error ?? payload)}`);
  }
  const setCookie = response.headers.get("set-cookie")?.split(";")[0];
  return { data: payload.result.data.json, cookie: setCookie };
}

async function query(path, input, cookie) {
  const url = new URL(`${endpoint}/api/trpc/${path}`);
  url.searchParams.set("input", JSON.stringify({ json: input }));
  const response = await fetch(url, { headers: cookie ? { cookie } : {} });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(`${path} failed: ${JSON.stringify(payload.error ?? payload)}`);
  }
  return { data: payload.result.data.json };
}

const password = "smoke-test-password-9";
const host = await call("credentials.register", { email: `host-${unique}@branice.test`, password });
const opponent = await call("credentials.register", { email: `opponent-${unique}@branice.test`, password });
if (!host.cookie || !opponent.cookie) throw new Error("Credential session cookies were not issued.");

const signedInHost = await call("credentials.signIn", { email: `host-${unique}@branice.test`, password });
if (!signedInHost.cookie) throw new Error("Email-and-password sign-in did not reissue a session cookie.");

const hostToken = `host-${unique}`;
const opponentToken = `opponent-${unique}`;
const created = await call("rooms.create", { boardSize: 8, playerToken: hostToken }, host.cookie);
const code = created.data.room.code;
if (created.data.role !== "violet" || !code) throw new Error("Host room creation did not return a violet session.");

const joined = await call("rooms.join", { code, playerToken: opponentToken }, opponent.cookie);
if (joined.data.role !== "ember" || !joined.data.room.hasOpponent) throw new Error("Opponent room join failed.");

const moved = await call(
  "rooms.move",
  { code, playerToken: hostToken, from: { row: 5, col: 0 }, to: { row: 4, col: 1 } },
  host.cookie
);
if (moved.data.state.moveCount !== 1 || moved.data.state.currentPlayer !== "ember") {
  throw new Error("Protected room move did not synchronize the expected state.");
}

const synchronized = await query("rooms.state", { code, playerToken: opponentToken }, opponent.cookie);
if (synchronized.data.state.moveCount !== 1 || synchronized.data.state.currentPlayer !== "ember") {
  throw new Error("Opponent polling state did not receive the host move.");
}

const anonymousResponse = await fetch(`${endpoint}/api/trpc/rooms.state?input=${encodeURIComponent(JSON.stringify({ json: { code, playerToken: opponentToken } }))}`);
if (anonymousResponse.status !== 401) throw new Error("Unauthenticated room access was not rejected.");

console.log(`Authenticated room smoke test passed for room ${code}.`);
