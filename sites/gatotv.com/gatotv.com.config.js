const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');
const path = require('path');
const { DateTime } = require('luxon');
const crypto = require('crypto');

module.exports = {
  site: 'gatotv.com',
  days: 2,
  url({ channel, date }) {
    date = ensureDateTime(date);
    return `https://www.gatotv.com/canal/${channel.site_id}/${date.toFormat('yyyy-MM-dd')}`;
  },
  async parser({ content, date }) {
    console.log('Fecha recibida:', date);
    
    if (!(date instanceof DateTime)) {
      date = DateTime.fromISO(date);
    }
    console.log('Fecha convertida:', date.toISO());

    const filteredContent = extractRelevantContent(content);
    console.log('HTML Hash:', getHash(filteredContent)); // Depuración
    
    let programs = [];
    const items = parseItems(content);
    let fixedDate = date.minus({ days: 1 });
    
    items.forEach((item, i) => {
      const $item = cheerio.load(item);
      let start = parseStart($item, fixedDate);
      
      if (i === 0 && start.hour >= 5) {
        start = start.plus({ days: 1 });
        fixedDate = fixedDate.plus({ days: 1 });
      }
      
      let stop = parseStop($item, fixedDate);
      if (stop < start) {
        stop = stop.plus({ days: 1 });
        fixedDate = fixedDate.plus({ days: 1 });
      }
      
      programs.push({
        title: parseTitle($item),
        description: parseDescription($item),
        image: parseImage($item),
        start,
        stop
      });
    });
    
    return programs;
  },
  async channels() {
    const data = await axios
      .get('https://www.gatotv.com/guia_tv/completa', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      })
      .then(response => response.data)
      .catch(console.log);

    const $ = cheerio.load(data);
    const items = $('.tbl_EPG_row,.tbl_EPG_rowAlternate').toArray();

    return items.map(item => {
      const $item = cheerio.load(item);
      const link = $item('td:nth-child(1) > div:nth-child(2) > a:nth-child(3)').attr('href');
      const parsed = url.parse(link);

      return {
        lang: 'es',
        site_id: path.basename(parsed.pathname),
        name: $item('td:nth-child(1) > div:nth-child(2) > a:nth-child(3)').text()
      };
    });
  }
};

function parseTitle($item) {
  return $item(
    'td:nth-child(4) > div > div > a > span,td:nth-child(3) > div > div > span,td:nth-child(3) > div > div > a > span'
  ).text();
}

function parseDescription($item) {
  return $item('td:nth-child(4) > div').clone().children().remove().end().text().trim();
}

function parseImage($item) {
  return $item('td:nth-child(3) > a > img').attr('src');
}

function parseStart($item, date) {
  if (!(date instanceof DateTime)) {
    date = DateTime.fromISO(date);
  }

  const time = $item('td:nth-child(1) > div > time').attr('datetime');

  return DateTime.fromFormat(`${date.toFormat('yyyy-MM-dd')} ${time}`, 'yyyy-MM-dd HH:mm', {
    zone: 'America/New_York'
  }).setZone('UTC');
}

function parseStop($item, date) {
  if (!(date instanceof DateTime)) {
    date = DateTime.fromISO(date);
  }

  const time = $item('td:nth-child(2) > div > time').attr('datetime');

  return DateTime.fromFormat(`${date.toFormat('yyyy-MM-dd')} ${time}`, 'yyyy-MM-dd HH:mm', {
    zone: 'America/New_York'
  }).setZone('UTC');
}

function parseItems(content) {
  const $ = cheerio.load(content);
  return $(
    'body > div.div_content > table:nth-child(8) > tbody > tr:nth-child(2) > td:nth-child(1) > table.tbl_EPG'
  )
    .find('.tbl_EPG_row,.tbl_EPG_rowAlternate,.tbl_EPG_row_selected')
    .toArray();
}

function getHash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

function extractRelevantContent(html) {
  const $ = cheerio.load(html);
  return $('.tbl_EPG_row,.tbl_EPG_rowAlternate,.tbl_EPG_row_selected').toString();
}

function ensureDateTime(date) {
  if (date instanceof DateTime) return date;
  if (typeof date === 'string') return DateTime.fromISO(date);
  if (date && date.$d) return DateTime.fromJSDate(date.$d);
  return DateTime.now();
}
