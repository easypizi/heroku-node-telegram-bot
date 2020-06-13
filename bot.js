const token = process.env.TOKEN;

const SteamAPI = require("steamapi");
const Bot = require("node-telegram-bot-api");
let bot;

let allWeaponsID = {
  1: "Desert Eagle",
  2: "Dual Berettas",
  3: "Five-SeveN",
  4: "Glock-18",
  7: "AK-47",
  8: "AUG",
  9: "AWP",
  10: "FAMAS",
  11: "G3SG1",
  13: "Galil AR",
  14: "M249",
  16: "M4A4",
  17: "MAC-10",
  19: "P90",
  23: "MP5-SD",
  24: "UMP-45",
  25: "XM1014",
  26: "PP-Bizon",
  27: "MAG-7",
  28: "Negev",
  29: "Sawed-Off",
  30: "Tec-9",
  31: "Zeus x27",
  32: "P2000",
  33: "MP7",
  34: "MP9",
  35: "Nova",
  36: "P250",
  37: "Ballistic Shield",
  38: "SCAR-20",
  39: "SG 553",
  40: "SSG 08",
  41: "Knife",
  42: "Knife",
  43: "Flashbang",
  44: "High Explosive Grenade",
  45: "Smoke Grenade",
  46: "Molotov",
  47: "Decoy Grenade",
  48: "Incendiary Grenade",
  49: "C4 Explosive",
  50: "Kevlar Vest",
  51: "Kevlar + Helmet",
  52: "Heavy Assault Suit",
  54: "item_nvg",
  55: "Defuse Kit",
  56: "Rescue Kit",
  57: "Medi-Shot",
  58: "Music Kit",
  59: "Knife",
  60: "M4A1-S",
  61: "USP-S",
  62: "Trade Up Contract",
  63: "CZ75-Auto",
  64: "R8 Revolver",
  74: "Knife",
  500: "Bayonet",
  503: "Classic Knife",
  505: "Flip Knife",
  506: "Gut Knife",
  507: "Karambit",
  508: "M9 Bayonet",
  509: "Huntsman Knife",
  512: "Falchion Knife",
  514: "Bowie Knife",
  515: "Butterfly Knife",
  516: "Shadow Daggers",
  517: "Paracord Knife",
  518: "Survival Knife",
  519: "Ursus Knife",
  520: "Navaja Knife",
  521: "Nomad Knife",
  522: "Stiletto Knife",
  523: "Talon Knife",
  525: "Skeleton Knife",
};

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
this.accuracy = "";
this.summary = {};
this.adr = 0;
this.waitingForID = false;
this.nickname = "";

bot.on("polling_error", (error) => {
  console.log(error); // => 'EFATAL'
});

bot.on("text", (msg) => {
  const name = msg.from.first_name;

  // HELP command
  if (msg.text.includes("/help")) {
    bot.sendMessage(
      msg.chat.id,
      `Hello ${name}! This is a list of all possible commands: 
        
            /getkdr - Get your average damage and total average accuracy.
            /getbest - Get best weapon in each category, depends on damage.
            /reset - Drop off all search data.
        `
    );
    return;
  }
  // Authorization
  if (this.steamID === "") {
    if (this.waitingForID) {
      steam
        .resolve(`https://steamcommunity.com/id/${msg.text}`)
        .then((id) => {
          console.log("ID:", id);

          if (typeof id === "string" && id !== undefined && id !== null) {
            this.waitingForID = false;
            this.steamID = id;
            this.nickname = msg.text;
          } else {
            return;
          }

          getUserData(this.steamID);
          getUserStats(this.steamID);

          bot.sendMessage(
            msg.chat.id,
            `Hello ${this.nickname}! This is your steamID: ${this.steamID}
            Wanna some stats? Use /getkdr or /getbest to get your info!`
          );
        })
        .catch((error) => {
          bot.sendMessage(
            msg.chat.id,
            `${name}! This steamID looks weird or you CSGO Data is closed by privacy. Check is your ID is correct and also check privacy settings in your steam.`
          );
          resetBot(msg);
          console.log("This is error in SteamID detection: ", error);
        });
    } else {
      bot.sendMessage(
        msg.chat.id,
        `Hello ${name}! Please send me your steam ID. I need it to identify you.`
      );
      this.waitingForID = true;
    }
  } else {
    // RESET command
    if (msg.text.includes("/reset")) {
      resetBot(msg);
      return;
    }

    if (msg.text.includes("/getkdr")) {
      getKdr(msg);
      return;
    }

    if (msg.text.includes("/getbest")) {
      getMostEffectiveGun(msg);
      return;
    }

    if (msg.text.includes("/last")) {
      getLastMatchData(msg);
      return;
    }

    bot.sendMessage(
      msg.chat.id,
      `Hello ${name}! How can I help you? Choose any command use /help to show all commands list`
    );
  }
});

