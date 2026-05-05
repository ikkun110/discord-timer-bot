import { Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, REST, Routes, SlashCommandBuilder, TextChannel } from "discord.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const timers = new Map();

const fmt = (s) => { s = Math.abs(Math.floor(s)); const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), ss=s%60; return h ? `${h}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}` : `${m}:${String(ss).padStart(2,"0")}`; };
const parse = (t) => { let m; if (m=t.match(/^(\d+):(\d{2}):(\d{2})$/)) return +m[1]*3600 + +m[2]*60 + +m[3]; if (m=t.match(/^(\d+):(\d{2})$/)) return +m[1]*60 + +m[2]; const s=+t; return s>0?s:null; };
const elapsed = (t) => t.running ? t.e + Math.floor((Date.now()-t.t0)/1000) : t.e;
const remain = (t) => t.running ? Math.max(0, Math.ceil((t.end-Date.now())/1000)) : Math.max(0,t.total);
const bar = (c,tot,n=12) => { const f=Math.round(Math.max(0,Math.min(1,c/tot))*n); return "█".repeat(f)+"░".repeat(n-f); };

const upEmbed = (t) => new EmbedBuilder().setColor(t.running?Colors.Green:Colors.Yellow).setTitle(`⏱️ ストップウォッチ — ${t.running?"計測中":"一時停止中"}`).addFields({name:"経過時間",value:`\`\`\`${fmt(elapsed(t))}\`\`\``}).setFooter({text:t.running?"3秒ごとに更新":"一時停止中"});
const downEmbed = (t, done=false) => { if(done) return new EmbedBuilder().setColor(Colors.Red).setTitle("⏰ カウントダウン終了！").setDescription(`**${fmt(t.total)}** が経過しました`).setFooter({text:"完了"}); const r=remain(t),p=r/t.total,c=p>.5?Colors.Green:p>.25?Colors.Yellow:Colors.Red; return new EmbedBuilder().setColor(c).setTitle("⏳ カウントダウン").addFields({name:"残り時間",value:`\`\`\`${fmt(r)}\`\`\``,inline:true},{name:"設定時間",value:`\`\`\`${fmt(t.total)}\`\`\``,inline:true}).addFields({name:"進捗",value:`\`${bar(r,t.total)}\` ${Math.round((1-p)*100)}%`}).setFooter({text:"3秒ごとに更新"}); };
const upRow = (id, run) => new ActionRowBuilder().addComponents(run ? new ButtonBuilder().setCustomId(`cup:${id}`).setLabel("一時停止").setStyle(ButtonStyle.Primary).setEmoji("⏸️") : new ButtonBuilder().setCustomId(`cur:${id}`).setLabel("再開").setStyle(ButtonStyle.Success).setEmoji("▶️"), new ButtonBuilder().setCustomId(`cux:${id}`).setLabel("リセット").setStyle(ButtonStyle.Danger).setEmoji("🔄"));
const downRow = (id) => new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`cds:${id}`).setLabel("停止").setStyle(ButtonStyle.Danger).setEmoji("⏹️"));

const editLive = async (msg, opts) => { try { msg.editReply ? await msg.editReply(opts) : await msg.edit(opts); } catch {} };

const startUp = async (id, replyFn, getFn) => {
  const ex = timers.get(id);
  if (ex?.type==="up" && ex.running) { await replyFn({content:"⚠️ タイマーはすでに動いています。",flags:64}); return; }
  if (ex?.iv) clearInterval(ex.iv);
  if (ex?.type==="down" && ex.to) clearTimeout(ex.to);
  const t = {type:"up", t0:Date.now(), e:0, running:true, msg:null, iv:null};
  timers.set(id, t);
  await replyFn({embeds:[upEmbed(t)], components:[upRow(id,true)]});
  t.msg = await getFn();
  t.iv = setInterval(async () => { if (!t.msg||!t.running) return; await editLive(t.msg,{embeds:[upEmbed(t)],components:[upRow(id,true)]}); }, 3000);
};

const startDown = async (id, total, replyFn, getFn) => {
  const ex = timers.get(id);
  if (ex?.iv) clearInterval(ex.iv);
  if (ex?.type==="down" && ex.to) clearTimeout(ex.to);
  const t = {type:"down", end:Date.now()+total*1000, total, running:true, id, msg:null, iv:null, to:null};
  timers.set(id, t);
  await replyFn({embeds:[downEmbed(t)], components:[downRow(id)]});
  t.msg = await getFn();
  t.iv = setInterval(async () => { if (!t.msg) return; const r=remain(t); await editLive(t.msg,{embeds:[downEmbed(t)],components:r>0?[downRow(id)]:[]}); if (r<=0&&t.iv){clearInterval(t.iv);t.iv=null;} }, 3000);
  t.to = setTimeout(async () => {
    if (t.iv) clearInterval(t.iv); timers.delete(id);
    await editLive(t.msg, {embeds:[downEmbed(t,true)],components:[]});
    try { const ch=await client.channels.fetch(id); if(ch instanceof TextChannel) await ch.send(`⏰ @here **${fmt(total)}** のカウントダウンが終わりました！`); } catch {}
  }, total*1000);
};

