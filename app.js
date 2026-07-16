// ---------- Config ----------
const CONTRACT_ADDRESS = "0x6B607476A3647f2a2a29aD14F7f364b377af0202";
const MONAD_CHAIN_ID = 10143; // Monad Testnet
const MONAD_CHAIN_HEX = "0x" + MONAD_CHAIN_ID.toString(16);
const MONAD_RPC = "https://testnet-rpc.monad.xyz/";
const MONAD_EXPLORER = "https://testnet.monadexplorer.com";

const CONTRACT_ABI = [
  "function logEngagement() external",
  "function getStats(address _user) external view returns (uint256 currentStreak, uint256 longestStreak, uint256 totalUses, uint256 lastTimestamp)",
  "event EngagementLogged(address indexed user, uint256 newStreak, uint256 totalUses, uint256 timestamp)",
  "error TooSoon(uint256 secondsUntilNextLog)"
];

// ---------- State ----------
let provider, signer, contract, userAddress;

// ---------- Elements ----------
const connectBtn = document.getElementById("connectBtn");
const generateBtn = document.getElementById("generateBtn");
const logBtn = document.getElementById("logBtn");
const postInput = document.getElementById("postInput");
const summaryBox = document.getElementById("summaryBox");
const commentsBox = document.getElementById("commentsBox");
const txStatus = document.getElementById("txStatus");
const streakNumber = document.getElementById("streakNumber");
const longestStat = document.getElementById("longestStat");
const totalStat = document.getElementById("totalStat");
const walletStat = document.getElementById("walletStat");
const stampRing = document.getElementById("stampRing");
const stampGlyph = document.getElementById("stampGlyph");
const ledgerList = document.getElementById("ledgerList");
const apiKeyInput = document.getElementById("apiKeyInput");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const apiHint = document.getElementById("apiHint");

// ---------- API key handling ----------
function getApiKey() {
  return localStorage.getItem("engage_groq_key") || "";
}

function refreshApiKeyUI() {
  const key = getApiKey();
  if (key) {
    apiKeyInput.value = key;
    apiHint.textContent = "Key saved locally. You're set to generate suggestions.";
    generateBtn.disabled = !postInput.value.trim();
  } else {
    apiHint.textContent = "Add your Groq API key below to enable this.";
    generateBtn.disabled = true;
  }
}

saveKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  localStorage.setItem("engage_groq_key", key);
  refreshApiKeyUI();
});

postInput.addEventListener("input", () => {
  generateBtn.disabled = !getApiKey() || !postInput.value.trim();
});

// ---------- Wallet connect ----------
connectBtn.addEventListener("click", async () => {
  if (!window.ethereum) {
    alert("No wallet found. Install MetaMask to continue.");
    return;
  }

  try {
    await switchToMonad();

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    connectBtn.textContent = shortAddress(userAddress);
    connectBtn.disabled = true;
    walletStat.textContent = shortAddress(userAddress);
    logBtn.disabled = false;

    await refreshStats();
    loadLedger();
  } catch (err) {
    console.error(err);
    txStatus.textContent = "Couldn't connect: " + (err.message || err);
    txStatus.className = "tx-status error";
  }
});

async function switchToMonad() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_CHAIN_HEX }],
    });
  } catch (switchError) {
    // Chain not added yet -> add it
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: MONAD_CHAIN_HEX,
          chainName: "Monad Testnet",
          nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
          rpcUrls: [MONAD_RPC],
          blockExplorerUrls: [MONAD_EXPLORER],
        }],
      });
    } else {
      throw switchError;
    }
  }
}

function shortAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// Turns a raw contract revert into a plain-English message.
function describeContractError(err) {
  const errorData = err?.data || err?.error?.data || err?.info?.error?.data;
  if (errorData && contract) {
    try {
      const decoded = contract.interface.parseError(errorData);
      if (decoded && decoded.name === "TooSoon") {
        const seconds = Number(decoded.args[0]);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `Already logged recently — come back in about ${hours}h ${minutes}m to keep your streak going.`;
      }
    } catch (parseErr) {
      console.warn("Could not decode contract error:", parseErr);
    }
  }
  return "Error: " + (err.shortMessage || err.reason || err.message || "Transaction failed.");
}

// ---------- Stats ----------
async function refreshStats() {
  if (!contract || !userAddress) return;
  try {
    const [currentStreak, longestStreak, totalUses, lastTimestamp] = await contract.getStats(userAddress);
    streakNumber.textContent = currentStreak.toString();
    longestStat.textContent = longestStreak.toString();
    totalStat.textContent = totalUses.toString();
    updateStampRing(Number(totalUses), Number(lastTimestamp));
  } catch (err) {
    console.error("getStats failed", err);
  }
}

