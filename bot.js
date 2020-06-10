const token = process.env.TOKEN;

const SteamAPI = require("steamapi");
const Bot = require("node-telegram-bot-api");
let bot;

if (process.env.NODE_ENV === "production") {
  bot = new Bot(token);
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
} else {
  bot = new Bot(token, { polling: true });
}
const steam = new SteamAPI(process.env.STEAM);
const allGuns = {
  pistols: ["glock", "fiveseven", "p250", "tec9", "deagle", "hkp2000"],
  rifles: ["famas", "galilar", "ak47", "aug", "sg556", "m4a1"],
  sniper: ["awp", "g3sg1", "scar20", "ssg08"],
  shotgun: ["xm1014", "nova", "sawedoff", "mag7"],
  smallgun: ["mac10", "p90", "ump45", "mp7", "mp9", "bizon"],
  heavy: ["m249", "negev"],
};

console.log("Bot server started in the " + process.env.NODE_ENV + " mode");

let StateMachine = {
  WELCOME: "welcome",
  REQUEST: "request",
  RESPONSE: "response",
  EXIT: "exit",
};

this.steamID = "";
let waitingForID = false;

bot.on("message", (msg) => {
  const name = msg.from.first_name;

  // console.log(msg);

  if (this.steamID === "") {
    if (waitingForID) {
      steam
        .resolve(`https://steamcommunity.com/id/${msg.text}`)
        .then((id) => {
          console.log(id);
          if (typeof id === "string" && id !== undefined && id !== null) {
            waitingForID = false;
            this.steamID = id;
          }
        })
        .error((error) => {
          console.log(error);
        });
    } else {
      bot.sendMessage(
        msg.chat.id,
        `Hello ${name}! Please send me your steam ID. I need it to identify you.`
      );
      waitingForID = true;
    }
  } else {
    // steam.resolve("https://steamcommunity.com/id/milky_cookie").then((num) => {
    //   id = num;

    console.log(this.steamID);

    steam.getUserStats(this.steamID, "730").then((summary) => {
      let adr = getAdr(summary);
      getAccuracy(summary);
      getMostEffectiveGun(summary);
      bot.sendMessage(
        msg.chat.id,
        "Hello, " + name + "! " + `Your KDR: ${adr.toFixed(3)}`
      );
    });
    // });
  }
});

const getAdr = (summary) => {
  return summary.stats.total_kills / summary.stats.total_deaths;
};

const getAccuracy = (summary) => {
  return (
    (summary.stats.total_shots_hit / summary.stats.total_shots_fired) * 100
  );
};

const getMostEffectiveGun = (summary) => {
  let totalKills = [];
  let totalShots = [];
  let totalHits = [];
  Object.entries(summary.stats).forEach((item) => {
    if (item[0].includes("total_kill")) {
      totalKills.push(item);
    }

    if (item[0].includes("total_shot")) {
      totalShots.push(item);
    }

    if (item[0].includes("total_hit")) {
      totalHits.push(item);
    }
  });
  console.log(totalKills);
  console.log(totalShots);
  console.log(totalHits);
};

module.exports = bot;
