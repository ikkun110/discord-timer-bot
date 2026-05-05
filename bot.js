import {
  Client,
  GatewayIntentBits,
  Events,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/** @type {Map<string, object>} */
const timers = new Map();
const UPDATE_INTERVAL_MS = 3000;

function formatDuration(totalSeconds) {
  const abs = Math.abs(Math.floor(totalSeconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const mStr = h > 0 ? String(m).padStart(2, "0") : String(m);
  const sStr = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mStr}:${sStr}` : `${mStr}:${sStr}`;
}

function parseTime(input) {
  const hhmmss = input.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (hhmmss) return parseInt(hhmmss[1]) * 3600 + parseInt(hhmmss[2]) * 60 + parseInt(hhmmss[3]);
  const mmss = input.match(/^(\d+):(\d{2})$/);
  if (mmss) return parseInt(mmss[1]) * 60 + parseInt(mmss[2]);
  const s = parseInt(input);
  return !isNaN(s) && s > 0 ? s : null;
}

function getElapsed(timer) {
  return timer.running
    ? timer.elapsed + Math.floor((Date.now() - timer.startedAt) / 1000)
    : timer.elapsed;
}

function getRemaining(timer) {
  return timer.running
    ? Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000))