const countAdr = (summary) => {
  return summary.stats.total_kills / summary.stats.total_deaths;
};

const countAccuracy = (summary) => {
  return (
    (summary.stats.total_shots_hit / summary.stats.total_shots_fired) * 100
  );
};

const getKdr = (msg) => {
  this.adr = countAdr(this.summary);
  this.accuracy = countAccuracy(this.summary);

  bot.sendMessage(
    msg.chat.id,
    "Well, " +
      this.nickname +
      "... " +
      `Your KDR: ${this.adr.toFixed(
        3
      )}.  Your average accuracy: ${this.accuracy.toFixed(3)}`
  );
  return this.adr;
};

// Get user CSGO Data
const getUserData = (steamId) => {
  if (typeof steamId !== "string") {
    return;
  }
  try {
    steam.getUserSummary(steamId).then((data) => {
      // console.log(data)
      this.nickname = data.nickname;
    });
  } catch (error) {
    console.log("Error in userData");
  }
};

// Get user CSGO statistics
const getUserStats = (steamId) => {
  if (typeof steamId !== "string") {
    return;
  }
  try {
    steam.getUserStats(steamId, "730").then((summary) => {
      console.log(summary);
      this.summary = summary;
    });
  } catch (error) {
    console.log("Error in userStats");
  }
};

const getLastMatchData = (msg) => {
  let lastMatchData = {};
  Object.entries(this.summary.stats).forEach((item) => {
    if (item[0].includes("last")) {
      lastMatchData[item[0]] = item[1];
    }
  });

  let lastMatch = {
    mode: lastMatchData["last_match_rounds"] >= 30 ? "competetive" : "casual",
    kdr: lastMatchData["last_match_kills"] / lastMatchData["last_match_deaths"],
    mvp: lastMatchData["last_match_mvps"],
    fav_weapon: allWeaponsID[Number(lastMatchData['last_match_favweapon_id"'])],
  };

  // ["last_match_t_wins", 7],
  //   ["last_match_ct_wins", 8],
  //   ["last_match_wins", 8],
  //   ["last_match_max_players", 20],
  //   ["last_match_kills", 6],
  //   ["last_match_deaths", 12],
  //   ["last_match_mvps", 0],
  //   ["last_match_favweapon_id", 16],
  //   ["last_match_favweapon_shots", 126],
  //   ["last_match_favweapon_hits", 17],
  //   ["last_match_favweapon_kills", 3],
  //   ["last_match_damage", 934],
  //   ["last_match_money_spent", 42500],
  //   ["last_match_dominations", 0],
  //   ["last_match_revenges", 0],
  //   ["last_match_contribution_score", 17],
  //   ["last_match_rounds", 15],
  //   ["last_match_gg_contribution_score", 0];

  console.log(lastMatch);
};

// Reset all bot data
const resetBot = (msg) => {
  this.steamID = "";
  this.nickname = "";
  this.summary = {};
  this.adr = 0;
  this.accuracy = "";
  this.waitingForID = false;
  const name = msg.from.first_name;
  bot.sendMessage(msg.chat.id, `Ok, ${name}! All data clear!`);
};

// Return most effecxtive gun in each category
const getMostEffectiveGun = (msg) => {
  let totalKills = [];
  let totalHits = [];
  let totalShots = [];

  mvGun = {
    pistol: {
      name: "",
      kills: 0,
    },
    rifles: {
      name: "",
      kills: 0,
    },
    sniper: {
      name: "",
      kills: 0,
    },
    shotgun: {
      name: "",
      kills: 0,
    },
    smallgun: {
      name: "",
      kills: 0,
    },
    heavy: {
      name: "",
      kills: 0,
    },
  };

  Object.entries(this.summary.stats).forEach((item) => {
    if (item[0].includes("total_kill")) {
      totalKills.push(item);
    }

    if (item[0].includes("total_hit")) {
      totalHits.push(item);
    }

    if (item[0].includes("total_shot")) {
      totalShots.push(item);
    }
  });
  // console.log(totalKills);
  // console.log(totalShots);
  // console.log(totalHits);
};

module.exports = bot;
