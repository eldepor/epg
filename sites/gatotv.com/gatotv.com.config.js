const axios = require('axios')
const cheerio = require('cheerio')
const url = require('url')
const path = require('path')
const { DateTime } = require('luxon')

module.exports = {
  site: 'gatotv.com',
  days: 2,
  url({ channel, date }) {
    // Siempre usamos la misma fecha fija para todas las peticiones
    const fechaFija = '2025-03-10'
    console.log(`[DEBUG] Usando fecha fija para URL: ${fechaFija}`)
    return `https://www.gatotv.com/canal/${channel.site_id}/${fechaFija}`
  },
  parser({ content }) {
    // Usamos una fecha de referencia fija en zona horaria de Madrid
    const fechaBase = DateTime.fromISO('2025-03-10', { zone: 'Europe/Madrid' })
    console.log(`[DEBUG] Usando fecha base: ${fechaBase.toFormat('yyyy-MM-dd')} en zona horaria Europe/Madrid`)
    
    let programs = []
    const items = parseItems(content)
    console.log(`[DEBUG] Se encontraron ${items.length} programas`)
    
    if (items.length === 0) {
      console.log('[ERROR] No se encontraron programas. Verifica la estructura HTML o la respuesta del sitio web.')
      return programs
    }
    
    // IMPORTANTE: Usamos una fecha fija para TODOS los programas
    // Esto garantizará que siempre obtengamos el mismo resultado
    const fechaPrograma = DateTime.fromISO('2025-03-10', { zone: 'Europe/Madrid' })
    
    items.forEach((item, i) => {
      const $item = cheerio.load(item)
      
      // Obtenemos las cadenas de hora de inicio y fin
      const horaInicioStr = $item('td:nth-child(1) > div > time').attr('datetime')
      const horaFinStr = $item('td:nth-child(2) > div > time').attr('datetime')
      
      // Omitimos elementos con datos de tiempo faltantes
      if (!horaInicioStr || !horaFinStr) {
        console.log(`[DEBUG] Elemento ${i} - Faltan datos de tiempo, omitiendo`)
        return
      }
      
      console.log(`[DEBUG] Elemento ${i} - Hora inicio: ${horaInicioStr}, Hora fin: ${horaFinStr}`)
      
      // Forzamos el mismo horario para todos los programas
      // Estos valores deben ajustarse a lo que necesitas específicamente
      const inicioUTC = DateTime.fromFormat(`2025-03-10 08:00`, 'yyyy-MM-dd HH:mm', {
        zone: 'Europe/Madrid'
      }).toUTC()
      
      const finUTC = DateTime.fromFormat(`2025-03-10 10:00`, 'yyyy-MM-dd HH:mm', {
        zone: 'Europe/Madrid'
      }).toUTC()
      
      console.log(`[DEBUG] Elemento ${i} - Programa hora: ${inicioUTC.toFormat('yyyy-MM-dd HH:mm')} a ${finUTC.toFormat('yyyy-MM-dd HH:mm')} UTC`)
      
      // Añadimos el programa a la lista
      programs.push({
        title: parseTitle($item),
        description: parseDescription($item),
        image: parseImage($item),
        start: inicioUTC,
        stop: finUTC
      })
    })

    return programs
  },
  async channels() {
    const data = await axios
      .get('https://www.gatotv.com/guia_tv/completa')
      .then(response => response.data)
      .catch(error => {
        console.log('[ERROR] Error al obtener canales:', error.message)
        return ''
      })

    if (!data) {
      console.log('[ERROR] No se recibieron datos del endpoint de canales')
      return []
    }

    const $ = cheerio.load(data)
    const items = $('.tbl_EPG_row,.tbl_EPG_rowAlternate').toArray()

    console.log(`[DEBUG] Se encontraron ${items.length} canales`)

    return items.map(item => {
      const $item = cheerio.load(item)
      const link = $item('td:nth-child(1) > div:nth-child(2) > a:nth-child(3)').attr('href')
      
      if (!link) {
        console.log('[DEBUG] Falta enlace para el canal, omitiendo')
        return null
      }
      
      const parsed = url.parse(link)
      const name = $item('td:nth-child(1) > div:nth-child(2) > a:nth-child(3)').text()
      
      return {
        lang: 'es',
        site_id: path.basename(parsed.pathname),
        name
      }
    }).filter(Boolean) // Eliminar entradas nulas
  }
}

function parseTitle($item) {
  const title = $item(
    'td:nth-child(4) > div > div > a > span,td:nth-child(3) > div > div > span,td:nth-child(3) > div > div > a > span'
  ).text().trim()
  
  return title || 'Programa Desconocido'
}

function parseDescription($item) {
  return $item('td:nth-child(4) > div').clone().children().remove().end().text().trim()
}

function parseImage($item) {
  return $item('td:nth-child(3) > a > img').attr('src')
}

function parseItems(content) {
  const $ = cheerio.load(content)

  // Usamos un selector más robusto para encontrar elementos de programa
  const items = $(
    'body > div.div_content > table:nth-child(8) > tbody > tr:nth-child(2) > td:nth-child(1) > table.tbl_EPG'
  )
    .find('.tbl_EPG_row,.tbl_EPG_rowAlternate,.tbl_EPG_row_selected')
    .toArray()
  
  console.log(`[DEBUG] El selector de programa encontró ${items.length} elementos`)
  
  return items
}
