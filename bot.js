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
  59: "Knife",
  60: "M4A1-S",
  61: "USP-S",
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
this.stattrak = [];

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
        
          /getkdr - Get your kill damage ratio and total average accuracy.
          /getbest - Get best weapon in each category, depends on kill.
          /last - get stats of your last match result. 
          /stattrak - get all kill stats.
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

    if (msg.text.includes("/stattrak")) {
      if (this.stattrak.length > 0) {
        getStatTrak(msg);
      } else {
        bot.sendMessage(
          msg.chat.id,
          `Hello ${name}! Not enough data for get stattrak - call /getbest firstly and then repeat to stattrak.`
        );
      }
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
      this.summary = summary;
    });
  } catch (error) {
    console.log("Error in userStats");
  }
};

// Get last match Data
const getLastMatchData = (msg) => {
  let lastMatchData = {};
  Object.entries(this.summary.stats).forEach((item) => {
    if (item[0].includes("last")) {
      lastMatchData[item[0]] = item[1];
    }
  });

  let allrounds =
    lastMatchData.last_match_t_wins + lastMatchData.last_match_ct_wins;

  let lastMatch = {
    mode: lastMatchData["last_match_rounds"] >= 30 ? "competetive" : "casual",
    kills: lastMatchData["last_match_kills"],
    deaths: lastMatchData["last_match_deaths"],
    kdr: lastMatchData["last_match_kills"] / lastMatchData["last_match_deaths"],
    mvp: lastMatchData["last_match_mvps"],
    fav_weapon:
      allWeaponsID[Number(lastMatchData.last_match_favweapon_id)] !== undefined
        ? allWeaponsID[Number(lastMatchData.last_match_favweapon_id)]
        : "none",
    fav_weapon_kills: lastMatchData.last_match_favweapon_kills,
    average_damage: lastMatchData.last_match_damage / allrounds,
  };

  bot.sendMessage(
    msg.chat.id,
    `WP ${this.nickname}!

    Last Match data:
    ----------------------------------
     You have played in ${lastMatch.mode} mode;
     You've made ${lastMatch.kills} frags, and died ${lastMatch.deaths} times.

     KDR: ${lastMatch.kdr.toFixed(2)};
     ${lastMatch.kdr >= 1 ? "Good Job!" : "You can do better maaaan!"}
    ----------------------------------
     ADR: ${lastMatch.average_damage};
     ${
       lastMatch.average_damage >= 100
         ? "Smoookin shoting, maaaan!"
         : "Try harder"
     }
    ----------------------------------
     MVP: ${lastMatch.mvp};
     ${
       lastMatch.mvp > 0
         ? "Who is good boy here?!?"
         : "Next time, man... Next time..."
     }
    ----------------------------------
     FAV.WEAPON: ${lastMatch.fav_weapon};
     FAV.WEAPON KILLS: ${lastMatch.fav_weapon_kills};
     ${
       lastMatch.fav_weapon_kills / lastMatchData["last_match_kills"] >= 0.5
         ? "You know how to shoot with this baby, try something else"
         : "Still not impressive..."
     }
     ----------------------------------
     `
  );
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
  this.stattrak = [];
};

// Return most effecxtive gun in each category
const getMostEffectiveGun = (msg) => {
  let totalKills = {
    pistols: {
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
  this.stattrak = [];

  Object.entries(this.summary.stats).forEach((item) => {
    if (item[0].includes("total_kills_")) {
      let weaponName = item[0].replace("total_kills_", "");

      this.stattrak.push(item);

      Object.entries(allGuns).forEach((type) => {
        type[1].forEach((gun) => {
          if (gun === weaponName) {
            let value = totalKills[type[0]].kills;

            // console.log("Category: ", type[0]);
            // console.log("Name: ", weaponName);
            // console.log("Current value: ", item[1]);
            // console.log("Previous value: ", value);
            // console.log("///////////");

            if (item[1] >= value) {
              const patch = "usp-s";
              totalKills[type[0]].name =
                weaponName === "hkp2000" ? patch : weaponName;
              totalKills[type[0]].kills = item[1];
            }
          }
        });
      });
    }
  });
  bot.sendMessage(
    msg.chat.id,
    `Ok, ${this.nickname}!
    
    This is your's most performatic guns:
    ----------------------
    | Pistols | ${totalKills.pistols.name.toUpperCase()} :: ${
      totalKills.pistols.kills
    } kills.
    ----------------------
    | Riffles |  ${totalKills.rifles.name.toUpperCase()} :: ${
      totalKills.rifles.kills
    } kills.
    ----------------------
    | Sniper Riffles|  ${totalKills.sniper.name.toUpperCase()} :: ${
      totalKills.sniper.kills
    } kills.
    ----------------------
    | Shot Gun|  ${totalKills.shotgun.name.toUpperCase()} :: ${
      totalKills.shotgun.kills
    } kills.
    ----------------------
    | Farm Gun |  ${totalKills.smallgun.name.toUpperCase()} :: ${
      totalKills.smallgun.kills
    } kills.
    ----------------------
    | Heavy weapon |  ${totalKills.heavy.name.toUpperCase()} :: ${
      totalKills.heavy.kills
    } kills.
    ----------------------

    Wow. Awesome! 
    Also NOW u can run command /stattrak to grab and show all weapon data.
    `
  );
};

// Get all data for the kills.
const getStatTrak = (msg) => {
  let message = "";

  this.stattrak.forEach((item) => {
    let name = item[0].replace("total_kills_", "");
    message =
      message +
      `\n ${name.toUpperCase()}  ::  ${
        item[1]
      } kills\n -------------------------`;
  });

  bot.sendMessage(
    msg.chat.id,
    `Ok, ${this.nickname}!
    ${message}`
  );
};

module.exports = bot;
