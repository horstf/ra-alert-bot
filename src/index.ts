import cheerio from "cheerio";
import puppeteer from "puppeteer";
import Slimbot from "slimbot";
import { v4 as uuidv4 } from "uuid";

require('dotenv').config()

const baseURL = "https://www.ra.co";

const StupidStorage: any = {};

const isUrl = (maybeUrl: string): boolean => {
  return maybeUrl.indexOf("http") !== -1 || maybeUrl.indexOf("https") !== -1;
};

const getEventId = (url: string): string => {
  return url.match(/\d{7}/)[0];
}

const getAvailableTickets = async (url: string): Promise<boolean> => {

  let data;
  try {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
    "--no-sandbox",
    "--disable-gpu",
    ]
  });

  const page = await browser.newPage();

  page.setDefaultNavigationTimeout(10000);

  // set headers and user agent to seem natural :)
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:94.0) Gecko/20100101 Firefox/94.0")
  await page.setExtraHTTPHeaders({
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8", 
    "Accept-Encoding": "gzip, deflate, br", 
    "Accept-Language": "de,en-US;q=0.7,en;q=0.3", 
    "Dnt": "1", 
    "Referer": "https://www.google.com/", 
    "Sec-Fetch-Dest": "document", 
    "Sec-Fetch-Mode": "navigate", 
    "Sec-Fetch-Site": "cross-site", 
    "Sec-Fetch-User": "?1", 
    "Upgrade-Insecure-Requests": "1", 
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:94.0) Gecko/20100101 Firefox/94.0", 
  })

  //log into ra
  await page.setRequestInterception(true);
  const emitter = page.on('request', interceptedRequest => {
    var data = {
      'method': 'POST',
      'postData': 'usernameOrEmail='+process.env.USERNAME+'&password='+process.env.PASSWORD
    };
    interceptedRequest.continue(data);
    }
  );
  await page.goto("	https://auth.ra.co/api/v1/login");
  //only need to log in once
  emitter.off;

  await page.goto(url, {waitUntil: 'networkidle2'});
  data = await page.content();

  await page.close();
  await browser.close();

  } catch (error) {
    console.log(JSON.stringify(error))
    return false;
  }

  const $ = cheerio.load(data);
  let results: boolean[] = $('ul[data-ticket-info-selector-id="tickets-info"] li').map((i, elem) => elem.attribs.class.includes('onsale')).get();
  return results.some(x => x);
};

const startBot = () => {
  const slimbot = new Slimbot(process.env.BOT_TOKEN);

  slimbot.on("message", (message: any) => {
    const { text, chat } = message;
    if (text.indexOf("/watch") !== -1) {
      const [, urlOrId] = text.split(" ");
      const eventID = isUrl(urlOrId) ? getEventId(urlOrId) : urlOrId
      const url = baseURL + "/widget/event/" + eventID + '/embedtickets';
      const buyUrl = baseURL + "/events/" + eventID;

      const id = uuidv4().slice(uuidv4().length-4);

      StupidStorage[id] = {
        chatId: chat.id,
        status: "pending",
      };

      const timer = async (id: string) => {
        if (await getAvailableTickets(url)) {
          slimbot.sendMessage(
            chat.id,
            `Tickets are available! Go to ${buyUrl} to purchase.`
          );
        } else if (StupidStorage[id].status === "pending") {
          //wait between 1 and 6 seconds
          const timeout = 1000 + Math.floor(Math.random() * (5000 - 1000 + 1) + 1000)
          console.log(`Tickets for ${buyUrl} not yet available. Waiting for ` + timeout/1000 + ' seconds.');
          setTimeout(() => timer(id), timeout);
        }
      }
      timer(id);

      slimbot.sendMessage(
        chat.id,
        `Alright! I'll let you know when tickets for event ${eventID} are available.`
      );
      slimbot.sendMessage(
        chat.id,
        `Your unique identifier is ${id}. Type "/status <id>" to make sure I'm still running or "/cancel <id>" to clear the request.`
      );
      slimbot.sendMessage(
        chat.id,
        `Requests will be cancelled after a week automatically.`
      );
    } else if (text.indexOf("/cancel") !== -1) {
      const [, id] = text.split(" ");
      const item = StupidStorage[id];
      if (item && item.status === "pending") {
        StupidStorage[String(id)] = {
          chatId: item.chatId,
          status: "cancelled",
        };
        console.log(JSON.stringify(item));
        slimbot.sendMessage(item.chatId, "Cancelled your request! Thanks.");
      }
    } else if (text.indexOf("/status") !== -1) {
      const [, id] = text.split(" ");
      const item = StupidStorage[id];
      if (item) {
        slimbot.sendMessage(chat.id, `Status: ${item.status}`);
      } else {
        slimbot.sendMessage(
          chat.id,
          "Not found! Are you sure that's the right identifier?"
        );
      }
    }
  });

  slimbot.startPolling();
};

const main = async () => {
  startBot();
};

try {
  main();
} catch (err) {
  console.error(err);
}