// Reflects real on-chain state: is the streak currently safe, or does it need action today?
function updateStampRing(totalUses, lastTimestamp) {
  const STREAK_WINDOW_SECONDS = 2 * 24 * 60 * 60; // matches contract's 2-day window
  stampRing.classList.remove("stamped", "at-risk");

  if (totalUses === 0) {
    stampGlyph.textContent = "✕";
    return; // never logged yet, neutral state
  }

  const secondsSinceLast = Math.floor(Date.now() / 1000) - lastTimestamp;

  if (secondsSinceLast <= STREAK_WINDOW_SECONDS) {
    stampRing.classList.add("stamped");
    stampGlyph.textContent = "✓";
  } else {
    stampRing.classList.add("at-risk");
    stampGlyph.textContent = "!";
  }
}

// ---------- Ledger (local history cache, keyed by wallet) ----------
function ledgerKey() {
  return "engage_ledger_" + userAddress.toLowerCase();
}

function loadLedger() {
  const raw = localStorage.getItem(ledgerKey());
  const entries = raw ? JSON.parse(raw) : [];
  renderLedger(entries);
}

function addLedgerEntry(streak, txHash) {
  const raw = localStorage.getItem(ledgerKey());
  const entries = raw ? JSON.parse(raw) : [];
  entries.unshift({
    time: new Date().toISOString(),
    streak,
    txHash,
  });
  localStorage.setItem(ledgerKey(), JSON.stringify(entries.slice(0, 50)));
  renderLedger(entries);
}

function renderLedger(entries) {
  if (!entries.length) {
    ledgerList.innerHTML = '<div class="ledger-empty">No entries yet. Log your first session above.</div>';
    return;
  }
  ledgerList.innerHTML = entries.map(e => `
    <div class="ledger-entry">
      <span>${new Date(e.time).toLocaleString()}</span>
      <span>streak: ${e.streak} — <a href="${MONAD_EXPLORER}/tx/${e.txHash}" target="_blank" rel="noopener" style="color:var(--teal)">view tx</a></span>
    </div>
  `).join("");
}

// ---------- Log engagement on-chain ----------
logBtn.addEventListener("click", async () => {
  if (!contract) return;
  logBtn.disabled = true;
  txStatus.className = "tx-status";
  txStatus.textContent = "Waiting for confirmation in your wallet...";

  try {
    const tx = await contract.logEngagement();
    txStatus.textContent = "Transaction sent. Waiting for it to land on-chain...";
    const receipt = await tx.wait();

    txStatus.textContent = "Logged! Tx confirmed on Monad.";
    txStatus.className = "tx-status success";

    await refreshStats();
    addLedgerEntry(streakNumber.textContent, receipt.hash);
  } catch (err) {
    console.error(err);
    txStatus.textContent = describeContractError(err);
    txStatus.className = "tx-status error";
  } finally {
    logBtn.disabled = false;
  }
});

// ---------- Groq: summarize + suggest comments ----------
generateBtn.addEventListener("click", async () => {
  const postText = postInput.value.trim();
  const apiKey = getApiKey();
  if (!postText || !apiKey) return;

  generateBtn.disabled = true;
  generateBtn.textContent = "Thinking...";
  summaryBox.classList.remove("empty");
  summaryBox.innerHTML = '<span class="placeholder">Reading the post...</span>';
  commentsBox.innerHTML = "";

  try {
    const result = await callGroq(postText, apiKey);
    summaryBox.textContent = result.summary;
    commentsBox.innerHTML = result.comments.map(c => `
      <div class="comment-card">
        <span>${escapeHtml(c)}</span>
        <button data-comment="${encodeURIComponent(c)}">copy</button>
      </div>
    `).join("");

    commentsBox.querySelectorAll("button[data-comment]").forEach(btn => {
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(decodeURIComponent(btn.dataset.comment));
        btn.textContent = "copied";
        setTimeout(() => (btn.textContent = "copy"), 1500);
      });
    });
  } catch (err) {
    console.error(err);
    summaryBox.textContent = "Something went wrong talking to Groq: " + (err.message || err);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Get suggestions";
  }
});

async function callGroq(postText, apiKey) {
  const systemPrompt = `You help a professional write genuine, specific replies to posts on LinkedIn/X. Given a post's text, respond ONLY with valid JSON, no markdown fences, in this exact shape:
{"summary": "one or two plain-spoken sentences on what the post actually says and why it matters", "comments": ["comment 1", "comment 2", "comment 3"]}
Rules for comments: sound like a real person, not a corporate bot. Vary the three in approach (one agrees and adds a point, one asks a genuine question, one shares a related angle). No hashtags, no emojis, no "Great post!" filler. Keep each comment under 280 characters.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: postText },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const raw = data.choices[0].message.content.trim();
  const cleaned = raw.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Init ----------
refreshApiKeyUI();
