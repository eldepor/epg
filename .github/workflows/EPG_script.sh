#!/bin/bash

# Forzar UTF-8 en el entorno
export LC_ALL=C.UTF-8
export LANG=C.UTF-8
export LANGUAGE=C.UTF-8

# Eliminar líneas en blanco del archivo epgs.txt
grep -v '^ *$' epgs.txt > epgs_temp.txt && mv epgs_temp.txt epgs.txt

# Eliminar archivos temporales previos
rm -f EPG_temp*

date_stamp=$(date +"%d/%m/%Y %R")
echo '<?xml version="1.0" encoding="UTF-8"?>' > EPGTOTAL.xml
echo "<tv generator-info-name=\"dobleM $date_stamp\" generator-info-url=\"t.me/EPG_dobleM\">" >> EPGTOTAL.xml

while IFS=, read -r epg
do
    extension="${epg##*.}"
    if [ "$extension" = "gz" ]; then
        echo "Descomprimiendo archivo: $epg"
        gzip -d -c "$epg" > EPG_temp00.xml
    else
        echo "Procesando archivo: $epg"
        cp "$epg" EPG_temp00.xml
    fi

    # Convertir el archivo a UTF-8 si no lo está
    file_encoding=$(file -i EPG_temp00.xml | awk -F'charset=' '{print $2}')
    if [ "$file_encoding" != "utf-8" ]; then
        iconv -f "$file_encoding" -t UTF-8//IGNORE EPG_temp00.xml -o EPG_temp00.xml
    fi

    cat EPG_temp00.xml > EPG_temp.xml

    # Extraer datos asegurando compatibilidad con UTF-8
    gawk '/<channel id="/,/<\/channel>/' EPG_temp.xml >> EPG_temp_channel.xml
    gawk '/<programme/,/<\/programme>/' EPG_temp.xml >> EPG_temp_programme.xml

done < epgs.txt

cat EPG_temp_channel.xml >> EPGTOTAL.xml
cat EPG_temp_programme.xml >> EPGTOTAL.xml

echo '</tv>' >> EPGTOTAL.xml

# Convertir archivo final a UTF-8 si es necesario
file_encoding=$(file -i EPGTOTAL.xml | awk -F'charset=' '{print $2}')
if [ "$file_encoding" != "utf-8" ]; then
    iconv -f "$file_encoding" -t UTF-8//IGNORE EPGTOTAL.xml -o EPGTOTAL.xml
fi

# Eliminar archivos temporales
rm -f EPG_temp*
