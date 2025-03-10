const axios = require('axios')
const cheerio = require('cheerio')
const url = require('url')
const path = require('path')
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
const customParseFormat = require('dayjs/plugin/customParseFormat')

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)

module.exports = {
  site: 'gatotv.com',
  days: 2,
  url({ channel, date }) {
    return `https://www.gatotv.com/canal/${channel.site_id}/${date.format('YYYY-MM-DD')}`
  },
  parser({ content, date }) {
    let programs = []
    const items = parseItems(content)
    date = date.subtract(1, 'd')
    items.forEach((item, index) => {
      const prev = programs[programs.length - 1]
      const $item = cheerio.load(item)
      let start = parseStart($item, date)
      if (prev) {
        if (start.isBefore(prev.start)) {
          start = start.add(1, 'd')
          date = date.add(1, 'd')
        }
        prev.stop = start
      }
      let stop = parseStop($item, start)
      if (stop.isBefore(start)) {
        stop = stop.add(1, 'd')
        date = date.add(1, 'd')
      }

      programs.push({
        title: parseTitle($item),
        description: parseDescription($item),
        icon: parseIcon($item),
        start,
        stop
      })
    })

    return programs
  },
  async channels() {
    const data = await axios
      .get(`https://www.gatotv.com/guia_tv/completa`)
      .then(response => response.data)
      .catch(console.log)

    const $ = cheerio.load(data)
    const items = $('.tbl_EPG_row,.tbl_EPG_rowAlternate').toArray()

    return items.map(item => {
      const $item = cheerio.load(item)
      const link = $item('td:nth-child(1) > div:nth-child(2) > a:nth-child(3)').attr('href')
      const parsed = url.parse(link)

      return {
        lang: 'es',
        site_id: path.basename(parsed.pathname),
        name: $item('td:nth-child(1) > div:nth-child(2) > a:nth-child(3)').text()
      }
    })
  }
}

function parseTitle($item) {
  return $item('td:nth-child(4) > div > div > a > span,td:nth-child(3) > div > div > span').text()
}

function parseDescription($item) {
  return $item('td:nth-child(4) > div').clone().children().remove().end().text().trim()
}

function parseIcon($item) {
  return $item('td:nth-child(3) > a > img').attr('src')
}

function parseStart($item, date) {
  const time = $item('td:nth-child(1) > div > time').attr('datetime')

  return dayjs.tz(`${date.format('YYYY-MM-DD')} ${time}`, 'YYYY-MM-DD HH:mm', 'America/New_York')
}

function parseStop($item, date) {
  const time = $item('td:nth-child(2) > div > time').attr('datetime')

  return dayjs.tz(`${date.format('YYYY-MM-DD')} ${time}`, 'YYYY-MM-DD HH:mm', 'America/New_York')
}

function parseItems(content) {
  const $ = cheerio.load(content)

  return $(
    'body > div.div_content > table:nth-child(8) > tbody > tr:nth-child(2) > td:nth-child(1) > table.tbl_EPG'
  )
    .find('.tbl_EPG_row,.tbl_EPG_rowAlternate,.tbl_EPG_row_selected')
    .toArray()
}
