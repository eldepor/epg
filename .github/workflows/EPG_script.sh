#!/bin/bash

export LC_ALL=C.UTF-8
export LANG=C.UTF-8
export LANGUAGE=C.UTF-8

sed -i '/^ *$/d' epgs.txt

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
	cat EPG_temp00.xml > EPG_temp.xml


	awk '/<channel id="/,/<\/channel>/' EPG_temp.xml >> EPG_temp_channel.xml
	awk '/<programme/,/<\/programme>/' EPG_temp.xml >> EPG_temp_programme.xml


done < epgs.txt

cat EPG_temp_channel.xml >> EPGTOTAL.xml
cat EPG_temp_programme.xml >> EPGTOTAL.xml

echo '</tv>' >> EPGTOTAL.xml

rm -f EPG_temp*
