#!/bin/bash

sed -i '/^ *$/d' epgs.txt
#sed -i '/^ *$/d' canales.txt

rm -f EPG_temp*

	date_stamp=$(date +"%d/%m/%Y %R") 
	echo '<?xml version="1.0" encoding="UTF-8"?>' > EPGTOTAL.xml 
	echo "<tv generator-info-name=\"dobleM $date_stamp\" generator-info-url=\"t.me/EPG_dobleM\">" >> EPGTOTAL.xml 

 	while IFS=, read -r epg
	do
 		extension="${epg##*.}"
		if [ $extension = "gz" ]; then
			echo Descargando y descomprimiendo epg
			wget -O EPG_temp00.xml.gz -q ${epg}
      			gzip -d -f EPG_temp00.xml.gz
	  	else
			echo Descargando epg
			wget -O EPG_temp00.xml -q ${epg}
		fi
  	cat EPG_temp00.xml >> EPG_temp.xml
	
	
	awk '/<channel id="/,/<\/channel>/' EPG_temp.xml >> EPG_temp_channel.xml
	awk '/<programme/,/<\/programme>/' EPG_temp.xml >> EPG_temp_programme.xml
	
	#sed -n '/<channel id="/,/<\/channel>/p' EPG_temp.xml | grep -E '<channel|<\/channel>' >> EPGTOTAL.xml
	#sed -n '/<channel id=/,/<\/channel/p' EPG_temp.xml >> EPGTOTAL.xml 
	#sed -n '/<programme/,/<\/programme/p' EPG_temp.xml >> EPGTOTAL.xml
	
	done < epgs.txt
	
	cat EPG_temp_channel.xml >> EPGTOTAL.xml
	cat EPG_temp_programme.xml >> EPGTOTAL.xml

	echo '</tv>' >> EPGTOTAL.xml



rm -f EPG_temp*