client.on(Events.InteractionCreate, async (i) => {
  if (i.isButton()) {
    const [act, id] = [i.customId.slice(0,3), i.customId.slice(4)];
    const t = timers.get(id);
    if (act==="cup") {
      if (!t||t.type!=="up"||!t.running){await i.reply({content:"⚠️ タイマーは動いていません。",ephemeral:true});return;}
      t.e=elapsed(t); t.running=false; if(t.iv){clearInterval(t.iv);t.iv=null;}
      await i.update({embeds:[upEmbed(t)],components:[upRow(id,false)]});
    } else if (act==="cur") {
      if (!t||t.type!=="up"||t.running){await i.reply({content:"⚠️ すでに動いています。",ephemeral:true});return;}
      t.t0=Date.now(); t.running=true;
            t.iv=setInterval(async()=>{if(!t.msg||!t.running)return;await editLive(t.msg,{embeds:[upEmbed(t)],components:[upRow(id,true)]});},1000);
      await i.update({embeds:[upEmbed(t)],components:[upRow(id,true)]});
    } else if (act==="cux") {
      if(t?.iv) clearInterval(t.iv); timers.delete(id);
      await i.update({embeds:[new EmbedBuilder().setColor(Colors.Grey).setTitle("🔄 リセット済み").setDescription("`/timer start` でスタートできます")],components:[]});
    } else if (act==="cds") {
      if(t?.iv) clearInterval(t.iv); if(t?.to) clearTimeout(t.to); timers.delete(id);
      await i.update({embeds:[new EmbedBuilder().setColor(Colors.Grey).setTitle("⏹️ 停止").setDescription("`/countdown` でスタートできます")],components:[]});
    }
    return;
  }
  if (i.isChatInputCommand()) {
    const id = i.channelId;
    if (i.commandName==="timer") {
      if (i.options.getSubcommand()==="start") await startUp(id, o=>i.reply(o), ()=>i.fetchReply());
      else {
        const t=timers.get(id); if(t){if(t.iv)clearInterval(t.iv);if(t.type==="down"&&t.to)clearTimeout(t.to);if(t.msg)await editLive(t.msg,{embeds:[new EmbedBuilder().setColor(Colors.Grey).setTitle("🔄 リセット済み")],components:[]});timers.delete(id);}
        await i.reply({content:"🔄 リセットしました。",ephemeral:true});
      }
    } else if (i.commandName==="countdown") {
      const s=parse(i.options.getString("time",true));
      if (!s) { await i.reply({content:"⚠️ 例: `5:00`（5分）、`90`（90秒）",ephemeral:true}); return; }
      await startDown(id, s, o=>i.reply(o), ()=>i.fetchReply());
    }
  }
});

client.on(Events.MessageCreate, async (m) => {
  if (m.author.bot) return;
  const id=m.channelId, low=m.content.trim().toLowerCase();
  if (low==="!timer start") await startUp(id, o=>m.reply(o), async()=>(await m.channel.messages.fetch({limit:1})).first());
  else if (low==="!timer reset") { const t=timers.get(id); if(t){if(t.iv)clearInterval(t.iv);if(t.type==="down"&&t.to)clearTimeout(t.to);timers.delete(id);} await m.reply("🔄 リセットしました。"); }
  else { const r=m.content.match(/^!countdown\s+(.+)$/i); if(r){const s=parse(r[1].trim());if(!s){await m.reply("⚠️ 例: `!countdown 5:00`");return;} await startDown(id,s,o=>m.reply(o),async()=>(await m.channel.messages.fetch({limit:1})).first());} }
});

const cmds = [
  new SlashCommandBuilder().setName("timer").setDescription("ストップウォッチ").addSubcommand(s=>s.setName("start").setDescription("スタート")).addSubcommand(s=>s.setName("reset").setDescription("リセット")),
  new SlashCommandBuilder().setName("countdown").setDescription("カウントダウン").addStringOption(o=>o.setName("time").setDescription("時間 例:5:00 / 90 / 1:30:00").setRequired(true)),
].map(c=>c.toJSON());

client.on(Events.ClientReady, async () => {
  console.log(`✅ 起動: ${client.user?.tag}`);
  const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), {body:cmds}).catch(console.error);
  console.log("✅ スラッシュコマンド登録完了");
});

if (!process.env.DISCORD_BOT_TOKEN) { console.error("❌ DISCORD_BOT_TOKEN が未設定"); process.exit(1); }
client.login(process.env.DISCORD_BOT_TOKEN);
