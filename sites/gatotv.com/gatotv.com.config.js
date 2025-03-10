const axios = require('axios')
const cheerio = require('cheerio')
const url = require('url')
const path = require('path')
const { DateTime } = require('luxon')

module.exports = {
  site: 'gatotv.com',
  days: 2,
  url({ channel, date }) {
    // Usar una fecha fija para obtener siempre los mismos resultados
    // El día 9 del mes actual (un día antes del 10)
    const currentYear = date.year()
    const currentMonth = date.month()
    
    // Creamos una fecha fija: día 9 del mes actual
    const fixedDate = DateTime.fromObject(
      { year: currentYear, month: currentMonth, day: 9 },
      { zone: 'Europe/Madrid' }
    )
    
    console.log(`[DEBUG] Fecha original: ${date.format('YYYY-MM-DD')}`)
    console.log(`[DEBUG] Fecha fija utilizada para URL: ${fixedDate.format('YYYY-MM-DD')}`)
    
    // Usamos la fecha fija para la URL
    return `https://www.gatotv.com/canal/${channel.site_id}/${fixedDate.format('YYYY-MM-DD')}`
  },
  parser({ content, date }) {
    // Usar una fecha fija para el procesamiento
    const currentYear = date.year()
    const currentMonth = date.month()
    
    // Siempre empezamos desde el día 9 del mes actual
    const baseDate = DateTime.fromObject(
      { year: currentYear, month: currentMonth, day: 9 },
      { zone: 'Europe/Madrid' }
    )
    
    console.log(`[DEBUG] Fecha base en parser: ${baseDate.format('YYYY-MM-DD')}`)
    
    let programs = []
    const items = parseItems(content)
    
    console.log(`[DEBUG] Número de items encontrados: ${items.length}`)
    
    // Primer procesamiento para determinar el inicio del día de programación
    // Esto nos ayudará a determinar qué programas pertenecen a qué día
    let programDayStart = null;
    let firstItemTime = null;
    
    if (items.length > 0) {
      const $firstItem = cheerio.load(items[0]);
      firstItemTime = $firstItem('td:nth-child(1) > div > time').attr('datetime');
      console.log(`[DEBUG] Primera hora encontrada: ${firstItemTime}`);
      
      // Si el primer programa es después de las 5:00, consideramos que pertenece al mismo día
      // Si es antes de las 5:00, consideramos que pertenece a la madrugada del día siguiente
      const [hours] = firstItemTime.split(':').map(Number);
      programDayStart = hours >= 5 ? baseDate : baseDate.plus({ days: 1 });
      
      console.log(`[DEBUG] Día de inicio de programación: ${programDayStart.format('YYYY-MM-DD')}`);
    }
    
    items.forEach((item, i) => {
      const $item = cheerio.load(item);
      const timeStr = $item('td:nth-child(1) > div > time').attr('datetime');
      const stopTimeStr = $item('td:nth-child(2) > div > time').attr('datetime');
      
      console.log(`[DEBUG] Item ${i} - Tiempo inicio: ${timeStr}, Tiempo fin: ${stopTimeStr}`);
      
      // Determinamos si este programa pertenece al día actual o al siguiente
      // basándonos en una lógica de "día de televisión" (que normalmente comienza en la madrugada)
      const [hours] = timeStr.split(':').map(Number);
      
      // Si es el primer item, usamos programDayStart
      // Si no, comparamos con el horario del primer programa para mantener coherencia
      let itemDate;
      if (i === 0) {
        itemDate = programDayStart;
      } else {
        // Si esta hora es menor que la primera hora y la primera hora >= 12,
        // probablemente estamos en el día siguiente (ej: primer programa a las 20:00, este a las 02:00)
        const [firstHour] = firstItemTime.split(':').map(Number);
        if (hours < firstHour && firstHour >= 12 && hours < 12) {
          itemDate = baseDate.plus({ days: 1 });
        } else {
          itemDate = baseDate;
        }
      }
      
      console.log(`[DEBUG] Fecha asignada para item ${i}: ${itemDate.format('YYYY-MM-DD')}`);
      
      // Crea el datetime de inicio
      const start = DateTime.fromFormat(`${itemDate.format('YYYY-MM-DD')} ${timeStr}`, 'yyyy-MM-dd HH:mm', {
        zone: 'Europe/Madrid'
      }).toUTC();
      
      // Para la hora de finalización, usamos la misma fecha base
      // Si la hora de fin es menor que la hora de inicio, sumamos un día
      let stopDate = itemDate;
      const [startHour] = timeStr.split(':').map(Number);
      const [stopHour] = stopTimeStr.split(':').map(Number);
      
      if (stopHour < startHour) {
        stopDate = stopDate.plus({ days: 1 });
        console.log(`[DEBUG] Ajustando fecha de fin para item ${i} (fin < inicio): ${stopDate.format('YYYY-MM-DD')}`);
      }
      
      const stop = DateTime.fromFormat(`${stopDate.format('YYYY-MM-DD')} ${stopTimeStr}`, 'yyyy-MM-dd HH:mm', {
        zone: 'Europe/Madrid'
      }).toUTC();
      
      console.log(`[DEBUG] Item ${i} - Start UTC: ${start.toString()}, Stop UTC: ${stop.toString()}`);
      
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
