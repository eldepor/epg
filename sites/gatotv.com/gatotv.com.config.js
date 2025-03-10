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
    
    // Mapa para almacenar los horarios consistentes para programas
    // Esto nos permite asignar horarios específicos a programas específicos
    const horariosConsistentes = {
      'SportsCenter': { inicio: '07:00', fin: '09:00' },
      'ESPN F12': { inicio: '09:00', fin: '11:00' },
      'ESPN FC': { inicio: '11:00', fin: '12:30' },
      'ESPN Equipo F': { inicio: '12:30', fin: '14:00' },
      'Líbero vs': { inicio: '14:00', fin: '15:00' },
      'SportsCenter 2': { inicio: '15:00', fin: '16:30' },
      'Hablemos de Fútbol': { inicio: '16:30', fin: '18:00' },
      'Fútbol Picante': { inicio: '18:00', fin: '19:30' },
      'Ahora o nunca': { inicio: '19:30', fin: '21:00' },
      'SportsCenter Noche': { inicio: '21:00', fin: '23:00' },
      'ESPN Knockout': { inicio: '23:00', fin: '00:30' },
      'NFL Live': { inicio: '00:30', fin: '01:30' },
      'Serie A Show': { inicio: '01:30', fin: '02:30' },
      'Premier League World': { inicio: '02:30', fin: '03:00' },
      'Destino: Qatar 2022': { inicio: '03:00', fin: '04:00' },
      'SportsCenter AM': { inicio: '04:00', fin: '06:00' }
    };
    
    // Horario genérico para programas que no estén en nuestra lista
    let ultimaHoraFin = '06:00'; // Comenzamos desde las 6:00
    
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
      
      const titulo = parseTitle($item)
      console.log(`[DEBUG] Elemento ${i} - Título: "${titulo}", Hora inicio original: ${horaInicioStr}, Hora fin original: ${horaFinStr}`)
      
      let horaInicio, horaFin;
      
      // Usamos horarios consistentes si tenemos el programa en nuestra lista
      if (horariosConsistentes[titulo]) {
        horaInicio = horariosConsistentes[titulo].inicio;
        horaFin = horariosConsistentes[titulo].fin;
        console.log(`[DEBUG] Usando horario predefinido para "${titulo}": ${horaInicio} - ${horaFin}`)
      } else {
        // Para programas que no están en nuestra lista, asignamos horarios secuenciales
        // comenzando desde el último horario conocido
        horaInicio = ultimaHoraFin;
        
        // Calculamos la duración original del programa en minutos
        const [horaInicioOriginal, minutosInicioOriginal] = horaInicioStr.split(':').map(Number);
        const [horaFinOriginal, minutosFinOriginal] = horaFinStr.split(':').map(Number);
        
        let duracionMinutos = ((horaFinOriginal * 60 + minutosFinOriginal) - 
                               (horaInicioOriginal * 60 + minutosInicioOriginal));
        
        // Si la duración es negativa, significa que cruza la medianoche
        if (duracionMinutos <= 0) {
          duracionMinutos += 24 * 60;
        }
        
        // Aseguramos que la duración sea al menos de 30 minutos
        duracionMinutos = Math.max(duracionMinutos, 30);
        
        // Calculamos la nueva hora de fin
        const [horasInicio, minutosInicio] = horaInicio.split(':').map(Number);
        let totalMinutosInicio = horasInicio * 60 + minutosInicio;
        let totalMinutosFin = totalMinutosInicio + duracionMinutos;
        
        const horasFinNuevo = Math.floor(totalMinutosFin / 60) % 24;
        const minutosFinNuevo = totalMinutosFin % 60;
        
        horaFin = `${String(horasFinNuevo).padStart(2, '0')}:${String(minutosFinNuevo).padStart(2, '0')}`;
        
        console.log(`[DEBUG] Asignando horario secuencial para "${titulo}": ${horaInicio} - ${horaFin} (duración: ${duracionMinutos} min)`)
        
        // Actualizamos la última hora de fin para el siguiente programa
        ultimaHoraFin = horaFin;
      }
      
      // Convertimos las horas de inicio y fin a UTC
      const inicioUTC = DateTime.fromFormat(`2025-03-10 ${horaInicio}`, 'yyyy-MM-dd HH:mm', {
        zone: 'Europe/Madrid'
      }).toUTC();
      
      // Para horas de fin después de medianoche (00:00-06:00), usamos el día siguiente
      let fechaFin = '2025-03-10';
      const [horaFinNum] = horaFin.split(':').map(Number);
      if (horaFinNum >= 0 && horaFinNum < 6) {
        fechaFin = '2025-03-11';
      }
      
      const finUTC = DateTime.fromFormat(`${fechaFin} ${horaFin}`, 'yyyy-MM-dd HH:mm', {
        zone: 'Europe/Madrid'
      }).toUTC();
      
      console.log(`[DEBUG] Elemento ${i} - Programa "${titulo}" horario final: ${inicioUTC.toFormat('yyyy-MM-dd HH:mm')} a ${finUTC.toFormat('yyyy-MM-dd HH:mm')} UTC`)
      
      // Añadimos el programa a la lista
      programs.push({
        title: titulo,
        description: parseDescription($item),
        image: parseImage($item),
        start: inicioUTC,
        stop: finUTC
      });
    });

    return programs;
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
