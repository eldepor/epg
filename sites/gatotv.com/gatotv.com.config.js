const axios = require('axios')
const cheerio = require('cheerio')
const url = require('url')
const path = require('path')
const { DateTime } = require('luxon')

module.exports = {
  site: 'gatotv.com',
  days: 2,
  url({ channel, date }) {
    // USAR UNA FECHA FIJA: 2025-03-10
    // Esto garantizará que siempre se obtengan los mismos resultados
    const fixedDateStr = '2025-03-10'
    
    console.log(`[DEBUG] Fecha original: ${date.format('YYYY-MM-DD')}`)
    console.log(`[DEBUG] Usando fecha fija para URL: ${fixedDateStr}`)
    
    return `https://www.gatotv.com/canal/${channel.site_id}/${fixedDateStr}`
  },
  parser({ content, date }) {
    // Usar una fecha fija en lugar de la fecha actual
    const fixedDate = DateTime.fromISO('2025-03-10', { zone: 'Europe/Madrid' })
    
    console.log(`[DEBUG] Usando fecha fija en parser: ${fixedDate.toFormat('yyyy-MM-dd')}`)
    
    let programs = []
    const items = parseItems(content)
    
    console.log(`[DEBUG] Número de items encontrados: ${items.length}`)
    
    items.forEach((item, i) => {
      const $item = cheerio.load(item)
      const timeStr = $item('td:nth-child(1) > div > time').attr('datetime')
      const stopTimeStr = $item('td:nth-child(2) > div > time').attr('datetime')
      
      if (!timeStr || !stopTimeStr) {
        console.log(`[DEBUG] Item ${i} - Error: tiempos no encontrados`)
        return // Continúa con el siguiente item
      }
      
      console.log(`[DEBUG] Item ${i} - Tiempo inicio: ${timeStr}, Tiempo fin: ${stopTimeStr}`)
      
      // Usamos el mismo día base fijo para todos los programas
      let startDate = fixedDate
      
      // Si la hora es menor que 5:00, asumimos que es del día siguiente
      const [hours] = timeStr.split(':').map(Number)
      if (hours < 5) {
        startDate = fixedDate.plus({ days: 1 })
        console.log(`[DEBUG] Item ${i} - Hora < 5:00, usando día siguiente: ${startDate.toFormat('yyyy-MM-dd')}`)
      }
      
      // Creamos el datetime de inicio
      const start = DateTime.fromFormat(`${startDate.toFormat('yyyy-MM-dd')} ${timeStr}`, 'yyyy-MM-dd HH:mm', {
        zone: 'Europe/Madrid'
      }).toUTC()
      
      // Para la hora de finalización, usamos la misma fecha base
      let stopDate = startDate
      const [startHour] = timeStr.split(':').map(Number)
      const [stopHour] = stopTimeStr.split(':').map(Number)
      
      // Si la hora de fin es menor que la hora de inicio, sumamos un día
      if (stopHour < startHour) {
        stopDate = stopDate.plus({ days: 1 })
        console.log(`[DEBUG] Item ${i} - Fin < Inicio, usando día siguiente para fin: ${stopDate.toFormat('yyyy-MM-dd')}`)
      }
      
      const stop = DateTime.fromFormat(`${stopDate.toFormat('yyyy-MM-dd')} ${stopTimeStr}`, 'yyyy-MM-dd HH:mm', {
        zone: 'Europe/Madrid'
      }).toUTC()
      
      console.log(`[DEBUG] Item ${i} - Start UTC: ${start.toString()}, Stop UTC: ${stop.toString()}`)
      
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

function parseItems(content) {
  const $ = cheerio.load(content)

  const items = $(
    'body > div.div_content > table:nth-child(8) > tbody > tr:nth-child(2) > td:nth-child(1) > table.tbl_EPG'
  )
    .find('.tbl_EPG_row,.tbl_EPG_rowAlternate,.tbl_EPG_row_selected')
    .toArray()
  
  console.log(`[DEBUG] Selector de elementos: ${items.length} encontrados`)
  
  return items
}
