const axios = require('axios')
const cheerio = require('cheerio')
const url = require('url')
const path = require('path')
const { DateTime } = require('luxon')

module.exports = {
  site: 'gatotv.com',
  days: 2,
  url({ channel, date }) {
    date = ensureDateTime(date)
    console.log(`Generando URL con fecha: ${date.toFormat('yyyy-MM-dd')}`)
    return `https://www.gatotv.com/canal/${channel.site_id}/${date.toFormat('yyyy-MM-dd')}`
  },
  parser({ content, date }) {
    date = ensureDateTime(date)
    console.log(`Fecha original antes de restar un día: ${date.toFormat('yyyy-MM-dd')}`)
    
    date = date.minus({ days: 1 })
    console.log(`Fecha después de restar un día: ${date.toFormat('yyyy-MM-dd')}`)

    const programs = []
    const items = parseItems(content)

    items.forEach((item, i) => {
      const $item = cheerio.load(item)
      let start = parseStart($item, date)
      console.log(`Start antes de ajustes: ${start.toISO()}`)

      if (i === 0 && start.hour >= 5) {
        start = start.plus({ days: 1 })
        console.log(`Start ajustado porque es el primer item y la hora >= 5: ${start.toISO()}`)
      }

      let stop = parseStop($item, date)
      console.log(`Stop antes de ajustes: ${stop.toISO()}`)

      if (stop < start) {
        stop = stop.plus({ days: 1 })
        console.log(`Stop ajustado porque era menor a start: ${stop.toISO()}`)
      }

      programs.push({
        title: parseTitle($item),
        description: parseDescription($item),
        image: parseImage($item),
        start,
        stop
      })
    })

    return programs
  },
  async channels() {
    console.log("Obteniendo lista de canales...")
    const data = await axios
      .get('https://www.gatotv.com/guia_tv/completa')
      .then(response => response.data)
      .catch(console.log)

    const $ = cheerio.load(data)
    const items = $('.tbl_EPG_row,.tbl_EPG_rowAlternate').toArray()

    return items.map(item => {
      const $item = cheerio.load(item)
      const link = $item('td:nth-child(1) > div:nth-child(2) > a:nth-child(3)').attr('href')
      if (!link) return null
      const parsed = url.parse(link)

      return {
        lang: 'es',
        site_id: path.basename(parsed.pathname),
        name: $item('td:nth-child(1) > div:nth-child(2) > a:nth-child(3)').text().trim()
      }
    }).filter(Boolean)
  }
}

function parseTitle($item) {
  return $item(
    'td:nth-child(4) > div > div > a > span,td:nth-child(3) > div > div > span,td:nth-child(3) > div > div > a > span'
  ).text().trim()
}

function parseDescription($item) {
  return $item('td:nth-child(4) > div').clone().children().remove().end().text().trim()
}

function parseImage($item) {
  return $item('td:nth-child(3) > a > img').attr('src') || ''
}

function parseStart($item, date) {
  date = ensureDateTime(date)
  const time = $item('td:nth-child(1) > div > time').attr('datetime')
  if (!time) return null

  const start = DateTime.fromFormat(`${date.toFormat('yyyy-MM-dd')} ${time}`, 'yyyy-MM-dd HH:mm', {
    zone: 'EST'
  }).toUTC()
  
  console.log(`Parseado Start: ${start.toISO()} con fecha base: ${date.toFormat('yyyy-MM-dd')} y hora: ${time}`)
  
  return start
}

function parseStop($item, date) {
  date = ensureDateTime(date)
  const time = $item('td:nth-child(2) > div > time').attr('datetime')
  if (!time) return null

  const stop = DateTime.fromFormat(`${date.toFormat('yyyy-MM-dd')} ${time}`, 'yyyy-MM-dd HH:mm', {
    zone: 'EST'
  }).toUTC()
  
  console.log(`Parseado Stop: ${stop.toISO()} con fecha base: ${date.toFormat('yyyy-MM-dd')} y hora: ${time}`)
  
  return stop
}

function parseItems(content) {
  const $ = cheerio.load(content)
  return $( 
    'body > div.div_content > table:nth-child(8) > tbody > tr:nth-child(2) > td:nth-child(1) > table.tbl_EPG'
  )
    .find('.tbl_EPG_row,.tbl_EPG_rowAlternate,.tbl_EPG_row_selected')
    .toArray()
}

function ensureDateTime(date) {
  return date instanceof DateTime ? date : DateTime.fromISO(date)
}
