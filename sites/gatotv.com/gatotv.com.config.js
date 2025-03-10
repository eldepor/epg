const axios = require('axios')
const cheerio = require('cheerio')
const url = require('url')
const path = require('path')
const { DateTime } = require('luxon')

module.exports = {
  site: 'gatotv.com',
  days: 2,
  url({ channel, date }) {
    // Añade log para ver qué fecha se está utilizando para la URL
    console.log(`[DEBUG] Fecha utilizada para URL: ${date.format('YYYY-MM-DD')}`)
    return `https://www.gatotv.com/canal/${channel.site_id}/${date.format('YYYY-MM-DD')}`
  },
  parser({ content, date }) {
    // Añade logs para verificar la fecha inicial
    console.log(`[DEBUG] Fecha inicial en parser: ${date.toISO()}`)
    
    let programs = []
    const items = parseItems(content)
    
    // Importante: ELIMINA esta línea que resta un día a la fecha actual
    // date = date.subtract(1, 'd')
    
    console.log(`[DEBUG] Número de items encontrados: ${items.length}`)
    
    items.forEach((item, i) => {
      const $item = cheerio.load(item)
      let start = parseStart($item, date)
      
      // Log para ver los tiempos de inicio extraídos
      console.log(`[DEBUG] Item ${i} - Tiempo original: ${$item('td:nth-child(1) > div > time').attr('datetime')}, Fecha ISO: ${start.toISO()}`)
      
      if (i === 0 && start.hour >= 5) {
        start = start.plus({ days: 1 })
        date = date.add(1, 'd')
        console.log(`[DEBUG] Ajustando fecha para item 0 con hora >= 5: Nueva fecha: ${date.toISO()}`)
      }
      
      let stop = parseStop($item, date)
      
      // Log para ver los tiempos de fin extraídos
      console.log(`[DEBUG] Item ${i} - Tiempo fin original: ${$item('td:nth-child(2) > div > time').attr('datetime')}, Fecha ISO: ${stop.toISO()}`)
      
      if (stop < start) {
        stop = stop.plus({ days: 1 })
        date = date.add(1, 'd')
        console.log(`[DEBUG] Ajustando fecha para stop < start: Nueva fecha: ${date.toISO()}`)
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
    const data = await axios
      .get('https://www.gatotv.com/guia_tv/completa')
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
  return $item(
    'td:nth-child(4) > div > div > a > span,td:nth-child(3) > div > div > span,td:nth-child(3) > div > div > a > span'
  ).text()
}

function parseDescription($item) {
  return $item('td:nth-child(4) > div').clone().children().remove().end().text().trim()
}

function parseImage($item) {
  return $item('td:nth-child(3) > a > img').attr('src')
}

function parseStart($item, date) {
  const time = $item('td:nth-child(1) > div > time').attr('datetime')
  
  console.log(`[DEBUG] parseStart - Fecha: ${date.format('YYYY-MM-DD')}, Hora: ${time}, Zona: Europe/Madrid`)
  
  const dateTime = DateTime.fromFormat(`${date.format('YYYY-MM-DD')} ${time}`, 'yyyy-MM-dd HH:mm', {
    zone: 'Europe/Madrid'
  }).toUTC()
  
  console.log(`[DEBUG] parseStart - Resultado UTC: ${dateTime.toISO()}`)
  
  return dateTime
}

function parseStop($item, date) {
  const time = $item('td:nth-child(2) > div > time').attr('datetime')
  
  console.log(`[DEBUG] parseStop - Fecha: ${date.format('YYYY-MM-DD')}, Hora: ${time}, Zona: Europe/Madrid`)
  
  const dateTime = DateTime.fromFormat(`${date.format('YYYY-MM-DD')} ${time}`, 'yyyy-MM-dd HH:mm', {
    zone: 'Europe/Madrid'
  }).toUTC()
  
  console.log(`[DEBUG] parseStop - Resultado UTC: ${dateTime.toISO()}`)
  
  return dateTime
}

function parseItems(content) {
  const $ = cheerio.load(content)

  return $(
    'body > div.div_content > table:nth-child(8) > tbody > tr:nth-child(2) > td:nth-child(1) > table.tbl_EPG'
  )
    .find('.tbl_EPG_row,.tbl_EPG_rowAlternate,.tbl_EPG_row_selected')
    .toArray()
}
